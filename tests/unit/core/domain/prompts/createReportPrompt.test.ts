import { createReportPrompt } from "@core/domain/prompts/createReportPrompt";

describe("createReportPrompt", () => {
  describe("プロンプトの生成", () => {
    it("デフォルトのプロンプトを生成できること", () => {
      const prompt = createReportPrompt();

      expect(prompt).toContain("調査状況の構造化");
      expect(prompt).toContain("JSON形式");
      expect(prompt).toContain("status");
      expect(prompt).toContain("confirmedFacts");
      expect(prompt).toContain("sourceUrls");
      expect(prompt).toContain("missingInformation");
      expect(prompt).toContain("logicSummary");
    });

    it("追加テキストを含むプロンプトを生成できること", () => {
      const additionalText = "追加の指示: 重要事項を優先してください";
      const prompt = createReportPrompt(additionalText);

      expect(prompt).toContain(additionalText);
      expect(prompt).toContain("調査状況の構造化");
    });

    it("空文字列の追加テキストでもプロンプトを生成できること", () => {
      const prompt = createReportPrompt("");

      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("複数行の追加テキストを含むプロンプトを生成できること", () => {
      const additionalText = "追加の指示1\n追加の指示2\n追加の指示3";
      const prompt = createReportPrompt(additionalText);

      expect(prompt).toContain("追加の指示1");
      expect(prompt).toContain("追加の指示2");
      expect(prompt).toContain("追加の指示3");
    });
  });

  describe("プロンプトの内容", () => {
    it("JSONスキーマの説明が含まれていること", () => {
      const prompt = createReportPrompt();

      expect(prompt).toContain('"status"');
      expect(prompt).toContain('"confirmedFacts"');
      expect(prompt).toContain('"sourceUrls"');
      expect(prompt).toContain('"toolExecutionSummary"');
      expect(prompt).toContain('"missingInformation"');
      expect(prompt).toContain('"logicSummary"');
    });

    it("行動指針が含まれていること", () => {
      const prompt = createReportPrompt();

      expect(prompt).toContain("JSONファースト");
      expect(prompt).toContain("事実の峻別");
      expect(prompt).toContain("情報源の参照");
      expect(prompt).toContain("継続的更新");
    });

    it("プロンプトの先頭と末尾に不要な空白がないこと", () => {
      const prompt = createReportPrompt();

      expect(prompt.trim()).toBe(prompt);
    });
  });
});
