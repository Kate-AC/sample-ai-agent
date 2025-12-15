import { SlackThreadContextFinder } from "src/core/application/services/slack/slackThreadContextFinder";
import { ClaudeRepository } from "src/core/domain/repositories/claude/claudeRepository";
import { ClaudeMessage } from "sample-mcp-kit";
import { SlackRepository } from "src/core/domain/repositories/slack/slackRepository";
import { OpsSheetHandler } from "@projects/shared/application/services/opsSheetHandler";
import {
  summarySystemPrompt,
  buildSummaryMessage,
} from "./prompts/opsResolution/summaryPrompt";
import { DatadogLogAnalysisUsecase } from "@projects/shared/usecases/datadogLogAnalysisUsecase";
import { CodeInvestigationUsecase } from "@projects/shared/usecases/codeInvestigationUsecase";
import { SqlGenerationUsecase } from "@projects/shared/usecases/sqlGenerationUsecase";
import { extractDatadogUrl } from "@projects/shared/application/services/datadogUrlExtractor";
import {
  OpsReportEvaluationUsecase,
  DatadogAnalysisResult,
} from "@projects/shared/usecases/opsReportEvaluationUsecase";

export { extractDatadogUrl };

export interface OpsResolutionWorkflow {
  invoke: (slackMessageUrl: string, isDryRun?: boolean) => Promise<string>;
}

export const makeOpsResolutionWorkflow = (deps: {
  slackThreadContextFinder: SlackThreadContextFinder;
  opsSheetHandler: OpsSheetHandler;
  opsReportEvaluator: OpsReportEvaluationUsecase;
  claudeRepository: ClaudeRepository;
  slackRepository: SlackRepository;
  datadogLogAnalysisUsecase: DatadogLogAnalysisUsecase;
  codeInvestigationUsecase: CodeInvestigationUsecase;
  sqlGenerationUsecase: SqlGenerationUsecase;
  options?: {
    dirs: string[];
    opsSheetUrl?: string;
    sqlGenerationAdditionalPrompt?: string;
    evaluationAdditionalPrompt?: string;
  };
}) => {
  return {
    invoke: async (
      slackMessageUrl: string,
      isDryRun = true,
    ): Promise<string> => {
      const context =
        await deps.slackThreadContextFinder.invoke(slackMessageUrl);

      const sheetContents = buildSheetContentsForDuplicateCheck(
        await deps.opsSheetHandler.getAllValues(),
      );

      // SlackメッセージからDatadog URLを抽出
      const datadogUrl = extractDatadogUrlFromSlackTexts(
        context.userQuestion.text,
        context.threadMessages,
      );

      if (!datadogUrl) {
        throw new Error(
          `[OpsResolutionWorkflow] SlackメッセージからDatadog URLを抽出できませんでした: ${slackMessageUrl}`,
        );
      }

      // ========================================
      // Stage 1: ログ分析
      // ========================================
      console.log(`[OpsResolutionWorkflow] Stage 1: Starting log analysis...`);
      const logAnalysisReport =
        await deps.datadogLogAnalysisUsecase.invoke(datadogUrl);

      // ========================================
      // Stage 2: コード調査
      // ========================================
      console.log(
        `[OpsResolutionWorkflow] Stage 2: Starting code investigation...`,
      );
      const codeInvestigationReport =
        await deps.codeInvestigationUsecase.invoke(
          datadogUrl,
          logAnalysisReport,
        );

      // ========================================
      // Stage 3: SQL生成
      // ========================================
      console.log(
        `[OpsResolutionWorkflow] Stage 3: Generating verification SQL...`,
      );
      const sqlReport = await deps.sqlGenerationUsecase.invoke(
        logAnalysisReport,
        codeInvestigationReport,
        deps.options?.dirs ?? ["sample-service", "sample-api"],
        deps.options?.sqlGenerationAdditionalPrompt,
      );

      // logAnalysisReportのoptionsにrawLogsを入れるようにした。存在しない場合は空文字列とする
      const rawLogs =
        (logAnalysisReport.options as { rawLogs?: string } | undefined)
          ?.rawLogs ?? "";

      const datadogAnalysisResult: DatadogAnalysisResult = {
        logAnalysisReport,
        codeInvestigationReport,
        sqlReport,
        datadogUrl,
        rawLogs,
      };

      // datadogAnalysisResultをもとにシートの重複チェック・スタンプ判定
      const checkAndSavePayload = await deps.opsReportEvaluator.evaluate(
        datadogAnalysisResult,
        slackMessageUrl,
        sheetContents,
        isDryRun,
        deps.options?.evaluationAdditionalPrompt,
      );

      const message: ClaudeMessage = {
        role: "user",
        content: buildSummaryMessage({
          datadogAnalysisResult,
          errorMessage: context.userQuestion.text,
          evaluationPayload: checkAndSavePayload,
        }),
      };

      console.log(
        `[OpsResolutionWorkflow] Generating summary for ${slackMessageUrl}`,
      );
      const summary = await deps.claudeRepository.ask(message, undefined, {
        system: summarySystemPrompt,
      });

      let replyText = summary.payload.text;

      // シートに既存エントリがある場合は冒頭にシート参照を追加
      if (
        !checkAndSavePayload.shouldSave &&
        checkAndSavePayload.matchedEntryId
      ) {
        if (deps.options?.opsSheetUrl) {
          replyText = `*これはシートに記載済みのエラーです*\n<${deps.options.opsSheetUrl}|対応シート>（ID: ${checkAndSavePayload.matchedEntryId}）\n\n${replyText}`;
        } else {
          replyText = `*これはシートに記載済みのエラーです*\nID: ${checkAndSavePayload.matchedEntryId}\n\n${replyText}`;
        }
      }

      if (!isDryRun) {
        try {
          console.log(
            `[OpsResolutionWorkflow] Posting reply to Slack: ${slackMessageUrl}`,
          );
          await deps.slackRepository.replyWithFeedbackForm(
            context.userQuestion,
            replyText,
          );
          console.log(
            `[OpsResolutionWorkflow] ✅ Successfully posted reply to Slack: ${slackMessageUrl}`,
          );
        } catch (error) {
          console.error(
            `[OpsResolutionWorkflow] ❌ Failed to post reply to Slack: ${slackMessageUrl}`,
            error,
          );
        }
      } else {
        console.log(
          `[OpsResolutionWorkflow] 🔒 Dry Run mode: Skipping Slack post for ${slackMessageUrl}`,
        );
      }

      return replyText;
    },
  };
};

const buildSheetContentsForDuplicateCheck = (rows: string[][]): string => {
  return rows
    .map((row, index) => {
      const trimmed = row.map((cell, colIndex) => {
        // Col 4 (SQL) は重複チェックに不要なため除外
        if (colIndex === 4) return "";
        // Col 2 (エラー内容) から「元のDatadogログ」以降を除去
        if (colIndex === 2) {
          const sepIndex = cell.indexOf("\n\n---\n【元のDatadogログ】");
          return sepIndex !== -1 ? cell.substring(0, sepIndex) : cell;
        }
        return cell;
      });

      return `行${index + 1}: ${trimmed.join(",")}`;
    })
    .join("\n");
};

const extractDatadogUrlFromSlackTexts = (
  userQuestionText: string,
  threadMessages: Array<{ text: string }>,
): string | null => {
  const allTexts = [
    userQuestionText,
    ...threadMessages.map((message) => message.text),
  ].join(" ");

  return extractDatadogUrl(allTexts);
};