import { type MessageFetcher } from "application/slackMonitor/messageFetcher";
import { makeSlackMonitor } from "application/slackMonitor/slackMonitor";
import type { SlackMcp, SlackMessagePayload } from "sample-mcp";

// answerQuestionUseCaseをモック
jest.mock("application/usecases/answerQuestion/answerQuestionUseCase", () => ({
  makeAnswerQuestionUseCase: jest.fn(() => ({
    invoke: jest.fn(),
  })),
}));

describe("SlackMonitor", () => {
  const createMockMessage = (ts: string): SlackMessagePayload => ({
    type: "message",
    text: "test message",
    user: "U123456",
    ts,
  });

  const createMockMcpRegistry = () => ({
    getMcp: jest.fn((name: string) => {
      if (name === "slack") {
        return {
          mcpFunctions: {
            getConversationHistory: jest.fn(),
          },
        } as unknown as SlackMcp;
      }
      return {} as any;
    }),
    getAllMcp: jest.fn(),
    getAllMcpNames: jest.fn(),
  });

  const createMockAiModelRegistry = () => ({
    useAiModel: jest.fn(),
    getAllAiModels: jest.fn(),
    getAllAiModelNames: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("checkByUrl", () => {
    it("URLからメッセージを取得して処理する", async () => {
      const mockMessage = createMockMessage("1759736875.617839");

      const mockMessageFetcher = {
        fetchMessageByUrl: jest.fn().mockResolvedValue({
          isSuccess: true,
          payload: { message: mockMessage },
          message: "",
        }),
      } as unknown as MessageFetcher;

      const mcpRegistry = createMockMcpRegistry();
      const aiModelRegistry = createMockAiModelRegistry();

      const slackMonitor = makeSlackMonitor(
        {
          channelId: "C123456",
          reactionName: "thumbsup",
        },
        {
          mcpRegistry: mcpRegistry as any,
          aiModelRegistry: aiModelRegistry as any,
          messageFetcher: mockMessageFetcher,
        },
      );

      const testUrl =
        "https://your-workspace.slack.com/archives/C017U6EBKQS/p1759736875617839";
      await slackMonitor.checkByUrl(testUrl);

      expect(mockMessageFetcher.fetchMessageByUrl).toHaveBeenCalledWith(
        testUrl,
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Found message: 1759736875.617839"),
      );
      expect(console.log).toHaveBeenCalledWith(
        "✅ Message processed successfully",
      );
    });

    it("メッセージ取得に失敗した場合はエラーログを出力", async () => {
      const mockMessageFetcher = {
        fetchMessageByUrl: jest.fn().mockResolvedValue({
          isSuccess: false,
          payload: { message: {} as SlackMessagePayload },
          message: "Message not found",
        }),
      } as unknown as MessageFetcher;

      const mcpRegistry = createMockMcpRegistry();
      const aiModelRegistry = createMockAiModelRegistry();

      const slackMonitor = makeSlackMonitor(
        {
          channelId: "C123456",
          reactionName: "thumbsup",
        },
        {
          mcpRegistry: mcpRegistry as any,
          aiModelRegistry: aiModelRegistry as any,
          messageFetcher: mockMessageFetcher,
        },
      );

      await slackMonitor.checkByUrl(
        "https://your-workspace.slack.com/archives/C017U6EBKQS/p1759736875617839",
      );

      expect(console.error).toHaveBeenCalledWith(
        "❌ Failed to get message:",
        "Message not found",
      );
    });

    it("例外が発生した場合はエラーログを出力", async () => {
      const mockError = new Error("Unexpected error");
      const mockMessageFetcher = {
        fetchMessageByUrl: jest.fn().mockRejectedValue(mockError),
      } as unknown as MessageFetcher;

      const mcpRegistry = createMockMcpRegistry();
      const aiModelRegistry = createMockAiModelRegistry();

      const slackMonitor = makeSlackMonitor(
        {
          channelId: "C123456",
          reactionName: "thumbsup",
        },
        {
          mcpRegistry: mcpRegistry as any,
          aiModelRegistry: aiModelRegistry as any,
          messageFetcher: mockMessageFetcher,
        },
      );

      await slackMonitor.checkByUrl(
        "https://your-workspace.slack.com/archives/C017U6EBKQS/p1759736875617839",
      );

      expect(console.error).toHaveBeenCalledWith(
        "❌ Error in checkByUrl:",
        mockError,
      );
    });
  });
});
