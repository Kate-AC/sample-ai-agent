import {
  AiTextPayload,
  ClaudeExtendedTextPayload,
  hasToolUse,
  PlatformName,
} from "sample-mcp-kit";

type ParsedToolName = {
  platformName: PlatformName;
  functionName: string;
};

export const parseToolName = (toolName: string): ParsedToolName => {
  const parts = toolName.split("_");

  if (parts.length < 2) {
    throw new Error(`Invalid tool name format: ${toolName}`);
  }

  return {
    platformName: parts[0] as PlatformName,
    functionName: parts.slice(1).join("_"),
  };
};
