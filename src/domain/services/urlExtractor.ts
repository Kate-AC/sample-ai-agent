/**
 * ツール実行結果から情報源URLを抽出
 */
export const extractSourceUrls = (
  toolName: string,
  input: Record<string, any>,
  result: any,
): string[] => {
  const urls: string[] = [];

  // Slack関連
  if (toolName.startsWith("slack_")) {
    if (input.messageUrl) {
      urls.push(input.messageUrl);
    }
    if (toolName === "slack_getThreadMessages" && result.threadUrl) {
      urls.push(result.threadUrl);
    }
  }

  // Redmine関連
  if (toolName.startsWith("redmine_")) {
    // RedmineのベースURLは環境変数から取得するか、汎用的な形式を使用
    const redmineBaseUrl =
      process.env.REDMINE_BASE_URL || "https://redmine.example.com";
    if (toolName === "redmine_getIssue" && input.issueId) {
      urls.push(`${redmineBaseUrl}/issues/${input.issueId}`);
    }
    if (result.issue?.id) {
      urls.push(`${redmineBaseUrl}/issues/${result.issue.id}`);
    }
    if (result.issues && Array.isArray(result.issues)) {
      result.issues.slice(0, 5).forEach((issue: any) => {
        if (issue.id) {
          urls.push(`${redmineBaseUrl}/issues/${issue.id}`);
        }
      });
    }
  }

  return urls;
};
