/**
 * Reportという命名を選択した経緯
 *
 * このAIアプリケーションは会話がメインではなく、
 * 質問内容についての回答を返すためにAIが欲しい情報をMCPで取ってきて渡すというループの実行が主なので
 * 会話（Conversation）を行っているわけではない。
 * 常に過去の生のログを全て入れて渡すようにしていくとトークン数の上限にすぐ到達してしまう問題もあるので、
 * 生ログ自体は保持せず、メッセージを投げるたびに「報告書」を更新していくという概念で実装している。
 */
export type Report<T = unknown> = {
  status: ReportStatus;
  confirmedFacts: string[];
  missingInformation: string[];
  logicSummary: string;
  overwritableInfo: unknown;
  sourceUrls: string[];
  updatedAt: Date | string;
  options?: T;
};

export type ReportStatus = "processing" | "completed";
