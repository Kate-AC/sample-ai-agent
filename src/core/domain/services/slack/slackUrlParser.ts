export type ParsedSlackUrl = {
  channelId: string;
  ts: string;
  threadTs: string | null;
};

/**
 * URLからチャンネルID、タイムスタンプ、thread_tsを抽出
 */
export const parseSlackUrl = (messageUrl: string): ParsedSlackUrl | null => {
  const urlWithoutQuery = messageUrl.split("?")[0];
  const urlPattern = /\/archives\/([A-Z0-9]+)\/p(\d+)/;
  const match = urlWithoutQuery.match(urlPattern);

  if (!match) {
    return null;
  }

  const channelId = match[1];
  const timestamp = match[2];
  const ts = `${timestamp.slice(0, 10)}.${timestamp.slice(10)}`;

  const threadTsMatch = messageUrl.match(/thread_ts=(\d+\.\d+)/);
  const threadTs = threadTsMatch ? threadTsMatch[1] : null;

  return { channelId, ts, threadTs };
};
