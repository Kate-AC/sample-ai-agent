import { GitHubIssueSearchItemPayload } from "sample-mcp-kit";

export interface GitHubRepository {
  /**
   * DependaBotが作成したオープンPRを全件取得する
   */
  fetchAllDependabotPRs: (
    repo: string,
  ) => Promise<GitHubIssueSearchItemPayload[]>;

  /**
   * PRに分析結果コメントを投稿する
   */
  postAnalysisComment: (
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
  ) => Promise<boolean>;

  /**
   * PRに「AI Check」ラベルを追加する
   */
  addAICheckLabel: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Promise<boolean>;
}
