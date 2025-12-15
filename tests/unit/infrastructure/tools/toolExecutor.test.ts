import { executeTool } from "infrastructure/tools/toolExecutor";
import type { Mcp } from "sample-mcp";

describe("toolExecutor", () => {
  const createMockMcp = (functionName: string, returnValue: any): Mcp => ({
    mcpFunctions: {
      [functionName]: jest.fn().mockResolvedValue({
        isSuccess: true,
        payload: returnValue,
      }),
    } as any,
    mcpMetadata: {} as any,
    mcpSetting: {} as any,
  });

  const createMockMcps = (
    platform: string,
    functionName: string,
    returnValue: any,
  ) => {
    const mockMcp = createMockMcp(functionName, returnValue);

    return {
      slackMcp: platform === "slack" ? mockMcp : createMockMcp("dummy", {}),
      redmineMcp: platform === "redmine" ? mockMcp : createMockMcp("dummy", {}),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("正常系", () => {
    it("Slackツールを実行できること", async () => {
      const mcps = createMockMcps("slack", "getThreadMessages", {
        messages: [],
      });

      const result = await executeTool(
        "slack_getThreadMessages",
        {
          messageUrl: "https://your-workspace.slack.com/archives/C123/p123456",
        },
        mcps,
      );

      expect(result).toEqual({ messages: [] });
      expect(
        (mcps.slackMcp.mcpFunctions as any).getThreadMessages,
      ).toHaveBeenCalled();
    });

    it("Redmineツールを実行できること", async () => {
      const mcps = createMockMcps("redmine", "getIssue", {
        issue: { id: 123 },
      });

      const result = await executeTool(
        "redmine_getIssue",
        { issueId: "123" },
        mcps,
      );

      expect(result).toEqual({ issue: { id: 123 } });
    });

    it("queryParamsが文字列の場合はオブジェクトに変換すること", async () => {
      const mcps = createMockMcps("redmine", "getIssues", { issues: [] });

      await executeTool(
        "redmine_getIssues",
        { queryParams: "status_id=1&limit=10" },
        mcps,
      );

      const mockFunc = (mcps.redmineMcp.mcpFunctions as any).getIssues;
      expect(mockFunc).toHaveBeenCalledWith({ status_id: "1", limit: "10" });
    });

    it("複数の引数を正しい順序で渡すこと", async () => {
      const mcps = createMockMcps("redmine", "getIssues", {
        issues: [],
      });

      await executeTool(
        "redmine_getIssues",
        { queryParams: "status_id=1&limit=10" },
        mcps,
      );

      const mockFunc = (mcps.redmineMcp.mcpFunctions as any).getIssues;
      expect(mockFunc).toHaveBeenCalledWith({ status_id: "1", limit: "10" });
    });
  });

  describe("異常系", () => {
    it("不正なツール名形式の場合はエラーをスローすること", async () => {
      const mcps = createMockMcps("slack", "dummy", {});

      await expect(executeTool("invalidtoolname", {}, mcps)).rejects.toThrow(
        "Invalid tool name format",
      );
    });

    it("存在しないプラットフォームの場合はエラーをスローすること", async () => {
      const mcps = createMockMcps("slack", "dummy", {});

      await expect(executeTool("unknown_function", {}, mcps)).rejects.toThrow(
        "Unknown platform",
      );
    });

    it("存在しない関数の場合はエラーをスローすること", async () => {
      const mcps = createMockMcps("slack", "existingFunc", {});

      await expect(
        executeTool("slack_nonExistentFunction", {}, mcps),
      ).rejects.toThrow("Unknown function");
    });

    it("MCP関数がエラーを返した場合はエラーをスローすること", async () => {
      const mockMcp = {
        mcpFunctions: {
          getIssue: jest.fn().mockResolvedValue({
            isSuccess: false,
            message: "API Error",
          }),
        } as any,
        mcpMetadata: {} as any,
        mcpSetting: {} as any,
      };

      const mcps = {
        slackMcp: createMockMcp("dummy", {}),
        redmineMcp: mockMcp,
      };

      await expect(
        executeTool("redmine_getIssue", { issueId: "123" }, mcps),
      ).rejects.toThrow("API Error");
    });
  });
});
