import { SlackRepository } from "@core/domain/repositories/slack/slackRepository";
import { SlackThreadMessage } from "@core/domain/entities/slack/thread";

describe("SlackRepository", () => {
  it("インターフェースが正しく定義されていること", () => {
    const repository: SlackRepository = {
      fetch: async (messageUrl: string) => {
        return {
          ts: "1234567890.123456",
          text: "テスト",
          channel: "C1234567890",
        };
      },
      fetchAll: async (messageUrl: string) => {
        return [
          {
            ts: "1234567890.123456",
            text: "テスト",
            channel: "C1234567890",
          },
        ];
      },
      replyWithFeedbackForm: async (
        target: SlackThreadMessage,
        text: string,
      ) => {
        // voidを返す
      },
      addReaction: async (messageUrl: string, reactionName: string) => {
        return {
          isSuccess: true,
          status: 200,
          payload: {
            ok: true,
          },
        };
      },
      getChannelHistory: async (
        channelId: string,
        oldest: number,
        latest: number,
        limit?: number,
      ) => {
        return [];
      },
    };

    expect(repository).toBeDefined();
    expect(typeof repository.fetch).toBe("function");
    expect(typeof repository.fetchAll).toBe("function");
    expect(typeof repository.replyWithFeedbackForm).toBe("function");
  });
});
