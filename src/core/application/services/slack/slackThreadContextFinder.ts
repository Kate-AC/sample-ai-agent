import { SlackThreadContext } from "@core/domain/entities/slack/thread";
import { parseSlackUrl } from "@core/domain/services/slack/slackUrlParser";
import { SlackRepository } from "@core/domain/repositories/slack/slackRepository";

export interface SlackThreadContextFinder {
  invoke: (slackMessageUrl: string) => Promise<SlackThreadContext>;
}

export const makeSlackThreadContextFinder = (deps: {
  slackRepository: SlackRepository;
}): SlackThreadContextFinder => {
  return {
    invoke: async (slackMessageUrl: string) => {
      // 1. URLをパースしてチャンネルIDを取得
      const parsedUrl = parseSlackUrl(slackMessageUrl);
      if (!parsedUrl) {
        throw new Error("Invalid Slack message URL");
      }

      // 2. スレッドメッセージを取得
      const threadMessages =
        await deps.slackRepository.fetchAll(slackMessageUrl);

      if (!threadMessages || threadMessages.length === 0) {
        throw new Error("Failed to fetch thread messages");
      }

      // 3. URLで指定されたメッセージを取得
      const targetMessage = threadMessages.find(
        (msg) => msg.ts === parsedUrl.ts,
      );
      if (!targetMessage) {
        throw new Error("Target message not found in thread");
      }

      // 4. スレッドコンテキストを構築
      return {
        threadMessages,
        userQuestion: targetMessage,
      };
    },
  };
};
