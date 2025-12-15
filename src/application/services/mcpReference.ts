import type { McpRegistry } from "sample-mcp";

/**
 * MCPのセキュリティルールと利用コンテキストをシステムプロンプト用に生成
 */
export const buildSecurityRulesPrompt = (mcpRegistry: McpRegistry): string => {
  let prompt = "";

  // セキュリティルールを収集
  const rules = mcpRegistry.getAllMcpNames().flatMap((mcpName) => {
    const mcp = mcpRegistry.getMcp(mcpName);
    const securityRules = mcp.mcpMetadata.getSecurityRules();
    return securityRules.length > 0
      ? securityRules.map((rule) => `[${mcpName}] ${rule}`)
      : [];
  });

  if (rules.length > 0) {
    prompt += `\n【セキュリティルール】\n${rules.map((r) => `- ${r}`).join("\n")}\n`;
  }

  // 利用コンテキストを収集
  const contexts = mcpRegistry.getAllMcpNames().flatMap((mcpName) => {
    const mcp = mcpRegistry.getMcp(mcpName);
    const usageContext = mcp.mcpMetadata.getUsageContext();
    return usageContext.length > 0
      ? usageContext.map((context) => `[${mcpName}] ${context}`)
      : [];
  });

  if (contexts.length > 0) {
    prompt += `\n【各ツールの利用コンテキスト】\n${contexts.map((c) => `- ${c}`).join("\n")}\n`;
  }

  return prompt;
};
