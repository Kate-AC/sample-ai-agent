import { makeSlackRepository } from "@core/infrastructure/slack/slackRepository";
import { SlackMcp, SlackMessagePayload, Result } from "sample-mcp-kit";
import { SlackThreadMessage } from "@core/domain/entities/slack/thread";

describe("makeSlackRepository", () => {
  const createMockSlackMcp = (): SlackMcp => {
    return {
      mcpFunctions: {
        getConversationHistory: jest.fn(),
        getThreadMessages: jest.fn(),
        postMessage: jest.fn(),
      },
      mcpMetadata: {} as any,
      mcpSetting: {} as any,
    } as unknown as SlackMcp;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetch", () => {
    it("メッセージURLからメッセージを取得できること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const mockMessage: SlackMessagePayload = {
        type: "message",
        user: "U1234567890",
        ts: "1234567890.123456",
        text: "テストメッセージ",
      };

      const mockResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {
          messages: [mockMessage],
        },
      };

      (
        mockSlackMcp.mcpFunctions.getConversationHistory as jest.Mock
      ).mockResolvedValue(mockResult);

      const repository = makeSlackRepository({ slackMcp: mockSlackMcp });
      const messageUrl =
        "https://example.slack.com/archives/C1234567890/p1234567890123456";

      const result = await repository.fetch(messageUrl);

      expect(result).not.toBeNull();
      expect(result?.text).toBe("テストメッセージ");
      expect(result?.channel).toBe("C1234567890");
      expect(result?.ts).toBe("1234567890.123456");
    });

    it("無効なURLの場合はnullを返すこと", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const repository = makeSlackRepository({ slackMcp: mockSlackMcp });

      const result = await repository.fetch("https://invalid-url.com");

      expect(result).toBeNull();
    });

    it("メッセージが見つからない場合はnullを返すこと", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const mockResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {
          messages: [],
        },
      };

      (
        mockSlackMcp.mcpFunctions.getConversationHistory as jest.Mock
      ).mockResolvedValue(mockResult);

      const repository = makeSlackRepository({ slackMcp: mockSlackMcp });
      const messageUrl =
        "https://example.slack.com/archives/C1234567890/p1234567890123456";

      const result = await repository.fetch(messageUrl);

      expect(result).toBeNull();
    });

    it("スレッドメッセージを取得できること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const threadMessage: SlackMessagePayload = {
        type: "message",
        user: "U1234567890",
        ts: "1234567890.123457",
        text: "スレッドメッセージ",
        thread_ts: "1234567890.123456",
      };

      const conversationResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {
          messages: [],
        },
      };

      const threadResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {
          messages: [threadMessage],
        },
      };

      (
        mockSlackMcp.mcpFunctions.getConversationHistory as jest.Mock
      ).mockResolvedValue(conversationResult);
      (
        mockSlackMcp.mcpFunctions.getThreadMessages as jest.Mock
      ).mockResolvedValue(threadResult);

      const repository = makeSlackRepository({ slackMcp: mockSlackMcp });
      const messageUrl =
        "https://example.slack.com/archives/C1234567890/p1234567890123457?thread_ts=1234567890.123456";

      const result = await repository.fetch(messageUrl);

      expect(result).not.toBeNull();
      expect(result?.text).toBe("スレッドメッセージ");
    });

    it("tombstoneメッセージはnullを返すこと", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const tombstoneMessage: SlackMessagePayload = {
        type: "message",
        user: "U1234567890",
        ts: "1234567890.123456",
        text: "",
        subtype: "tombstone",
      };

      const mockResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {
          messages: [tombstoneMessage],
        },
      };

      (
        mockSlackMcp.mcpFunctions.getConversationHistory as jest.Mock
      ).mockResolvedValue(mockResult);

      const repository = makeSlackRepository({ slackMcp: mockSlackMcp });
      const messageUrl =
        "https://example.slack.com/archives/C1234567890/p1234567890123456";

      const result = await repository.fetch(messageUrl);

      expect(result).toBeNull();
    });
  });

  describe("fetchAll", () => {
    it("スレッドの全メッセージを取得できること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const messages: SlackMessagePayload[] = [
        {
          type: "message",
          user: "U1234567890",
          ts: "1234567890.123456",
          text: "親メッセージ",
        },
        {
          type: "message",
          user: "U1234567890",
          ts: "1234567890.123457",
          text: "スレッドメッセージ1",
          thread_ts: "1234567890.123456",
        },
      ];

      const mockResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {
          messages,
        },
      };

      (
        mockSlackMcp.mcpFunctions.getThreadMessages as jest.Mock
      ).mockResolvedValue(mockResult);

      const repository = makeSlackRepository({ slackMcp: mockSlackMcp });
      const messageUrl =
        "https://example.slack.com/archives/C1234567890/p1234567890123456?thread_ts=1234567890.123456";

      const result = await repository.fetchAll(messageUrl);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result?.[0].text).toBe("親メッセージ");
      expect(result?.[1].text).toBe("スレッドメッセージ1");
    });

    it("無効なURLの場合はnullを返すこと", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const repository = makeSlackRepository({ slackMcp: mockSlackMcp });

      const result = await repository.fetchAll("https://invalid-url.com");

      expect(result).toBeNull();
    });

    it("スレッドメッセージ取得に失敗した場合は空配列を返すこと", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const mockResult: Result<any> = {
        isSuccess: false,
        status: 500,
        message: "エラー",
        payload: null as any,
      };

      (
        mockSlackMcp.mcpFunctions.getThreadMessages as jest.Mock
      ).mockResolvedValue(mockResult);

      const repository = makeSlackRepository({ slackMcp: mockSlackMcp });
      const messageUrl =
        "https://example.slack.com/archives/C1234567890/p1234567890123456?thread_ts=1234567890.123456";

      const result = await repository.fetchAll(messageUrl);

      expect(result).toEqual([]);
    });
  });

  describe("replyWithFeedbackForm", () => {
    it("フィードバックフォーム付きでメッセージを投稿できること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const mockResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {},
      };

      (mockSlackMcp.mcpFunctions.postMessage as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeSlackRepository({ slackMcp: mockSlackMcp });
      const target: SlackThreadMessage = {
        ts: "1234567890.123456",
        text: "質問",
        channel: "C1234567890",
      };
      const text = "回答です";

      await repository.replyWithFeedbackForm(target, text);

      expect(mockSlackMcp.mcpFunctions.postMessage).toHaveBeenCalledWith(
        "C1234567890",
        "回答です",
        expect.stringContaining('"thread_ts"'),
      );
      expect(mockSlackMcp.mcpFunctions.postMessage).toHaveBeenCalledWith(
        "C1234567890",
        "回答です",
        expect.stringContaining('"type":"actions"'),
      );
    });

    it("thread_tsが存在する場合はthread_tsを使用すること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const mockResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {},
      };

      (mockSlackMcp.mcpFunctions.postMessage as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeSlackRepository({ slackMcp: mockSlackMcp });
      const target: SlackThreadMessage = {
        ts: "1234567890.123457",
        text: "質問",
        channel: "C1234567890",
        thread_ts: "1234567890.123456",
      };
      const text = "回答です";

      await repository.replyWithFeedbackForm(target, text);

      const callArgs = (mockSlackMcp.mcpFunctions.postMessage as jest.Mock).mock
        .calls[0];
      const options = JSON.parse(callArgs[2]);

      expect(options.thread_ts).toBe("1234567890.123456");
    });
  });
});
