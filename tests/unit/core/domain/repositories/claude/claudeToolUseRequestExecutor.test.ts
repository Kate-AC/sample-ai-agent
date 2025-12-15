import { ClaudeToolUseRequestExecutor } from "@core/domain/repositories/claude/claudeToolUseRequestExecutor";
import { ClaudeToolUseRequestContent, Result } from "sample-mcp-kit";

describe("ClaudeToolUseRequestExecutor", () => {
  it("インターフェースが正しく定義されていること", () => {
    const executor: ClaudeToolUseRequestExecutor = {
      execute: async (toolUseRequest: ClaudeToolUseRequestContent) => {
        return {
          isSuccess: true,
          status: 200,
          payload: { result: "テスト結果" },
        };
      },
    };

    expect(executor).toBeDefined();
    expect(typeof executor.execute).toBe("function");
  });
});
