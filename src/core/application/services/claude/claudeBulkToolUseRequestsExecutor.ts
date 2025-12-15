import {
  ClaudeToolUseResultContent,
  ClaudeToolUseRequestContent,
} from "sample-mcp-kit";
import { ClaudeToolUseResultLimiter } from "./claudeToolUseResultLimiter";
import { ClaudeToolUseRequestExecutor } from "@core/domain/repositories/claude/claudeToolUseRequestExecutor";

export interface ClaudeBulkToolUseRequestsExecutor {
  execute: (
    toolUseRequests: ClaudeToolUseRequestContent[],
  ) => Promise<ClaudeToolUseResultContent[]>;
}

/**
 * toolUseRequestsを実行してtoolResultsを返すサービス
 * 並列実行によりパフォーマンスを向上
 */
export const makeClaudeBulkToolUseRequestsExecutor = (deps: {
  toolUseRequestExecutor: ClaudeToolUseRequestExecutor;
  toolUseLimiter?: ClaudeToolUseResultLimiter;
}): ClaudeBulkToolUseRequestsExecutor => {
  return {
    execute: async (toolUseRequests) => {
      console.log(
        `[ClaudeBulkToolUseRequestsExecutor] RequestCount: ${toolUseRequests.length}`,
      );

      const results = await Promise.allSettled(
        toolUseRequests.map(async (toolUseRequest, _) => {
          try {
            console.log(
              `[ClaudeBulkToolUseRequestsExecutor] Executing toolUseRequest: ${toolUseRequest.name} ${JSON.stringify(toolUseRequest.input, null, 2)}`,
            );
            const result =
              await deps.toolUseRequestExecutor.execute(toolUseRequest);

            if (!result.isSuccess) {
              throw new Error(result.message);
            }

            // ツール結果を制限（均等サンプリング + 文字数制限）
            // toolUseLimiterが提供されていない場合は無制限で実行
            const limitedPayload = deps.toolUseLimiter
              ? deps.toolUseLimiter.limit(toolUseRequest.name, result.payload)
              : result.payload;

            return {
              type: "tool_result" as const,
              tool_use_id: toolUseRequest.id,
              content: JSON.stringify(limitedPayload, null, 2),
            };
          } catch (error) {
            throw error;
          }
        }),
      );

      return results.map((settledResult, index) => {
        // Promise.allSettledの結果をClaudeToolUseResultContent[]に変換
        if (settledResult.status === "fulfilled") {
          return settledResult.value;
        }

        // NOTE: ToolUseRequestとToolUseResultのペアが必要なのでエラーでも返す必要がある
        return {
          type: "tool_result" as const,
          tool_use_id: toolUseRequests[index].id,
          content: `エラーが発生しました: ${settledResult.reason instanceof Error ? settledResult.reason.message : String(settledResult.reason)}`,
        };
      });
    },
  };
};
