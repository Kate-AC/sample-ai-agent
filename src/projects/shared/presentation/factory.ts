import {
  aiModelRegistry,
  mcpRegistry,
  makeToolUseSchemaBuilder,
  makeUsageContextBuilder,
  makeSecurityRuleBuilder,
} from "sample-mcp-kit";
import { makeDatadogRepository } from "sample-mcp-kit/dist/src/platforms/datadog/infrastructure/repositories/datadogRepository";
import {
  DatadogLogAnalysisUsecase,
  makeDatadogLogAnalysisUsecase,
} from "@projects/shared/usecases/datadogLogAnalysisUsecase";
import {
  CodeInvestigationUsecase,
  makeCodeInvestigationUsecase,
} from "@projects/shared/usecases/codeInvestigationUsecase";
import {
  SqlGenerationUsecase,
  makeSqlGenerationUsecase,
} from "@projects/shared/usecases/sqlGenerationUsecase";
import { makeScheduleYamlGetter } from "@projects/shared/application/services/scheduleYamlGetter";
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
import { makeLocalRepository } from "@core/infrastructure/local/localRepository";
import { makeClaudeToolUseRequestExecutor } from "@core/infrastructure/claude/claudeToolUseRequestExecutor";
import { ClaudeRepository } from "@core/domain/repositories/claude/claudeRepository";
import { SlackRepository } from "@core/domain/repositories/slack/slackRepository";

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

export const resolveDatadogLogAnalysisUsecase =
  (): DatadogLogAnalysisUsecase => {
    const aiReg = aiModelRegistry();
    const claudeModel = aiReg.useAiModel("claude");
    const claudeRepository = makeClaudeRepository({ claudeModel });
    const claudeRecursiveReportGenerator =
      resolveClaudeRecursiveReportGenerator(claudeRepository);
    const datadogRepository = makeDatadogRepository();

    return makeDatadogLogAnalysisUsecase({
      claudeRecursiveReportGenerator,
      datadogRepository,
    });
  };

export const resolveCodeInvestigationUsecase = (): CodeInvestigationUsecase => {
  const mcpReg = mcpRegistry();
  const aiReg = aiModelRegistry();
  const localMcp = mcpReg.getMcp("local");
  const claudeModel = aiReg.useAiModel("claude");
  const claudeRepository = makeClaudeRepository({ claudeModel });
  const localRepository = makeLocalRepository({ localMcp });
  const claudeRecursiveReportGenerator =
    resolveClaudeRecursiveReportGenerator(claudeRepository);
  const scheduleYamlGetter = makeScheduleYamlGetter({ localRepository });

  return makeCodeInvestigationUsecase({
    claudeRecursiveReportGenerator,
    localRepository,
    scheduleYamlGetter,
  });
};

export const resolveSqlGenerationUsecase = (): SqlGenerationUsecase => {
  const mcpReg = mcpRegistry();
  const aiReg = aiModelRegistry();
  const localMcp = mcpReg.getMcp("local");
  const claudeModel = aiReg.useAiModel("claude");
  const claudeRepository = makeClaudeRepository({ claudeModel });
  const localRepository = makeLocalRepository({ localMcp });
  const claudeRecursiveReportGenerator =
    resolveClaudeRecursiveReportGenerator(claudeRepository);

  return makeSqlGenerationUsecase({
    claudeRecursiveReportGenerator,
    localRepository,
  });
};

