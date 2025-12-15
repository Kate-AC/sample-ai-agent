import {
  OpsReportEvaluationResult,
  DatadogAnalysisResult,
  formatDatadogAnalysisAsText,
} from "@projects/shared/usecases/opsReportEvaluationUsecase";

/**
 * サマリー生成用のシステムプロンプト（Slackフォーマット指示）
 */
export const summarySystemPrompt = [
  "収集した情報を基に、質問に対する簡潔な総括を生成してください。",
  "",
  "【重要】",
  "- これ以上ツールを実行する必要はありません",
  "- 与えられた情報だけを使って回答してください",
  "- 詳細な分析は2次オペ対応シートに記録済みのため、Slackへの投稿は簡潔にまとめること",
  "- ソースURLの記載は不要",
  "",
  "【文字数制限】",
  "- 回答全体を2500文字以内に収めること（Slack投稿の制限のため）",
  "- エラー概要・原因は簡潔に1-2行で記載する",
  "- 確認用SQLとリトライ情報は省略せず完全に記載する",
  "- それ以外の情報は要点のみに絞る",
  "",
  "【回答フォーマット】",
  "- 回答はSlackに投稿されるため、Slack mrkdwn記法を使用してください",
  "- 見出しは *太字* で表現してください（##は使用不可）",
  "- 太字: *text*、イタリック: _text_、取り消し線: ~text~、コード: `code`",
  "- リンクは <url|表示名> の形式（例: <https://example.com|リンク>）",
  "- 箇条書きは • または - で開始",
].join("\n");

/**
 * サマリー生成用のメッセージを組み立てる
 */
export const buildSummaryMessage = (params: {
  datadogAnalysisResult: DatadogAnalysisResult;
  errorMessage: string;
  evaluationPayload: OpsReportEvaluationResult;
}): string => {
  const { datadogAnalysisResult, errorMessage, evaluationPayload } = params;
  const summaryDirective =
    stampSummaryDirectives[evaluationPayload.stampName] || "";

  return [
    "### 重要司令",
    "以下の情報を元に、元のエラーメッセージに対する回答をまとめてください。",
    "独自の分析や推測は行わず、与えられた情報だけを使用して、簡潔な回答を生成してください。",
    "",
    "### 元のエラーメッセージ",
    errorMessage,
    "",
    "### Datadog分析結果",
    formatDatadogAnalysisAsText(datadogAnalysisResult),
    "",
    "### Datadog分析結果に対する評価",
    JSON.stringify(evaluationPayload.evaluationReport),
    "",
    summaryDirective,
  ].join("\n");
};

export const stampSummaryDirectives: Record<string, string> = {
  seikan: [
    "### まとめ方（:seikan: 静観）",
    "- エラー概要と原因を1-2行で簡潔に説明する",
    "- 対応不要である理由を1行で述べる",
    "- 確認用SQL文を省略せず完全に記載する（Datadog分析結果に含まれるSQLをそのまま記載すること。独自に生成しないこと）",
  ].join("\n"),
  retry: [
    "### まとめ方（:retry: リトライ）",
    "- エラー概要と原因を1-2行で簡潔に説明する",
    "- 自動復旧を行うジョブ名と定期実行スケジュールを省略せず完全に記載する（どの処理がいつリトライするか）",
    "- 確認用SQL文を省略せず完全に記載する（Datadog分析結果に含まれるSQLをそのまま記載すること。独自に生成しないこと）",
  ].join("\n"),
  youkakunin: [
    "### まとめ方（:youkakunin: 要確認）",
    "- エラー概要と原因を1-2行で簡潔に説明する",
    "- リカバリ手順または次のアクションを記載する",
    "- 確認用SQL文を省略せず完全に記載する（Datadog分析結果に含まれるSQLをそのまま記載すること。独自に生成しないこと）",
    "- 判断がつかない場合は、何が不明で何を追加調査すべきかを記載する",
  ].join("\n"),
};
