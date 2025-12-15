import {
  SlackThreadMessage,
  SlackThreadContext,
} from "@core/domain/entities/slack/thread";

describe("SlackThreadMessage", () => {
  describe("型定義", () => {
    it("基本的なSlackThreadMessageを作成できること", () => {
      const message: SlackThreadMessage = {
        ts: "1234567890.123456",
        text: "テストメッセージ",
        channel: "C1234567890",
      };

      expect(message.ts).toBe("1234567890.123456");
      expect(message.text).toBe("テストメッセージ");
      expect(message.channel).toBe("C1234567890");
    });

    it("thread_tsフィールドをオプショナルで含められること", () => {
      const messageWithThread: SlackThreadMessage = {
        ts: "1234567890.123456",
        text: "スレッドメッセージ",
        thread_ts: "1234567890.000000",
        channel: "C1234567890",
      };

      expect(messageWithThread.thread_ts).toBe("1234567890.000000");
    });

    it("thread_tsがないメッセージも作成できること", () => {
      const messageWithoutThread: SlackThreadMessage = {
        ts: "1234567890.123456",
        text: "通常メッセージ",
        channel: "C1234567890",
      };

      expect(messageWithoutThread.thread_ts).toBeUndefined();
    });
  });
});

describe("SlackThreadContext", () => {
  describe("型定義", () => {
    it("基本的なSlackThreadContextを作成できること", () => {
      const userQuestion: SlackThreadMessage = {
        ts: "1234567890.123456",
        text: "質問",
        channel: "C1234567890",
      };

      const threadMessages: SlackThreadMessage[] = [
        userQuestion,
        {
          ts: "1234567890.123457",
          text: "回答1",
          thread_ts: "1234567890.123456",
          channel: "C1234567890",
        },
      ];

      const context: SlackThreadContext = {
        threadMessages,
        userQuestion,
      };

      expect(context.threadMessages).toHaveLength(2);
      expect(context.userQuestion).toBe(userQuestion);
      expect(context.userQuestion.text).toBe("質問");
    });

    it("空のスレッドメッセージ配列でも作成できること", () => {
      const userQuestion: SlackThreadMessage = {
        ts: "1234567890.123456",
        text: "質問",
        channel: "C1234567890",
      };

      const context: SlackThreadContext = {
        threadMessages: [],
        userQuestion,
      };

      expect(context.threadMessages).toHaveLength(0);
      expect(context.userQuestion).toBe(userQuestion);
    });
  });
});
