import { makeMessageFetcher } from "application/slackMonitor/messageFetcher";
import type { SlackMcp, SlackMessagePayload } from "sample-mcp";

describe("messageFetcher", () => {
  const mockSlackMcp = {
    mcpFunctions: {
      getConversationHistory: jest.fn(),
    },
  } as unknown as SlackMcp;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchMessageByUrl", () => {
    it("正しいURL形式からメッセージを取得できること", async () => {
      const mockMessage: SlackMessagePayload = {
        type: "message",
        user: "U123",
        text: "Test message from URL",
        ts: "1759736875.617839",
      };

      (
        mockSlackMcp.mcpFunctions.getConversationHistory as jest.Mock
      ).mockResolvedValue({
        isSuccess: true,
        payload: { messages: [mockMessage] },
      });

      const fetcher = makeMessageFetcher(mockSlackMcp);
      const result = await fetcher.fetchMessageByUrl(
        "https://your-workspace.slack.com/archives/C017U6EBKQS/p1759736875617839",
      );

      expect(result.isSuccess).toBe(true);
      expect(result.payload.message).toEqual(mockMessage);
      expect(
        mockSlackMcp.mcpFunctions.getConversationHistory,
      ).toHaveBeenCalledWith(
        "C017U6EBKQS",
        "latest=1759736875.617839&oldest=1759736875.617839&inclusive=true&limit=1",
      );
    });

    it("不正なURL形式の場合、エラーを返すこと", async () => {
      const fetcher = makeMessageFetcher(mockSlackMcp);
      const result = await fetcher.fetchMessageByUrl(
        "https://invalid-url.com/test",
      );

      expect(result.isSuccess).toBe(false);
      expect(result.message).toContain("Invalid Slack message URL format");
    });

    it("メッセージが見つからない場合、エラーを返すこと", async () => {
      (
        mockSlackMcp.mcpFunctions.getConversationHistory as jest.Mock
      ).mockResolvedValue({
        isSuccess: true,
        payload: { messages: [] },
      });

      const fetcher = makeMessageFetcher(mockSlackMcp);
      const result = await fetcher.fetchMessageByUrl(
        "https://your-workspace.slack.com/archives/C017U6EBKQS/p1759736875617839",
      );

      expect(result.isSuccess).toBe(false);
      expect(result.message).toContain("Message not found");
    });

    it("APIエラーの場合、エラーを返すこと", async () => {
      (
        mockSlackMcp.mcpFunctions.getConversationHistory as jest.Mock
      ).mockResolvedValue({
        isSuccess: false,
        message: "API Error",
      });

      const fetcher = makeMessageFetcher(mockSlackMcp);
      const result = await fetcher.fetchMessageByUrl(
        "https://your-workspace.slack.com/archives/C017U6EBKQS/p1759736875617839",
      );

      expect(result.isSuccess).toBe(false);
      expect(result.message).toBe("API Error");
    });
  });
});
