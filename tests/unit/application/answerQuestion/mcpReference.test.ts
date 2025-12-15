import { buildSecurityRulesPrompt } from "application/services/mcpReference";
import type { McpRegistry } from "sample-mcp";

describe("mcpReference", () => {
  describe("buildSecurityRulesPrompt", () => {
    const createMockMcpRegistry = (
      rulesMap: Record<string, string[]>,
    ): McpRegistry => {
      return {
        getAllMcpNames: jest.fn().mockReturnValue(Object.keys(rulesMap)),
        getMcp: jest.fn((name: string) => ({
          mcpMetadata: {
            getSummary: jest.fn().mockReturnValue([]),
            getUsageContext: jest.fn().mockReturnValue([]),
            getCommands: jest.fn().mockReturnValue([]),
            getSecurityRules: jest.fn().mockReturnValue(rulesMap[name] || []),
          },
          mcpFunctions: {},
          mcpSetting: {},
        })),
      } as any;
    };

    it("セキュリティルールからプロンプトを生成できること", () => {
      const mockRegistry = createMockMcpRegistry({
        redmine: ["個人情報は返答しないこと", "機密チケットに注意"],
        redash: ["SQLクエリ結果に個人情報が含まれる可能性あり"],
      });

      const result = buildSecurityRulesPrompt(mockRegistry);

      expect(result).toContain("【セキュリティルール】");
      expect(result).toContain("[redmine] 個人情報は返答しないこと");
      expect(result).toContain("[redmine] 機密チケットに注意");
      expect(result).toContain(
        "[redash] SQLクエリ結果に個人情報が含まれる可能性あり",
      );
    });

    it("セキュリティルールがない場合は空文字列を返すこと", () => {
      const mockRegistry = createMockMcpRegistry({
        slack: [],
        github: [],
      });

      const result = buildSecurityRulesPrompt(mockRegistry);

      expect(result).toBe("");
    });

    it("一部のプラットフォームにのみルールがある場合", () => {
      const mockRegistry = createMockMcpRegistry({
        slack: [],
        redmine: ["個人情報は返答しないこと"],
        github: [],
      });

      const result = buildSecurityRulesPrompt(mockRegistry);

      expect(result).toContain("【セキュリティルール】");
      expect(result).toContain("[redmine] 個人情報は返答しないこと");
      expect(result).not.toContain("[slack]");
      expect(result).not.toContain("[github]");
    });

    it("複数のMCPに複数のルールがある場合、すべて含まれること", () => {
      const mockRegistry = createMockMcpRegistry({
        redmine: ["ルール1", "ルール2"],
        redash: ["ルール3"],
        google: ["ルール4", "ルール5"],
      });

      const result = buildSecurityRulesPrompt(mockRegistry);

      expect(result).toContain("[redmine] ルール1");
      expect(result).toContain("[redmine] ルール2");
      expect(result).toContain("[redash] ルール3");
      expect(result).toContain("[google] ルール4");
      expect(result).toContain("[google] ルール5");
    });

    it("プロンプトが正しいフォーマットであること", () => {
      const mockRegistry = createMockMcpRegistry({
        redmine: ["テストルール"],
      });

      const result = buildSecurityRulesPrompt(mockRegistry);

      // 改行で始まり、改行で終わる
      expect(result.startsWith("\n【セキュリティルール】\n")).toBe(true);
      expect(result.endsWith("\n")).toBe(true);

      // 箇条書き形式
      expect(result).toContain("- [redmine] テストルール");
    });
  });
});
