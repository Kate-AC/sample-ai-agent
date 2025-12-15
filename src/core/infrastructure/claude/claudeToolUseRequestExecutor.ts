import { ClaudeToolUseRequestExecutor } from "@core/domain/repositories/claude/claudeToolUseRequestExecutor";
import { executeToolUse } from "sample-mcp-kit";

export const makeClaudeToolUseRequestExecutor =
  (): ClaudeToolUseRequestExecutor => {
    return {
      execute: async (toolUseRequest) => {
        return await executeToolUse(toolUseRequest);
      },
    };
  };
