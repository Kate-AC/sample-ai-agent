import { ClaudeRecursiveReportGenerator } from "@core/application/services/claude/claudeRecursiveReportGenerator";
import { RETRY_STRATEGY } from "@core/application/services/claude/helpers/claudeRecursiveReportGeneratorDefaultSettings";
import { Report } from "@core/domain/entities/report";
import { LocalRepository } from "@core/domain/repositories/local/localRepository";
import { ScheduleYamlGetter } from "@projects/shared/application/services/scheduleYamlGetter";
import { reportToText } from "@core/domain/services/reportFormatter";

export interface CodeInvestigationUsecase {
  invoke: (datadogUrl: string, logAnalysisReport: Report) => Promise<Report>;
}

export const makeCodeInvestigationUsecase = (deps: {
  claudeRecursiveReportGenerator: ClaudeRecursiveReportGenerator;
  localRepository: LocalRepository;
  scheduleYamlGetter: ScheduleYamlGetter;
}): CodeInvestigationUsecase => {
  return {
    invoke: async (
      datadogUrl: string,
      logAnalysisReport: Report,
      dirsNames = ["sample-service", "sample-api"],
    ): Promise<Report> => {
      const dirs = await deps.localRepository.findDirsByName(dirsNames);

      const scheduleYamlContent = await deps.scheduleYamlGetter.invoke();

      const questionPrompt = codeInvestigationQuestionPrompt({
        datadogUrl,
        logAnalysisReport: reportToText(logAnalysisReport),
      });

      console.log(`[CodeInvestigation] Starting code investigation...`);

      const report = await deps.claudeRecursiveReportGenerator.invoke(
        questionPrompt,
        {
          mapNames: ["local"],
          additionalSystemPrompts: [
            codeInvestigationSystemPrompt(dirs, scheduleYamlContent),
          ],
          repeatTimes: 20,
          retryStrategy: RETRY_STRATEGY,
          // コード調査の正確性が重要なためSonnetを使用
          modelId: "jp.anthropic.claude-sonnet-4-5-20250929-v1:0",
        },
      );

      console.log(
        `[CodeInvestigation] Completed. logicSummary length: ${report.logicSummary.length}`,
      );

      return report;
    },
  };
};

/**
 * コード原因特定用プロンプト
 * MCP: local のみ
 * 目的: Stage 1のDatadogログ分析結果を受けて、問題のあるコードを調査しエラー原因を特定する
 */
const codeInvestigationSystemPrompt = (
  dirs: string[],
  scheduleYamlContent: string,
) =>
  [
    "【目的】",
    "Datadogログ分析の結果を受けて、エラーが発生しているコードを特定し、原因を調査する。",
    "",
    "【最重要ルール】",
    "- クラス名やメソッド名を推測してはならない。必ずsearchCodeで検索し、readFileで読んで確認すること",
    "- confirmedFactsにはコードで確認した事実のみ断定形で書くこと。「推定」「可能性」「と思われる」は禁止",
    "- 確認できていない点はmissingInformationに記載すること",
    "- ログのjob_classはジョブの外殻であり、例外の直接の呼び出し元ではないことが多い。例外はjob内部で発火するListener/EventHandler等から発生する。(b)のsearchCode結果にListenerがあれば、job_classよりもListenerを先に読むこと",
    "",
    "【調査手順】",
    "",
    "ステップ1: 例外の発生箇所と呼び出し元を特定する",
    "最初のレスポンスで以下の3検索を同時にtool_useすること：",
    "  (a) ログのprevious.fileをreadFileで読み、throwの条件を確認する",
    "  (b) throwしているクラス名でsearchCodeし、dispatch/newしている箇所を全件列挙する",
    "  (c) ログのexception.messageのcontext内のキー名（例: fulfillment_order_id）でsearchCodeする",
    "(b)の結果に出現するファイルを**すべて**readFileすること。1件見つかった時点で止まってはならない。",
    "※ (b)の結果にListenerやEventHandlerがあれば、Workflow/Serviceよりも先にそちらを読むこと",
    "",
    "ステップ1.5: contextキー照合でListenerを絞り込む【省略不可】",
    "このステップはステップ1で候補が1件しかなくても必ず実行すること。",
    "- (b)で列挙した全候補のcatch節（ListenerExceptionReporter::reportError）を読み、渡されるキー集合を一覧にまとめる",
    "- ログのcontextに含まれるキーの集合と各候補のキー集合を照合し、完全一致するものを特定する",
    "  例: ログにfulfillment_order_idのみ → catch節にfulfillment_order_idのみ渡しているListenerが正解",
    "  例: ログにorder_id・product_id・variant_idも含む → それらを渡しているListenerが正解",
    "- キーが多い候補・少ない候補は除外する。「含む」ではなく「完全一致」で判定すること",
    "- 照合結果の表（候補名 | catch節のキー一覧 | 一致/不一致）をconfirmedFactsに含めること",
    "",
    "ステップ2: ジョブの実行トリガーを特定する",
    "- ログのjob_classから、実行方法を特定する：",
    "  A. 定期実行: 下記schedule.yamlを参照",
    "  B. イベント起点: コード上でジョブクラス名を検索し、dispatch箇所を特定",
    "  C. API起点: routes/api.php等でエンドポイントを特定",
    "",
    "ステップ3: エラー原因を判定する",
    "- A. コード上のバグ → バグの原因箇所をコード上で特定する",
    "- B. 外部要因（API認証切れ、バリデーションエラー等）→ コードにバグはないことを確認し、外部要因を明記する",
    "- 判定基準: コードが想定すべきデータパターン（null, 空コレクション等）をハンドリングせずに例外を投げている場合はコードバグ（A）である。「データが異常」は理由にならない。filter/map後に空チェックなしでdispatchしていればバグ。",
    "",
    "ステップ4: 自動復旧の見込みを判定する",
    "- 一時的なエラー → リトライで解決される可能性あり",
    "- 永続的なエラー（認証切れ、データ不整合、バグ等）→ リトライでは解決されない",
    "",
    "【検索パス】",
    "searchCodeのrootPathは必ず以下のディレクトリを個別に指定すること：",
    ...dirs.map((dir) => `- ${dir}`),
    "",
    "【schedule.yaml】",
    "```yaml",
    scheduleYamlContent,
    "```",
    "",
    "【調査完了の条件】",
    '- statusを"completed"にしてよいのは以下のすべてを満たした場合のみ：',
    "  1. 呼び出し元のListener/Job/Controllerをコード上で特定できた（クラス名の推測ではなく、searchCode→readFileで確認済み）",
    "  2. エラー原因がコードのバグか外部要因かを判定できた",
    "  3. 自動復旧の見込みを判定できた",
    "",
    "【confirmedFactsに含めること】",
    "- 呼び出し元の正確なクラス名とファイルパス（ステップ1.5のcontextキー照合で絞り込んだもの。必ず記載すること）",
    "- エラー原因の判定結果とその根拠（コードの該当行を引用）",
    "- ジョブの実行トリガー",
    "- 自動復旧の見込み",
    "",
    "【ツール使用】",
    "- 1回のレスポンスで5〜10件のtool_useを同時にリクエストせよ",
    "- 同じファイルを2回以上readしない",
    "- searchCodeのcontextLinesは5以下。詳細確認はreadFileで行う",
  ].join("\n");

const codeInvestigationQuestionPrompt = (params: {
  datadogUrl: string;
  logAnalysisReport: string;
}) =>
  [
    "以下のDatadogログ分析結果を元に、エラー原因をコード上で特定してください。",
    "",
    "【Datadog URL】",
    params.datadogUrl,
    "",
    "【Datadogログ分析結果】",
    params.logAnalysisReport,
    "",
    "【重要】",
    "- コードをreadFileで実際に読んで確認した事実のみ記載すること",
    "- クラス名を推測してはならない。searchCodeで検索→readFileで確認のプロセスを必ず踏むこと",
    "- 対応手順・確認用SQLは記載不要（後続のステップで作成するため）",
  ].join("\n");
