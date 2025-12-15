import { ClaudeRecursiveReportGenerator } from "@core/application/services/claude/claudeRecursiveReportGenerator";
import { RETRY_STRATEGY } from "@core/application/services/claude/helpers/claudeRecursiveReportGeneratorDefaultSettings";
import { Report } from "@core/domain/entities/report";
import { DatadogRepository } from "sample-mcp-kit/dist/src/platforms/datadog/domain/repositories/datadogRepository";

export interface DatadogLogAnalysisUsecase {
  invoke: (datadogUrl: string) => Promise<Report>;
}

export const makeDatadogLogAnalysisUsecase = (deps: {
  claudeRecursiveReportGenerator: ClaudeRecursiveReportGenerator;
  datadogRepository: DatadogRepository;
}): DatadogLogAnalysisUsecase => {
  return {
    invoke: async (datadogUrl: string): Promise<Report> => {
      console.log(`[DatadogLogAnalysis] Fetching raw logs from: ${datadogUrl}`);
      const rawLogResult =
        await deps.datadogRepository.searchLogsFromUrl(datadogUrl);
      const rawLogs = (rawLogResult.payload?.data ?? [])
        .map((log) => log.attributes?.message ?? "")
        .filter(Boolean)
        .join("\n");

      const questionPrompt = datadogLogAnalysisQuestionPrompt(datadogUrl);

      console.log(`[DatadogLogAnalysis] Starting log analysis...`);

      const logAnalysisReport =
        await deps.claudeRecursiveReportGenerator.invoke(questionPrompt, {
          mapNames: ["datadog"],
          additionalSystemPrompts: [datadogLogAnalysisSystemPrompt],
          repeatTimes: 20,
          retryStrategy: RETRY_STRATEGY,
        });

      console.log(
        `[DatadogLogAnalysis] Completed. logicSummary length: ${logAnalysisReport.logicSummary.length}`,
      );

      return { ...logAnalysisReport, options: { rawLogs } };
    },
  };
};

/**
 * Datadogログ分析用プロンプト
 * MCP: datadog のみ
 * 目的: DatadogのURLからエラーの内容を取得し、エラーの全体像を把握する
 */
const datadogLogAnalysisSystemPrompt = [
  "【目的】",
  "DatadogのURLからエラーログを取得し、エラーの全体像を把握する。",
  "調査結果は後続のコード原因特定に使用される。",
  "",
  "【禁止事項】",
  "- 初回のログ取得には必ずdatadog_searchLogsFromUrlを使うこと",
  "- 追加調査にはdatadog_searchLogsByCompanyCodeを使うこと（datadog_searchLogsは使用禁止）",
  "- 推測でエラー原因を特定してはならない。ログから読み取れる事実のみ記載すること",
  "- 同じツールを同じ引数で繰り返し実行しないこと",
  "- 一般論的な説明（例: 「タイムアウトはネットワーク障害の可能性があります」等）は禁止",
  "",
  "【調査手順】",
  "",
  "ステップ1: URLからエラーログを取得する",
  "- datadog_searchLogsFromUrlを使って、URLに含まれるログを取得する",
  "- ログの内容からエラーメッセージ、発生時刻、サービス名、企業コード（companyCode）、spanId等を把握する",
  "",
  "ステップ2: トレース情報を取得する",
  "- ログにspanIdが含まれている場合、datadog_getTraceMetadataBySpanIdを使ってトレース情報を取得する",
  "- トレース情報からリクエストの流れ、どのサービスでエラーが発生したかを把握する",
  "- spanIdが存在しない場合はこのステップをスキップする",
  "",
  "ステップ3: エラー前後のログを確認する",
  "- ログから企業コード（companyCode）と発生時刻が特定できた場合、datadog_searchLogsByCompanyCodeを使う",
  "- 検索する時間範囲はエラー発生時刻の前後5分とする",
  "  例: エラー発生が 2026-03-05 21:06:57 (JST) の場合 → fromDateTime=2026-03-05 21:01:57, toDateTime=2026-03-05 21:11:57",
  "- infoレベルのログも含めて取得し、エラーに至るまでの処理の流れを把握する",
  "- 企業コードが特定できない場合はこのステップをスキップする",
  "",
  "【調査完了の条件】",
  '- statusを"completed"にしてよいのは以下のいずれかの場合のみ：',
  "  1. ステップ1〜3を実行し、エラーの全体像が把握できた",
  "  2. ステップ1でログが取得できなかった場合（URLが無効等）",
  "- missingInformationには、ログから特定できなかった情報を具体的に記載すること",
  "",
  "【レポート記載ルール】",
  "- confirmedFactsにはログから読み取れた具体的な事実を1件ずつ記載すること",
  "  例: 「エラーメッセージ: Connection refused to host smtp.example.com:587」",
  "  例: 「サービス: sample-service-job、ジョブ: ExportShippedShipments」",
  "  例: 「企業コード: FN724、発生時刻: 2026-03-05T21:06:57+09:00」",
  "  例: 「トレース: OrderExportService → SmtpClient → Connection refused」",
  "  例: 「エラー前後のログ: 21:01:57にStockSync開始 → 21:05:30にAPI呼び出し → 21:06:57に401エラー」",
  "- missingInformationには特定できなかった情報を記載すること",
  "  例: 「spanIdが存在しないためトレース情報は取得できなかった」",
  "  例: 「企業コードが特定できないためエラー前後のログは確認できなかった」",
  "",
  "【ツール使用】",
  "- 1回のレスポンスで複数のtool_useを同時にリクエストしてよい",
  "- 提供されたツール定義に含まれるツールのみ使用",
].join("\n");

const datadogLogAnalysisQuestionPrompt = (datadogUrl: string) =>
  [
    "以下のDatadog URLに記録されたエラーについて調査してください。",
    "",
    "【Datadog URL】",
    datadogUrl,
    "",
    "【調査指示】",
    "1. URLからエラーログを取得し、エラーの内容を把握する",
    "2. spanIdが存在する場合はトレース情報を取得し、リクエストの流れを把握する",
    "3. 企業コードと発生時刻が特定できた場合、前後5分のログを取得し、エラーに至る経緯を把握する",
    "",
    "【重要】",
    "- ログから読み取れる事実のみ記載すること",
    "- 推測でエラー原因を特定してはならない",
    "- 不明な点は不明と明記すること",
  ].join("\n");
