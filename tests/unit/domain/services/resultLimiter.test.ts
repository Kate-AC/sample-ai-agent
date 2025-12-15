import { limitToolResult } from "domain/services/resultLimiter";

describe("resultLimiter", () => {
  describe("faq_search", () => {
    it("FAQ検索結果を3件に制限すること", () => {
      const result = {
        matches: [
          {
            text: "長いテキスト".repeat(100),
            context: "コンテキスト".repeat(100),
          },
          { text: "テキスト2", context: "コンテキスト2" },
          { text: "テキスト3", context: "コンテキスト3" },
          { text: "テキスト4", context: "コンテキスト4" },
        ],
      };

      const limited = limitToolResult("faq_search", result);

      expect(limited.matches).toHaveLength(3);
      expect(limited.total).toBe(4);
      expect(limited.matches[0].text.length).toBeLessThanOrEqual(200);
      expect(limited.matches[0].context.length).toBeLessThanOrEqual(500);
    });

    it("matchesが存在しない場合は元の結果を返すこと", () => {
      const result = { someOtherField: "value" };
      const limited = limitToolResult("faq_search", result);

      expect(limited).toEqual(result);
    });
  });

  describe("growi_searchPages", () => {
    it("Growi検索結果を5件に制限すること", () => {
      const result = {
        data: Array.from({ length: 10 }, (_, i) => ({
          data: {
            _id: `id${i}`,
            path: `/path${i}`,
            snippet: "スニペット".repeat(200),
          },
        })),
      };

      const limited = limitToolResult("growi_searchPages", result);

      expect(limited.data).toHaveLength(5);
      expect(limited.data[0].data.snippet.length).toBeLessThanOrEqual(500);
    });

    it("result.pagesフォーマットにも対応すること", () => {
      const result = {
        pages: [
          { data: { _id: "1", path: "/path1", snippet: "test" } },
          { data: { _id: "2", path: "/path2", snippet: "test" } },
        ],
      };

      const limited = limitToolResult("growi_searchPages", result);

      expect(limited.data).toHaveLength(2);
    });
  });

  describe("redmine_getIssues", () => {
    it("Redmine issues一覧を10件に制限すること", () => {
      const result = {
        issues: Array.from({ length: 20 }, (_, i) => ({
          id: i,
          subject: `Issue ${i}`,
          status: "open",
          description: "説明".repeat(200),
        })),
      };

      const limited = limitToolResult("redmine_getIssues", result);

      expect(limited.issues).toHaveLength(10);
      expect(limited.issues[0].description.length).toBeLessThanOrEqual(500);
    });
  });

  describe("google_searchDriveFiles", () => {
    it("Google Drive検索結果を5件に制限すること", () => {
      const result = {
        files: Array.from({ length: 20 }, (_, i) => ({
          id: `file${i}`,
          name: `File ${i}`,
        })),
      };

      const limited = limitToolResult("google_searchDriveFiles", result);

      expect(limited.files).toHaveLength(5);
    });
  });

  describe("汎用的な配列制限", () => {
    it("配列結果の場合は10件に制限すること", () => {
      const result = Array.from({ length: 50 }, (_, i) => ({ id: i }));

      const limited = limitToolResult("unknown_tool", result);

      expect(limited).toHaveLength(10);
    });

    it("配列でない場合はそのまま返すこと", () => {
      const result = { data: "some data" };

      const limited = limitToolResult("unknown_tool", result);

      expect(limited).toEqual(result);
    });
  });

  describe("制限不要なツール", () => {
    it("該当しないツールは元の結果を返すこと", () => {
      const result = { large: "data".repeat(1000) };

      const limited = limitToolResult("slack_postMessage", result);

      expect(limited).toEqual(result);
    });
  });
});
