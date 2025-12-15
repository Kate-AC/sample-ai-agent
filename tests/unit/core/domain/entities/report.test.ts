import { Report, ReportStatus } from "@core/domain/entities/report";

describe("Report", () => {
  describe("型定義", () => {
    it("Report型の基本的な構造を満たすオブジェクトを作成できること", () => {
      const report: Report = {
        status: "processing",
        confirmedFacts: ["事実1", "事実2"],
        missingInformation: ["情報1"],
        logicSummary: "ロジックサマリー",
        overwritableInfo: null,
        sourceUrls: ["https://example.com"],
        updatedAt: new Date().toISOString(),
      };

      expect(report.status).toBe("processing");
      expect(report.confirmedFacts).toHaveLength(2);
      expect(report.missingInformation).toHaveLength(1);
      expect(report.sourceUrls).toHaveLength(1);
    });

    it("completedステータスのReportを作成できること", () => {
      const report: Report = {
        status: "completed",
        confirmedFacts: ["完了した事実"],
        missingInformation: [],
        logicSummary: "完了したロジック",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date(),
      };

      expect(report.status).toBe("completed");
      expect(report.missingInformation).toHaveLength(0);
    });

    it("optionsフィールドをオプショナルで含められること", () => {
      const report: Report<{ metadata: string }> = {
        status: "processing",
        confirmedFacts: [],
        missingInformation: [],
        logicSummary: "",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date(),
        options: {
          metadata: "メタデータ",
        },
      };

      expect(report.options?.metadata).toBe("メタデータ");
    });

    it("updatedAtがDate型でもstring型でも受け入れられること", () => {
      const reportWithDate: Report = {
        status: "processing",
        confirmedFacts: [],
        missingInformation: [],
        logicSummary: "",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date(),
      };

      const reportWithString: Report = {
        status: "processing",
        confirmedFacts: [],
        missingInformation: [],
        logicSummary: "",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      expect(reportWithDate.updatedAt).toBeInstanceOf(Date);
      expect(typeof reportWithString.updatedAt).toBe("string");
    });
  });

  describe("ReportStatus", () => {
    it("processingステータスが有効であること", () => {
      const status: ReportStatus = "processing";
      expect(status).toBe("processing");
    });

    it("completedステータスが有効であること", () => {
      const status: ReportStatus = "completed";
      expect(status).toBe("completed");
    });
  });
});
