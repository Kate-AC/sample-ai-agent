import { makeSlackPoster } from "infrastructure/slack/slackPoster";
import type { SlackMcp } from "sample-mcp";
import type { SlackMessage } from "domain/entities/answerQuestion";

describe("slackPoster", () => {
  const createMockSlackMcp = (): SlackMcp => ({
    mcpFunctions: {
      postMessage: jest.fn().mockResolvedValue({
        isSuccess: true,
        payload: {},
      }),
    } as any,
    mcpMetadata: {} as any,
    mcpSetting: {} as any,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("postAnswer", () => {
    it("Slackにメッセージを投稿できること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const slackPoster = makeSlackPoster(mockSlackMcp);

      const message: SlackMessage = {
        text: "質問",
        ts: "123.456",
      };

      await slackPoster.postAnswer("C123", message, "回答です");

      expect(mockSlackMcp.mcpFunctions.postMessage).toHaveBeenCalledWith(
        "C123",
        "回答です",
        '{"thread_ts":"123.456"}',
      );
    });

    it("thread_tsが存在する場合はthread_tsを使用すること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const slackPoster = makeSlackPoster(mockSlackMcp);

      const message: SlackMessage = {
        text: "質問",
        ts: "123.457",
        thread_ts: "123.456",
      };

      await slackPoster.postAnswer("C123", message, "回答です");

      expect(mockSlackMcp.mcpFunctions.postMessage).toHaveBeenCalledWith(
        "C123",
        "回答です",
        '{"thread_ts":"123.456"}',
      );
    });
  });

  describe("postError", () => {
    it("エラーメッセージをSlackに投稿できること", async () => {
      const mockSlackMcp = createMockSlackMcp();
      const slackPoster = makeSlackPoster(mockSlackMcp);

      const message: SlackMessage = {
        text: "質問",
        ts: "123.456",
      };

      await slackPoster.postError("C123", message, "エラーが発生しました");

      expect(mockSlackMcp.mcpFunctions.postMessage).toHaveBeenCalledWith(
        "C123",
        "エラーが発生しました",
        '{"thread_ts":"123.456"}',
      );
    });

    it("投稿に失敗してもエラーをスローしないこと", async () => {
      const mockSlackMcp = createMockSlackMcp();
      (mockSlackMcp.mcpFunctions.postMessage as jest.Mock).mockRejectedValue(
        new Error("API Error"),
      );

      const slackPoster = makeSlackPoster(mockSlackMcp);

      const message: SlackMessage = {
        text: "質問",
        ts: "123.456",
      };

      // エラーをスローしないことを確認
      await expect(
        slackPoster.postError("C123", message, "エラーが発生しました"),
      ).resolves.not.toThrow();
    });
  });
});
