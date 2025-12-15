import { makeAnswerQuestionUseCase } from "application/usecases/answerQuestion/answerQuestionUseCase";
import type { SlackMessagePayload } from "sample-mcp-kit";
import { aiModelRegistry, mcpRegistry } from "sample-mcp-kit";
import { type MessageFetcher, makeMessageFetcher } from "./messageFetcher";

export type SlackMonitorConfig = {
  channelId: string;
  reactionName: string;
  messageLimit?: number;
};

export type SlackMonitorDependencies = {
  mcpRegistry: ReturnType<typeof mcpRegistry>;
  aiModelRegistry: ReturnType<typeof aiModelRegistry>;
  messageFetcher?: MessageFetcher;
};

/**
 * SlackメッセージURLからメッセージを取得して処理する
 * GitHub Actionsのworkflowから呼び出される
 */
export const makeSlackMonitor = (
  config: SlackMonitorConfig,
  deps: SlackMonitorDependencies = {
    mcpRegistry: mcpRegistry(),
    aiModelRegistry: aiModelRegistry(),
  },
) => {
  const registry = deps.mcpRegistry;
  const slackMcp = registry.getMcp("slack");
  const answerQuestionUseCase = makeAnswerQuestionUseCase(deps);

  // 依存関係の初期化（テスト時に注入可能）
  const messageFetcher = deps.messageFetcher || makeMessageFetcher(slackMcp);

  /**
   * 個別のメッセージを処理
   */
  const processMessage = async (
    message: SlackMessagePayload,
    channelId?: string,
  ): Promise<void> => {
    // 削除されたメッセージはスキップ
    if (message.subtype === "tombstone") {
      console.log(`⏭️  Skipping deleted message: ${message.ts}`);
      return;
    }

    // メッセージテキストがない場合もスキップ
    if (!message.text || message.text.trim() === "") {
      console.log(`⏭️  Skipping message without text: ${message.ts}`);
      return;
    }

    // channelIdが指定されていない場合はconfigから取得
    const targetChannelId = channelId || config.channelId;
    await answerQuestionUseCase.invoke(targetChannelId, message);
  };

  /**
   * SlackメッセージURLから特定のメッセージを取得して処理
   */
  const checkByUrl = async (messageUrl: string): Promise<void> => {
    try {
      console.log(`🔍 Checking message by URL: ${messageUrl}`);

      // URLからチャンネルIDを抽出
      const urlPattern = /\/archives\/([A-Z0-9]+)\//;
      const match = messageUrl.match(urlPattern);
      const channelId = match ? match[1] : config.channelId;

      // URLからメッセージを取得
      const result = await messageFetcher.fetchMessageByUrl(messageUrl);

      if (!result.isSuccess) {
        console.error(
          "❌ Failed to get message:",
          result.message || "Unknown error",
        );
        return;
      }

      const message = result.payload.message;
      console.log(`📬 Found message: ${message.ts}`);

      // メッセージを処理
      await processMessage(message, channelId);

      console.log("✅ Message processed successfully");
    } catch (error) {
      console.error("❌ Error in checkByUrl:", error);
    }
  };

  return {
    checkByUrl,
  };
};
