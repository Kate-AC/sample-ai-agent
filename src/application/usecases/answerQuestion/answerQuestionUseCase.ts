import {
  SLACK_FORMAT_INSTRUCTION,
  askClaude,
  buildInitialPrompt,
  extractResponseText,
  extractToolUses,
} from "application/services/claudeInteractor";
import type {
  ClaudeMessage,
  SlackMessage,
} from "domain/entities/answerQuestion";
import { MAX_ITERATIONS } from "domain/entities/answerQuestion";
import { limitToolResult } from "domain/services/resultLimiter";
import { extractSourceUrls } from "domain/services/urlExtractor";
import { makeSlackPoster } from "infrastructure/slack/slackPoster";
import { executeTool } from "infrastructure/tools/toolExecutor";
import { aiModelRegistry, buildToolUseSchema, mcpRegistry } from "sample-mcp";
import { gatherThreadContext } from "./gatherThreadContext";

/**
 * Claudeにリトライ付きで問い合わせる
 */
async function askClaudeWithRetry(
  claudeModel: any,
  context: any,
  conversationHistory: ClaudeMessage[],
  isFirstIteration: boolean,
  tools: any[],
  mcpRegistry: any,
  maxRetries = 5,
) {
  let claudeResponse = await askClaude(
    claudeModel,
    context,
    conversationHistory,
    isFirstIteration,
    tools,
    mcpRegistry,
  );

  // リトライが必要な場合
  for (let retry = 1; retry < maxRetries; retry++) {
    if (claudeResponse.isSuccess) {
      break;
    }

    // 400エラーの場合は即座に失敗
    if (claudeResponse.message?.includes("400")) {
      const errorMessage = claudeResponse.message.toLowerCase();

      if (
        errorMessage.includes("credit") ||
        errorMessage.includes("insufficient") ||
        errorMessage.includes("balance") ||
        errorMessage.includes("quota")
      ) {
        console.error(`❌ Claude API Error (400): ${claudeResponse.message}`);
        console.error(`💳 クレジット不足が発生しました。`);
        console.error(`   APIキーの残高を確認してください。`);
      } else {
        console.error(`❌ Claude API Error (400): ${claudeResponse.message}`);
        console.error(
          `   リクエストが不正です。パラメータを確認してください。`,
        );
        console.error(`   詳細: ${JSON.stringify(claudeResponse, null, 2)}`);
      }
      throw new Error(`Claude API error (400): ${claudeResponse.message}`);
    }

    // 429エラー（レート制限）または「Too many tokens」エラーの場合にリトライ
    const isRateLimitError =
      claudeResponse.message?.includes("429") ||
      claudeResponse.message?.toLowerCase().includes("too many tokens");

    if (isRateLimitError) {
      const waitTime = 30000 * retry;
      console.log(
        `Rate limit error detected. Retrying (attempt ${retry + 1}/${maxRetries})...`,
      );
      console.log(`Waiting ${waitTime / 1000} seconds before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      claudeResponse = await askClaude(
        claudeModel,
        context,
        conversationHistory,
        isFirstIteration,
        tools,
        mcpRegistry,
      );
    } else {
      console.error(`Claude API error: ${claudeResponse.message}`);
      throw new Error(`Claude API error: ${claudeResponse.message}`);
    }
  }

  if (!claudeResponse.isSuccess) {
    if (claudeResponse.message?.includes("400")) {
      const errorMessage = claudeResponse.message.toLowerCase();

      if (
        errorMessage.includes("credit") ||
        errorMessage.includes("insufficient") ||
        errorMessage.includes("balance") ||
        errorMessage.includes("quota")
      ) {
        console.error(`❌ Claude API Error (400): ${claudeResponse.message}`);
        console.error(`💳 クレジット不足が発生しました。`);
        console.error(`   APIキーの残高を確認してください。`);
      } else {
        console.error(`❌ Claude API Error (400): ${claudeResponse.message}`);
        console.error(
          `   リクエストが不正です。パラメータを確認してください。`,
        );
      }
    } else {
      console.error(
        `Claude API error after ${maxRetries} retries: ${claudeResponse.message}`,
      );
    }
    throw new Error(`Claude API error: ${claudeResponse.message}`);
  }

  return claudeResponse;
}

/**
 * ツールを実行して結果と情報源URLを収集
 */
async function executeToolsAndCollectResults(
  toolUses: any[],
  mcps: {
    slackMcp: any;
    redmineMcp: any;
  },
  sourceUrls: string[],
) {
  const toolResults: any[] = [];

  for (const toolUse of toolUses) {
    console.log(`Executing tool: ${toolUse.name}`);
    console.log(`Tool input: ${JSON.stringify(toolUse.input)}`);

    try {
      const result = await executeTool(toolUse.name, toolUse.input, mcps);

      // 結果を制限してClaudeに渡す（メモリ対策）
      const limitedResult = limitToolResult(toolUse.name, result);
      const resultJson = JSON.stringify(limitedResult, null, 2);

      // 結果のサイズをログ出力
      console.log(`  Result size: ${resultJson.length} chars`);
      if (resultJson.length > 10000) {
        console.warn(
          `  ⚠️  Result is very large (${resultJson.length} chars), may cause issues`,
        );
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: resultJson,
      });

      // 情報源URLを抽出して収集
      const urls = extractSourceUrls(toolUse.name, toolUse.input, result);

      urls.forEach((url) => {
        if (!sourceUrls.includes(url)) {
          sourceUrls.push(url);
        }
      });

      console.log(`Tool executed successfully: ${toolUse.name}`);
      if (urls.length > 0) {
        console.log(`  Extracted ${urls.length} source URL(s)`);
      }
    } catch (error) {
      console.error(`Tool execution failed: ${toolUse.name}`, error);
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return toolResults;
}

/**
 * 最終回答を参考URLとともにフォーマット
 */
function formatFinalAnswer(answerText: string, sourceUrls: string[]): string {
  let finalAnswer = answerText;

  if (sourceUrls.length > 0) {
    finalAnswer += "\n\n---\n*参考情報:*\n";
    sourceUrls.forEach((url) => {
      finalAnswer += `• ${url}\n`;
    });
  }

  return finalAnswer;
}

/**
 * Tool Useループを実行
 */
async function executeToolUseLoop(
  context: any,
  conversationHistory: ClaudeMessage[],
  tools: any[],
  mcpRegistry: any,
  claudeModel: any,
  mcps: {
    slackMcp: any;
    redmineMcp: any;
  },
): Promise<{ responseText: string | null; sourceUrls: string[] }> {
  const sourceUrls: string[] = [];
  let finalResponseText: string | null = null;
  const executedTools = new Set<string>(); // 実行済みツールを追跡

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    console.log(
      `\n========== Iteration ${iteration + 1}/${MAX_ITERATIONS} ==========`,
    );
    console.log(`会話履歴: ${conversationHistory.length}メッセージ`);
    console.log(`実行済みツール: ${executedTools.size}個`);

    // Claudeに質問（リトライロジック付き）
    const claudeResponse = await askClaudeWithRetry(
      claudeModel,
      context,
      conversationHistory,
      iteration === 0,
      tools,
      mcpRegistry,
    );

    console.log(`Claude API response received`);
    const responseMessage = claudeResponse.payload;

    // Tool Use情報を取得（hasToolUseでチェック）
    const {
      hasToolUse: hasToolUseInfo,
      extractToolUses: extractToolUsesFromPayload,
    } = await import("sample-mcp");
    const isToolUseResponse = hasToolUseInfo(responseMessage);
    const toolUses = isToolUseResponse ? extractToolUses(responseMessage) : [];

    // stop_reasonとcontentはmetadataから取得（Tool Use時のみ）
    const stopReason = isToolUseResponse
      ? (responseMessage as any).metadata.stopReason
      : "end_turn";
    const rawContent = isToolUseResponse
      ? (responseMessage as any).metadata.rawContent
      : [{ type: "text", text: responseMessage.text }];

    console.log(`Stop reason: ${stopReason}`);
    console.log(`Tool uses: ${toolUses.length}`);

    // テキスト応答を抽出（tool_use時の理由も含む）
    const responseText = extractResponseText(responseMessage);
    if (responseText) {
      console.log(`Response text (${responseText.length} chars):`);
      console.log(responseText);
    } else {
      console.log(`No text in response`);
    }

    // 会話履歴に追加
    if (iteration === 0) {
      conversationHistory.push({
        role: "user",
        content: buildInitialPrompt(context, mcpRegistry),
      });
    }

    conversationHistory.push({
      role: "assistant",
      content: rawContent as any,
    });

    // ツール使用がある場合
    if (toolUses.length > 0) {
      console.log(`Executing ${toolUses.length} tools...`);
      console.log(`Tool Use中のため、回答投稿をスキップします`);

      // 同じツールの繰り返し実行を検出
      const toolSignatures = toolUses.map(
        (t) => `${t.name}:${JSON.stringify(t.input)}`,
      );
      const repeatedTools = toolSignatures.filter((sig) =>
        executedTools.has(sig),
      );

      if (repeatedTools.length > 0) {
        console.warn(
          `⚠️  同じツールが繰り返し実行されています: ${repeatedTools.join(", ")}`,
        );
        console.warn(
          `   これは無限ループの可能性があります。収集済みの情報を基に回答を生成します。`,
        );

        // 繰り返しを検出したら、Claudeに総括を依頼するメッセージを追加
        conversationHistory.push({
          role: "user",
          content:
            "同じツールを繰り返し実行しています。これまでに収集した情報を基に、質問に対する回答を生成してください。",
        });

        // ループを抜けて総括生成へ
        break;
      }

      // 実行済みツールとして記録
      toolSignatures.forEach((sig) => executedTools.add(sig));

      // ツール実行
      const toolResults = await executeToolsAndCollectResults(
        toolUses,
        mcps,
        sourceUrls,
      );

      // ツール結果を会話履歴に追加
      conversationHistory.push({
        role: "user",
        content: toolResults as any,
      });

      console.log(
        `会話履歴に${toolResults.length}件のツール結果を追加しました`,
      );
      console.log(`現在の会話履歴: ${conversationHistory.length}メッセージ`);

      // 次のループでClaudeに結果を渡す
      continue;
    }

    // ツール使用がない場合は最終回答として保存
    if (responseText) {
      console.log(`最終回答を取得しました`);
      finalResponseText = responseText;
    }

    // end_turnで終了
    if (stopReason === "end_turn") {
      console.log(`Conversation ended normally`);
      break;
    }
  }

  return { responseText: finalResponseText, sourceUrls };
}

/**
 * 総括回答を生成
 */
async function generateSummary(
  context: any,
  conversationHistory: ClaudeMessage[],
  mcpRegistry: any,
  claudeModel: any,
): Promise<string> {
  console.log(`収集した情報を基に総括を生成します...`);

  // 総括リクエストを追加
  conversationHistory.push({
    role: "user",
    content: `収集した情報を基に、質問に対する総括的な回答を生成してください。

【重要】
- これ以上ツールを実行する必要はありません
- すでに収集した情報だけを使って回答してください
- 具体的で詳細な回答を生成してください

${SLACK_FORMAT_INSTRUCTION}`,
  });

  // Claudeに総括を依頼（ツールなしで実行）
  const summaryResponse = await claudeModel.aiModelFunctions.ask(
    conversationHistory,
    undefined, // toolsを渡さない！
    {
      system:
        "収集した情報を基に、質問に対する総括的な回答を生成してください。ツールは使用せず、既存の情報のみで回答してください。",
      max_tokens: 4096,
    },
  );

  if (!summaryResponse.isSuccess) {
    console.error(`総括生成に失敗: ${summaryResponse.message}`);
    return "回答を生成できませんでした。";
  }

  const summaryMessage = summaryResponse.payload;
  const summaryText = extractResponseText(summaryMessage);

  console.log(`Summary generated (${summaryText?.length || 0} chars)`);

  return summaryText || "回答を生成できませんでした。";
}

export const makeAnswerQuestionUseCase = (
  deps: {
    mcpRegistry: ReturnType<typeof mcpRegistry>;
    aiModelRegistry: ReturnType<typeof aiModelRegistry>;
  } = {
    mcpRegistry: mcpRegistry(),
    aiModelRegistry: aiModelRegistry(),
  },
) => {
  const mcpRegistry = deps.mcpRegistry;
  const slackMcp = mcpRegistry.getMcp("slack");
  const redmineMcp = mcpRegistry.getMcp("redmine");

  const aiReg = deps.aiModelRegistry;
  const claudeModel = aiReg.useAiModel("claude");

  // Slack投稿ヘルパーを初期化
  const slackPoster = makeSlackPoster(slackMcp);

  // MCP参照オブジェクト
  const mcps = {
    slackMcp,
    redmineMcp,
  };

  const invoke = async (
    channelId: string,
    message: SlackMessage,
  ): Promise<void> => {
    try {
      console.log(`Answering question for message: ${message.ts}`);
      console.log(`Question: ${message.text}`);

      // 1. スレッドコンテキストを収集
      const context = await gatherThreadContext(channelId, message, slackMcp);
      console.log(
        `Thread context gathered: ${context.messages.length} messages`,
      );

      // 2. ツール定義を生成
      const tools = buildToolUseSchema(mcpRegistry);
      console.log(`Generated ${tools.length} tools`);

      // 3. 会話履歴を構築
      const conversationHistory: ClaudeMessage[] = [];

      // 4. Tool Useループを実行して回答と情報源を取得
      const { responseText, sourceUrls } = await executeToolUseLoop(
        context,
        conversationHistory,
        tools,
        mcpRegistry,
        claudeModel,
        mcps,
      );

      // 5. 回答を整形して投稿
      let finalAnswer: string;

      if (responseText) {
        // 最終回答が取得できた場合
        console.log(`最終回答を取得しました (${sourceUrls.length} URLs)`);
        finalAnswer = formatFinalAnswer(responseText, sourceUrls);
      } else {
        // 回答が取得できなかった場合は総括を生成
        const summaryText = await generateSummary(
          context,
          conversationHistory,
          mcpRegistry,
          claudeModel,
        );
        finalAnswer = formatFinalAnswer(summaryText, sourceUrls);
      }

      // Slackに投稿
      await slackPoster.postAnswer(channelId, message, finalAnswer);
      console.log(
        `Answer posted to Slack with ${sourceUrls.length} source URLs`,
      );
    } catch (error) {
      console.error(`Failed to answer question:`, error);
      await slackPoster.postError(
        channelId,
        message,
        "申し訳ございません。回答の生成中にエラーが発生しました。",
      );
      throw error;
    }
  };

  return {
    invoke,
  };
};
