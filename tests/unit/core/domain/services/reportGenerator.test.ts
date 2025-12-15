import { ReportGenerator } from "@core/domain/services/reportGenerator";
import { Report } from "@core/domain/entities/report";

describe("ReportGenerator", () => {
  it("インターフェースが正しく定義されていること", () => {
    const generator: ReportGenerator = {
      generate: async (
        initialMessage: string,
        previousReport: Report,
        payload: unknown,
      ) => {
        return {
          status: "processing",
          confirmedFacts: [],
          missingInformation: [],
          logicSummary: "",
          overwritableInfo: null,
          sourceUrls: [],
          updatedAt: new Date(),
        };
      },
    };

    expect(generator).toBeDefined();
    expect(typeof generator.generate).toBe("function");
  });
});
