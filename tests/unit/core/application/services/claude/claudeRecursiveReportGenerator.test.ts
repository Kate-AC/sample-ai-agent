import {
  makeClaudeRecursiveReportGenerator,
  ClaudeRecursiveReportGeneratorSettings,
} from "@core/application/services/claude/claudeRecursiveReportGenerator";
import { ReportGenerator } from "@core/domain/services/reportGenerator";
import { ClaudeBulkToolUseRequestsExecutor } from "@core/application/services/claude/claudeBulkToolUseRequestsExecutor";
import {
  ToolUseSchemaBuilder,
  SecurityRuleBuilder,
  UsageContextBuilder,
  PlatformName,
  ClaudeMetadata,
  ClaudeToolUseRequestContent,
  ClaudeToolUseResultContent,
} from "sample-mcp-kit";
import { Report } from "@core/domain/entities/report";
import { ClaudeRecursiveReportGeneratorState } from "@core/application/services/claude/claudeRecursiveReportGenerator";

jest.mock("sample-mcp-kit", () => ({
  ...jest.requireActual("sample-mcp-kit"),
  executeRepeatedCallback: jest.fn(),
  extractToolUsesFromMetadata: jest.fn(),
}));

describe("makeClaudeRecursiveReportGenerator", () => {
  const createMockReportGenerator = (): ReportGenerator<
    any,
    ClaudeMetadata
  > => {
    return {
      generate: jest.fn(),
    };
  };

  const createMockBulkExecutor = (): ClaudeBulkToolUseRequestsExecutor => {
    return {
      execute: jest.fn(),
    };
  };

  const createMockBuilders = () => {
    return {
      toolUseSchemaBuilder: {
        buildFromMcpNames: jest.fn(() => []),
      } as unknown as ToolUseSchemaBuilder,
      securityRulesBuilder: {
        buildFromMcpNames: jest.fn(() => "セキュリティルール"),
      } as unknown as SecurityRuleBuilder,
      usageContextBuilder: {
        buildFromMcpNames: jest.fn(() => "使用コンテキスト"),
      } as unknown as UsageContextBuilder,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("invoke", () => {
    it("レポートを生成できること", async () => {
      const { executeRepeatedCallback } = require("sample-mcp-kit");
      const mockReportGenerator = createMockReportGenerator();
      const mockBulkExecutor = createMockBulkExecutor();
      const builders = createMockBuilders();

      const finalReport: Report<ClaudeMetadata> = {
        status: "completed",
        confirmedFacts: ["事実"],
        missingInformation: [],
        logicSummary: "ロジック",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
        options: {
          id: "test-id",
          rawContent: [],
          stopReason: "end_turn",
        },
      };

      const finalState: ClaudeRecursiveReportGeneratorState = {
        previousReport: finalReport,
        toolUseResults: [],
        toolUseRequests: [],
        additionalSystemPrompt: "",
        isFinished: true,
      };

      executeRepeatedCallback.mockResolvedValue(finalState);

      const generator = makeClaudeRecursiveReportGenerator({
        reportGenerator: mockReportGenerator,
        bulkToolUseRequestsExecutor: mockBulkExecutor,
        ...builders,
      });

      const settings: ClaudeRecursiveReportGeneratorSettings = {
        mapNames: ["slack"] as PlatformName[],
        repeatTimes: 10,
        retryStrategy: {
          maxRetries: 5,
          shouldRetry: () => false,
          getWaitTime: () => 0,
        },
      };

      const report = await generator.invoke("初期メッセージ", settings);

      expect(report).toEqual(finalReport);
      expect(
        builders.toolUseSchemaBuilder.buildFromMcpNames,
      ).toHaveBeenCalledWith(["slack"]);
    });

    it("ツール使用がない場合は終了すること", async () => {
      const {
        executeRepeatedCallback,
        extractToolUsesFromMetadata,
      } = require("sample-mcp-kit");
      const mockReportGenerator = createMockReportGenerator();
      const mockBulkExecutor = createMockBulkExecutor();
      const builders = createMockBuilders();

      const report: Report<ClaudeMetadata> = {
        status: "completed",
        confirmedFacts: ["事実"],
        missingInformation: [],
        logicSummary: "ロジック",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
        options: {
          id: "test-id",
          rawContent: [],
          stopReason: "end_turn",
        },
      };

      extractToolUsesFromMetadata.mockReturnValue([]);

      executeRepeatedCallback.mockImplementation(async (callback) => {
        const state = await callback(undefined);
        return state;
      });

      (mockReportGenerator.generate as jest.Mock).mockResolvedValue(report);

      const generator = makeClaudeRecursiveReportGenerator({
        reportGenerator: mockReportGenerator,
        bulkToolUseRequestsExecutor: mockBulkExecutor,
        ...builders,
      });

      const settings: ClaudeRecursiveReportGeneratorSettings = {
        mapNames: ["slack"] as PlatformName[],
        repeatTimes: 10,
        retryStrategy: {
          maxRetries: 5,
          shouldRetry: () => false,
          getWaitTime: () => 0,
        },
      };

      const result = await generator.invoke("初期メッセージ", settings);

      expect(result.status).toBe("completed");
      expect(mockBulkExecutor.execute).not.toHaveBeenCalled();
    });

    it("ツール使用がある場合はツールを実行すること", async () => {
      const {
        executeRepeatedCallback,
        extractToolUsesFromMetadata,
      } = require("sample-mcp-kit");
      const mockReportGenerator = createMockReportGenerator();
      const mockBulkExecutor = createMockBulkExecutor();
      const builders = createMockBuilders();

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

      const report: Report<ClaudeMetadata> = {
        status: "processing",
        confirmedFacts: [],
        missingInformation: ["情報1"],
        logicSummary: "ロジック",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
        options: {
          id: "test-id",
          rawContent: [],
          stopReason: "tool_use",
        },
      };

      extractToolUsesFromMetadata.mockReturnValue(toolUseRequests);
      (mockBulkExecutor.execute as jest.Mock).mockResolvedValue(toolUseResults);

      executeRepeatedCallback.mockImplementation(async (callback) => {
        const state1 = await callback(undefined);
        const state2 = await callback(state1);
        return state2;
      });

      (mockReportGenerator.generate as jest.Mock)
        .mockResolvedValueOnce(report)
        .mockResolvedValueOnce({
          ...report,
          status: "completed",
          missingInformation: [],
        });

      const generator = makeClaudeRecursiveReportGenerator({
        reportGenerator: mockReportGenerator,
        bulkToolUseRequestsExecutor: mockBulkExecutor,
        ...builders,
      });

      const settings: ClaudeRecursiveReportGeneratorSettings = {
        mapNames: ["slack"] as PlatformName[],
        repeatTimes: 10,
        retryStrategy: {
          maxRetries: 5,
          shouldRetry: () => false,
          getWaitTime: () => 0,
        },
      };

      await generator.invoke("初期メッセージ", settings);

      expect(mockBulkExecutor.execute).toHaveBeenCalledWith(toolUseRequests);
    });

    it("excludeToolsで指定したツールがスキーマから除外されること", async () => {
      const { executeRepeatedCallback } = require("sample-mcp-kit");
      const mockReportGenerator = createMockReportGenerator();
      const mockBulkExecutor = createMockBulkExecutor();
      const builders = createMockBuilders();

      const allSchemas = [
        {
          name: "github_getFileContent",
          description: "ファイル取得",
          input_schema: { type: "object", properties: {} },
        },
        {
          name: "github_listRepositoryContents",
          description: "ディレクトリ一覧",
          input_schema: { type: "object", properties: {} },
        },
        {
          name: "local_readFile",
          description: "ローカルファイル読み込み",
          input_schema: { type: "object", properties: {} },
        },
      ];

      (
        builders.toolUseSchemaBuilder.buildFromMcpNames as jest.Mock
      ).mockReturnValue(allSchemas);

      const finalState: ClaudeRecursiveReportGeneratorState = {
        previousReport: {
          status: "completed",
          confirmedFacts: [],
          missingInformation: [],
          logicSummary: "ロジック",
          overwritableInfo: null,
          sourceUrls: [],
          updatedAt: new Date().toISOString(),
          options: { id: "test-id", rawContent: [], stopReason: "end_turn" },
        },
        toolUseResults: [],
        toolUseRequests: [],
        additionalSystemPrompt: "",
        isFinished: true,
      };

      executeRepeatedCallback.mockResolvedValue(finalState);

      const generator = makeClaudeRecursiveReportGenerator({
        reportGenerator: mockReportGenerator,
        bulkToolUseRequestsExecutor: mockBulkExecutor,
        ...builders,
      });

      const settings: ClaudeRecursiveReportGeneratorSettings = {
        mapNames: ["local", "github"] as PlatformName[],
        excludeTools: ["github_listRepositoryContents"],
        repeatTimes: 10,
        retryStrategy: {
          maxRetries: 5,
          shouldRetry: () => false,
          getWaitTime: () => 0,
        },
      };

      await generator.invoke("初期メッセージ", settings);

      // executeRepeatedCallbackに渡されるcallback内でtoolUseSchemasが使われるが、
      // 直接検証するため、reportGenerator.generateに渡されるスキーマを確認する
      const callbackFn = executeRepeatedCallback.mock.calls[0][0];
      // callbackを実行してreportGenerator.generateが呼ばれることを確認
      const { extractToolUsesFromMetadata } = require("sample-mcp-kit");
      extractToolUsesFromMetadata.mockReturnValue([]);
      (mockReportGenerator.generate as jest.Mock).mockResolvedValue(
        finalState.previousReport,
      );

      await callbackFn(undefined);

      const generateCall = (mockReportGenerator.generate as jest.Mock).mock
        .calls[0];
      const passedSchemas = generateCall[2].toolUseSchemas;

      expect(passedSchemas).toHaveLength(2);
      expect(passedSchemas.map((s: any) => s.name)).toEqual([
        "github_getFileContent",
        "local_readFile",
      ]);
      expect(passedSchemas.map((s: any) => s.name)).not.toContain(
        "github_listRepositoryContents",
      );
    });

    it("excludeToolsが未指定の場合は全スキーマが渡されること", async () => {
      const {
        executeRepeatedCallback,
        extractToolUsesFromMetadata,
      } = require("sample-mcp-kit");
      const mockReportGenerator = createMockReportGenerator();
      const mockBulkExecutor = createMockBulkExecutor();
      const builders = createMockBuilders();

      const allSchemas = [
        {
          name: "github_getFileContent",
          description: "ファイル取得",
          input_schema: { type: "object", properties: {} },
        },
        {
          name: "github_listRepositoryContents",
          description: "ディレクトリ一覧",
          input_schema: { type: "object", properties: {} },
        },
      ];

      (
        builders.toolUseSchemaBuilder.buildFromMcpNames as jest.Mock
      ).mockReturnValue(allSchemas);

      const finalReport: Report<ClaudeMetadata> = {
        status: "completed",
        confirmedFacts: [],
        missingInformation: [],
        logicSummary: "ロジック",
        overwritableInfo: null,
        sourceUrls: [],
        updatedAt: new Date().toISOString(),
        options: { id: "test-id", rawContent: [], stopReason: "end_turn" },
      };

      executeRepeatedCallback.mockImplementation(async (callback: any) => {
        const state = await callback(undefined);
        return state;
      });
      extractToolUsesFromMetadata.mockReturnValue([]);
      (mockReportGenerator.generate as jest.Mock).mockResolvedValue(
        finalReport,
      );

      const generator = makeClaudeRecursiveReportGenerator({
        reportGenerator: mockReportGenerator,
        bulkToolUseRequestsExecutor: mockBulkExecutor,
        ...builders,
      });

      const settings: ClaudeRecursiveReportGeneratorSettings = {
        mapNames: ["github"] as PlatformName[],
        repeatTimes: 10,
        retryStrategy: {
          maxRetries: 5,
          shouldRetry: () => false,
          getWaitTime: () => 0,
        },
      };

      await generator.invoke("初期メッセージ", settings);

      const generateCall = (mockReportGenerator.generate as jest.Mock).mock
        .calls[0];
      const passedSchemas = generateCall[2].toolUseSchemas;

      expect(passedSchemas).toHaveLength(2);
      expect(passedSchemas.map((s: any) => s.name)).toEqual([
        "github_getFileContent",
        "github_listRepositoryContents",
      ]);
    });
  });
});
