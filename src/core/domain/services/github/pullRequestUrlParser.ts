/**
 * GitHub PR URLからowner/repo/numberをパースする
 * 例: https://github.com/example-org/sample-service/pull/2861
 */
export const parsePullRequestUrl = (
  url: string,
): { owner: string; repo: string; number: number } => {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    throw new Error(`Invalid pull request URL: ${url}`);
  }
  return {
    owner: match[1],
    repo: match[2],
    number: parseInt(match[3], 10),
  };
};
