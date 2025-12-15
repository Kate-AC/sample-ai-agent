/**
 * SlackメッセージのテキストからDatadog URLを抽出する
 * Slackのリンク形式 <url|表示テキスト> やHTMLエンティティ &amp; を考慮
 * from_tsを含むURL（時間範囲付き）を優先して返す
 */
export const extractDatadogUrl = (text: string): string | null => {
  const regex =
    /https?:\/\/app\.datadoghq\.com\/(?:logs|monitors|error-tracking|apm|infrastructure|events)[^\s>)}\]"|`]*/g;
  const matches = text.match(regex);
  if (!matches || matches.length === 0) return null;

  const cleanedUrls = matches.map((url) => url.replace(/&amp;/g, "&"));

  // from_tsを含むURLを優先（時間範囲が指定されているURL）
  const urlWithTimeRange = cleanedUrls.find((url) => url.includes("from_ts="));
  return urlWithTimeRange || cleanedUrls[0];
};
