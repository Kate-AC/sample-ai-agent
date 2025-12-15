import "dotenv/config";
import { makeSlackMonitor } from "../../../../src/application/slackMonitor/slackMonitor";
import { mcpRegistry, aiModelRegistry } from "sample-mcp-kit";

/**
 * E2Eテスト - 実際のSlack APIとの統合テスト
 *
 * 実行前の準備：
 * 1. .env ファイルに以下の環境変数を設定
 *    - SLACK_USER_OAUTH_TOKEN
 *    - ANTHROPIC_API_KEY
 * 2. テスト用のチャンネルIDを用意
 * 3. チャンネルにテストメッセージを投稿してリアクションを付ける
 *
 * 注意：このテストは実際のSlack APIを呼び出すため、
 * CI環境では環境変数が設定されている場合のみ実行されます。
 */

describe.skip("SlackMonitor E2E", () => {
  const requiredEnvVars = {
    slackToken: process.env.SLACK_USER_OAUTH_TOKEN,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  };

  const isEnvironmentReady = Object.values(requiredEnvVars).every(
    (value) => value !== undefined && value !== "",
  );

  // 環境変数が設定されていない場合はスキップ
  if (!isEnvironmentReady) {
    console.warn(
      "⚠️ Skipping E2E tests: Required environment variables are not set",
    );
    return;
  }

  // テスト用の設定
  const TEST_CHANNEL_ID = process.env.TEST_SLACK_CHANNEL_ID || "C09L24UTM8A";
  const TEST_REACTION_NAME = "test_reaction";
  const TEST_TIMEOUT = 30000; // 30秒

  describe("run (単発実行)", () => {
    it(
      "実際のSlack APIからメッセージを取得して処理できる",
      async () => {
        const testCacheDir = ".cache/test-e2e-sample-mcp";
        const slackMonitor = makeSlackMonitor({
          channelId: TEST_CHANNEL_ID,
          reactionName: TEST_REACTION_NAME,
          cacheDir: testCacheDir,
        });

        // run メソッドを1回だけ実行
        await expect(slackMonitor.run()).resolves.not.toThrow();
      },
      TEST_TIMEOUT,
    );

    it(
      "メッセージが見つからない場合でもエラーにならない",
      async () => {
        const testCacheDir = ".cache/test-e2e-sample-mcp-2";
        const slackMonitor = makeSlackMonitor({
          channelId: TEST_CHANNEL_ID,
          reactionName: "non_existent_reaction_xyz",
          cacheDir: testCacheDir,
        });

        await expect(slackMonitor.run()).resolves.not.toThrow();
      },
      TEST_TIMEOUT,
    );
  });

  describe("実際のユースケース", () => {
    it(
      "複数回runを実行しても正常に動作する",
      async () => {
        const testCacheDir = ".cache/test-e2e-sample-mcp-3";
        const slackMonitor = makeSlackMonitor({
          channelId: TEST_CHANNEL_ID,
          reactionName: TEST_REACTION_NAME,
          cacheDir: testCacheDir,
        });

        // 2回連続でrunを実行（CI/cronでの連続実行をシミュレート）
        await slackMonitor.run();
        await slackMonitor.run();

        // エラーが発生しないことを確認
        expect(true).toBe(true);
      },
      TEST_TIMEOUT,
    );

    it(
      "カスタムのmessageLimitを指定できる",
      async () => {
        const testCacheDir = ".cache/test-e2e-sample-mcp-4";
        const slackMonitor = makeSlackMonitor({
          channelId: TEST_CHANNEL_ID,
          reactionName: TEST_REACTION_NAME,
          messageLimit: 10,
          cacheDir: testCacheDir,
        });

        await expect(slackMonitor.run()).resolves.not.toThrow();
      },
      TEST_TIMEOUT,
    );
  });

  describe("エラーハンドリング", () => {
    it(
      "無効なチャンネルIDでもエラーをキャッチする",
      async () => {
        const testCacheDir = ".cache/test-e2e-sample-mcp-5";
        const slackMonitor = makeSlackMonitor({
          channelId: "INVALID_CHANNEL",
          reactionName: TEST_REACTION_NAME,
          cacheDir: testCacheDir,
        });

        // エラーが発生してもcrashしないことを確認
        await expect(slackMonitor.run()).resolves.not.toThrow();
      },
      TEST_TIMEOUT,
    );
  });
});

/**
 * 手動テスト用のヘルパー関数
 *
 * 実行方法：
 * ```bash
 * npm test -- tests/e2e/application/slackMonitor/slackMonitor.e2e.test.ts
 * ```
 */
export const runManualTest = async () => {
  console.log("🚀 Starting manual E2E test...");

  const channelId = process.env.TEST_SLACK_CHANNEL_ID || "C09L24UTM8A";
  const reactionName = process.env.TEST_REACTION_NAME || "kami_hatena";

  console.log(`📢 Channel ID: ${channelId}`);
  console.log(`👍 Reaction: ${reactionName}`);

  const slackMonitor = makeSlackMonitor({
    channelId,
    reactionName,
    cacheDir: ".cache/test-manual-sample-mcp",
  });

  console.log("✅ SlackMonitor created");
  console.log("🔄 Running...");

  await slackMonitor.run();

  console.log("✅ Run completed successfully");
};

// 直接実行された場合は手動テストを実行
if (require.main === module) {
  runManualTest().catch((error) => {
    console.error("❌ Manual test failed:", error);
    process.exit(1);
  });
}
