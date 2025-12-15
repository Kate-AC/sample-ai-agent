import { ClaudeRepository } from "@core/domain/repositories/claude/claudeRepository";
import {
  ClaudeMessage,
  ClaudeToolUseSchema,
  ClaudeTextPayload,
} from "sample-mcp-kit";

describe("ClaudeRepository", () => {
  it("インターフェースが正しく定義されていること", () => {
    const repository: ClaudeRepository = {
      ask: async (
        messages: ClaudeMessage | ClaudeMessage[],
        tools?: ClaudeToolUseSchema[],
      ) => {
        return {
          isSuccess: true,
          status: 200,
          payload: {
            text: "テスト",
            finishReason: "stop",
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
            },
            metadata: {
              id: "test-id",
              rawContent: [],
              stopReason: "end_turn",
            },
          } as ClaudeTextPayload,
        };
      },
    };

    expect(repository).toBeDefined();
    expect(typeof repository.ask).toBe("function");
  });
});
