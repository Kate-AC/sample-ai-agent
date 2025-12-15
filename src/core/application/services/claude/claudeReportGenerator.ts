import { Report } from "@core/domain/entities/report";
import { createReportPrompt } from "@core/domain/prompts/createReportPrompt";
import { updateReportPrompt } from "@core/domain/prompts/updateReportPrompt";
import {
  ClaudeMessage,
  ClaudeMetadata,
  ClaudeToolUseSchema,
  ClaudeToolUseRequestContent,
  buildClaudeToolUseDataSet,
  ClaudeToolUseResultContent,
  hasToolUse,
} from "sample-mcp-kit";
import { ClaudeRepository } from "@core/domain/repositories/claude/claudeRepository";
import { parseJsonFromText } from "@core/domain/services/reportJsonParser";

export interface ClaudeReportGenerator {
  generate: (
    initialMessage: string,
    previousReport: Report<ClaudeMetadata>,
    payload: ClaudeReportGeneratorPayload,
  ) => Promise<Report<ClaudeMetadata>>;
}

export type ClaudeReportGeneratorPayload = {
  toolUseSchemas: ClaudeToolUseSchema[];
  toolUseResults?: ClaudeToolUseResultContent[];
  toolUseRequests?: ClaudeToolUseRequestContent[];
  additionalSystemPrompt: string;
  /** APIコール時にモデルを上書きする場合に指定 */
  modelId?: string;
};

export const makeClaudeReportGenerator = (deps: {
  claudeRepository: ClaudeRepository;
}): ClaudeReportGenerator => {
  return {
    generate: async (initialMessage, previousReport, payload) => {
      const messages: ClaudeMessage[] = [];

      // 初回のみ元の質問（initialMessage）を含める
      // 2回目以降はtool_useとtool_resultのペアのみで、元の質問はsystemPromptに含まれる
      if (!previousReport) {
        messages.push({
          role: "user",
          content: initialMessage,
        });
      }

      // ツール実行結果がある場合は、対応するtool_useとtool_resultのペアを含める
      if (
        payload.toolUseResults &&
        payload.toolUseResults.length > 0 &&
        payload.toolUseRequests &&
        payload.toolUseRequests.length > 0
      ) {
        const toolUseDataSet = buildClaudeToolUseDataSet(
          payload.toolUseRequests,
          payload.toolUseResults,
        );
        if (toolUseDataSet) {
          messages.push(toolUseDataSet.toolUseRequest);
          messages.push(toolUseDataSet.toolUseResult);
        }
      }

      const systemPrompt = previousReport
        ? updateReportPrompt(previousReport, payload.additionalSystemPrompt)
        : createReportPrompt(payload.additionalSystemPrompt);

      // レスポンス速度やボトルネックの改善に役立つのでログ出力
      console.log(
        `[ClaudeReportGenerator] Request system prompt length: ${systemPrompt.length}`,
      );
      console.log(
        `[ClaudeReportGenerator] Request message length: ${JSON.stringify(messages).length}`,
      );
      console.log(
        `[ClaudeReportGenerator] Request tool use schemas text length: ${JSON.stringify(payload.toolUseSchemas).length}`,
      );
      console.log(
        `[ClaudeReportGenerator] Request tool use results text length: ${JSON.stringify(payload.toolUseResults ?? []).length}`,
      );
      console.log(
        `[ClaudeReportGenerator] Request tool use requests text length: ${JSON.stringify(payload.toolUseRequests ?? []).length}`,
      );

      const result = await deps.claudeRepository.ask(
        messages,
        payload.toolUseSchemas,
        {
          // TODO: なんとなくの値なので要検討
          max_tokens: 30000,
          system: systemPrompt,
          enablePromptCaching: true,
          ...(payload.modelId && { model: payload.modelId }),
        },
      );

      if (!result.isSuccess) {
        throw new Error(result.message || "Failed to create report");
      }

      const responseText = result.payload?.text || "";
      const hasToolUse =
        result.payload?.metadata?.rawContent?.some(
          (c: any) => c.type === "tool_use",
        ) || false;

      console.log(
        `[ClaudeReportGenerator] Response text length: ${responseText.length}`,
      );
      console.log(`[ClaudeReportGenerator] Has tool_use: ${hasToolUse}`);
      console.log(
        `[ClaudeReportGenerator] Cache: creation=${result.payload?.usage?.cacheCreationInputTokens ?? 0}, read=${result.payload?.usage?.cacheReadInputTokens ?? 0}`,
      );

      if (!responseText && hasToolUse) {
        if (previousReport) {
          console.log(
            `[ClaudeReportGenerator] Reportが返されなかったため、前回のReportをそのまま返します。`,
          );
          return {
            ...previousReport,
            updatedAt: new Date().toISOString(),
            options: result.payload.metadata,
          };
        }

        throw new Error(
          "[ClaudeReportGenerator] 初回でReportが生成されていません。ツール実行結果があるにも関わらず、テキストが空の場合はエラーです。",
        );
      }

      const parsed = parseJsonFromText(
        responseText,
        previousReport || undefined,
      );

      return {
        ...parsed,
        updatedAt: new Date().toISOString(),
        options: result.payload.metadata,
      };
    },
  };
};
