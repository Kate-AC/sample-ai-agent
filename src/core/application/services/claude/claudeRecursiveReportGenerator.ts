import { Report } from "@core/domain/entities/report";
import { ClaudeReportGeneratorPayload } from "./claudeReportGenerator";
import {
  executeRepeatedCallback,
  ClaudeToolUseRequestContent,
  RetryStrategy,
  ClaudeMetadata,
  extractToolUsesFromMetadata,
  ToolUseSchemaBuilder,
  ClaudeToolUseResultContent,
  convertToolUseResultForImages,
  SecurityRuleBuilder,
  UsageContextBuilder,
  PlatformName,
} from "sample-mcp-kit";
import { ClaudeBulkToolUseRequestsExecutor } from "./claudeBulkToolUseRequestsExecutor";
import { ReportGenerator } from "@core/domain/services/reportGenerator";

export interface ClaudeRecursiveReportGenerator {
  invoke: (
    initialMessage: string,
    settings: ClaudeRecursiveReportGeneratorSettings,
  ) => Promise<Report>;
}

export type ClaudeRecursiveReportGeneratorState = {
  previousReport: Report<ClaudeMetadata>;
  toolUseResults: ClaudeToolUseResultContent[];
  toolUseRequests: ClaudeToolUseRequestContent[];
  additionalSystemPrompt: string;
  isFinished?: boolean;
};

export type ClaudeRecursiveReportGeneratorSettings = {
  mapNames: PlatformName[];
  additionalSystemPrompts?: string[];
  excludeTools?: string[];
  repeatTimes: number;
  retryStrategy: RetryStrategy<ClaudeRecursiveReportGeneratorState>;
  /** ステージごとにモデルを切り替える場合に指定（例: Sonnet） */
  modelId?: string;
};

/**
 * Tool Useループを実行
 */
export const makeClaudeRecursiveReportGenerator = (deps: {
  reportGenerator: ReportGenerator<
    ClaudeReportGeneratorPayload,
    ClaudeMetadata
  >;
  toolUseSchemaBuilder: ToolUseSchemaBuilder;
  securityRulesBuilder: SecurityRuleBuilder;
  usageContextBuilder: UsageContextBuilder;
  bulkToolUseRequestsExecutor: ClaudeBulkToolUseRequestsExecutor;
}): ClaudeRecursiveReportGenerator => {
  return {
    invoke: async (initialMessage, settings) => {
      let loopCount = 0;
      const allToolUseSchemas = deps.toolUseSchemaBuilder.buildFromMcpNames(
        settings.mapNames,
      );
      const toolUseSchemas = settings.excludeTools
        ? allToolUseSchemas.filter(
            (schema) => !settings.excludeTools!.includes(schema.name),
          )
        : allToolUseSchemas;
      const securityRulesPrompt = deps.securityRulesBuilder.buildFromMcpNames(
        settings.mapNames,
      );
      const usageContextPrompt = deps.usageContextBuilder.buildFromMcpNames(
        settings.mapNames,
      );

      // 質問はadditionalSystemPromptに含める（2回目以降のループでも質問を保持するため）
      const baseSystemPrompt = [
        ...(settings.additionalSystemPrompts ?? []),
        securityRulesPrompt,
        usageContextPrompt,
        "---",
        initialMessage,
      ].join("\n");

      const state = await executeRepeatedCallback(
        async (previousState?: ClaudeRecursiveReportGeneratorState) => {
          loopCount++;
          console.log(
            `[ClaudeRecursiveReportGenerator] LoopCount: ${loopCount}`,
          );

          // ループ進捗をClaudeに伝えることで、調査の切り上げ判断を支援する
          const additionalSystemPrompt = [
            baseSystemPrompt,
            "",
            `【進捗】${loopCount}/${settings.repeatTimes}ターン目。残りターン数を考慮し、十分な情報が集まったら早めに調査を終了せよ。`,
          ].join("\n");

          const report = await deps.reportGenerator.generate(
            initialMessage,
            previousState ? previousState.previousReport : undefined,
            {
              toolUseSchemas: toolUseSchemas,
              toolUseResults: previousState ? previousState.toolUseResults : [],
              toolUseRequests: previousState
                ? previousState.toolUseRequests
                : [],
              additionalSystemPrompt,
              ...(settings.modelId && { modelId: settings.modelId }),
            },
          );

          const metadata = report.options;
          const newToolUseRequests = extractToolUsesFromMetadata(metadata);

          if (newToolUseRequests.length === 0) {
            return {
              previousReport: report,
              toolUseResults: previousState ? previousState.toolUseResults : [],
              toolUseRequests: previousState
                ? previousState.toolUseRequests
                : [],
              additionalSystemPrompt,
              isFinished: true,
            };
          }

          const newToolUseResults =
            await deps.bulkToolUseRequestsExecutor.execute(newToolUseRequests);

          // 画像データがあればClaude APIの画像ブロック形式に変換
          const convertedResults = newToolUseResults.map(
            convertToolUseResultForImages,
          );

          return {
            previousReport: report,
            toolUseResults: convertedResults,
            toolUseRequests: newToolUseRequests,
            additionalSystemPrompt,
          };
        },
        settings.repeatTimes,
        settings.retryStrategy,
      );

      return state.previousReport;
    },
  };
};
