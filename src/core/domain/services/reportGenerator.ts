import { Report } from "../entities/report";

/**
 * レポートを返す処理
 */
export interface ReportGenerator<T = unknown, U = unknown> {
  generate: (
    initialMessage: string,
    previousReport: Report<U>,
    payload: T,
  ) => Promise<Report<U>>;
}
