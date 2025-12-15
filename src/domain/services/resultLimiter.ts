/**
 * ツール結果をClaudeに渡すために制限する（メモリ対策）
 */
export const limitToolResult = (toolName: string, result: any): any => {
  // FAQ検索結果も制限（メモリ対策で厳しく制限）
  if (toolName === "faq_search") {
    if (result.matches && Array.isArray(result.matches)) {
      return {
        matches: result.matches.slice(0, 3).map((match: any) => ({
          text: match.text?.substring(0, 200) || "",
          context: match.context?.substring(0, 500) || "",
        })),
        total: result.matches.length,
      };
    }
  }

  // Growi検索結果も制限
  if (toolName === "growi_searchPages") {
    const pages = result.data || result.pages;
    if (pages && Array.isArray(pages)) {
      return {
        ...result,
        data: pages.slice(0, 5).map((page: any) => {
          const pageData = page.data || page;
          return {
            data: {
              _id: pageData._id,
              path: pageData.path,
              snippet: pageData.snippet?.substring(0, 500),
            },
            meta: page.meta,
          };
        }),
      };
    }
  }

  // Redmine issues一覧も制限
  if (toolName === "redmine_getIssues") {
    if (result.issues && Array.isArray(result.issues)) {
      return {
        ...result,
        issues: result.issues.slice(0, 10).map((issue: any) => ({
          id: issue.id,
          subject: issue.subject,
          status: issue.status,
          description: issue.description?.substring(0, 500),
        })),
      };
    }
  }

  // Google Drive検索結果も制限
  if (toolName === "google_searchDriveFiles") {
    if (result.files && Array.isArray(result.files)) {
      return {
        ...result,
        files: result.files.slice(0, 5),
      };
    }
  }

  // Slackスレッドメッセージも制限
  if (toolName === "slack_getThreadMessages") {
    if (result.messages && Array.isArray(result.messages)) {
      return {
        ...result,
        messages: result.messages.slice(0, 20).map((msg: any) => ({
          user: msg.user,
          text: msg.text?.substring(0, 1000), // 各メッセージは1000文字まで
          ts: msg.ts,
          thread_ts: msg.thread_ts,
          type: msg.type,
        })),
        total: result.messages.length,
      };
    }
  }

  // デフォルト: 結果が巨大すぎないかチェック
  // 配列の場合は要素数を制限
  if (Array.isArray(result)) {
    console.warn(
      `Tool result is an array with ${result.length} items, limiting to 10...`,
    );
    return result.slice(0, 10);
  }

  return result;
};
