import type {
  SlackMessage,
  ThreadContext,
} from "domain/entities/answerQuestion";
import type { SlackMcp } from "sample-mcp";

/**
 * スレッドの文脈を収集（スレッドメッセージのみ）
 */
export const gatherThreadContext = async (
  channelId: string,
  message: SlackMessage,
  slackMcp: SlackMcp,
): Promise<ThreadContext> => {
  const threadTs = message.thread_ts || message.ts;

  console.log(`Gathering thread messages...`);

  // スレッドメッセージのみ取得
  // SlackのベースURLは環境変数から取得するか、汎用的な形式を使用
  const slackBaseUrl =
    process.env.SLACK_BASE_URL || "https://your-workspace.slack.com";
  const threadResult = await slackMcp.mcpFunctions.getThreadMessages(
    `${slackBaseUrl}/archives/${channelId}/p${threadTs.replace(".", "")}`,
  );

  const messages: SlackMessage[] = threadResult.isSuccess
    ? threadResult.payload.messages || []
    : [];

  console.log(`Thread messages gathered: ${messages.length}`);

  return {
    messages,
    userQuestion: message.text,
  };
};
