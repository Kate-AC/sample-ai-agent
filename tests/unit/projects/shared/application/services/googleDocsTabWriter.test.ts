import { makeGoogleDocsTabWriter } from "@projects/shared/application/services/googleDocsTabWriter";
import { GoogleMcp } from "sample-mcp-kit";

describe("makeGoogleDocsTabWriter", () => {
  const createMockGoogleMcp = (): GoogleMcp => {
    return {
      mcpFunctions: {
        getCalendarEvents: jest.fn(),
        getDocument: jest.fn(),
        batchUpdateDocument: jest.fn(),
        getSpreadsheet: jest.fn(),
        getSheetValues: jest.fn(),
        appendSheetValues: jest.fn(),
        updateSheetValues: jest.fn(),
        getDriveFile: jest.fn(),
        searchDriveFiles: jest.fn(),
      },
      mcpMetadata: {} as any,
      mcpSetting: {} as any,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addTab", () => {
    it("タブを作成してタブIDを返すこと", async () => {
      const mockGoogleMcp = createMockGoogleMcp();
      (
        mockGoogleMcp.mcpFunctions.batchUpdateDocument as jest.Mock
      ).mockResolvedValue({
        isSuccess: true,
        status: 200,
        payload: {
          documentId: "doc-123",
          replies: [
            {
              addDocumentTab: {
                tabProperties: {
                  tabId: "t.new-tab-id",
                  title: "test_review",
                  index: 1,
                },
              },
            },
          ],
          writeControl: {},
        },
      });

      const writer = makeGoogleDocsTabWriter({ googleMcp: mockGoogleMcp });
      const tabId = await writer.addTab("doc-123", "test_review");

      expect(tabId).toBe("t.new-tab-id");
      expect(
        mockGoogleMcp.mcpFunctions.batchUpdateDocument,
      ).toHaveBeenCalledWith(
        "doc-123",
        JSON.stringify([
          {
            addDocumentTab: {
              tabProperties: {
                title: "test_review",
              },
            },
          },
        ]),
      );
    });

    it("API呼び出しが失敗した場合はエラーをスローすること", async () => {
      const mockGoogleMcp = createMockGoogleMcp();
      (
        mockGoogleMcp.mcpFunctions.batchUpdateDocument as jest.Mock
      ).mockResolvedValue({
        isSuccess: false,
        status: 400,
        message: "Bad Request",
        payload: null,
      });

      const writer = makeGoogleDocsTabWriter({ googleMcp: mockGoogleMcp });

      await expect(writer.addTab("doc-123", "test_review")).rejects.toThrow(
        'Failed to create tab "test_review": Bad Request',
      );
    });

    it("レスポンスにタブIDが含まれない場合はエラーをスローすること", async () => {
      const mockGoogleMcp = createMockGoogleMcp();
      (
        mockGoogleMcp.mcpFunctions.batchUpdateDocument as jest.Mock
      ).mockResolvedValue({
        isSuccess: true,
        status: 200,
        payload: {
          documentId: "doc-123",
          replies: [{}],
          writeControl: {},
        },
      });

      const writer = makeGoogleDocsTabWriter({ googleMcp: mockGoogleMcp });

      await expect(writer.addTab("doc-123", "test_review")).rejects.toThrow(
        'Failed to get new tab ID from response for tab "test_review"',
      );
    });
  });

  describe("writeToTab", () => {
    it("タブにテキストを書き込めること", async () => {
      const mockGoogleMcp = createMockGoogleMcp();
      (
        mockGoogleMcp.mcpFunctions.batchUpdateDocument as jest.Mock
      ).mockResolvedValue({
        isSuccess: true,
        status: 200,
        payload: {
          documentId: "doc-123",
          replies: [{}],
          writeControl: {},
        },
      });

      const writer = makeGoogleDocsTabWriter({ googleMcp: mockGoogleMcp });
      await writer.writeToTab("doc-123", "t.tab-id", "テスト文章");

      expect(
        mockGoogleMcp.mcpFunctions.batchUpdateDocument,
      ).toHaveBeenCalledWith(
        "doc-123",
        JSON.stringify([
          {
            insertText: {
              location: {
                index: 1,
                tabId: "t.tab-id",
              },
              text: "テスト文章",
            },
          },
        ]),
      );
    });

    it("API呼び出しが失敗した場合はエラーをスローすること", async () => {
      const mockGoogleMcp = createMockGoogleMcp();
      (
        mockGoogleMcp.mcpFunctions.batchUpdateDocument as jest.Mock
      ).mockResolvedValue({
        isSuccess: false,
        status: 500,
        message: "Internal Server Error",
        payload: null,
      });

      const writer = makeGoogleDocsTabWriter({ googleMcp: mockGoogleMcp });

      await expect(
        writer.writeToTab("doc-123", "t.tab-id", "テスト文章"),
      ).rejects.toThrow(
        'Failed to insert text to tab "t.tab-id": Internal Server Error',
      );
    });
  });
});
