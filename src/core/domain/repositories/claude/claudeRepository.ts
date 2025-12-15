import {
  ClaudeMessage,
  ClaudeTextPayload,
  ClaudeToolUseSchema,
  Result,
} from "sample-mcp-kit";
import { AiGenerateOptions } from "sample-mcp-kit/dist/src/core/contracts/aiModel/aiModelPayload";
import { AiTextPayload } from "sample-mcp-kit/dist/src/core/contracts/application/aiClientPort";

export interface ClaudeRepository {
  // toolsが渡された場合はClaudeTextPayloadを返す
  ask(
    messages: ClaudeMessage | ClaudeMessage[],
    tools: ClaudeToolUseSchema[],
    options?: AiGenerateOptions,
  ): Promise<Result<ClaudeTextPayload>>;
  ask(
    messages: ClaudeMessage | ClaudeMessage[],
    tools?: ClaudeToolUseSchema[],
    options?: AiGenerateOptions,
  ): Promise<Result<AiTextPayload | ClaudeTextPayload>>;
}
