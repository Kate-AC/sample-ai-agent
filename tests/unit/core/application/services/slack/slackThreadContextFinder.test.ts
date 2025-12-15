import { makeSlackThreadContextFinder } from "@core/application/services/slack/slackThreadContextFinder";
import { SlackRepository } from "@core/domain/repositories/slack/slackRepository";
import { SlackThreadMessage } from "@core/domain/entities/slack/thread";

describe("makeSlackThreadContextFinder", () => {
  const createMockSlackRepository = (): SlackRepository => {
    return {
      fetch: jest.fn(),
      fetchAll: jest.fn(),
      replyWithFeedbackForm: jest.fn(),
      addReaction: jest.fn(),
      getChannelHistory: jest.fn(),
    };
  };

  describe("invoke", () => {
    it("スレッドコンテキストを正しく取得できること", async () => {
      const mockSlackRepository = createMockSlackRepository();
      const threadMessages: SlackThreadMessage[] = [
        {
          ts: "1234567890.123456",
          text: "質問",
          channel: "C1234567890",
        },
        {
          ts: "1234567890.123457",
          text: "回答1",
          channel: "C1234567890",
          thread_ts: "1234567890.123456",
        },
      ];

      (mockSlackRepository.fetchAll as jest.Mock).mockResolvedValue(
        threadMessages,
      );

      const finder = makeSlackThreadContextFinder({
        slackRepository: mockSlackRepository,
      });
      const messageUrl =
        "https://example.slack.com/archives/C1234567890/p1234567890123456";

      const context = await finder.invoke(messageUrl);

      expect(context.threadMessages).toHaveLength(2);
      expect(context.userQuestion.text).toBe("質問");
      expect(context.userQuestion.ts).toBe("1234567890.123456");
    });

    it("無効なURLの場合はエラーをスローすること", async () => {
      const mockSlackRepository = createMockSlackRepository();
      const finder = makeSlackThreadContextFinder({
        slackRepository: mockSlackRepository,
      });

      await expect(finder.invoke("https://invalid-url.com")).rejects.toThrow(
        "Invalid Slack message URL",
      );
    });

    it("スレッドメッセージが取得できない場合はエラーをスローすること", async () => {
      const mockSlackRepository = createMockSlackRepository();
      (mockSlackRepository.fetchAll as jest.Mock).mockResolvedValue(null);

      const finder = makeSlackThreadContextFinder({
        slackRepository: mockSlackRepository,
      });
      const messageUrl =
        "https://example.slack.com/archives/C1234567890/p1234567890123456";

      await expect(finder.invoke(messageUrl)).rejects.toThrow(
        "Failed to fetch thread messages",
      );
    });

    it("空配列の場合はエラーをスローすること", async () => {
      const mockSlackRepository = createMockSlackRepository();
      (mockSlackRepository.fetchAll as jest.Mock).mockResolvedValue([]);

      const finder = makeSlackThreadContextFinder({
        slackRepository: mockSlackRepository,
      });
      const messageUrl =
        "https://example.slack.com/archives/C1234567890/p1234567890123456";

      await expect(finder.invoke(messageUrl)).rejects.toThrow(
        "Failed to fetch thread messages",
      );
    });

    it("対象メッセージが見つからない場合はエラーをスローすること", async () => {
      const mockSlackRepository = createMockSlackRepository();
      const threadMessages: SlackThreadMessage[] = [
        {
          ts: "1234567890.999999",
          text: "別のメッセージ",
          channel: "C1234567890",
        },
      ];

      (mockSlackRepository.fetchAll as jest.Mock).mockResolvedValue(
        threadMessages,
      );

      const finder = makeSlackThreadContextFinder({
        slackRepository: mockSlackRepository,
      });
      const messageUrl =
        "https://example.slack.com/archives/C1234567890/p1234567890123456";

      await expect(finder.invoke(messageUrl)).rejects.toThrow(
        "Target message not found in thread",
      );
    });
  });
});
