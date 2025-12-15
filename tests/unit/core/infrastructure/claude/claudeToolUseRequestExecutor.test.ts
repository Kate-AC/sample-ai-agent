import { makeClaudeToolUseRequestExecutor } from "@core/infrastructure/claude/claudeToolUseRequestExecutor";
import { ClaudeToolUseRequestContent, Result } from "sample-mcp-kit";
import { executeToolUse } from "sample-mcp-kit";

jest.mock("sample-mcp-kit", () => ({
  ...jest.requireActual("sample-mcp-kit"),
  executeToolUse: jest.fn(),
}));

describe("makeClaudeToolUseRequestExecutor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("正常系", () => {
    it("ClaudeToolUseRequestExecutorを正しく作成できること", () => {
      const executor = makeClaudeToolUseRequestExecutor();

      expect(executor).toBeDefined();
      expect(typeof executor.execute).toBe("function");
    });

    it("executeメソッドがexecuteToolUseを呼び出すこと", async () => {
      const mockResult: Result<unknown> = {
        isSuccess: true,
        status: 200,
        payload: { result: "テスト結果" },
      };

      (executeToolUse as jest.Mock).mockResolvedValue(mockResult);

      const executor = makeClaudeToolUseRequestExecutor();
      const toolUseRequest: ClaudeToolUseRequestContent = {
        type: "tool_use",
        id: "test_id",
        name: "test_tool",
        input: { key: "value" },
      };

      const result = await executor.execute(toolUseRequest);

      expect(executeToolUse).toHaveBeenCalledWith(toolUseRequest);
      expect(result).toEqual(mockResult);
    });

    it("executeメソッドがエラーを返す場合も正しく処理できること", async () => {
      const mockErrorResult: Result<unknown> = {
        isSuccess: false,
        status: 500,
        message: "エラーメッセージ",
        payload: null as any,
      };

      (executeToolUse as jest.Mock).mockResolvedValue(mockErrorResult);

      const executor = makeClaudeToolUseRequestExecutor();
      const toolUseRequest: ClaudeToolUseRequestContent = {
        type: "tool_use",
        id: "test_id",
        name: "test_tool",
        input: {},
      };

      const result = await executor.execute(toolUseRequest);

      expect(executeToolUse).toHaveBeenCalledWith(toolUseRequest);
      expect(result.isSuccess).toBe(false);
      expect(result.message).toBe("エラーメッセージ");
    });
  });
});
