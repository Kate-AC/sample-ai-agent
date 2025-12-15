import { makeClaudeReportGenerator } from "@core/application/services/claude/claudeReportGenerator";
import { ClaudeRepository } from "@core/domain/repositories/claude/claudeRepository";
import {
  ClaudeMessage,
  ClaudeMetadata,
  ClaudeToolUseSchema,
  ClaudeToolUseRequestContent,
  ClaudeToolUseResultContent,
  Result,
  ClaudeTextPayload,
} from "sample-mcp-kit";
import { Report } from "@core/domain/entities/report";

jest.mock("@core/domain/services/reportJsonParser", () => ({
  parseJsonFromText: jest.fn(),
}));

jest.mock("sample-mcp-kit", () => ({
  ...jest.requireActual("sample-mcp-kit"),
  buildClaudeToolUseDataSet: jest.fn(),
}));

describe("makeClaudeReportGenerator", () => {
  const createMockClaudeRepository = (): ClaudeRepository => {
    return {
      ask: jest.fn(),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("generate", () => {
    it("初回レポートを生成できること", async () => {
      const {
        parseJsonFromText,
      } = require("@core/domain/services/reportJsonParser");
      const mockClaudeRepository = createMockClaudeRepository();
      const mockResult: Result<ClaudeTextPayload> = {
        isSuccess: true,
        status: 200,
        payload: {
          text: JSON.stringify({
            status: "processing",
            confirmedFacts: ["事実1"],
            missingInformation: ["情報1"],
            logicSummary: "ロジック",
            sourceUrls: [],
          }),
          finishReason: "stop",
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          metadata: {
            id: "test-id",
            rawContent: [],
            stopReason: "end_turn",
          },
        },
      };

      const parsedReport: Report = {
        status: "processing",
        confirmedFacts: ["事実1"],
        missingInformation: ["情報1"],
        logicSummary: "ロジック",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
      };

      (mockClaudeRepository.ask as jest.Mock).mockResolvedValue(mockResult);
      parseJsonFromText.mockReturnValue(parsedReport);

      const generator = makeClaudeReportGenerator({
        claudeRepository: mockClaudeRepository,
      });

      const payload = {
        toolUseSchemas: [] as ClaudeToolUseSchema[],
        additionalSystemPrompt: "システムプロンプト",
      };

      const result = await generator.generate(
        "初期メッセージ",
        null as any,
        payload,
      );

      expect(mockClaudeRepository.ask).toHaveBeenCalledWith(
        [{ role: "user", content: "初期メッセージ" }],
        [],
        {
          max_tokens: 30000,
          system: expect.stringContaining("システムプロンプト"),
          enablePromptCaching: true,
        },
      );
      expect(result.status).toBe("processing");
      expect(result.confirmedFacts).toEqual(["事実1"]);
    });

    it("2回目以降のレポートを生成できること", async () => {
      const {
        parseJsonFromText,
      } = require("@core/domain/services/reportJsonParser");
      const mockClaudeRepository = createMockClaudeRepository();
      const previousReport: Report<ClaudeMetadata> = {
        status: "processing",
        confirmedFacts: ["事実1"],
        missingInformation: ["情報1"],
        logicSummary: "ロジック",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
        options: {
          id: "previous-id",
          rawContent: [],
          stopReason: "end_turn",
        },
      };

      const mockResult: Result<ClaudeTextPayload> = {
        isSuccess: true,
        status: 200,
        payload: {
          text: JSON.stringify({
            status: "completed",
            confirmedFacts: ["事実1", "事実2"],
            missingInformation: [],
            logicSummary: "更新されたロジック",
            sourceUrls: [],
          }),
          finishReason: "stop",
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          metadata: {
            id: "test-id",
            rawContent: [],
            stopReason: "end_turn",
          },
        },
      };

      const parsedReport: Report = {
        status: "completed",
        confirmedFacts: ["事実1", "事実2"],
        missingInformation: [],
        logicSummary: "更新されたロジック",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
      };

      (mockClaudeRepository.ask as jest.Mock).mockResolvedValue(mockResult);
      parseJsonFromText.mockReturnValue(parsedReport);

      const generator = makeClaudeReportGenerator({
        claudeRepository: mockClaudeRepository,
      });

      const payload = {
        toolUseSchemas: [] as ClaudeToolUseSchema[],
        additionalSystemPrompt: "システムプロンプト",
      };

      const result = await generator.generate(
        "初期メッセージ",
        previousReport,
        payload,
      );

      expect(mockClaudeRepository.ask).toHaveBeenCalledWith([], [], {
        max_tokens: 30000,
        system: expect.stringContaining("システムプロンプト"),
        enablePromptCaching: true,
      });
      expect(result.status).toBe("completed");
    });

    it("tool_useとtool_resultのペアを含むレポートを生成できること", async () => {
      const {
        parseJsonFromText,
      } = require("@core/domain/services/reportJsonParser");
      const { buildClaudeToolUseDataSet } = require("sample-mcp-kit");
      const mockClaudeRepository = createMockClaudeRepository();

      const toolUseRequests: ClaudeToolUseRequestContent[] = [
        {
          type: "tool_use",
          id: "tool1",
          name: "slack_getThreadMessages",
          input: {},
        },
      ];

      const toolUseResults: ClaudeToolUseResultContent[] = [
        {
          type: "tool_result",
          tool_use_id: "tool1",
          content: "結果",
        },
      ];

      const toolUseDataSet = {
        toolUseRequest: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool1",
              name: "slack_getThreadMessages",
              input: {},
            },
          ],
        } as ClaudeMessage,
        toolUseResult: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool1",
              content: "結果",
            },
          ],
        } as ClaudeMessage,
      };

      buildClaudeToolUseDataSet.mockReturnValue(toolUseDataSet);

      const mockResult: Result<ClaudeTextPayload> = {
        isSuccess: true,
        status: 200,
        payload: {
          text: JSON.stringify({
            status: "processing",
            confirmedFacts: ["事実1"],
            missingInformation: [],
            logicSummary: "ロジック",
            sourceUrls: [],
          }),
          finishReason: "stop",
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          metadata: {
            id: "test-id",
            rawContent: [],
            stopReason: "end_turn",
          },
        },
      };

      const parsedReport: Report = {
        status: "processing",
        confirmedFacts: ["事実1"],
        missingInformation: [],
        logicSummary: "ロジック",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
      };

      (mockClaudeRepository.ask as jest.Mock).mockResolvedValue(mockResult);
      parseJsonFromText.mockReturnValue(parsedReport);

      const generator = makeClaudeReportGenerator({
        claudeRepository: mockClaudeRepository,
      });

      const payload = {
        toolUseSchemas: [] as ClaudeToolUseSchema[],
        toolUseResults,
        toolUseRequests,
        additionalSystemPrompt: "システムプロンプト",
      };

      const result = await generator.generate(
        "初期メッセージ",
        null as any,
        payload,
      );

      expect(buildClaudeToolUseDataSet).toHaveBeenCalledWith(
        toolUseRequests,
        toolUseResults,
      );
      expect(mockClaudeRepository.ask).toHaveBeenCalledWith(
        expect.arrayContaining([
          { role: "user", content: "初期メッセージ" },
          toolUseDataSet.toolUseRequest,
          toolUseDataSet.toolUseResult,
        ]),
        [],
        expect.any(Object),
      );
      expect(result.status).toBe("processing");
    });

    it("ClaudeRepositoryがエラーを返した場合は例外をスローすること", async () => {
      const mockClaudeRepository = createMockClaudeRepository();
      const mockErrorResult: Result<ClaudeTextPayload> = {
        isSuccess: false,
        status: 500,
        message: "APIエラー",
        payload: null as any,
      };

      (mockClaudeRepository.ask as jest.Mock).mockResolvedValue(
        mockErrorResult,
      );

      const generator = makeClaudeReportGenerator({
        claudeRepository: mockClaudeRepository,
      });

      const payload = {
        toolUseSchemas: [] as ClaudeToolUseSchema[],
        additionalSystemPrompt: "システムプロンプト",
      };

      await expect(
        generator.generate("初期メッセージ", null as any, payload),
      ).rejects.toThrow("APIエラー");
    });

    it("tool_useのみでテキストがない場合（初回）はエラーをスローすること", async () => {
      const mockClaudeRepository = createMockClaudeRepository();
      const mockResult: Result<ClaudeTextPayload> = {
        isSuccess: true,
        status: 200,
        payload: {
          text: "",
          finishReason: "stop",
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          metadata: {
            id: "test-id",
            rawContent: [
              {
                type: "tool_use",
                id: "tool1",
                name: "test_tool",
                input: {},
              },
            ],
            stopReason: "tool_use",
          },
        },
      };

      (mockClaudeRepository.ask as jest.Mock).mockResolvedValue(mockResult);

      const generator = makeClaudeReportGenerator({
        claudeRepository: mockClaudeRepository,
      });

      const payload = {
        toolUseSchemas: [] as ClaudeToolUseSchema[],
        additionalSystemPrompt: "システムプロンプト",
      };

      await expect(
        generator.generate("初期メッセージ", null as any, payload),
      ).rejects.toThrow(
        "[ClaudeReportGenerator] 初回でReportが生成されていません。ツール実行結果があるにも関わらず、テキストが空の場合はエラーです。",
      );
    });

    it("tool_useのみでテキストがない場合（2回目以降）は前回のレポートを返すこと", async () => {
      const mockClaudeRepository = createMockClaudeRepository();
      const mockResult: Result<ClaudeTextPayload> = {
        isSuccess: true,
        status: 200,
        payload: {
          text: "",
          finishReason: "stop",
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          metadata: {
            id: "test-id",
            rawContent: [
              {
                type: "tool_use",
                id: "tool1",
                name: "test_tool",
                input: {},
              },
            ],
            stopReason: "tool_use",
          },
        },
      };

      const previousReport: Report<ClaudeMetadata> = {
        status: "processing",
        confirmedFacts: ["前回の事実"],
        missingInformation: ["前回の情報"],
        logicSummary: "前回のロジック",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
        options: {
          id: "previous-id",
          rawContent: [],
          stopReason: "end_turn",
        },
      };

      (mockClaudeRepository.ask as jest.Mock).mockResolvedValue(mockResult);

      const generator = makeClaudeReportGenerator({
        claudeRepository: mockClaudeRepository,
      });

      const payload = {
        toolUseSchemas: [] as ClaudeToolUseSchema[],
        additionalSystemPrompt: "システムプロンプト",
      };

      const result = await generator.generate(
        "初期メッセージ",
        previousReport,
        payload,
      );

      expect(result).toEqual({
        ...previousReport,
        updatedAt: expect.any(String),
        options: mockResult.payload.metadata,
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          "[ClaudeReportGenerator] Reportが返されなかったため、前回のReportをそのまま返します。",
        ),
      );
    });

    it("updatedAtとoptionsが正しく設定されること", async () => {
      const {
        parseJsonFromText,
      } = require("@core/domain/services/reportJsonParser");
      const mockClaudeRepository = createMockClaudeRepository();
      const mockResult: Result<ClaudeTextPayload> = {
        isSuccess: true,
        status: 200,
        payload: {
          text: JSON.stringify({
            status: "completed",
            confirmedFacts: [],
            missingInformation: [],
            logicSummary: "",
            sourceUrls: [],
          }),
          finishReason: "stop",
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          metadata: {
            id: "test-id",
            rawContent: [],
            stopReason: "end_turn",
          },
        },
      };

      const parsedReport: Report = {
        status: "completed",
        confirmedFacts: [],
        missingInformation: [],
        logicSummary: "",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      (mockClaudeRepository.ask as jest.Mock).mockResolvedValue(mockResult);
      parseJsonFromText.mockReturnValue(parsedReport);

      const generator = makeClaudeReportGenerator({
        claudeRepository: mockClaudeRepository,
      });

      const payload = {
        toolUseSchemas: [] as ClaudeToolUseSchema[],
        additionalSystemPrompt: "システムプロンプト",
      };

      const result = await generator.generate(
        "初期メッセージ",
        null as any,
        payload,
      );

      expect(result.updatedAt).toBeDefined();
      expect(result.options).toEqual(mockResult.payload.metadata);
    });
  });
});
