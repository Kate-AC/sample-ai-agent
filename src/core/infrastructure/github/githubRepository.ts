import {
  GitHubRepository as GitHubRepositoryMcpKit,
  GitHubIssueSearchItemPayload,
} from "sample-mcp-kit";
import { GitHubRepository } from "@core/domain/repositories/github/githubRepository";

const AI_CHECK_LABEL = "AI Check";

export const makeGitHubDependabotRepository = (deps: {
  githubRepository: GitHubRepositoryMcpKit;
}): GitHubRepository => {
  const { githubRepository } = deps;

  return {
    fetchAllDependabotPRs: async (
      repo: string,
    ): Promise<GitHubIssueSearchItemPayload[]> => {
      const query = `is:pr is:open author:app/dependabot repo:${repo}`;
      const result = await githubRepository.searchIssues(query, 100);

      if (!result.isSuccess || !result.payload) {
        return [];
      }

      return result.payload.items;
    },

    postAnalysisComment: async (
      owner: string,
      repo: string,
      prNumber: number,
      body: string,
    ): Promise<boolean> => {
      const apiPath = `/repos/${owner}/${repo}/issues/${prNumber}/comments`;
      const result = await githubRepository.createPullRequestComment(
        apiPath,
        body,
      );
      return result.isSuccess;
    },

    addAICheckLabel: async (
      owner: string,
      repo: string,
      prNumber: number,
    ): Promise<boolean> => {
      const apiPath = `/repos/${owner}/${repo}/issues/${prNumber}/labels`;
      const result = await githubRepository.addLabels(apiPath, [
        AI_CHECK_LABEL,
      ]);
      return result.isSuccess;
    },
  };
};
