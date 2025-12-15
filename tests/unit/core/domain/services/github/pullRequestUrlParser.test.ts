import { parsePullRequestUrl } from "@core/domain/services/github/pullRequestUrlParser";

describe("parsePullRequestUrl", () => {
  describe("正常系", () => {
    it("標準的なPR URLをパースできること", () => {
      const result = parsePullRequestUrl(
        "https://github.com/example-org/sample-service/pull/2861",
      );

      expect(result).toEqual({
        owner: "example-org",
        repo: "sample-service",
        number: 2861,
      });
    });

    it("異なるowner/repoのURLをパースできること", () => {
      const result = parsePullRequestUrl(
        "https://github.com/facebook/react/pull/123",
      );

      expect(result).toEqual({
        owner: "facebook",
        repo: "react",
        number: 123,
      });
    });

    it("PR番号が1桁でもパースできること", () => {
      const result = parsePullRequestUrl(
        "https://github.com/owner/repo/pull/1",
      );

      expect(result.number).toBe(1);
    });

    it("PR番号が大きい数値でもパースできること", () => {
      const result = parsePullRequestUrl(
        "https://github.com/owner/repo/pull/99999",
      );

      expect(result.number).toBe(99999);
    });
  });

  describe("異常系", () => {
    it("無効なURLの場合エラーをスローすること", () => {
      expect(() => parsePullRequestUrl("https://example.com/invalid")).toThrow(
        "Invalid pull request URL",
      );
    });

    it("空文字列の場合エラーをスローすること", () => {
      expect(() => parsePullRequestUrl("")).toThrow("Invalid pull request URL");
    });

    it("GitHubのURLだがPRではない場合エラーをスローすること", () => {
      expect(() =>
        parsePullRequestUrl(
          "https://github.com/example-org/sample-service/issues/123",
        ),
      ).toThrow("Invalid pull request URL");
    });

    it("PR番号がない場合エラーをスローすること", () => {
      expect(() =>
        parsePullRequestUrl(
          "https://github.com/example-org/sample-service/pull/",
        ),
      ).toThrow("Invalid pull request URL");
    });
  });
});
