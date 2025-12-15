import { ClaudeRecursiveReportGenerator } from "@core/application/services/claude/claudeRecursiveReportGenerator";
import { RETRY_STRATEGY } from "@core/application/services/claude/helpers/claudeRecursiveReportGeneratorDefaultSettings";
import { Report } from "@core/domain/entities/report";
import { LocalRepository } from "@core/domain/repositories/local/localRepository";
import { reportToText } from "@core/domain/services/reportFormatter";

export interface SqlGenerationUsecase {
  invoke: (
    logAnalysisReport: Report,
    codeInvestigationReport: Report,
    dirsNames?: string[],
    additionalPrompts?: string,
  ) => Promise<Report>;
}

export const makeSqlGenerationUsecase = (deps: {
  claudeRecursiveReportGenerator: ClaudeRecursiveReportGenerator;
  localRepository: LocalRepository;
}): SqlGenerationUsecase => {
  return {
    invoke: async (
      logAnalysisReport: Report,
      codeInvestigationReport: Report,
      dirsNames = ["sample-service", "sample-api"],
      additionalPrompts = "",
    ): Promise<Report> => {
      const dirs = await deps.localRepository.findDirsByName(dirsNames);

      const questionPrompt = sqlGenerationQuestionPrompt({
        logAnalysisReport: reportToText(logAnalysisReport),
        codeInvestigationReport: reportToText(codeInvestigationReport),
      });

      console.log(`[SqlGeneration] Generating verification SQL...`);

      const report = await deps.claudeRecursiveReportGenerator.invoke(
        questionPrompt,
        {
          mapNames: ["local", "github"],
          additionalSystemPrompts: [
            sqlGenerationSystemPrompt(dirs, additionalPrompts),
          ],
          excludeTools: ["github_listRepositoryContents"],
          repeatTimes: 40,
          retryStrategy: RETRY_STRATEGY,
        },
      );

      console.log(
        `[SqlGeneration] Completed. logicSummary length: ${report.logicSummary.length}`,
      );

      return report;
    },
  };
};

/**
 * 確認用SQL生成プロンプト
 * MCP: local, github
 * 目的: Stage 2のコード調査結果を元に、Eloquentモデルからテーブル名を特定し、
 *       DBスキーマと照合して正確なSQLを生成する
 */
const sqlGenerationSystemPrompt = (dirs: string[], additionalPrompts: string) =>
  [
    "【目的】",
    "コード調査結果を元に、エラーに関連するデータの確認用SQLを生成する。",
    "Eloquentモデルのコードを読んでテーブル名を特定し、DBスキーマファイルで実在するカラム名を確認した上で、正確なSQLを作成する。",
    "",
    "【絶対ルール】",
    "- テーブル名: 必ずEloquentモデルの$tableプロパティから取得すること。クラス名からの推測は禁止",
    "- SELECT句は常に `SELECT *` を使用すること。個別カラムの列挙は禁止（理由: スキーマ調査で得たカラム名にタイポがあると構文エラーになる。確認用SQLでは全カラム取得が最も安全かつ有用）",
    "  - NG: SELECT id, status, shop_id, created_at FROM ...",
    "  - OK: SELECT * FROM ...",
    "",
    "【注意】",
    "- Domain層のEntity/Modelはビジネスロジック用であり、DBテーブルと直接対応しない",
    "- 実際のテーブル構造はInfrastructure/Eloquent層のクラス（$tableプロパティ）を確認すること",
    "- 例: Domain層の OrderLineItem クラス → order_line_items テーブルとは限らない。Eloquentモデルの$tableを確認せよ",
    "",
    "【在庫同期（StockSync）エラーの注意事項】",
    "- shop_items.stock_quantityカラムは在庫同期では使用されていない。shop_itemsテーブルで在庫数を確認してはならない",
    "- 在庫同期の状態確認には stock_sync_shop_item_statuses テーブルを使用すること",
    "",
    "【JOINの結合条件ルール】",
    "- テーブル間のJOINを書く場合、結合カラムの対応関係を必ずEloquentモデルのリレーション定義（belongsTo, hasMany等）またはDBスキーマファイルのカラムコメントで確認すること",
    "- カラム名が同じ（例: shop_id）でも、参照先テーブルのPK（id）と結合できるとは限らない（shop_idカラムの参照先はテーブルによって異なるため）",
    "- JOINを書く前に、両側のカラムが何を表すかをスキーマファイルのコメントまたはEloquentモデルのPHPDocで確認すること",
    "- 【よくある間違い】多くのテーブルのPKは `id` であり `{テーブル名}_id` ではない。例: shop_items.id であって shop_items.shop_item_id ではない。外部キー名（例: stock_sync_shop_item_statuses.shop_item_id）と参照先のPK名（例: shop_items.id）は異なることに注意",
    "- confirmedFactsに「JOIN確認: {テーブルA}.{カラムX} = {テーブルB}.{カラムY}（根拠: ...）」を記載する",
    "",
    additionalPrompts,
    "",
    "【手順】",
    "",
    "ステップ1: 関連するEloquentモデルを特定する",
    "- コード調査結果に記載されたクラス名・ファイルパスを元に、関連するEloquentモデルを検索する",
    "- Domain層のEntityではなく、Infrastructure/Eloquent層のクラスを探すこと",
    "- 検索のrootPathは必ず下記【検索パス】に記載されたディレクトリを個別に指定すること",
    "- Eloquentモデルを見つけたらreadFileで$tableプロパティを確認する",
    "- confirmedFactsに「Eloquentモデル: {クラス名} → $table = '{テーブル名}'」を記載する",
    "",
    "ステップ2: DBスキーマファイルでテーブルの存在を確認する",
    "- ステップ1で特定したテーブル名を、github_getFileContentでスキーマファイルから確認する",
    "- まずREADME.mdでテーブル一覧を確認し、該当テーブルが存在することを確認する",
    "  - sample-service: apiPath=/repos/example-org/sample-service/contents/README.md, ref=dbdoc",
    "  - sample-api: apiPath=/repos/example-org/sample-api-dbdoc/contents/schema/README.md, ref=master",
    "- JOIN条件やWHERE句で使用するカラム名の確認が必要な場合のみ、個別テーブルのスキーマファイルを取得する",
    "  - sample-service: apiPath=/repos/example-org/sample-service/contents/{table_name}.md, ref=dbdoc",
    "  - sample-api: apiPath=/repos/example-org/sample-api-dbdoc/contents/schema/{table_name}.md, ref=master",
    "- confirmedFactsに「スキーマ確認: {テーブル名}テーブルの存在を確認」を記載する",
    "",
    "ステップ3: ステータスカラムのenum値を確認する",
    "- SQLのコメントでステータス値に言及する場合、必ずEloquentモデルからenumクラスを辿って正確な値を確認すること",
    "- このステップを省略してはならない。ステータス値を推測してコメントに書くことは禁止",
    "",
    "ステップ4: SQLを作成してoverwritableInfoに記載する",
    "- SELECT句は必ず `SELECT *` とすること。SELECT id, status, ... のようなカラム列挙は絶対に禁止",
    "- WHERE句でステータス値による絞り込みをしないこと。ステータスで絞るとヒットしない場合があり確認に使えない",
    "- 代わりに、SQLコメントで確認観点を記載する（例: '-- statusがfailedのままなら未復旧、completedになっていれば復旧済み'）",
    "- コメントでステータス値に言及する場合、ステップ3でenum tracingにより確認した値のみを使うこと",
    "- WHERE句にはコード調査結果に含まれる具体的な値（企業コード、ID、UID等）と時間範囲で絞ること",
    "- 時間範囲で絞る場合、エラー発生時刻の1時間前〜5分後の区間を指定すること（処理開始がエラー発生より前のため、前方を広めに取る）",
    "- 【重要】DatadogのタイムスタンプはUTCである。DBはJST（UTC+9）で格納されているため、SQL内の時刻はUTC→JSTに変換すること（例: Datadog上の 02:12 UTC → SQLでは 11:12 JST）",
    "",
    "【overwritableInfoの書き方 — 最重要ルール】",
    "- SQL文はASCII文字のみで記述すること。全角スペース・ノーブレークスペース・全角括弧などの非ASCII文字は使用禁止（MySQLの構文エラーの原因になる）",
    "- overwritableInfoには必ず実行可能なSQL文を記載すること",
    "- 「準備が整った」「確認できた」等の計画文・説明文・進捗報告を書くことは厳禁",
    "- テーブル名やカラム名の調査が完了していなくても、判明している情報だけでSQLを記載すること",
    "- 以下のフォーマットで記載すること：",
    "  ```",
    "  -- 現在の状態確認",
    "  SELECT * FROM ... WHERE ...;",
    "",
    "  -- 復旧確認（期待値: ...）",
    "  SELECT * FROM ... WHERE ...;",
    "  ```",
    "- SQLの前に簡潔な1行の説明を入れてもよいが、主体はSQL文であること",
    "- overwritableInfoにSQL文が1つも含まれていない場合は不合格とみなす",
    "- overwritableInfoに `SELECT *` 以外のSELECT句（カラム列挙）が含まれている場合も不合格とみなす",
    "",
    "【検索パス】",
    ...dirs.map((dir) => `- ${dir}`),
    "",
    "【調査完了の条件】",
    '- statusを"completed"にしてよいのは以下のすべてを満たした場合のみ：',
    "  1. Eloquentモデルの$tableプロパティからテーブル名を特定できた",
    "  2. github_getFileContentでDBスキーマファイルを取得し、テーブルの実在を確認できた",
    "  3. SQLで使用するステータスカラムについて、Eloquentモデル→enum tracingで正確な値を確認できた",
    "  4. 確認済みのテーブル名・ステータス値のみを使ってSQLをoverwritableInfoに記載できた",
    "- github_getFileContentを一度も呼んでいない場合、completedにしてはならない",
    "- Eloquentモデルが見つからない場合はmissingInformationに記載し、SQLは「該当テーブル不明のため作成不可」とすること",
    "",
    "【ツール使用】",
    "- 1回のレスポンスで5〜10件のtool_useを同時にリクエストせよ。Eloquentモデル検索・スキーマファイル取得・enumファイル読み込みなど、独立した調査は並列で実行すること",
    "- 同じツールを同じ引数で繰り返し実行しない",
    "- 提供されたツール定義に含まれるツールのみ使用",
    "",
    "【SQL出力の優先ルール】",
    "- 調査の途中であっても、その時点で判明している情報からoverwritableInfoにSQLを記載し続けること",
    "- 調査が完了してからSQLを書くのではなく、早い段階から暫定SQLを記載し、調査が進むにつれて更新すること",
    "- 最終ターンでSQLが未記載のまま終了することは絶対に避けること",
    "- 【進捗】のターン数を確認し、残り5ターン以下になったら新規調査を中止してSQLの完成に集中すること",
    "- 十分な情報が集まったらターン上限を待たずにstatusをcompletedにして早期終了すること",
  ].join("\n");

const sqlGenerationQuestionPrompt = (params: {
  logAnalysisReport: string;
  codeInvestigationReport: string;
}) =>
  [
    "以下のコード調査結果を元に、エラーに関連するデータの確認用SQLを生成してください。",
    "",
    "【Datadogログ分析結果】",
    params.logAnalysisReport,
    "",
    "【コード調査結果】",
    params.codeInvestigationReport,
    "",
    "上記の情報を元に、システムプロンプトの【手順】に従ってSQLを生成してください。",
  ].join("\n");
