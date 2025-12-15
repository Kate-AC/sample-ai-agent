import { ClaudeRepository } from "@core/domain/repositories/claude/claudeRepository";
import {
  aiModelRegistry,
  ClaudeAiModel,
  ClaudeMessage,
  ClaudeToolUseSchema,
} from "sample-mcp-kit";
import { AiGenerateOptions } from "sample-mcp-kit/dist/src/core/contracts/aiModel/aiModelPayload";

export const makeClaudeRepository = (
  deps: {
    claudeModel: ClaudeAiModel;
  } = {
    claudeModel: aiModelRegistry().useAiModel("claude"),
  },
): ClaudeRepository => {
  const ask = (async (
    messages: ClaudeMessage | ClaudeMessage[],
    tools?: ClaudeToolUseSchema[],
    options?: AiGenerateOptions,
  ) => {
    const messagesArray = Array.isArray(messages) ? messages : [messages];
    return await deps.claudeModel.aiModelFunctions.ask(
      messagesArray,
      tools,
      options,
    );
  }) as ClaudeRepository["ask"];

  return {
    ask,
  };
};
