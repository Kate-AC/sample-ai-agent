import { gatherThreadContext } from "application/usecases/answerQuestion/gatherThreadContext";
import type { SlackMessage } from "domain/entities/answerQuestion";

describe("gatherThreadContext", () => {
  const createMockSlackMcp = () => ({
    mcpFunctions: {
      getThreadMessages: jest.fn(),
    },
    mcpMetadata: {} as any,
    mcpSetting: {} as any,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("正常系", () => {
    it("スレッドメッセージを取得してコンテキストを生成できること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const message: SlackMessage = {
        text: "最初のメッセージ",
        ts: "123.456",
      };

      // getThreadMessagesのモック
      (
        mockSlackMcp.mcpFunctions.getThreadMessages as jest.Mock
      ).mockResolvedValue({
        isSuccess: true,
        payload: {
          messages: [
            {
              text: "最初のメッセージ",
              ts: "123.456",
            },
            {
              text: "2番目のメッセージ",
              ts: "123.457",
            },
          ],
        },
      });

      const result = await gatherThreadContext(
        "C123",
        message,
        mockSlackMcp as any,
      );

      expect(result).toEqual({
        userQuestion: "最初のメッセージ",
        messages: [
          {
            text: "最初のメッセージ",
            ts: "123.456",
          },
          {
            text: "2番目のメッセージ",
            ts: "123.457",
          },
        ],
      });

      expect(mockSlackMcp.mcpFunctions.getThreadMessages).toHaveBeenCalledWith(
        "https://your-workspace.slack.com/archives/C123/p123456",
      );
    });

    it("スレッドメッセージが空の場合でもコンテキストを生成できること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const message: SlackMessage = {
        text: "質問",
        ts: "123.456",
      };

      (
        mockSlackMcp.mcpFunctions.getThreadMessages as jest.Mock
      ).mockResolvedValue({
        isSuccess: true,
        payload: {
          messages: [],
        },
      });

      const result = await gatherThreadContext(
        "C123",
        message,
        mockSlackMcp as any,
      );

      expect(result).toEqual({
        userQuestion: "質問",
        messages: [],
      });
    });

    it("thread_tsが存在する場合はthread_tsを使用すること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const message: SlackMessage = {
        text: "質問",
        ts: "123.457",
        thread_ts: "123.456",
      };

      (
        mockSlackMcp.mcpFunctions.getThreadMessages as jest.Mock
      ).mockResolvedValue({
        isSuccess: true,
        payload: {
          messages: [],
        },
      });

      await gatherThreadContext("C123", message, mockSlackMcp as any);

      expect(mockSlackMcp.mcpFunctions.getThreadMessages).toHaveBeenCalledWith(
        "https://your-workspace.slack.com/archives/C123/p123456",
      );
    });
  });

  describe("異常系", () => {
    it("messagesが存在しない場合でも正常に動作すること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const message: SlackMessage = {
        text: "質問",
        ts: "123.456",
      };

      (
        mockSlackMcp.mcpFunctions.getThreadMessages as jest.Mock
      ).mockResolvedValue({
        isSuccess: true,
        payload: {},
      });

      const result = await gatherThreadContext(
        "C123",
        message,
        mockSlackMcp as any,
      );

      expect(result).toEqual({
        userQuestion: "質問",
        messages: [],
      });
    });

    it("API失敗時でも空の配列を返すこと", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const message: SlackMessage = {
        text: "質問",
        ts: "123.456",
      };

      (
        mockSlackMcp.mcpFunctions.getThreadMessages as jest.Mock
      ).mockResolvedValue({
        isSuccess: false,
        message: "API Error",
      });

      const result = await gatherThreadContext(
        "C123",
        message,
        mockSlackMcp as any,
      );

      expect(result).toEqual({
        userQuestion: "質問",
        messages: [],
      });
    });
  });
});
