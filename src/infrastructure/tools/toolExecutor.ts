import type { Mcp } from "sample-mcp";

/**
 * ツールを実行
 */
export const executeTool = async (
  toolName: string,
  input: Record<string, any>,
  mcps: {
    slackMcp: Mcp;
    redmineMcp: Mcp;
  },
): Promise<any> => {
  // ツール名を分解: "platform_function" -> ["platform", "function"]
  const parts = toolName.split("_");
  if (parts.length < 2) {
    throw new Error(`Invalid tool name format: ${toolName}`);
  }

  const platformName = parts[0];
  const functionName = parts.slice(1).join("_");

  // MCPを取得
  const mcpMap: Record<string, Mcp> = {
    slack: mcps.slackMcp,
    redmine: mcps.redmineMcp,
  };

  const mcp = mcpMap[platformName];
  if (!mcp) {
    throw new Error(`Unknown platform: ${platformName}`);
  }

  const func = (mcp.mcpFunctions as any)[functionName];
  if (typeof func !== "function") {
    throw new Error(`Unknown function: ${platformName}:${functionName}`);
  }

  // 引数を配列に変換して実行
  // 引数の順序を保証するため、既知のパラメータ順序を使用
  const argOrder = [
    "issueId",
    "queryId",
    "documentId",
    "fileId",
    "pageId",
    "channel",
    "text",
    "searchQuery",
    "query",
    "messageUrl",
    "env",
    "sql",
    "apiPath",
    "queryParams",
    "options",
    "iconEmoji",
    "ref",
  ];

  // queryParamsが文字列の場合はオブジェクトに変換
  let processedInput = { ...input };

  if (input.queryParams && typeof input.queryParams === "string") {
    // "key1=value1&key2=value2" → { key1: "value1", key2: "value2" }
    const params: Record<string, string> = {};
    input.queryParams.split("&").forEach((pair: string) => {
      const [k, v] = pair.split("=");
      if (k && v) {
        params[k] = v;
      }
    });
    processedInput.queryParams = params;
  }

  // 引数順序に従って配列を構築
  const args = argOrder
    .filter((key) => key in processedInput)
    .map((key) => processedInput[key]);

  const result = await func(...args);

  if (!result.isSuccess) {
    throw new Error(result.message);
  }

  return result.payload;
};
