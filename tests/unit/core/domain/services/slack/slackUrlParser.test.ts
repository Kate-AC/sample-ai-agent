import {
  parseSlackUrl,
  ParsedSlackUrl,
} from "@core/domain/services/slack/slackUrlParser";

describe("parseSlackUrl", () => {
  describe("正常系", () => {
    it("通常のSlackメッセージURLをパースできること", () => {
      const url =
        "https://example.slack.com/archives/C1234567890/p1234567890123456";
      const result = parseSlackUrl(url);

      expect(result).not.toBeNull();
      expect(result?.channelId).toBe("C1234567890");
      expect(result?.ts).toBe("1234567890.123456");
      expect(result?.threadTs).toBeNull();
    });

    it("スレッドメッセージURLをパースできること", () => {
      const url =
        "https://example.slack.com/archives/C1234567890/p1234567890123456?thread_ts=1234567890.000000";
      const result = parseSlackUrl(url);

      expect(result).not.toBeNull();
      expect(result?.channelId).toBe("C1234567890");
      expect(result?.ts).toBe("1234567890.123456");
      expect(result?.threadTs).toBe("1234567890.000000");
    });

    it("クエリパラメータが複数あるURLをパースできること", () => {
      const url =
        "https://example.slack.com/archives/C1234567890/p1234567890123456?thread_ts=1234567890.000000&foo=bar";
      const result = parseSlackUrl(url);

      expect(result).not.toBeNull();
      expect(result?.channelId).toBe("C1234567890");
      expect(result?.ts).toBe("1234567890.123456");
      expect(result?.threadTs).toBe("1234567890.000000");
    });

    it("タイムスタンプが10桁未満でもパースできること", () => {
      const url = "https://example.slack.com/archives/C1234567890/p1234567890";
      const result = parseSlackUrl(url);

      expect(result).not.toBeNull();
      expect(result?.channelId).toBe("C1234567890");
      // 10桁未満の場合はsliceでエラーにならないか確認
      expect(result?.ts).toBeTruthy();
    });

    it("タイムスタンプが長い場合でもパースできること", () => {
      const url =
        "https://example.slack.com/archives/C1234567890/p12345678901234567890";
      const result = parseSlackUrl(url);

      expect(result).not.toBeNull();
      expect(result?.channelId).toBe("C1234567890");
      expect(result?.ts).toBe("1234567890.1234567890");
    });
  });

  describe("異常系", () => {
    it("無効なURL形式の場合nullを返すこと", () => {
      const url = "https://example.com/invalid";
      const result = parseSlackUrl(url);

      expect(result).toBeNull();
    });

    it("SlackのURLではない場合でもパターンに一致すればパースできること", () => {
      // 実装では/archives/.../p...のパターンに一致すればパースされる
      const url = "https://google.com/archives/C123/p1234567890123456";
      const result = parseSlackUrl(url);

      // パターンに一致するため、パースされる
      expect(result).not.toBeNull();
      expect(result?.channelId).toBe("C123");
    });

    it("archivesパスがない場合nullを返すこと", () => {
      const url = "https://example.slack.com/messages/C1234567890";
      const result = parseSlackUrl(url);

      expect(result).toBeNull();
    });

    it("タイムスタンプがない場合nullを返すこと", () => {
      const url = "https://example.slack.com/archives/C1234567890";
      const result = parseSlackUrl(url);

      expect(result).toBeNull();
    });

    it("空文字列の場合nullを返すこと", () => {
      const result = parseSlackUrl("");

      expect(result).toBeNull();
    });
  });

  describe("タイムスタンプの変換", () => {
    it("タイムスタンプが正しく変換されること", () => {
      const url =
        "https://example.slack.com/archives/C1234567890/p1234567890123456";
      const result = parseSlackUrl(url);

      // p1234567890123456 -> 1234567890.123456
      expect(result?.ts).toBe("1234567890.123456");
    });

    it("タイムスタンプが10桁の場合でも変換できること", () => {
      const url = "https://example.slack.com/archives/C1234567890/p1234567890";
      const result = parseSlackUrl(url);

      // p1234567890 -> 1234567890. (空文字列)
      expect(result?.ts).toBeTruthy();
    });
  });

  describe("thread_tsの抽出", () => {
    it("thread_tsが存在する場合正しく抽出できること", () => {
      const url =
        "https://example.slack.com/archives/C1234567890/p1234567890123456?thread_ts=9876543210.654321";
      const result = parseSlackUrl(url);

      expect(result?.threadTs).toBe("9876543210.654321");
    });

    it("thread_tsが存在しない場合nullを返すこと", () => {
      const url =
        "https://example.slack.com/archives/C1234567890/p1234567890123456";
      const result = parseSlackUrl(url);

      expect(result?.threadTs).toBeNull();
    });

    it("thread_tsが空の場合nullを返すこと", () => {
      const url =
        "https://example.slack.com/archives/C1234567890/p1234567890123456?thread_ts=";
      const result = parseSlackUrl(url);

      expect(result?.threadTs).toBeNull();
    });
  });
});
