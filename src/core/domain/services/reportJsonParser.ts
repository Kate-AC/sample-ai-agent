import { Report } from "@core/domain/entities/report";
import { PromptComplianceError } from "@core/domain/errors/promptComplianceError";

/**
 * テキストからJSONをパースする
 * コードブロック（```json ... ```）を除去してからパースする
 * @param text パースするテキスト
 * @param fallbackReport テキストが空の場合に返すフォールバックレポート（オプション）
 */
export const parseJsonFromText = (
  text: string,
  fallbackReport?: Report,
): Report => {
  if (!text || text.trim() === "") {
    if (fallbackReport) {
      console.warn(`[parseJsonFromText] Text is empty, using fallback report`);
      return fallbackReport;
    }
    throw new PromptComplianceError("返答の文字列が空です");
  }

  // コードブロック（```json ... ```）を除去
  const cleanedText = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  // ブレースの対応を数えてJSONオブジェクトを正確に抽出する
  const startIndex = cleanedText.indexOf("{");
  if (startIndex === -1) {
    throw new PromptComplianceError(
      `返答の文字列がJSONではない可能性があります: ${cleanedText}`,
    );
  }

  let depth = 0;
  let endIndex = -1;
  for (let i = startIndex; i < cleanedText.length; i++) {
    if (cleanedText[i] === "{") depth++;
    else if (cleanedText[i] === "}") {
      depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new PromptComplianceError(
      `返答の文字列がJSONではない可能性があります: ${cleanedText}`,
    );
  }

  const jsonString = cleanedText.slice(startIndex, endIndex + 1);

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new PromptComplianceError(
      `返答の文字列をJSONにパースできませんでした: ${jsonString}`,
    );
  }
};
