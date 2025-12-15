import {
  askClaude,
  buildInitialPrompt,
  extractResponseText,
  extractToolUses,
} from "application/services/claudeInteractor";
import type {
  ClaudeAiModel,
  ClaudeCreateMessagePayload,
  ClaudeExtendedTextPayload,
  ClaudeToolUseSchema,
  McpRegistry,
} from "sample-mcp";
import type { ThreadContext } from "domain/entities/answerQuestion";

// テスト用ヘルパー: ClaudeCreateMessagePayload から ClaudeExtendedTextPayload を生成
const toExtendedPayload = (
  payload: ClaudeCreateMessagePayload,
): ClaudeExtendedTextPayload => {
  const textContent = payload.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  return {
    text: textContent,
    finishReason: payload.stop_reason === "tool_use" ? "tool-calls" : "stop",
    usage: {
      promptTokens: payload.usage.input_tokens,
      completionTokens: payload.usage.output_tokens,
      totalTokens: payload.usage.input_tokens + payload.usage.output_tokens,
    },
    model: payload.model,
    metadata: {
      id: payload.id,
      rawContent: payload.content,
      stopReason: payload.stop_reason,
      stopSequence: payload.stop_sequence,
    },
  };
};

describe("claudeInteractor", () => {
  const createMockClaudeModel = (): ClaudeAiModel => {
    return {
      aiModelFunctions: {
        ask: jest.fn(),
        askJson: jest.fn(),
      },
      aiModelMetadata: {
        name: "claude",
        description: "Claude AI Model",
        version: "1.0.0",
      },
      aiModelSetting: {
        defaultModel: "claude-3-5-sonnet-20241022",
        defaultMaxTokens: 4096,
        requiresAuth: true,
      },
    } as unknown as ClaudeAiModel;
  };

  const createMockThreadContext = (): ThreadContext => ({
    userQuestion: "テスト質問",
    messages: [{ text: "テスト質問", ts: "1234567890.123456" }],
  });

  const createMockMcpRegistry = (): McpRegistry =>
    ({
      getAllMcpNames: jest.fn().mockReturnValue(["slack", "redmine"]),
      getMcp: jest.fn((name: string) => ({
        mcpMetadata: {
          getSummary: jest.fn().mockReturnValue([]),
          getUsageContext: jest.fn().mockReturnValue([]),
          getCommands: jest.fn().mockReturnValue([]),
          getSecurityRules: jest
            .fn()
            .mockReturnValue(
              name === "redmine" ? ["個人情報は返答しないこと"] : [],
            ),
        },
        mcpFunctions: {},
        mcpSetting: {},
      })),
    }) as any;

  const createMockTools = (): ClaudeToolUseSchema[] => [
    {
      name: "slack_search",
      description: "Search Slack messages",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  ];

  describe("askClaude", () => {
    it("初回実行時は初期プロンプトを使用する", async () => {
      const mockClaudeModel = createMockClaudeModel();
      const mockContext = createMockThreadContext();
      const mockTools = createMockTools();

      (mockClaudeModel.aiModelFunctions.ask as jest.Mock).mockResolvedValue({
        isSuccess: true,
        payload: {
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "回答です" }],
          model: "claude-3-5-sonnet-20241022",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      });

      const mockRegistry = createMockMcpRegistry();
      await askClaude(
        mockClaudeModel,
        mockContext,
        [],
        true,
        mockTools,
        mockRegistry,
      );

      expect(mockClaudeModel.aiModelFunctions.ask).toHaveBeenCalledWith(
        [
          {
            role: "user",
            content: expect.stringContaining("テスト質問"),
          },
        ],
        mockTools,
        expect.objectContaining({
          system: expect.stringContaining("オープンロジのエンジニア"),
        }),
      );
    });

    it("2回目以降は会話履歴を使用する", async () => {
      const mockClaudeModel = createMockClaudeModel();
      const mockContext = createMockThreadContext();
      const mockTools = createMockTools();
      const conversationHistory = [
        { role: "user" as const, content: "前の質問" },
        { role: "assistant" as const, content: "前の回答" },
      ];

      (mockClaudeModel.aiModelFunctions.ask as jest.Mock).mockResolvedValue({
        isSuccess: true,
        payload: {
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "回答です" }],
          model: "claude-3-5-sonnet-20241022",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      });

      const mockRegistry = createMockMcpRegistry();
      await askClaude(
        mockClaudeModel,
        mockContext,
        conversationHistory,
        false,
        mockTools,
        mockRegistry,
      );

      expect(mockClaudeModel.aiModelFunctions.ask).toHaveBeenCalledWith(
        conversationHistory,
        mockTools,
        expect.any(Object),
      );
    });
  });

  describe("buildInitialPrompt", () => {
    it("質問とスレッド履歴から初期プロンプトを構築する", () => {
      const context = createMockThreadContext();
      const mockRegistry = createMockMcpRegistry();
      const prompt = buildInitialPrompt(context, mockRegistry);

      expect(prompt).toContain("テスト質問");
    });

    it("複数メッセージがある場合、スレッド履歴が含まれる", () => {
      const context: ThreadContext = {
        userQuestion: "質問",
        messages: [
          { text: "メッセージ1", ts: "1234567890.123456" },
          { text: "メッセージ2", ts: "1234567891.234567" },
        ],
      };
      const mockRegistry = createMockMcpRegistry();

      const prompt = buildInitialPrompt(context, mockRegistry);

      expect(prompt).toContain("【スレッドの履歴】");
      expect(prompt).toContain("メッセージ1");
      expect(prompt).toContain("メッセージ2");
    });

    it("セキュリティルールがある場合、プロンプトに含まれる", () => {
      const context = createMockThreadContext();
      const mockRegistry = createMockMcpRegistry();

      const prompt = buildInitialPrompt(context, mockRegistry);

      expect(prompt).toContain("【セキュリティルール】");
      expect(prompt).toContain("[redmine] 個人情報は返答しないこと");
    });

    it("Slack URLが含まれている場合、ツール使用の指示が含まれる", () => {
      const context: ThreadContext = {
        userQuestion:
          "<https://your-workspace.slack.com/archives/C123/p1234567890123456>",
        messages: [],
      };
      const mockRegistry = createMockMcpRegistry();

      const prompt = buildInitialPrompt(context, mockRegistry);

      expect(prompt).toContain(
        "【重要】質問にSlackのメッセージURLが含まれている可能性があります",
      );
      expect(prompt).toContain("slack_getThreadMessages");
      expect(prompt).toContain(
        "https://your-workspace.slack.com/archives/C123/p1234567890123456",
      );
    });

    it("Slack URLが<>なしでも検出できる", () => {
      const context: ThreadContext = {
        userQuestion:
          "https://your-workspace.slack.com/archives/C123/p1234567890123456について教えて",
        messages: [],
      };
      const mockRegistry = createMockMcpRegistry();

      const prompt = buildInitialPrompt(context, mockRegistry);

      expect(prompt).toContain(
        "【重要】質問にSlackのメッセージURLが含まれている可能性があります",
      );
    });
  });

  describe("extractResponseText", () => {
    it("ClaudeCreateMessagePayloadからテキストを抽出する", () => {
      const payload: ClaudeCreateMessagePayload = {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "これが回答です" }],
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      };

      const result = extractResponseText(toExtendedPayload(payload));

      expect(result).toBe("これが回答です");
    });

    it("複数のテキストコンテンツを結合する", () => {
      const payload: ClaudeCreateMessagePayload = {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [
          { type: "text", text: "最初のテキスト" },
          { type: "text", text: "2番目のテキスト" },
        ],
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      };

      const result = extractResponseText(toExtendedPayload(payload));

      expect(result).toBe("最初のテキスト\n2番目のテキスト");
    });

    it("tool_useコンテンツは無視する", () => {
      const payload: ClaudeCreateMessagePayload = {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [
          { type: "text", text: "テキスト" },
          { type: "tool_use", id: "tool_1", name: "search", input: {} },
        ],
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "tool_use",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      };

      const result = extractResponseText(toExtendedPayload(payload));

      expect(result).toBe("テキスト");
    });
  });

  describe("extractToolUses", () => {
    it("tool_useコンテンツを抽出する", () => {
      const payload: ClaudeCreateMessagePayload = {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [
          { type: "text", text: "テキスト" },
          {
            type: "tool_use",
            id: "tool_1",
            name: "search",
            input: { query: "test" },
          },
        ],
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "tool_use",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      };

      const result = extractToolUses(toExtendedPayload(payload));

      expect(result).toEqual([
        { id: "tool_1", name: "search", input: { query: "test" } },
      ]);
    });
  });
});
