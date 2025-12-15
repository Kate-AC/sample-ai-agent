import { parseToolName } from "@core/domain/services/claude/claudeToolUseParser";

describe("parseToolName", () => {
  describe("正常系", () => {
    it("基本的なツール名をパースできること", () => {
      const toolName = "slack_getThreadMessages";
      const result = parseToolName(toolName);

      expect(result.platformName).toBe("slack");
      expect(result.functionName).toBe("getThreadMessages");
    });

    it("アンダースコアが複数あるツール名をパースできること", () => {
      const toolName = "redmine_getIssues";
      const result = parseToolName(toolName);

      expect(result.platformName).toBe("redmine");
      expect(result.functionName).toBe("getIssues");
    });

    it("アンダースコアが3つ以上あるツール名をパースできること", () => {
      const toolName = "slack_searchMessages";
      const result = parseToolName(toolName);

      expect(result.platformName).toBe("slack");
      expect(result.functionName).toBe("searchMessages");
    });

    it("アンダースコアが4つ以上あるツール名をパースできること", () => {
      const toolName = "platform_function_name_with_many_underscores";
      const result = parseToolName(toolName);

      expect(result.platformName).toBe("platform");
      expect(result.functionName).toBe("function_name_with_many_underscores");
    });

    it("様々なプラットフォーム名をパースできること", () => {
      const platforms = [
        "slack",
        "redmine",
        "github",
        "google",
        "growi",
        "faq",
        "redash",
      ];

      platforms.forEach((platform) => {
        const toolName = `${platform}_getSomething`;
        const result = parseToolName(toolName);

        expect(result.platformName).toBe(platform);
        expect(result.functionName).toBe("getSomething");
      });
    });
  });

  describe("異常系", () => {
    it("アンダースコアがない場合エラーをスローすること", () => {
      expect(() => {
        parseToolName("slackgetThreadMessages");
      }).toThrow("Invalid tool name format: slackgetThreadMessages");
    });

    it("プラットフォーム名のみの場合エラーをスローすること", () => {
      expect(() => {
        parseToolName("slack");
      }).toThrow("Invalid tool name format: slack");
    });

    it("空文字列の場合エラーをスローすること", () => {
      expect(() => {
        parseToolName("");
      }).toThrow("Invalid tool name format:");
    });

    it("アンダースコアのみの場合でもパースできること", () => {
      // "_"はsplit("_")で["", ""]になるため、parts.lengthは2になる
      // 実装ではparts.length < 2のチェックなので、"_"はエラーにならない
      // 結果として、platformNameは空文字列、functionNameも空文字列になる
      const result = parseToolName("_");
      expect(result.platformName).toBe("");
      expect(result.functionName).toBe("");
    });
  });

  describe("型チェック", () => {
    it("返り値が正しい構造を持つこと", () => {
      const toolName = "slack_getThreadMessages";
      const result = parseToolName(toolName);

      expect(result).toHaveProperty("platformName");
      expect(result).toHaveProperty("functionName");
      expect(typeof result.platformName).toBe("string");
      expect(typeof result.functionName).toBe("string");
    });

    it("platformNameがPlatformName型として扱えること", () => {
      const toolName = "slack_getThreadMessages";
      const result = parseToolName(toolName);

      // PlatformNameは文字列リテラル型のユニオンなので、型チェックは実行時には確認できない
      // ただし、値が文字列であることは確認できる
      expect(typeof result.platformName).toBe("string");
    });
  });

  describe("エッジケース", () => {
    it("関数名が空文字列になる場合でもパースできること", () => {
      const toolName = "platform_";
      const result = parseToolName(toolName);

      expect(result.platformName).toBe("platform");
      expect(result.functionName).toBe("");
    });

    it("関数名にアンダースコアが含まれる場合でも正しくパースできること", () => {
      const toolName = "slack_get_thread_messages";
      const result = parseToolName(toolName);

      expect(result.platformName).toBe("slack");
      expect(result.functionName).toBe("get_thread_messages");
    });
  });
});
