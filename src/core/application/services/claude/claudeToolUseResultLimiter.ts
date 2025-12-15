export interface ClaudeToolUseResultLimiter {
  limit: (toolName: string, result: any) => any;
}

/**
 * ツール結果を制限するサービス
 * 文章は途中で切らない（文字数制限なし）
 *
 * TODO: 面倒なのでtoolNameをベタ書きにしているが、機会があれば実装方針含め考える
 */
export const makeClaudeToolUseResultLimiter =
  (): ClaudeToolUseResultLimiter => {
    return {
      limit: (toolName, result): object => {
        // FAQ検索結果を制限
        if (toolName === "faq_search") {
          if (result.matches && Array.isArray(result.matches)) {
            // 全体から均等にサンプリング（最大100件）
            // 複数の結果があった場合に単純に後ろに足していくので、後半の情報も含めるため満遍なくサンプリング
            const sampledMatches = sampleEvenly(result.matches, 100);
            return {
              matches: sampledMatches.map((match: any) => ({
                text: match.text || "",
                context: match.context || "",
                position: match.position,
              })),
              total: result.matches.length,
            };
          }
        }

        // Growi検索結果を制限
        if (toolName === "growi_searchPages") {
          const pages = result.data || result.pages;
          if (pages && Array.isArray(pages)) {
            // 先頭10件 + 残りからサンプリング（最大30件）
            const sampledPages = sampleWithFirst10(pages, 30);
            return {
              ...result,
              data: sampledPages.map((page: any) => {
                const pageData = page.data || page;
                return {
                  data: {
                    _id: pageData._id,
                    path: pageData.path,
                    snippet: pageData.snippet || "",
                  },
                  meta: page.meta,
                };
              }),
            };
          }
        }

        // Redmine issues一覧を制限
        if (toolName === "redmine_getIssues") {
          if (result.issues && Array.isArray(result.issues)) {
            // 先頭10件 + 残りからサンプリング（最大30件）
            const sampledIssues = sampleWithFirst10(result.issues, 30);
            return {
              ...result,
              issues: sampledIssues.map((issue: any) => ({
                id: issue.id,
                subject: issue.subject,
                status: issue.status,
                description: issue.description || "",
              })),
            };
          }
        }

        // Google Drive検索結果を制限
        if (toolName === "google_searchDriveFiles") {
          if (result.files && Array.isArray(result.files)) {
            // 先頭50件 + 残りからサンプリング（最大100件）
            const sampledFiles = sampleWithFirst50(result.files, 100);
            return {
              ...result,
              files: sampledFiles,
            };
          }
        }

        // Slack検索結果を制限
        if (toolName === "slack_searchMessages") {
          if (
            result.messages?.matches &&
            Array.isArray(result.messages.matches)
          ) {
            // 先頭30件 + 残りからサンプリング（最大50件）
            const sampledMatches = sampleWithFirst30(
              result.messages.matches,
              50,
            );
            return {
              ok: result.ok,
              query: result.query,
              messages: {
                total: result.messages.total,
                matches: sampledMatches.map((match: any) => ({
                  text: match.text || "",
                  // text以外は最小限の情報のみ（permalinkは情報源として重要）
                  permalink: match.permalink,
                })),
              },
            };
          }
        }

        // Slackチャンネル履歴を制限
        if (toolName === "slack_getConversationHistory") {
          if (result.messages && Array.isArray(result.messages)) {
            // 先頭10件に制限し、各メッセージのテキストを5000文字で切り詰め
            const sampledMessages = sampleWithFirst10(result.messages, 10);
            return {
              ok: result.ok,
              messages: sampledMessages.map((msg: any) => ({
                text: truncateString(msg.text || "", 5000),
                ts: msg.ts,
                user: msg.user,
              })),
              total: result.messages.length,
            };
          }
        }

        // Localファイル読み込み結果を制限
        if (toolName === "local_readFile") {
          if (typeof result.content === "string") {
            const MAX_CHARS = 20000;
            if (result.content.length > MAX_CHARS) {
              return {
                ...result,
                content: result.content.slice(0, MAX_CHARS),
                truncated: true,
                originalLength: result.content.length,
                note: `ファイルが大きいため先頭${MAX_CHARS}文字に切り詰めました。`,
              };
            }
          }
        }

        // Localファイル一覧を制限
        if (toolName === "local_listFiles") {
          if (result.items && Array.isArray(result.items)) {
            // 先頭50件 + 残りからサンプリング（最大100件）
            const sampledItems = sampleWithFirst50(result.items, 100);
            return {
              path: result.path,
              items: sampledItems,
            };
          }
        }

        // Localファイル名検索結果を制限
        if (toolName === "local_searchFilesByName") {
          if (result.files && Array.isArray(result.files)) {
            // 先頭50件 + 残りからサンプリング（最大100件）
            const sampledFiles = sampleWithFirst50(result.files, 100);
            return {
              pattern: result.pattern,
              files: sampledFiles,
            };
          }
        }

        // Localコード検索結果を制限
        if (toolName === "local_searchCode") {
          if (result.results && Array.isArray(result.results)) {
            // 先頭50件 + 残りからサンプリング（最大100件）
            const sampledResults = sampleWithFirst50(result.results, 100);
            return {
              pattern: result.pattern,
              results: sampledResults.map((r: any) => ({
                ...r,
                line: truncateString(r.line, 300),
                context: r.context
                  ? {
                      before: r.context.before?.map((l: string) =>
                        truncateString(l, 300),
                      ),
                    }
                  : undefined,
              })),
            };
          }
        }

        // Datadogログ検索結果を制限
        if (
          toolName === "datadog_searchLogsByCompanyCode" ||
          toolName === "datadog_searchLogs" ||
          toolName === "datadog_searchLogsFromUrl"
        ) {
          if (result.data && Array.isArray(result.data)) {
            // 先頭30件 + 残りからサンプリング（最大50件）
            const sampledLogs = sampleWithFirst30(result.data, 50);
            return {
              ...result,
              data: sampledLogs.map(trimDatadogLogEntry),
            };
          }
        }

        return result;
      },
    };
  };

/**
 * 配列全体から均等にサンプリング
 * 先頭を優先せず、全体から満遍なくサンプリング
 */
export const sampleEvenly = <T>(
  array: T[],
  maxTotalItems: number = 100,
): T[] => {
  if (array.length <= maxTotalItems) {
    return array;
  }

  const sampled: T[] = [];
  const step = array.length / maxTotalItems;

  for (let i = 0; i < maxTotalItems; i++) {
    const index = Math.floor(i * step);
    sampled.push(array[index]!);
  }

  return sampled;
};

/**
 * 配列を先頭から指定数取得 + 残りからサンプリング
 * @param array サンプリング対象の配列
 * @param firstCount 先頭から必ず取得する数
 * @param maxTotalItems 最終的な合計数
 * @returns サンプリングされた配列
 */
export const sampleWithFirst = <T>(
  array: T[],
  firstCount: number,
  maxTotalItems: number,
): T[] => {
  if (array.length <= maxTotalItems) {
    return array;
  }

  const first = array.slice(0, firstCount);
  const remaining = array.slice(firstCount);
  const remainingSampleCount = maxTotalItems - firstCount;

  if (remaining.length <= remainingSampleCount) {
    return [...first, ...remaining];
  }

  // 残りから均等にサンプリング
  const sampled: T[] = [];
  const step = remaining.length / remainingSampleCount;

  for (let i = 0; i < remainingSampleCount; i++) {
    const index = Math.floor(i * step);
    sampled.push(remaining[index]!);
  }

  return [...first, ...sampled];
};

/**
 * 配列を先頭50件 + 残りからサンプリング
 * 先頭50件は必ず取得し、それ以降は均等にサンプリング
 */
export const sampleWithFirst50 = <T>(
  array: T[],
  maxTotalItems: number = 100,
): T[] => {
  return sampleWithFirst(array, 50, maxTotalItems);
};

/**
 * 配列を先頭30件 + 残りからサンプリング
 * 先頭30件は必ず取得し、それ以降は均等にサンプリング（最大50件）
 */
export const sampleWithFirst30 = <T>(
  array: T[],
  maxTotalItems: number = 50,
): T[] => {
  return sampleWithFirst(array, 30, maxTotalItems);
};

/**
 * 配列を先頭10件 + 残りからサンプリング
 * 先頭10件は必ず取得し、それ以降は均等にサンプリング（最大30件）
 */
export const sampleWithFirst10 = <T>(
  array: T[],
  maxTotalItems: number = 30,
): T[] => {
  return sampleWithFirst(array, 10, maxTotalItems);
};

/**
 * 文字列を指定文字数で切り詰める
 */
const truncateString = (str: string, maxLength: number): string => {
  if (typeof str !== "string") return str;
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
};

/**
 * Datadogログエントリから分析に必要なフィールドのみ抽出する
 * exception.trace/stack等の巨大フィールドを除去し、トークン消費を大幅に削減する
 */
const trimDatadogLogEntry = (log: any): any => {
  if (!log || typeof log !== "object") return log;

  const attrs = log.attributes;
  if (!attrs) return { id: log.id, attributes: {} };

  const innerAttrs = attrs.attributes;
  const context = innerAttrs?.context;

  // exceptionから必要なフィールドのみ抽出（trace/stackは除外）
  let trimmedContext: Record<string, any> | undefined;
  if (context && typeof context === "object") {
    const { exception, ...restContext } = context;
    trimmedContext = { ...restContext };

    if (exception && typeof exception === "object") {
      const { trace, stack, previous, ...restException } = exception;
      const trimmedEx: Record<string, any> = {
        ...restException,
        message:
          typeof restException.message === "string"
            ? truncateString(restException.message, 1000)
            : restException.message,
      };
      // previousからもtrace/stackを除外
      if (previous && typeof previous === "object") {
        const { trace: _pt, stack: _ps, ...restPrevious } = previous;
        trimmedEx.previous = {
          ...restPrevious,
          message:
            typeof restPrevious.message === "string"
              ? truncateString(restPrevious.message, 500)
              : restPrevious.message,
        };
      }
      trimmedContext.exception = trimmedEx;
    }
  }

  return {
    id: log.id,
    attributes: {
      timestamp: attrs.timestamp,
      host: attrs.host,
      service: attrs.service,
      status: attrs.status,
      message:
        typeof attrs.message === "string"
          ? truncateString(attrs.message, 2000)
          : attrs.message,
      attributes: trimmedContext ? { context: trimmedContext } : undefined,
      tags: attrs.tags,
    },
  };
};
