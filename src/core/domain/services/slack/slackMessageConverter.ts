import { SlackThreadMessage } from "@core/domain/entities/slack/thread";
import type { SlackMessagePayload } from "sample-mcp-kit";

/**
 * blocksからテキストを抽出
 */
const extractTextFromBlocks = (blocks?: Array<any>): string => {
  if (!blocks) {
    return "";
  }

  const texts: string[] = [];

  for (const block of blocks) {
    // sectionブロックのtextフィールド
    if (block.text?.text) {
      texts.push(block.text.text);
    }

    // sectionブロックのfields
    if (block.fields) {
      for (const field of block.fields) {
        if (field.text?.text) {
          texts.push(field.text.text);
        }
      }
    }

    // elements内のテキスト（ボタンなど）
    if (block.elements) {
      for (const element of block.elements) {
        if (element.text?.text) {
          texts.push(element.text.text);
        }
      }
    }
  }

  return texts.join("\n");
};

/**
 * attachmentsからテキストを抽出
 */
const extractTextFromAttachments = (attachments?: Array<any>): string => {
  if (!attachments) {
    return "";
  }

  const texts: string[] = [];

  for (const attachment of attachments) {
    if (attachment.pretext) {
      texts.push(attachment.pretext);
    }
    if (attachment.title) {
      texts.push(attachment.title);
    }
    if (attachment.title_link) {
      texts.push(attachment.title_link);
    }
    if (attachment.text) {
      texts.push(attachment.text);
    }
    if (attachment.fields) {
      for (const field of attachment.fields) {
        if (field.title) {
          texts.push(`${field.title}: ${field.value}`);
        } else {
          texts.push(field.value);
        }
      }
    }
    if (attachment.footer) {
      texts.push(attachment.footer);
    }
  }

  return texts.join("\n");
};

/**
 * SlackMessagePayloadをSlackThreadMessageに変換
 * textが空の場合はblocksやattachmentsからテキストを抽出
 */
export const convertToSlackMessage = (
  payload: SlackMessagePayload,
  channelId: string,
): SlackThreadMessage => {
  let text = payload.text || "";

  // textが空の場合はblocksやattachmentsから抽出
  if (!text.trim()) {
    const blocksText = extractTextFromBlocks(payload.blocks);
    const attachmentsText = extractTextFromAttachments(payload.attachments);

    const extractedTexts = [blocksText, attachmentsText].filter((t) =>
      t.trim(),
    );
    if (extractedTexts.length > 0) {
      text = extractedTexts.join("\n\n");
    }
  }

  return {
    ts: payload.ts,
    text,
    thread_ts: payload.thread_ts,
    channel: channelId,
  };
};
