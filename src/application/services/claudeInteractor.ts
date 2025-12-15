import type { ThreadContext } from "domain/entities/answerQuestion";
import type {
  AiTextPayload,
  ClaudeAiModel,
  ClaudeExtendedTextPayload,
  ClaudeMessage,
  ClaudeToolUseSchema,
  McpRegistry,
} from "sample-mcp";
import {
  hasToolUse,
  extractToolUses as extractToolUsesFromPayload,
} from "sample-mcp";
import { buildSecurityRulesPrompt } from "./mcpReference";

/**
 * Slack mrkdwn フォーマット指示
 */
export const SLACK_FORMAT_INSTRUCTION = `【回答フォーマット】
- 回答はSlackに投稿されるため、Slack mrkdwn記法を使用してください
- 見出しは *太字* で表現してください（##は使用不可）
- 太字: *text*、イタリック: _text_、取り消し線: ~text~、コード: \`code\`
- リンクは <url|表示名> の形式（例: <https://example.com|リンク>）
- 箇条書きは • または - で開始`;

/**
 * Claudeに質問を投げる（Tool Use対応）
 */
export const askClaude = async (
  claudeModel: ClaudeAiModel,
  context: ThreadContext,
  conversationHistory: ClaudeMessage[],
  isFirstIteration: boolean,
  tools: ClaudeToolUseSchema[],
  mcpRegistry: McpRegistry,
) => {
  const messages: ClaudeMessage[] = isFirstIteration
    ? [
        {
          role: "user",
          content: buildInitialPrompt(context, mcpRegistry),
        },
      ]
    : conversationHistory;

  return await claudeModel.aiModelFunctions.ask(messages, tools, {
    system: [
      "あなたはオープンロジのエンジニアです。",
      "質問に対して的確に答えてください。",
      "",
      "【重要な原則】",
      "- 回答する前に、複数の情報源から情報を収集してください",
      "- 1つのツールだけで判断せず、最低でも2-3の異なる情報源を確認してください",
      "- 特に技術的な質問では、以下の優先度順に確認することを推奨します：",
      "  1. Redmine（関連チケット・過去の問い合わせ）",
      "  2. FAQ（基本的な仕様・手順）",
      "  3. Slack（関連する過去の会話）",
      "  4. Growi（詳細なドキュメント・設計書）",
      "  5. GitHub（実装・ソースコード）",
      "- 不確実な場合は、追加のツールを使って情報を補完してください",
      "- 回答の根拠となる情報源は必ず複数確認してください",
      "- データベース直接検索（MySQL）は使用しないでください",
      "",
      "【ツール使用の制約】",
      "- 提供されたツール定義に含まれるツールのみを使用してください",
      "- 存在しないツール名を推測して使用しないでください",
      "- 同じツールを同じ引数で繰り返し実行しないでください",
      "- ツールの実行結果を受け取ったら、その情報を基に次のステップに進んでください",
      "- 十分な情報が集まったら、ツール実行を終了して回答を生成してください",
    ].join("\n"),
  });
};

/**
 * Tool Useレスポンスからテキストを抽出
 */
export const extractResponseText = (
  payload: AiTextPayload | ClaudeExtendedTextPayload,
): string => {
  // textプロパティを使用（両方の型で共通）
  return payload.text;
};

/**
 * Tool Useを抽出（sample-mcpの関数を再エクスポート）
 */
export const extractToolUses = (
  payload: AiTextPayload | ClaudeExtendedTextPayload,
) => {
  // hasToolUseでClaudeExtendedTextPayloadかチェックしてから抽出
  if (hasToolUse(payload)) {
    // sample-mcp側の返却には type が含まれる場合があるため、
    // ここではテスト互換のため最小フィールドに射影する
    return extractToolUsesFromPayload(payload).map((u: any) => ({
      id: u.id,
      name: u.name,
      input: u.input,
    }));
  }
  return [];
};

/**
 * 初回のプロンプトを構築
 */
export const buildInitialPrompt = (
  context: ThreadContext,
  mcpRegistry: McpRegistry,
): string => {
  let prompt = `以下の質問に回答してください。\n\n`;
  prompt += `【質問】\n${context.userQuestion}\n\n`;

  // 回答フォーマットの指示
  prompt += `${SLACK_FORMAT_INSTRUCTION}\n\n`;

  // Slack URLが含まれている場合は、そのスレッドを取得する指示を追加
  // <> で囲まれている可能性もあるため、それも考慮
  const slackUrlPattern =
    /<?(https:\/\/[^\/]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+)>?/;
  const urlMatch = context.userQuestion.match(slackUrlPattern);
  if (urlMatch) {
    const url = urlMatch[1]; // <>なしのURL
    prompt += `【重要】質問にSlackのメッセージURLが含まれている可能性があります: ${url}\n`;
    prompt += `必ず slack_getThreadMessages ツールを使って、このURLのスレッド内容を取得してください。\n`;
    prompt += `URLに含まれる情報だけでなく、スレッドの実際の内容を確認して回答してください。\n\n`;
  }

  // セキュリティルールを追加
  const securityRules = buildSecurityRulesPrompt(mcpRegistry);
  if (securityRules) {
    prompt += securityRules;
  }

  if (context.messages.length > 1) {
    prompt += `【スレッドの履歴】\n`;
    context.messages.forEach((msg, i) => {
      prompt += `${i + 1}. ${msg.text}\n`;
    });
    prompt += `\n`;
  }

  return prompt;
};
