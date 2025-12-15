import { parseJsonFromText } from "@core/domain/services/reportJsonParser";
import { PromptComplianceError } from "@core/domain/errors/promptComplianceError";
import { Report } from "@core/domain/entities/report";

describe("parseJsonFromText", () => {
  describe("正常系", () => {
    it("通常のReport形式のJSONをパースできること", () => {
      const text = JSON.stringify({
        status: "processing",
        confirmedFacts: ["事実1", "事実2"],
        missingInformation: ["情報1"],
        logicSummary: "ロジックサマリー",
        sourceUrls: ["https://example.com"],
        updatedAt: "2024-01-01T00:00:00.000Z",
      });
      const result = parseJsonFromText(text);

      expect(result.status).toBe("processing");
      expect(result.confirmedFacts).toEqual(["事実1", "事実2"]);
      expect(result.missingInformation).toEqual(["情報1"]);
      expect(result.logicSummary).toBe("ロジックサマリー");
      expect(result.sourceUrls).toEqual(["https://example.com"]);
    });

    it("completedステータスのReportをパースできること", () => {
      const text = JSON.stringify({
        status: "completed",
        confirmedFacts: ["完了した事実"],
        missingInformation: [],
        logicSummary: "完了したロジック",
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
      });
      const result = parseJsonFromText(text);

      expect(result.status).toBe("completed");
      expect(result.missingInformation).toEqual([]);
    });

    it("コードブロックで囲まれたReport JSONをパースできること", () => {
      const report = {
        status: "processing",
        confirmedFacts: ["事実"],
        missingInformation: [],
        logicSummary: "ロジック",
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
      };
      const text = `\`\`\`json\n${JSON.stringify(report)}\n\`\`\``;
      const result = parseJsonFromText(text);

      expect(result.status).toBe("processing");
      expect(result.confirmedFacts).toEqual(["事実"]);
    });

    it("optionsフィールドを含むReportをパースできること", () => {
      const text = JSON.stringify({
        status: "processing",
        confirmedFacts: [],
        missingInformation: [],
        logicSummary: "",
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
        options: {
          metadata: "メタデータ",
        },
      });
      const result = parseJsonFromText(text);

      expect(result.options).toEqual({ metadata: "メタデータ" });
    });
  });

  describe("異常系", () => {
    it("空文字列の場合PromptComplianceErrorをスローすること", () => {
      expect(() => {
        parseJsonFromText("");
      }).toThrow(PromptComplianceError);

      expect(() => {
        parseJsonFromText("");
      }).toThrow("返答の文字列が空です");
    });

    it("空白のみの文字列の場合PromptComplianceErrorをスローすること", () => {
      expect(() => {
        parseJsonFromText("   ");
      }).toThrow(PromptComplianceError);
    });

    it("JSONが含まれていない場合PromptComplianceErrorをスローすること", () => {
      expect(() => {
        parseJsonFromText("これはJSONではありません");
      }).toThrow(PromptComplianceError);

      expect(() => {
        parseJsonFromText("これはJSONではありません");
      }).toThrow("返答の文字列がJSONではない可能性があります");
    });

    it("不正なJSON形式の場合PromptComplianceErrorをスローすること", () => {
      // 実装では、JSONの開始ブレースがない場合は「JSONではない可能性があります」エラー
      // JSON.parseでエラーになる場合は「パースできませんでした」エラー
      // 不完全なJSON（閉じ括弧がない）の場合、jsonMatchにマッチしないため「JSONではない可能性があります」エラー
      expect(() => {
        parseJsonFromText('{"status": "processing"');
      }).toThrow(PromptComplianceError);

      expect(() => {
        parseJsonFromText('{"status": "processing"');
      }).toThrow("返答の文字列がJSONではない可能性があります");
    });

    it("閉じ括弧があるが不正なJSON形式の場合PromptComplianceErrorをスローすること", () => {
      // 閉じ括弧があるが、JSON.parseでエラーになる場合
      expect(() => {
        parseJsonFromText('{"status": "processing",}');
      }).toThrow(PromptComplianceError);

      expect(() => {
        parseJsonFromText('{"status": "processing",}');
      }).toThrow("返答の文字列をJSONにパースできませんでした");
    });
  });

  describe("型チェック", () => {
    it("返り値がReport型であること", () => {
      const text = JSON.stringify({
        status: "processing",
        confirmedFacts: [],
        missingInformation: [],
        logicSummary: "",
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
      });
      const result: Report = parseJsonFromText(text);

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("confirmedFacts");
      expect(result).toHaveProperty("missingInformation");
      expect(result).toHaveProperty("logicSummary");
      expect(result).toHaveProperty("sourceUrls");
      expect(result).toHaveProperty("updatedAt");
    });
  });

  describe("エッジケース", () => {
    it("空の配列を持つReportをパースできること", () => {
      const text = JSON.stringify({
        status: "processing",
        confirmedFacts: [],
        missingInformation: [],
        logicSummary: "",
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
      });
      const result = parseJsonFromText(text);

      expect(result.confirmedFacts).toEqual([]);
      expect(result.missingInformation).toEqual([]);
      expect(result.sourceUrls).toEqual([]);
    });

    it("長い文字列を含むReportをパースできること", () => {
      const longText = "a".repeat(1000);
      const text = JSON.stringify({
        status: "processing",
        confirmedFacts: [longText],
        missingInformation: [],
        logicSummary: longText,
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
      });
      const result = parseJsonFromText(text);

      expect(result.confirmedFacts[0]).toBe(longText);
      expect(result.logicSummary).toBe(longText);
    });
  });
});
