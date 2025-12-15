import { Report } from "@core/domain/entities/report";

export const reportToText = (report: Report): string =>
  [
    "【調査概要】",
    report.logicSummary,
    "",
    "【確認済み事実】",
    ...report.confirmedFacts.map((fact) => `- ${fact}`),
    "",
    "【不明点】",
    ...report.missingInformation.map((info) => `- ${info}`),
  ].join("\n");
