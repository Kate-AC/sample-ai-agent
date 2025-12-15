import { extractDatadogUrl } from "@projects/shared/application/services/datadogUrlExtractor";

describe("extractDatadogUrl", () => {
  describe("通常のDatadog URLを抽出する", () => {
    test("logsのURLを抽出できる", () => {
      const text = "https://app.datadoghq.com/logs?query=error";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/logs?query=error",
      );
    });

    test("monitorsのURLを抽出できる", () => {
      const text = "check https://app.datadoghq.com/monitors/12345 for details";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/monitors/12345",
      );
    });

    test("error-trackingのURLを抽出できる", () => {
      const text = "https://app.datadoghq.com/error-tracking/issues/abc123";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/error-tracking/issues/abc123",
      );
    });

    test("apmのURLを抽出できる", () => {
      const text = "https://app.datadoghq.com/apm/traces?traceId=xyz";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/apm/traces?traceId=xyz",
      );
    });

    test("infrastructureのURLを抽出できる", () => {
      const text = "https://app.datadoghq.com/infrastructure/map";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/infrastructure/map",
      );
    });

    test("eventsのURLを抽出できる", () => {
      const text = "https://app.datadoghq.com/events?query=source:aws";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/events?query=source:aws",
      );
    });
  });

  describe("Slackのリンク形式 <url|表示テキスト> を処理する", () => {
    test("<url|text>形式からURLを抽出できる", () => {
      const text = "<https://app.datadoghq.com/logs?query=error|ログを確認>";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/logs?query=error",
      );
    });

    test("<url>形式（表示テキストなし）からURLを抽出できる", () => {
      const text = "<https://app.datadoghq.com/monitors/123>";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/monitors/123",
      );
    });
  });

  describe("HTMLエンティティ &amp; を & に変換する", () => {
    test("&amp;を&に変換する", () => {
      const text =
        "https://app.datadoghq.com/logs?query=error&amp;from_ts=1234567890&amp;to_ts=1234567999";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/logs?query=error&from_ts=1234567890&to_ts=1234567999",
      );
    });
  });

  describe("from_tsを含むURLを優先して返す", () => {
    test("from_tsを含むURLが優先される", () => {
      const text =
        "https://app.datadoghq.com/logs?query=error " +
        "https://app.datadoghq.com/logs?query=error&from_ts=1234567890&to_ts=1234567999";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/logs?query=error&from_ts=1234567890&to_ts=1234567999",
      );
    });

    test("from_tsがない場合は最初のURLを返す", () => {
      const text =
        "https://app.datadoghq.com/logs?query=first " +
        "https://app.datadoghq.com/logs?query=second";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/logs?query=first",
      );
    });

    test("&amp;でエンコードされたfrom_tsも優先される", () => {
      const text =
        "https://app.datadoghq.com/monitors/123 " +
        "https://app.datadoghq.com/logs?query=error&amp;from_ts=1234567890";
      expect(extractDatadogUrl(text)).toBe(
        "https://app.datadoghq.com/logs?query=error&from_ts=1234567890",
      );
    });
  });

  describe("URLが見つからない場合はnullを返す", () => {
    test("Datadog URLがない場合はnullを返す", () => {
      expect(extractDatadogUrl("エラーが発生しました")).toBeNull();
    });

    test("空文字の場合はnullを返す", () => {
      expect(extractDatadogUrl("")).toBeNull();
    });

    test("他のドメインのURLはnullを返す", () => {
      expect(
        extractDatadogUrl("https://app.example.com/logs?query=error"),
      ).toBeNull();
    });

    test("対象外のパス（dashboardなど）はnullを返す", () => {
      expect(
        extractDatadogUrl("https://app.datadoghq.com/dashboard/abc"),
      ).toBeNull();
    });
  });
});
