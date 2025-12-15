#!/usr/bin/env ts-node

import "tsconfig-paths/register";
import "dotenv/config";
import { resolveOpsResolutionWorkflow } from "./factory";

/**
 * 単発でopsResolutionWorkflowを実行するCLI
 * 主にデバッグ用
 *
 * 引数: slackMessageUrl [isDryRun]
 * 実行例: npm run cli:opsResolutionWorkflow https://example.slack.com/archives/xxx/xxx false
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(
      "❌ Usage: npm run cli:opsResolutionWorkflow <slackMessageUrl> [isDryRun]",
    );
    console.error("\n引数:");
    console.error("  slackMessageUrl: 必須。SlackメッセージのURL");
    console.error(
      "  isDryRun: オプション。trueの場合はSlackに投稿しない（デフォルト: true）",
    );
    process.exit(1);
  }

  const slackMessageUrl = args[0];
  const isDryRun = args[1] !== "false";

  const opsResolutionWorkflow = resolveOpsResolutionWorkflow();

  console.log("🚀 Creating ops resolution workflow...");
  console.log(`📝 Slack Message URL: ${slackMessageUrl}`);
  console.log(`🔒 Dry Run: ${isDryRun}`);
  console.log();

  try {
    const result = await opsResolutionWorkflow.invoke(
      slackMessageUrl,
      isDryRun,
    );

    console.log("✅ Report generated successfully!\n");
    console.log("📄 Summary:");
    console.log(result);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
