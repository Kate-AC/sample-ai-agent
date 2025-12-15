import type { SlackMessage } from "domain/entities/answerQuestion";
import type { SlackMcp } from "sample-mcp";

/**
 * Slackに投稿するためのヘルパー
 */
export const makeSlackPoster = (slackMcp: SlackMcp) => {
  /**
   * Slackに回答を投稿
   */
  const postAnswer = async (
    channelId: string,
    message: SlackMessage,
    text: string,
  ): Promise<void> => {
    const threadTs = message.thread_ts || message.ts;
    const options = JSON.stringify({ thread_ts: threadTs });

    await slackMcp.mcpFunctions.postMessage(channelId, text, options);
  };

  /**
   * エラーをSlackに投稿
   */
  const postError = async (
    channelId: string,
    message: SlackMessage,
    errorText: string,
  ): Promise<void> => {
    try {
      await postAnswer(channelId, message, errorText);
    } catch (error) {
      console.error("Failed to post error to Slack:", error);
    }
  };

  return {
    postAnswer,
    postError,
  };
};

export type SlackPoster = ReturnType<typeof makeSlackPoster>;
