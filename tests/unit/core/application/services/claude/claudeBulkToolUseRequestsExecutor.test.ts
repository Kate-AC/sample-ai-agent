import { makeClaudeBulkToolUseRequestsExecutor } from "@core/application/services/claude/claudeBulkToolUseRequestsExecutor";
import { ClaudeToolUseRequestExecutor } from "@core/domain/repositories/claude/claudeToolUseRequestExecutor";
import { ClaudeToolUseResultLimiter } from "@core/application/services/claude/claudeToolUseResultLimiter";
import { ClaudeToolUseRequestContent, Result } from "sample-mcp-kit";

describe("makeClaudeBulkToolUseRequestsExecutor", () => {
  const createMockToolUseRequestExecutor = (): ClaudeToolUseRequestExecutor => {
    return {
      execute: jest.fn(),
    };
  };

  const createMockToolUseLimiter = (): ClaudeToolUseResultLimiter => {
    return {
      limit: jest.fn((toolName, result) => result),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("execute", () => {
    it("複数のツールリクエストを並列実行できること", async () => {
      const mockExecutor = createMockToolUseRequestExecutor();
      const mockResult1: Result<unknown> = {
        isSuccess: true,
        status: 200,
        payload: { result: "結果1" },
      };
      const mockResult2: Result<unknown> = {
        isSuccess: true,
        status: 200,
        payload: { result: "結果2" },
      };

      (mockExecutor.execute as jest.Mock)
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const bulkExecutor = makeClaudeBulkToolUseRequestsExecutor({
        toolUseRequestExecutor: mockExecutor,
      });

      const toolUseRequests: ClaudeToolUseRequestContent[] = [
        {
          type: "tool_use",
          id: "tool1",
          name: "test_tool1",
          input: {},
        },
        {
          type: "tool_use",
          id: "tool2",
          name: "test_tool2",
          input: {},
        },
      ];

      const results = await bulkExecutor.execute(toolUseRequests);

      expect(results).toHaveLength(2);
      expect(results[0].tool_use_id).toBe("tool1");
      expect(results[1].tool_use_id).toBe("tool2");
      expect(mockExecutor.execute).toHaveBeenCalledTimes(2);
    });

    it("ツール結果を制限できること", async () => {
      const mockExecutor = createMockToolUseRequestExecutor();
      const mockLimiter = createMockToolUseLimiter();
      const mockResult: Result<unknown> = {
        isSuccess: true,
        status: 200,
        payload: { data: "大量のデータ" },
      };

      (mockExecutor.execute as jest.Mock).mockResolvedValue(mockResult);
      (mockLimiter.limit as jest.Mock).mockReturnValue({
        data: "制限されたデータ",
      });

      const bulkExecutor = makeClaudeBulkToolUseRequestsExecutor({
        toolUseRequestExecutor: mockExecutor,
        toolUseLimiter: mockLimiter,
      });

      const toolUseRequests: ClaudeToolUseRequestContent[] = [
        {
          type: "tool_use",
          id: "tool1",
          name: "test_tool",
          input: {},
        },
      ];

      const results = await bulkExecutor.execute(toolUseRequests);

      expect(mockLimiter.limit).toHaveBeenCalledWith("test_tool", {
        data: "大量のデータ",
      });
      expect(JSON.parse(results[0].content as string)).toEqual({
        data: "制限されたデータ",
      });
    });

    it("ツールリミッターが提供されていない場合は制限しないこと", async () => {
      const mockExecutor = createMockToolUseRequestExecutor();
      const mockResult: Result<unknown> = {
        isSuccess: true,
        status: 200,
        payload: { data: "大量のデータ" },
      };

      (mockExecutor.execute as jest.Mock).mockResolvedValue(mockResult);

      const bulkExecutor = makeClaudeBulkToolUseRequestsExecutor({
        toolUseRequestExecutor: mockExecutor,
      });

      const toolUseRequests: ClaudeToolUseRequestContent[] = [
        {
          type: "tool_use",
          id: "tool1",
          name: "test_tool",
          input: {},
        },
      ];

      const results = await bulkExecutor.execute(toolUseRequests);

      expect(JSON.parse(results[0].content as string)).toEqual({
        data: "大量のデータ",
      });
    });

    it("エラーが発生した場合はエラーメッセージを含む結果を返すこと", async () => {
      const mockExecutor = createMockToolUseRequestExecutor();
      const mockErrorResult: Result<unknown> = {
        isSuccess: false,
        status: 500,
        message: "ツール実行エラー",
        payload: null as any,
      };

      (mockExecutor.execute as jest.Mock).mockResolvedValue(mockErrorResult);

      const bulkExecutor = makeClaudeBulkToolUseRequestsExecutor({
        toolUseRequestExecutor: mockExecutor,
      });

      const toolUseRequests: ClaudeToolUseRequestContent[] = [
        {
          type: "tool_use",
          id: "tool1",
          name: "test_tool",
          input: {},
        },
      ];

      const results = await bulkExecutor.execute(toolUseRequests);

      expect(results[0].content).toContain("エラーが発生しました");
      expect(results[0].content).toContain("ツール実行エラー");
    });

    it("例外が発生した場合はエラーメッセージを含む結果を返すこと", async () => {
      const mockExecutor = createMockToolUseRequestExecutor();
      const error = new Error("予期しないエラー");

      (mockExecutor.execute as jest.Mock).mockRejectedValue(error);

      const bulkExecutor = makeClaudeBulkToolUseRequestsExecutor({
        toolUseRequestExecutor: mockExecutor,
      });

      const toolUseRequests: ClaudeToolUseRequestContent[] = [
        {
          type: "tool_use",
          id: "tool1",
          name: "test_tool",
          input: {},
        },
      ];

      const results = await bulkExecutor.execute(toolUseRequests);

      expect(results[0].content).toContain("エラーが発生しました");
      expect(results[0].content).toContain("予期しないエラー");
    });
  });
});
