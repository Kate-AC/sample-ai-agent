import { makeClaudeRepository } from "@core/infrastructure/claude/claudeRepository";
import {
  ClaudeAiModel,
  ClaudeMessage,
  ClaudeToolUseSchema,
  Result,
  ClaudeTextPayload,
} from "sample-mcp-kit";

describe("makeClaudeRepository", () => {
  const createMockClaudeModel = (): ClaudeAiModel => {
    return {
      aiModelFunctions: {
        ask: jest.fn(),
        askJson: jest.fn(),
      },
      aiModelMetadata: {
        getSummary: jest.fn(),
        getUsageContext: jest.fn(),
        getFunctions: jest.fn(),
        getSecurityRules: jest.fn(),
      },
      aiModelSetting: {
        getConfig: jest.fn(),
        getEnv: jest.fn(),
      },
    } as unknown as ClaudeAiModel;
  };

  describe("正常系", () => {
    it("ClaudeRepositoryを正しく作成できること", () => {
      const mockClaudeModel = createMockClaudeModel();
      const repository = makeClaudeRepository({ claudeModel: mockClaudeModel });

      expect(repository).toBeDefined();
      expect(typeof repository.ask).toBe("function");
    });

    it("デフォルトの依存関係でClaudeRepositoryを作成できること", () => {
      const repository = makeClaudeRepository();

      expect(repository).toBeDefined();
      expect(typeof repository.ask).toBe("function");
    });

    it("askメソッドが単一のClaudeMessageを受け取れること", async () => {
      const mockClaudeModel = createMockClaudeModel();
      const mockResult: Result<ClaudeTextPayload> = {
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
        },
      };

      (mockClaudeModel.aiModelFunctions.ask as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeClaudeRepository({ claudeModel: mockClaudeModel });
      const message: ClaudeMessage = { role: "user", content: "テスト" };

      const result = await repository.ask(message);

      expect(mockClaudeModel.aiModelFunctions.ask).toHaveBeenCalledWith(
        [message],
        undefined,
        undefined,
      );
      expect(result.isSuccess).toBe(true);
    });

    it("askメソッドがClaudeMessage配列を受け取れること", async () => {
      const mockClaudeModel = createMockClaudeModel();
      const mockResult: Result<ClaudeTextPayload> = {
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
        },
      };

      (mockClaudeModel.aiModelFunctions.ask as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeClaudeRepository({ claudeModel: mockClaudeModel });
      const messages: ClaudeMessage[] = [
        { role: "user", content: "テスト1" },
        { role: "assistant", content: "テスト2" },
      ];

      const result = await repository.ask(messages);

      expect(mockClaudeModel.aiModelFunctions.ask).toHaveBeenCalledWith(
        messages,
        undefined,
        undefined,
      );
      expect(result.isSuccess).toBe(true);
    });

    it("askメソッドがtoolsパラメータを受け取れること", async () => {
      const mockClaudeModel = createMockClaudeModel();
      const mockResult: Result<ClaudeTextPayload> = {
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
        },
      };

      (mockClaudeModel.aiModelFunctions.ask as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeClaudeRepository({ claudeModel: mockClaudeModel });
      const message: ClaudeMessage = { role: "user", content: "テスト" };
      const tools: ClaudeToolUseSchema[] = [
        {
          name: "test_tool",
          description: "テストツール",
          input_schema: {
            type: "object",
            properties: {},
          },
        },
      ];

      const result = await repository.ask(message, tools);

      expect(mockClaudeModel.aiModelFunctions.ask).toHaveBeenCalledWith(
        [message],
        tools,
        undefined,
      );
      expect(result.isSuccess).toBe(true);
    });

    it("askメソッドがoptionsパラメータを受け取れること", async () => {
      const mockClaudeModel = createMockClaudeModel();
      const mockResult: Result<ClaudeTextPayload> = {
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
        },
      };

      (mockClaudeModel.aiModelFunctions.ask as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeClaudeRepository({ claudeModel: mockClaudeModel });
      const message: ClaudeMessage = { role: "user", content: "テスト" };
      const options = { system: "システムプロンプト" };

      const result = await repository.ask(message, undefined, options);

      expect(mockClaudeModel.aiModelFunctions.ask).toHaveBeenCalledWith(
        [message],
        undefined,
        options,
      );
      expect(result.isSuccess).toBe(true);
    });
  });
});
