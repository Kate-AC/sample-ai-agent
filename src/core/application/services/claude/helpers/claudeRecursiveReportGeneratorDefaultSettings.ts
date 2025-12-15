import { RetryStrategy } from "sample-mcp-kit";
import { ClaudeRecursiveReportGeneratorState } from "../claudeRecursiveReportGenerator";
import { PromptComplianceError } from "domain/errors/promptComplianceError";

export const REPEAT_TIMES = 10;

export const RETRY_STRATEGY: RetryStrategy<ClaudeRecursiveReportGeneratorState> =
  {
    maxRetries: 5, // 最大5回リトライ
    shouldRetry: (error, attempt) => {
      console.log(
        `[ClaudeRecursiveReportGenerator] RetryAttempt: ${attempt}, Error: ${error instanceof Error ? error.message : String(error)}`,
      );

      // 429エラー（レート制限）の場合にリトライ
      const isRateLimitError =
        error instanceof Error && error.message.includes("429");

      // たまにフォーマット通りのプロンプトを返してくれない場合があるのでリトライ対象
      const isPromptComplianceError = error instanceof PromptComplianceError;

      if (isRateLimitError || isPromptComplianceError) {
        return true;
      }

      return false;
    },
    getWaitTime: (error, attempt) => {
      // 429エラー（レート制限）または「Too many tokens」エラーの場合のみ待機
      const isRateLimitError =
        error instanceof Error && error.message.includes("429");
      let waitTime = 0;

      if (isRateLimitError) {
        waitTime = 30000 * attempt;
      }

      console.log(`[ClaudeRecursiveReportGenerator] Wait time: ${waitTime}`);
      return waitTime;
    },
  };
