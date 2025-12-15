import { updateReportPrompt } from "@core/domain/prompts/updateReportPrompt";
import { Report } from "@core/domain/entities/report";

describe("updateReportPrompt", () => {
  const mockPreviousReport: Report = {
    status: "processing",
    confirmedFacts: ["事実1", "事実2"],
    missingInformation: ["情報1"],
    logicSummary: "前回のロジックサマリー",
    overwritableInfo: null,
    sourceUrls: ["https://example.com/1"],
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  describe("プロンプトの生成", () => {
    it("前回の報告書を含むプロンプトを生成できること", () => {
      const prompt = updateReportPrompt(mockPreviousReport);

      expect(prompt).toContain("調査状況の更新");
      expect(prompt).toContain("前回の調査報告書");
      expect(prompt).toContain(JSON.stringify(mockPreviousReport));
    });

    it("追加テキストを含むプロンプトを生成できること", () => {
      const additionalText = "追加の指示: 最新情報を優先してください";
      const prompt = updateReportPrompt(mockPreviousReport, additionalText);

      expect(prompt).toContain(additionalText);
      expect(prompt).toContain(JSON.stringify(mockPreviousReport));
    });

    it("デフォルトの追加テキスト（空文字列）でもプロンプトを生成できること", () => {
      const prompt = updateReportPrompt(mockPreviousReport);

      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("completedステータスの報告書でもプロンプトを生成できること", () => {
      const completedReport: Report = {
        ...mockPreviousReport,
        status: "completed",
        missingInformation: [],
      };

      const prompt = updateReportPrompt(completedReport);

      expect(prompt).toContain(JSON.stringify(completedReport));
      expect(prompt).toContain('"status":"completed"');
    });
  });

  describe("プロンプトの内容", () => {
    it("JSONスキーマの説明が含まれていること", () => {
      const prompt = updateReportPrompt(mockPreviousReport);

      expect(prompt).toContain('"status"');
      expect(prompt).toContain('"confirmedFacts"');
      expect(prompt).toContain('"sourceUrls"');
      expect(prompt).toContain('"toolExecutionSummary"');
      expect(prompt).toContain('"missingInformation"');
      expect(prompt).toContain('"logicSummary"');
    });

    it("更新の鉄則が含まれていること", () => {
      const prompt = updateReportPrompt(mockPreviousReport);

      expect(prompt).toContain("マージの徹底");
      expect(prompt).toContain("矛盾の解消");
      expect(prompt).toContain("情報源の参照");
      expect(prompt).toContain("継続の義務");
      expect(prompt).toContain("JSONファースト");
    });

    it("前回の報告書がJSON形式で含まれていること", () => {
      const prompt = updateReportPrompt(mockPreviousReport);

      const reportJson = JSON.stringify(mockPreviousReport);
      expect(prompt).toContain(reportJson);
      expect(prompt).toContain('"confirmedFacts":["事実1","事実2"]');
    });

    it("プロンプトの先頭と末尾に不要な空白がないこと", () => {
      const prompt = updateReportPrompt(mockPreviousReport);

      expect(prompt.trim()).toBe(prompt);
    });
  });

  describe("エッジケース", () => {
    it("空の配列を持つ報告書でもプロンプトを生成できること", () => {
      const emptyReport: Report = {
        status: "processing",
        confirmedFacts: [],
        missingInformation: [],
        logicSummary: "",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date(),
      };

      const prompt = updateReportPrompt(emptyReport);

      expect(prompt).toContain(JSON.stringify(emptyReport));
    });

    it("optionsフィールドを持つ報告書でもプロンプトを生成できること", () => {
      const reportWithOptions: Report<{ metadata: string }> = {
        ...mockPreviousReport,
        options: {
          metadata: "メタデータ",
        },
      };

      const prompt = updateReportPrompt(reportWithOptions);

      expect(prompt).toContain(JSON.stringify(reportWithOptions));
    });
  });
});
