#!/usr/bin/env ts-node

import "tsconfig-paths/register";
import "dotenv/config";
import { makeSlackMonitor } from "application/slackMonitor/slackMonitor";

/**
 * Slack Monitor CLI
 *
 * 実行方法:
 * URL指定
 *    npm run monitor:slack url <messageUrl>
 *    例: npm run monitor:slack url https://your-workspace.slack.com/archives/C017U6EBKQS/p1759736875617839
 */

function showUsage() {
  console.log("Usage:");
  console.log("  URL指定:");
  console.log("     npm run monitor:slack url <messageUrl>");
  console.log(
    "     例: npm run monitor:slack url https://your-workspace.slack.com/archives/C017U6EBKQS/p1759736875617839",
  );
}

function checkEnvVars() {
  const awsBearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const awsProfile = process.env.AWS_PROFILE;
  const slackUserToken = process.env.SLACK_USER_OAUTH_TOKEN;

  // AWS認証チェック（優先順位: Bearer Token > Access Key > Profile）
  const hasAuth =
    awsBearerToken || (awsAccessKeyId && awsSecretAccessKey) || awsProfile;

  if (!hasAuth) {
    console.error("❌ AWS認証情報が設定されていません");
    console.error("   以下のいずれかを設定してください：");
    console.error("   1. AWS_BEARER_TOKEN_BEDROCK（Bedrock APIキー）");
    console.error("   2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY");
    console.error("   3. AWS_PROFILE");
    process.exit(1);
  }

  if (!slackUserToken) {
    console.error("❌ SLACK_USER_OAUTH_TOKEN is not set");
    process.exit(1);
  }

  console.log("✅ Environment variables loaded");
  if (awsBearerToken) {
    console.log(
      `   AWS_BEARER_TOKEN_BEDROCK: ${awsBearerToken.substring(0, 10)}...`,
    );
  } else if (awsAccessKeyId) {
    console.log(`   AWS_ACCESS_KEY_ID: ${awsAccessKeyId.substring(0, 10)}...`);
  } else {
    console.log(`   AWS_PROFILE: ${awsProfile}`);
  }
  console.log(
    `   SLACK_USER_OAUTH_TOKEN: ${slackUserToken.substring(0, 10)}...`,
  );
  console.log();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("❌ No arguments provided");
    console.log();
    showUsage();
    process.exit(1);
  }

  checkEnvVars();

  const command = args[0];

  // コマンド判定
  if (command === "url") {
    // URL指定モード
    if (args.length < 2) {
      console.error("❌ Usage: npm run monitor:slack url <messageUrl>");
      process.exit(1);
    }

    const messageUrl = args[1];

    console.log(`🔗 URL mode`);
    console.log(`   Message URL: ${messageUrl}`);
    console.log();

    const slackMonitor = makeSlackMonitor({
      channelId: "dummy", // URL指定では使わないがrequiredなので仮の値
      reactionName: "dummy",
    });

    await slackMonitor.checkByUrl(messageUrl);
  } else {
    console.error("❌ Invalid command. Use 'url' command.");
    console.log();
    showUsage();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
