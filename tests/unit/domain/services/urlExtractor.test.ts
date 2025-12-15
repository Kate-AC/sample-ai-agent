import { extractSourceUrls } from "domain/services/urlExtractor";

describe("urlExtractor", () => {
  describe("Slack", () => {
    it("messageUrlがある場合はURLを返すこと", () => {
      const urls = extractSourceUrls(
        "slack_getThreadMessages",
        {
          messageUrl: "https://your-workspace.slack.com/archives/C123/p123456",
        },
        {},
      );

      expect(urls).toContain(
        "https://your-workspace.slack.com/archives/C123/p123456",
      );
    });

    it("スレッドURLがresultにある場合は返すこと", () => {
      const urls = extractSourceUrls(
        "slack_getThreadMessages",
        {},
        { threadUrl: "https://your-workspace.slack.com/archives/C123/p123456" },
      );

      expect(urls).toContain(
        "https://your-workspace.slack.com/archives/C123/p123456",
      );
    });
  });

  describe("Redmine", () => {
    it("getIssueでissueIdからURLを生成できること", () => {
      const urls = extractSourceUrls(
        "redmine_getIssue",
        { issueId: "12345" },
        { issue: { id: 12345 } },
      );

      expect(urls).toContain("https://redmine.example.com/issues/12345");
    });

    it("getIssuesで複数のissue URLを生成できること", () => {
      const urls = extractSourceUrls(
        "redmine_getIssues",
        {},
        {
          issues: [{ id: 123 }, { id: 456 }, { id: 789 }],
        },
      );

      expect(urls).toHaveLength(3);
      expect(urls).toContain("https://redmine.example.com/issues/123");
      expect(urls).toContain("https://redmine.example.com/issues/456");
      expect(urls).toContain("https://redmine.example.com/issues/789");
    });

    it("issues配列が6件以上ある場合は最初の5件のみ抽出すること", () => {
      const urls = extractSourceUrls(
        "redmine_getIssues",
        {},
        {
          issues: [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
            { id: 5 },
            { id: 6 },
          ],
        },
      );

      expect(urls).toHaveLength(5);
    });
  });

  describe("複数プラットフォーム", () => {
    it("該当しないツール名の場合は空配列を返すこと", () => {
      const urls = extractSourceUrls("unknown_tool", {}, {});

      expect(urls).toEqual([]);
    });
  });
});
