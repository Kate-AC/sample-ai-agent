import {
  aiModelRegistry,
  mcpRegistry,
  makeToolUseSchemaBuilder,
  makeUsageContextBuilder,
  makeSecurityRuleBuilder,
} from "sample-mcp-kit";
import {
  ClaudeRecursiveReportGenerator,
  makeClaudeRecursiveReportGenerator,
} from "@core/application/services/claude/claudeRecursiveReportGenerator";
import {
  makeSlackThreadContextFinder,
  SlackThreadContextFinder,
} from "@core/application/services/slack/slackThreadContextFinder";
import { makeClaudeReportGenerator } from "@core/application/services/claude/claudeReportGenerator";
import {
  ClaudeBulkToolUseRequestsExecutor,
  makeClaudeBulkToolUseRequestsExecutor,
} from "@core/application/services/claude/claudeBulkToolUseRequestsExecutor";
import { makeClaudeToolUseResultLimiter } from "@core/application/services/claude/claudeToolUseResultLimiter";
import { makeClaudeRepository } from "@core/infrastructure/claude/claudeRepository";
import { makeSlackRepository } from "@core/infrastructure/slack/slackRepository";
import { makeClaudeToolUseRequestExecutor } from "@core/infrastructure/claude/claudeToolUseRequestExecutor";
import { ClaudeRepository } from "@core/domain/repositories/claude/claudeRepository";

import { SlackRepository } from "@core/domain/repositories/slack/slackRepository";
import { makeOpsResolutionWorkflow } from "@projects/shared/workflows/opsResolutionWorkflow";
import { makeOpsMonitoringWorkflow } from "@projects/shared/workflows/opsMonitoringWorkflow";
import { makeQuickDuplicateCheckWorkflow } from "@projects/shared/workflows/quickDuplicateCheckWorkflow";
import {
  resolveDatadogLogAnalysisUsecase,
  resolveCodeInvestigationUsecase,
  resolveSqlGenerationUsecase,
} from "@projects/shared/presentation/factory";
import { makeOpsSheetHandler } from "@projects/shared/application/services/opsSheetHandler";
import { makeOpsReportEvaluationUsecase } from "@projects/shared/usecases/opsReportEvaluationUsecase";
import { makeDatadogRepository } from "sample-mcp-kit/dist/src/platforms/datadog/infrastructure/repositories/datadogRepository";
import { sqlGenerationAdditionalPrompt } from "../usecases/prompts/opsResolution/sqlGenerationAdditionalPrompt";
import { evaluationAdditionalPrompt } from "../usecases/prompts/opsResolution/evaluationAdditionalPrompt";

export const resolveClaudeBulkToolUseRequestsExecutor =
  (): ClaudeBulkToolUseRequestsExecutor => {
    return makeClaudeBulkToolUseRequestsExecutor({
      toolUseRequestExecutor: makeClaudeToolUseRequestExecutor(),
      toolUseLimiter: makeClaudeToolUseResultLimiter(),
    });
  };

export const resolveClaudeRecursiveReportGenerator = (
  claudeRepository: ClaudeRepository,
): ClaudeRecursiveReportGenerator => {
  const reportGenerator = makeClaudeReportGenerator({ claudeRepository });
  const bulkToolUseRequestsExecutor =
    resolveClaudeBulkToolUseRequestsExecutor();

  return makeClaudeRecursiveReportGenerator({
    reportGenerator,
    bulkToolUseRequestsExecutor,
    toolUseSchemaBuilder: makeToolUseSchemaBuilder(),
    securityRulesBuilder: makeSecurityRuleBuilder(),
    usageContextBuilder: makeUsageContextBuilder(),
  });
};

export const resolveSlackThreadContextFinder = (
  slackRepository: SlackRepository,
): SlackThreadContextFinder => {
  return makeSlackThreadContextFinder({ slackRepository });
};

export const resolveOpsResolutionWorkflow = () => {
  const mcpReg = mcpRegistry();
  const aiReg = aiModelRegistry();

  const slackMcp = mcpReg.getMcp("slack");
  const googleMcp = mcpReg.getMcp("google");
  const claudeModel = aiReg.useAiModel("claude");

  const slackRepository = makeSlackRepository({ slackMcp });
  const claudeRepository = makeClaudeRepository({ claudeModel });
  const opsSheetHandler = makeOpsSheetHandler({
    googleMcp,
    spreadsheetId: "example-spreadsheet-id",
    sheetName: "sample-main",
  });

  const slackThreadContextFinder =
    resolveSlackThreadContextFinder(slackRepository);
  const claudeRecursiveReportGenerator =
    resolveClaudeRecursiveReportGenerator(claudeRepository);

  const opsReportEvaluator = makeOpsReportEvaluationUsecase({
    claudeRecursiveReportGenerator,
    opsSheetHandler,
    slackRepository,
  });

  const datadogLogAnalysisUsecase = resolveDatadogLogAnalysisUsecase();
  const codeInvestigationUsecase = resolveCodeInvestigationUsecase();
  const sqlGenerationUsecase = resolveSqlGenerationUsecase();

  return makeOpsResolutionWorkflow({
    slackThreadContextFinder,
    opsSheetHandler,
    opsReportEvaluator,
    claudeRepository,
    slackRepository,
    datadogLogAnalysisUsecase,
    codeInvestigationUsecase,
    sqlGenerationUsecase,
    options: {
      dirs: ["sample-service", "sample-api"],
      opsSheetUrl:
        "https://docs.google.com/spreadsheets/d/example-spreadsheet-id/edit?gid=0#gid=0",
      sqlGenerationAdditionalPrompt,
      evaluationAdditionalPrompt,
    },
  });
};

export const resolveQuickDuplicateCheckWorkflow = () => {
  const mcpReg = mcpRegistry();
  const aiReg = aiModelRegistry();
  const slackMcp = mcpReg.getMcp("slack");
  const googleMcp = mcpReg.getMcp("google");
  const claudeModel = aiReg.useAiModel("claude");

  const slackRepository = makeSlackRepository({ slackMcp });
  const claudeRepository = makeClaudeRepository({ claudeModel });
  const slackThreadContextFinder =
    resolveSlackThreadContextFinder(slackRepository);
  const opsSheetHandler = makeOpsSheetHandler({
    googleMcp,
    spreadsheetId: "example-spreadsheet-id",
    sheetName: "sample-main",
  });
  const datadogRepository = makeDatadogRepository();

  return makeQuickDuplicateCheckWorkflow({
    slackThreadContextFinder,
    opsSheetHandler,
    slackRepository,
    claudeRepository,
    datadogRepository,
    options: {
      opsSheetUrl:
        "https://docs.google.com/spreadsheets/d/example-spreadsheet-id/edit?gid=0#gid=0",
    },
  });
};

export const resolveOpsMonitoringWorkflow = () => {
  const mcpReg = mcpRegistry();
  const slackMcp = mcpReg.getMcp("slack");
  const slackRepository = makeSlackRepository({ slackMcp });
  const opsResolutionWorkflow = resolveOpsResolutionWorkflow();
  const quickDuplicateCheckWorkflow = resolveQuickDuplicateCheckWorkflow();

  return makeOpsMonitoringWorkflow({
    slackRepository,
    opsResolutionWorkflow,
    quickDuplicateCheckWorkflow,
  });
};

