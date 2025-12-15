import { SlackThreadMessage } from "@core/domain/entities/slack/thread";
import { SlackMcp } from "sample-mcp-kit";
import {
  parseSlackUrl,
  ParsedSlackUrl,
} from "@core/domain/services/slack/slackUrlParser";
import { convertToSlackMessage } from "@core/domain/services/slack/slackMessageConverter";
import { SlackRepository } from "@core/domain/repositories/slack/slackRepository";

/**
 * 指定されたタイムスタンプのメッセージを取得
 */
const fetchMessage = async (
  slackMcp: SlackMcp,
  parsedUrl: ParsedSlackUrl,
): Promise<SlackThreadMessage | null> => {
  const { channelId, ts, threadTs } = parsedUrl;
  const result = await slackMcp.mcpFunctions.getConversationHistory(
    channelId,
    `latest=${ts}&oldest=${ts}&inclusive=true&limit=1`,
  );

  if (!result.isSuccess) {
    return null;
  }

  let messagePayload = result.payload.messages[0];

  // メッセージが見つからない、またはテキストがない場合はスレッド内メッセージの可能性
  if ((!messagePayload || !messagePayload.text) && threadTs) {
    try {
      const threadMessageUrl = `https://example.slack.com/archives/${channelId}/p${threadTs.replace(".", "")}`;
      const threadResult =
        await slackMcp.mcpFunctions.getThreadMessages(threadMessageUrl);

      if (threadResult.isSuccess && threadResult.payload.messages) {
        messagePayload =
          threadResult.payload.messages.find((msg) => msg.ts === ts) || null;
      }
    } catch (error) {
      // エラーを無視して続行
    }
  }

  if (!messagePayload) {
    return null;
  }

  // 削除されたメッセージ（tombstone）はスキップ
  if (messagePayload.subtype === "tombstone") {
    return null;
  }

  // textが空でもblocksやattachmentsがあれば有効なメッセージとして扱う
  const hasContent =
    messagePayload.text?.trim() ||
    (messagePayload.blocks && messagePayload.blocks.length > 0) ||
    (messagePayload.attachments && messagePayload.attachments.length > 0);

  if (!hasContent) {
    return null;
  }

  return convertToSlackMessage(messagePayload, channelId);
};

/**
 * スレッドの全メッセージを取得（親メッセージを含む）
 */
const fetchThreadMessages = async (
  slackMcp: SlackMcp,
  channelId: string,
  threadTs: string,
): Promise<SlackThreadMessage[]> => {
  const threadResult = await slackMcp.mcpFunctions.getThreadMessages(
    `https://example.slack.com/archives/${channelId}/p${threadTs.replace(".", "")}`,
  );

  return threadResult.isSuccess
    ? threadResult.payload.messages?.map((msg) =>
        convertToSlackMessage(msg, channelId),
      ) || []
    : [];
};

/**
 * Slackリポジトリの実装
 */
export const makeSlackRepository = (deps: {
  slackMcp: SlackMcp;
}): SlackRepository => {
  const { slackMcp } = deps;

  const fetch = async (
    messageUrl: string,
  ): Promise<SlackThreadMessage | null> => {
    const parsedUrl = parseSlackUrl(messageUrl);
    if (!parsedUrl) {
      return null;
    }

    return await fetchMessage(slackMcp, parsedUrl);
  };

  const fetchAll = async (
    messageUrl: string,
  ): Promise<SlackThreadMessage[] | null> => {
    const parsedUrl = parseSlackUrl(messageUrl);
    if (!parsedUrl) {
      return null;
    }

    const threadTsForContext = parsedUrl.threadTs || parsedUrl.ts;
    return await fetchThreadMessages(
      slackMcp,
      parsedUrl.channelId,
      threadTsForContext,
    );
  };

  const replyWithFeedbackForm = async (
    target: SlackThreadMessage,
    text: string,
  ): Promise<void> => {
    const threadTs = target.thread_ts || target.ts;

    // 回答テキストとフィードバックフォームを1つのメッセージに統合
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: text,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "フィードバックを送る",
            },
            style: "primary",
            action_id: "open_rating_modal",
            value: "open",
          },
        ],
      },
    ];

    const options = JSON.stringify({
      thread_ts: threadTs,
      blocks: blocks,
    });

    const result = await slackMcp.mcpFunctions.postMessage(
      target.channel,
      text,
      options,
    );

    if (!result.isSuccess) {
      throw new Error(
        `Failed to post message to Slack: ${result.message || "Unknown error"}`,
      );
    }
  };

  const addReaction = async (messageUrl: string, reactionName: string) => {
    return await slackMcp.mcpFunctions.addReaction(messageUrl, reactionName);
  };

  const getChannelHistory = async (
    channelId: string,
    oldest: number,
    latest: number,
    limit: number = 100,
  ) => {
    const queryParams = `latest=${latest}&oldest=${oldest}&limit=${limit}`;
    const result = await slackMcp.mcpFunctions.getConversationHistory(
      channelId,
      queryParams,
    );

    if (!result.isSuccess || !result.payload.messages) {
      return [];
    }

    // 無効なメッセージをフィルタリング
    return result.payload.messages.filter((message) => {
      // 削除されたメッセージ（tombstone）を除外
      if (message.subtype === "tombstone") {
        return false;
      }

      // textが空でもblocksやattachmentsがあれば有効なメッセージとして扱う
      const hasContent =
        message.text?.trim() ||
        (message.blocks && message.blocks.length > 0) ||
        (message.attachments && message.attachments.length > 0);

      return hasContent;
    });
  };

  return {
    fetch,
    fetchAll,
    replyWithFeedbackForm,
    addReaction,
    getChannelHistory,
  };
};
