#!/usr/bin/env ts-node

import "tsconfig-paths/register";
import "dotenv/config";
import { resolveOpsMonitoringWorkflow } from "./factory";

/**
 * opsMonitoringWorkflowを実行するCLI
 * github actionsで定期的に実行される
 *
 * 引数: channelId [oldest] [latest] [isDryRun]
 * 実行例: npm run cli:opsMonitoringWorkflowTest C1234567890 "2024-01-01 00:00:00" "2024-01-01 23:59:59" false
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(
      "❌ Usage: npm run cli:opsMonitoringWorkflowTest <channelId> [oldest] [latest] [isDryRun]",
    );
    console.error("\n引数:");
    console.error("  channelId: 必須。SlackチャンネルID（例: C1234567890）");
    console.error(
      '  oldest: オプション。取得開始時刻（JST日付文字列、例: "2024-01-01 00:00:00" または ISO8601形式、デフォルト: 30分前）',
    );
    console.error(
      '  latest: オプション。取得終了時刻（JST日付文字列、例: "2024-01-01 23:59:59" または ISO8601形式、デフォルト: 現在時刻）',
    );
    console.error(
      "  isDryRun: オプション。falseの場合はSlackに投稿する（デフォルト: true）",
    );
    console.error("\n例:");
    console.error("  npm run cli:opsMonitoringWorkflowTest C1234567890");
    console.error(
      '  npm run cli:opsMonitoringWorkflowTest C1234567890 "2024-01-01 00:00:00" "2024-01-01 23:59:59"',
    );
    console.error(
      '  npm run cli:opsMonitoringWorkflowTest C1234567890 "2024-01-01 00:00:00" "2024-01-01 23:59:59" false',
    );
    process.exit(1);
  }

  const channelId = args[0];
  let oldest: Date | undefined;
  let latest: Date | undefined;
  const isDryRun = args[3] !== "false";

  try {
    if (args[1]) {
      oldest = parseJstDate(args[1]);
    }
    if (args[2]) {
      latest = parseJstDate(args[2]);
    }
  } catch (error) {
    console.error(
      "❌ Invalid date format:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  if (oldest !== undefined && latest !== undefined && oldest >= latest) {
    console.error("❌ oldest must be less than latest");
    process.exit(1);
  }

  const opsMonitoringWorkflow = resolveOpsMonitoringWorkflow();

  const now = new Date();
  const defaultOldest = oldest ?? new Date(now.getTime() - 30 * 60 * 1000);
  const defaultLatest = latest ?? now;

  console.log("🚀 Starting ops monitoring workflow (test mode)...");
  console.log(`📝 Channel ID: ${channelId}`);
  console.log(
    `⏰ Oldest: ${oldest ? oldest.toISOString() : `${defaultOldest.toISOString()} (default: 30 minutes ago)`}`,
  );
  console.log(
    `⏰ Latest: ${latest ? latest.toISOString() : `${defaultLatest.toISOString()} (default: now)`}`,
  );
  console.log(`🔒 Dry Run: ${isDryRun}`);
  console.log();

  try {
    await opsMonitoringWorkflow.invoke(channelId, oldest, latest, isDryRun);

    console.log("✅ Finished processing all messages");
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

/**
 * JSTの日付文字列をDate型に変換
 * 形式: "2024-01-01 00:00:00" または "2024-01-01T00:00:00+09:00"
 */
const parseJstDate = (dateString: string): Date => {
  // ISO8601形式（Tまたは+09:00付き）の場合はそのままパース
  if (
    dateString.includes("T") ||
    dateString.includes("+") ||
    dateString.includes("Z")
  ) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateString}`);
    }
    return date;
  }

  // "YYYY-MM-DD HH:mm:ss" 形式の場合はJSTとして扱う
  // JSTはUTC+9なので、9時間引いてUTCとして扱う
  const [datePart, timePart] = dateString.split(" ");
  if (!datePart) {
    throw new Error(`Invalid date format: ${dateString}`);
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = (timePart || "00:00:00")
    .split(":")
    .map(Number);

  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    isNaN(hour) ||
    isNaN(minute) ||
    isNaN(second)
  ) {
    throw new Error(`Invalid date format: ${dateString}`);
  }

  // JSTとして解釈し、UTCに変換（9時間引く）
  const jstDate = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second || 0),
  );
  return new Date(jstDate.getTime() - 9 * 60 * 60 * 1000);
};

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
