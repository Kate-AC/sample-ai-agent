import { ClaudeToolUseRequestContent, Result } from "sample-mcp-kit";

export interface ClaudeToolUseRequestExecutor {
  execute: (
    toolUseRequest: ClaudeToolUseRequestContent,
  ) => Promise<Result<unknown>>;
}
