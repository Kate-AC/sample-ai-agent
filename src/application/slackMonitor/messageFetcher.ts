import type { ResultFs, SlackMcp, SlackMessagePayload } from "sample-mcp";

export type FetchMessageResult = {
  message: SlackMessagePayload;
};

export type MessageFetcher = {
  fetchMessageByUrl: (
    messageUrl: string,
  ) => Promise<ResultFs<FetchMessageResult>>;
};

/**
 * Slackからメッセージを取得する
 */
export const makeMessageFetcher = (slackMcp: SlackMcp): MessageFetcher => {
  /**
   * SlackメッセージURLからメッセージを取得
   * URL形式: https://your-workspace.slack.com/archives/C017U6EBKQS/p1759736875617839
   * スレッドURL形式: https://your-workspace.slack.com/archives/C017U6EBKQS/p1759736875617839?thread_ts=1756339790.198569&cid=C017U6EBKQS
   */
  const fetchMessageByUrl = async (
    messageUrl: string,
  ): Promise<ResultFs<FetchMessageResult>> => {
    try {
      // URLからクエリパラメータを除去してから正規表現を適用
      const urlWithoutQuery = messageUrl.split("?")[0];

      // URLからチャンネルIDとタイムスタンプを抽出
      const urlPattern = /\/archives\/([A-Z0-9]+)\/p(\d+)/;
      const match = urlWithoutQuery.match(urlPattern);

      if (!match) {
        return {
          isSuccess: false,
          payload: { message: {} as SlackMessagePayload },
          message: `Invalid Slack message URL format: ${messageUrl}`,
        };
      }

      const channelId = match[1];
      const timestamp = match[2];

      // タイムスタンプを変換（p1756339888758549 -> 1756339888.758549）
      const ts = `${timestamp.slice(0, 10)}.${timestamp.slice(10)}`;

      console.log(`📋 Extracted from URL: channelId=${channelId}, ts=${ts}`);

      // URLからthread_tsパラメータを抽出（スレッド内メッセージの場合）
      const threadTsMatch = messageUrl.match(/thread_ts=(\d+\.\d+)/);
      const threadTs = threadTsMatch ? threadTsMatch[1] : null;

      if (threadTs) {
        console.log(`🧵 Thread detected: thread_ts=${threadTs}`);
        // スレッド内のメッセージを取得する場合、thread_tsを使用
        // ただし、sample-mcpのSlack MCPにthread_ts対応があるか確認が必要
        // 現時点では、親メッセージのタイムスタンプで取得を試みる
      }

      // メッセージを取得（指定されたタイムスタンプのメッセージを含む）
      const result = await slackMcp.mcpFunctions.getConversationHistory(
        channelId,
        `latest=${ts}&oldest=${ts}&inclusive=true&limit=1`,
      );

      if (!result.isSuccess) {
        return {
          isSuccess: false,
          payload: { message: {} as SlackMessagePayload },
          message: result.message || "Failed to fetch message",
        };
      }

      const messages = result.payload.messages;
      if (messages.length === 0) {
        // メッセージが見つからない場合、スレッド内のメッセージの可能性がある
        // 親メッセージのタイムスタンプ（thread_ts）で再試行
        if (threadTs) {
          console.log(`🔄 Retrying with thread_ts: ${threadTs}`);
          const retryResult =
            await slackMcp.mcpFunctions.getConversationHistory(
              channelId,
              `latest=${threadTs}&oldest=${threadTs}&inclusive=true&limit=1`,
            );

          if (
            retryResult.isSuccess &&
            retryResult.payload.messages.length > 0
          ) {
            return {
              isSuccess: true,
              payload: {
                message: retryResult.payload.messages[0],
              },
              message: "",
            };
          }
        }

        return {
          isSuccess: false,
          payload: { message: {} as SlackMessagePayload },
          message: `Message not found. ts=${ts}, thread_ts=${threadTs || "none"}`,
        };
      }

      return {
        isSuccess: true,
        payload: {
          message: messages[0],
        },
        message: "",
      };
    } catch (error) {
      return {
        isSuccess: false,
        payload: { message: {} as SlackMessagePayload },
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  return {
    fetchMessageByUrl,
  };
};
