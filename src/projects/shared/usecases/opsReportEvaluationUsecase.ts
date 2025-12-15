import { ClaudeRecursiveReportGenerator } from "@core/application/services/claude/claudeRecursiveReportGenerator";
import { OpsSheetHandler } from "@projects/shared/application/services/opsSheetHandler";
import {
  REPEAT_TIMES,
  RETRY_STRATEGY,
} from "@core/application/services/claude/helpers/claudeRecursiveReportGeneratorDefaultSettings";
import { parseEvaluationFromText } from "./helpers/opsReportEvaluation/evaluationJsonParser";
import { SlackRepository } from "@core/domain/repositories/slack/slackRepository";
import { Report } from "@core/domain/entities/report";
import { PromptComplianceError } from "@core/domain/errors/promptComplianceError";
import { executeWithRetry, type RetryStrategy } from "sample-mcp-kit";
import { randomBytes } from "crypto";
import { reportToText } from "@core/domain/services/reportFormatter";

export type DatadogAnalysisResult = {
  logAnalysisReport: Report;
  codeInvestigationReport: Report;
  sqlReport: Report;
  datadogUrl: string;
  rawLogs: string;
};

export const formatDatadogAnalysisAsText = (
  result: DatadogAnalysisResult,
): string =>
  [
    "### Datadogログ分析結果（Stage 1）",
    reportToText(result.logAnalysisReport),
    "",
    "### コード原因特定結果（Stage 2）",
    reportToText(result.codeInvestigationReport),
    "",
    "### 確認用SQL（Stage 3）",
    (result.sqlReport.overwritableInfo as string) ??
      result.sqlReport.logicSummary,
    "",
    "【確認済み事実】",
    ...result.sqlReport.confirmedFacts.map((fact) => `- ${fact}`),
    "",
    "【不明点】",
    ...result.sqlReport.missingInformation.map((info) => `- ${info}`),
    "",
    "### 元のDatadog URL",
    result.datadogUrl,
  ].join("\n");

const EVALUATION_MAX_RETRIES = 5;

const generateRowId = (): string => randomBytes(4).toString("hex");

export type EvaluationPayload = {
  shouldSave: boolean;
  content: string[][];
  stampName: string;
  matchedEntryId: string | null;
};

export type OpsReportEvaluationResult = EvaluationPayload & {
  evaluationReport: Report;
};

export interface OpsReportEvaluationUsecase {
  evaluate: (
    datadogAnalysisResult: DatadogAnalysisResult,
    slackUrl: string,
    sheetContents: string,
    isDryRun?: boolean,
    additionalPrompt?: string,
  ) => Promise<OpsReportEvaluationResult>;
}

/**
 * エラーについての評価を行うユースケース
 */
export const makeOpsReportEvaluationUsecase = (deps: {
  claudeRecursiveReportGenerator: ClaudeRecursiveReportGenerator;
  opsSheetHandler: OpsSheetHandler;
  slackRepository: SlackRepository;
}): OpsReportEvaluationUsecase => {
  const evaluate = async (
    datadogAnalysisResult: DatadogAnalysisResult,
    slackUrl: string,
    sheetContents: string,
    isDryRun = false,
    additionalPrompt = "",
  ): Promise<OpsReportEvaluationResult> => {
    const datadogAnalysisText = formatDatadogAnalysisAsText(
      datadogAnalysisResult,
    );
    const prompt = evaluationPrompt(
      datadogAnalysisText,
      slackUrl,
      sheetContents,
      additionalPrompt,
    );

    const evaluationRetryStrategy: RetryStrategy<{
      evaluationReport: Report;
      evaluationPayload: EvaluationPayload;
    }> = {
      maxRetries: EVALUATION_MAX_RETRIES,
      shouldRetry: (error) => {
        if (error instanceof PromptComplianceError) {
          console.warn(
            `[OpsReportEvaluationUsecase] 評価結果のパースに失敗しました。リトライします。`,
          );
          return true;
        }
        return false;
      },
      getWaitTime: (_error, attempt) => attempt * 1000,
    };

    const { evaluationReport, evaluationPayload } = await executeWithRetry(
      async () => {
        const report = await deps.claudeRecursiveReportGenerator.invoke(
          prompt,
          {
            mapNames: ["google", "slack", "local"],
            additionalSystemPrompts: [],
            repeatTimes: REPEAT_TIMES,
            retryStrategy: RETRY_STRATEGY,
          },
        );
        const payload = parseEvaluationFromText(report.logicSummary);
        return { evaluationReport: report, evaluationPayload: payload };
      },
      evaluationRetryStrategy,
    );

    // 列1（index 0）にユニークIDを設定、列3（index 2）に元のDatadogログを追記、列5（index 4）のnullをSQLで上書き
    evaluationPayload.content = evaluationPayload.content.map((row) => {
      const newRow = [...row];
      newRow[0] = generateRowId();
      const rawLogs = datadogAnalysisResult.rawLogs;
      newRow[2] = `${newRow[2]}\n\n---\n【元のDatadogログ】\n${rawLogs}`;
      newRow[4] =
        (datadogAnalysisResult.sqlReport.overwritableInfo as string) ??
        datadogAnalysisResult.sqlReport.logicSummary;
      return newRow;
    });

    if (evaluationPayload.shouldSave && evaluationPayload.content.length > 0) {
      const appendResult = await deps.opsSheetHandler.appendValues(
        evaluationPayload.content,
      );

      if (!appendResult.success) {
        console.error(
          `[OpsReportEvaluationUsecase] シートへの追記に失敗しましたが、評価は続行されます。content=${evaluationPayload.content} message=${appendResult.message}`,
        );
      }
    }

    console.log(
      `[OpsReportEvaluationUsecase] Selected stamp: ${evaluationPayload.stampName}`,
    );

    if (!isDryRun) {
      const stampResult = await deps.slackRepository.addReaction(
        slackUrl,
        evaluationPayload.stampName,
      );

      if (!stampResult.isSuccess) {
        console.error(
          `[OpsReportEvaluationUsecase] スタンプの追加に失敗しました。stampName=${evaluationPayload.stampName} message=${stampResult.message}`,
        );
      }

      // 最後に必ずai-checkリアクションをつける
      await deps.slackRepository.addReaction(slackUrl, "ai-check");
    } else {
      console.log(
        `[OpsReportEvaluationUsecase] 🔒 Dry Run mode: Skipping reactions`,
      );
    }

    return { ...evaluationPayload, evaluationReport };
  };

  return {
    evaluate,
  };
};

/**
 * datadogAnalysisResultの内容がシートに既に存在するかチェックし、新規内容があれば保存するか判断するプロンプト
 */
export const evaluationPrompt = (
  datadogAnalysisResult: string,
  slackUrl: string,
  sheetContents: string,
  additionalPrompt: string,
): string => {
  return `
  ### 重要指令：
  あなたは「2次オペ対応シートの重複チェックと新規内容の抽出」を担当する分析官です。
  報告書の内容が既にシートに存在するかどうかを判断し、新規で保存すべき内容を抽出してください。
  SlackのURLは"${slackUrl}"を使用してください。

  ### 出力フォーマット（厳守）:
  logicSummaryフィールドには、必ず以下の形式のJSONオブジェクトをJSON文字列としてエスケープして格納してください。
  logicSummaryに計画文、説明文、マークダウンなどのテキストを入れることは厳禁です。必ずエスケープされたJSONのみを入れてください。

  logicSummaryの中身（JSONオブジェクト）:
  {
    "shouldSave": boolean,
    "content": string[][],
    "stampName": "seikan" | "retry" | "youkakunin",
    "matchedEntryId": string | null
  }

  完全な出力例（shouldSave=true、シートに類似エントリなし）:
  {
    "status": "completed",
    "confirmedFacts": ["シートに同一パターンのエラーが存在しない", "認証トークン期限切れによるエラー"],
    "sourceUrls": [],
    "missingInformation": [],
    "logicSummary": "{\\"shouldSave\\":true,\\"content\\":[[\\"\\",\\"2026/03/06 05:20:34\\",\\"Rakuten 在庫同期失敗（401 Unauthorized）\\",\\"認証トークンの期限切れ\\",null,\\"${slackUrl}\\"]],\\"stampName\\":\\"seikan\\",\\"matchedEntryId\\":null}"
  }

  完全な出力例（shouldSave=false、シートに類似エントリあり）:
  {
    "status": "completed",
    "confirmedFacts": ["シートのID=a1b2c3d4に同一パターンのRakuten認証エラーが記録済み"],
    "sourceUrls": [],
    "missingInformation": [],
    "logicSummary": "{\\"shouldSave\\":false,\\"content\\":[],\\"stampName\\":\\"seikan\\",\\"matchedEntryId\\":\\"a1b2c3d4\\"}"
  }

  **stampNameは必須です**: 必ず "seikan", "retry", "youkakunin" のいずれかを選択してください。スタンプなしは許可されません。

  ### 評価判断基準:
  **重要: shouldSaveとstampNameは独立した判断です。stampNameが"seikan"でも、シートに類似エントリがなければshouldSave=trueです。**
  1. **shouldSave**: シートに同一パターンのエントリが既に存在するかどうかで判断する。存在しなければ true、存在すれば false。stampNameの値とは無関係。
  2. **content**: shouldSaveがtrueの場合、シートに追記すべき新規内容を配列の配列で出力してください。各要素（配列）は1行としてシートに追記され、配列の各要素は1つのセルに対応します。
  3. **stampName**: 以下のルールに従って、必ずいずれかのスタンプ名を出力してください（優先度順）：

     #### スタンプ分類ルール（優先度順に判定すること）:

     **1. "seikan"（静観）** — エラーが発生しているが、オペレーション側では対応不要と判断できる場合
        以下のいずれかに該当する場合に選択する:
        - DuplicateEntry等、データ自体は正常に保存されているがタイミングの問題でエラーが発生している場合
        - 一時的なアクセスエラーであり、次回のアクセスでは正常に処理される可能性が高い場合
        - 認証トークンの期限切れ等、こちら側では対処できない外部要因の場合（在庫同期や出荷実績連携の失敗を伴っていても、トークンが復旧しない限りリトライしても無意味なため静観とする）
        - 対象の商品や注文がすでに削除されており、API経由でアクセスできない場合
        - 広い意味で荷主側やEC事業者側の問題であり、オペレーション側からは何も対応できない場合
        **注意**: 認証エラー（401 Unauthorized等）が原因で在庫同期や出荷実績連携が失敗している場合、データの未反映が発生するが、これは荷主側がトークンを更新しない限り解決しないため"seikan"とする。リコンサイルやリトライでも認証が通らなければ復旧しないため"retry"ではない。

     **2. "retry"（リトライ）** — エラーが発生し、データの整合性に問題があるが、定期実行やリコンサイルにより自動復旧が見込まれる場合
        以下の条件をすべて満たす場合に選択する:
        - データ不整合が存在するが、次回の定期実行（リコンサイル、バッチ処理等）で自動的に修正される見込みがある
        この場合、回答に以下を必ず含めること:
        - 確認用SQLまたは確認手順（データ整合性の状態を確認するため）
        - 自動復旧を行うジョブ名・定期実行のスケジュール（どの処理がいつリトライするか）
        - 実装上の問題が存在する場合はその内容も含める

     **3. "youkakunin"（要確認）** — エラーが発生し、データの整合性に問題があり、自動復旧の見込みがない場合。または、判断がつかない場合
        以下のいずれかに該当する場合に選択する:
        - データ不整合があり、定期実行やリトライでは解決できない場合
        - 手動でのリカバリ操作が必要な場合
        - 上記の「seikan」「retry」のどちらにも該当しないと判断した場合
        - 情報が不足しており、正確な判断ができない場合
        この場合、回答に以下を必ず含めること:
        - 確認用SQLまたは確認手順
        - リカバリを行うための具体的な操作手順や必要な情報
        - 実装上の問題が存在する場合はその内容も含める
        - 2次オペ対応シートにすでに類似の対応記録がある場合は、該当するシートのリンクのみ返す

  5. **matchedEntryId**: shouldSave=falseの場合、一致した既存エントリのID（シートの列1の値）を設定してください。shouldSave=trueの場合はnullを設定してください。

  ### シートの列構造:
  シートの各行は以下の列構造を持ちます：
  - 列1: ID（システムが自動生成するため、contentでは空文字""を設定すること）
  - 列2: 日時（例: "2026/02/02 05:52:33"）
  - 列3: エラー内容（例: "BASE 注文情報の更新分の取得に失敗（API制限エラー）"）
  - 列4: 原因・対応などの詳細情報（例: "【原因】BASEのAPI制限...【対応】..."）
  - 列5: 必ずnullを設定（システムがDatadog分析結果で上書きします）
  - 列6: SlackのURL

  contentの各要素は、必ず6列の配列として出力してください。
  例: [["", "2026/02/02 05:52:33", "エラー内容", "原因・対応", null, "URL"]]

  ### shouldSaveの判定ルール（最重要）:
  **大原則: シートが空、またはシートに同一パターンのエントリが存在しない場合は、必ずshouldSave=trueとすること。**
  stampNameの値（seikan/retry/youkakunin）とshouldSaveは完全に独立した判断である。seikanであっても、シートに記録がなければshouldSave=trueである。

  shouldSave=falseにしてよいのは、シートに同一パターンのエントリが既に存在する場合のみ:
  - 同じ根本原因・同じ解決策のエントリが存在し、新たな知見がない場合
  - 「対応不要」「リトライで自動解決」として記録済みのエラーが同一条件で再発した場合
  - タイトルや日時が異なっていても、原因・対応・結論が既存エントリと実質同一な場合

  ${additionalPrompt}

  ---
  ### 【Datadog分析結果】:
  ${datadogAnalysisResult}

  ---
  ### 【現在のシート内容】:
  ※ 各行の先頭列にIDが付いています。既存エントリとの重複判定に使用してください。
  ${sheetContents}
  `.trim();
};
