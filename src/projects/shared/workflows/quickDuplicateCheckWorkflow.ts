import { SlackThreadContextFinder } from "src/core/application/services/slack/slackThreadContextFinder";
import { SlackRepository } from "src/core/domain/repositories/slack/slackRepository";
import { ClaudeRepository } from "src/core/domain/repositories/claude/claudeRepository";
import {
  ClaudeMessage,
  executeWithRetry,
  type RetryStrategy,
} from "sample-mcp-kit";
import { DatadogRepository } from "sample-mcp-kit/dist/src/platforms/datadog/domain/repositories/datadogRepository";
import { OpsSheetHandler } from "@projects/shared/application/services/opsSheetHandler";
import { extractDatadogUrl } from "@projects/shared/application/services/datadogUrlExtractor";
import {
  buildDuplicateCheckPrompt,
  parseDuplicateCheckResult,
  type DuplicateCheckResult,
} from "./prompts/quickDuplicateCheck/duplicateCheckPrompt";

export interface QuickDuplicateCheckWorkflow {
  invoke: (
    slackMessageUrl: string,
    isDryRun?: boolean,
  ) => Promise<{ skipped: boolean }>;
}

export const makeQuickDuplicateCheckWorkflow = (deps: {
  slackThreadContextFinder: SlackThreadContextFinder;
  opsSheetHandler: OpsSheetHandler;
  slackRepository: SlackRepository;
  claudeRepository: ClaudeRepository;
  datadogRepository: DatadogRepository;
  options?: {
    opsSheetUrl?: string;
  };
}): QuickDuplicateCheckWorkflow => {
  return {
    invoke: async (
      slackMessageUrl: string,
      isDryRun = true,
    ): Promise<{ skipped: boolean }> => {
      try {
        const context =
          await deps.slackThreadContextFinder.invoke(slackMessageUrl);

        // SlackメッセージからDatadog URLを抽出
        const allTexts = [
          context.userQuestion.text,
          ...context.threadMessages.map((msg) => msg.text),
        ].join(" ");
        const datadogUrl = extractDatadogUrl(allTexts);

        if (!datadogUrl) {
          console.log(
            `[QuickDuplicateCheckWorkflow] No Datadog URL found, skipping check for ${slackMessageUrl}`,
          );
          return { skipped: false };
        }

        // Datadogからログを取得
        console.log(
          `[QuickDuplicateCheckWorkflow] Fetching Datadog logs from: ${datadogUrl}`,
        );
        const logResult =
          await deps.datadogRepository.searchLogsFromUrl(datadogUrl);
        const datadogLogs = (logResult.payload?.data ?? [])
          .map((log) => log.attributes?.message ?? "")
          .filter(Boolean)
          .join("\n");

        const sheetData = await deps.opsSheetHandler.getAllValues();
        // 比較に必要な列のみ抽出: ID(0), エラー内容(2), 原因・対応(3)
        const sheetContents = sheetData
          .slice(1) // ヘッダー行をスキップ
          .map(
            (row) =>
              `ID:${row[0]} | エラー内容:${row[2]} | 原因・対応:${row[3] || ""}`,
          )
          .join("\n");

        if (sheetData.length === 0) {
          console.log(
            `[QuickDuplicateCheckWorkflow] Sheet is empty, skipping check for ${slackMessageUrl}`,
          );
          return { skipped: false };
        }

        const message: ClaudeMessage = {
          role: "user",
          content: buildDuplicateCheckPrompt(datadogLogs, sheetContents),
        };

        console.log(
          `[QuickDuplicateCheckWorkflow] Checking for duplicates: ${slackMessageUrl}`,
        );

        const retryStrategy: RetryStrategy<DuplicateCheckResult> = {
          maxRetries: 3,
          shouldRetry: (error) => {
            console.warn(
              `[QuickDuplicateCheckWorkflow] Claude API call failed, retrying...`,
              error,
            );
            return true;
          },
          getWaitTime: (_error, attempt) => attempt * 1000,
        };

        const result = await executeWithRetry(async () => {
          const response = await deps.claudeRepository.ask(message);
          return parseDuplicateCheckResult(response.payload.text);
        }, retryStrategy);

        if (!result.matched || !result.entryId) {
          console.log(
            `[QuickDuplicateCheckWorkflow] No matching entry found for ${slackMessageUrl}`,
          );
          return { skipped: false };
        }

        console.log(
          `[QuickDuplicateCheckWorkflow] Matched entry ID: ${result.entryId} for ${slackMessageUrl}`,
        );

        if (!isDryRun) {
          const opsSheetUrl = deps.options?.opsSheetUrl;
          const sheetLink = opsSheetUrl
            ? `<${opsSheetUrl}|2次オペ対応シート>`
            : "2次オペ対応シート";
          const replyText = [
            `*これはシートに記載済みのエラーです*`,
            `${sheetLink}（ID: ${result.entryId}）`,
            ``,
            `※ClaudeAPIの料金節約による簡易的な比較のため、内容の精査は行なっていません。`,
          ].join("\n");

          try {
            await deps.slackRepository.replyWithFeedbackForm(
              context.userQuestion,
              replyText,
            );
            console.log(
              `[QuickDuplicateCheckWorkflow] Posted reply to ${slackMessageUrl}`,
            );
          } catch (error) {
            console.error(
              `[QuickDuplicateCheckWorkflow] Failed to post reply: ${slackMessageUrl}`,
              error,
            );
          }

          await deps.slackRepository.addReaction(slackMessageUrl, "ai-check");
          await deps.slackRepository.addReaction(slackMessageUrl, "skip");
          await deps.slackRepository.addReaction(
            slackMessageUrl,
            result.stampName,
          );
        } else {
          console.log(
            `[QuickDuplicateCheckWorkflow] Dry Run mode: Skipping Slack actions for ${slackMessageUrl}`,
          );
        }

        return { skipped: true };
      } catch (error) {
        console.error(
          `[QuickDuplicateCheckWorkflow] Error during quick check, falling through to full analysis: ${slackMessageUrl}`,
          error,
        );
        return { skipped: false };
      }
    },
  };
};
