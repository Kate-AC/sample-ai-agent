import { PromptComplianceError } from "@core/domain/errors/promptComplianceError";
import { EvaluationPayload } from "../../opsReportEvaluationUsecase";

/**
 * テキストからEvaluationPayloadをパースする
 * エスケープされたJSON文字列の可能性があるため、デコード処理を含む
 * ClaudeがlogicSummaryにオブジェクトを直接返した場合にも対応する
 * @param text パースするテキスト（string または object）
 */
export const parseEvaluationFromText = (
  text: string | unknown,
): EvaluationPayload => {
  // Claudeがプロンプト指示に従わずオブジェクトを直接返した場合はそのまま検証する
  if (typeof text === "object" && text !== null) {
    const obj = text as Record<string, unknown>;
    if (
      typeof obj.shouldSave === "boolean" &&
      Array.isArray(obj.content) &&
      typeof obj.stampName === "string"
    ) {
      return {
        shouldSave: obj.shouldSave,
        content: obj.content as string[][],
        stampName: obj.stampName,
        matchedEntryId:
          typeof obj.matchedEntryId === "string" ? obj.matchedEntryId : null,
      };
    }
    throw new PromptComplianceError(
      "テキストに含まれるJSONの型が正しくありません",
    );
  }

  const textStr = text as string;
  if (!textStr || textStr.trim() === "") {
    throw new PromptComplianceError("テキストが空です");
  }

  // テキストからJSONを抽出（エスケープされたJSON文字列の可能性がある）
  let jsonString: string = textStr;

  // まず、エスケープされたJSON文字列をデコード
  try {
    // エスケープされたJSON文字列の場合、JSON.parseでデコードできる
    const decoded = JSON.parse(jsonString);
    if (typeof decoded === "string") {
      jsonString = decoded;
    }
  } catch {
    // エスケープされていない場合はそのまま使用
  }

  // コードブロック（```json ... ```）を除去
  const cleanedText = jsonString
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  // JSONオブジェクトを抽出
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new PromptComplianceError("テキストにJSONが見つかりません");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new PromptComplianceError("テキストをJSONにパースできませんでした");
  }

  // 必要なフィールドが存在するかチェック
  if (
    typeof parsed.shouldSave === "boolean" &&
    Array.isArray(parsed.content) &&
    typeof parsed.stampName === "string"
  ) {
    return {
      shouldSave: parsed.shouldSave,
      content: parsed.content,
      stampName: parsed.stampName,
      matchedEntryId:
        typeof parsed.matchedEntryId === "string"
          ? parsed.matchedEntryId
          : null,
    };
  } else {
    throw new PromptComplianceError(
      "テキストに含まれるJSONの型が正しくありません",
    );
  }
};
