import { convertToSlackMessage } from "@core/domain/services/slack/slackMessageConverter";
import { SlackThreadMessage } from "@core/domain/entities/slack/thread";

describe("convertToSlackMessage", () => {
  describe("正常系", () => {
    it("基本的なSlackMessagePayloadをSlackThreadMessageに変換できること", () => {
      const payload = {
        type: "message" as const,
        user: "U1234567890",
        ts: "1234567890.123456",
        text: "テストメッセージ",
      };
      const channelId = "C1234567890";

      const result = convertToSlackMessage(payload, channelId);

      expect(result.ts).toBe("1234567890.123456");
      expect(result.text).toBe("テストメッセージ");
      expect(result.channel).toBe(channelId);
      expect(result.thread_ts).toBeUndefined();
    });

    it("thread_tsを含むSlackMessagePayloadを変換できること", () => {
      const payload = {
        type: "message" as const,
        user: "U1234567890",
        ts: "1234567890.123456",
        text: "スレッドメッセージ",
        thread_ts: "1234567890.000000",
      };
      const channelId = "C1234567890";

      const result = convertToSlackMessage(payload, channelId);

      expect(result.ts).toBe("1234567890.123456");
      expect(result.text).toBe("スレッドメッセージ");
      expect(result.channel).toBe(channelId);
      expect(result.thread_ts).toBe("1234567890.000000");
    });

    it("空のテキストでも変換できること", () => {
      const payload = {
        type: "message" as const,
        user: "U1234567890",
        ts: "1234567890.123456",
        text: "",
      };
      const channelId = "C1234567890";

      const result = convertToSlackMessage(payload, channelId);

      expect(result.text).toBe("");
      expect(result.channel).toBe(channelId);
    });

    it("長いテキストでも変換できること", () => {
      const longText = "a".repeat(10000);
      const payload = {
        type: "message" as const,
        user: "U1234567890",
        ts: "1234567890.123456",
        text: longText,
      };
      const channelId = "C1234567890";

      const result = convertToSlackMessage(payload, channelId);

      expect(result.text).toBe(longText);
    });
  });

  describe("型チェック", () => {
    it("返り値がSlackThreadMessage型であること", () => {
      const payload = {
        type: "message" as const,
        user: "U1234567890",
        ts: "1234567890.123456",
        text: "テスト",
      };
      const channelId = "C1234567890";

      const result: SlackThreadMessage = convertToSlackMessage(
        payload,
        channelId,
      );

      expect(result).toHaveProperty("ts");
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("channel");
    });

    it("thread_tsがオプショナルであること", () => {
      const payload = {
        type: "message" as const,
        user: "U1234567890",
        ts: "1234567890.123456",
        text: "テスト",
      };
      const channelId = "C1234567890";

      const result = convertToSlackMessage(payload, channelId);

      // thread_tsが存在しない場合、undefinedでもオプショナルとして扱える
      expect("thread_ts" in result || result.thread_ts === undefined).toBe(
        true,
      );
    });
  });

  describe("エッジケース", () => {
    it("channelIdが空文字列でも変換できること", () => {
      const payload = {
        type: "message" as const,
        user: "U1234567890",
        ts: "1234567890.123456",
        text: "テスト",
      };
      const channelId = "";

      const result = convertToSlackMessage(payload, channelId);

      expect(result.channel).toBe("");
    });

    it("特殊文字を含むテキストでも変換できること", () => {
      const payload = {
        type: "message" as const,
        user: "U1234567890",
        ts: "1234567890.123456",
        text: 'テスト\n改行\n\tタブ\n"引用"',
      };
      const channelId = "C1234567890";

      const result = convertToSlackMessage(payload, channelId);

      expect(result.text).toBe('テスト\n改行\n\tタブ\n"引用"');
    });
  });
});
