/**
 * プロンプトの指示通りになっていないレスポンスが返ってきた場合のエラー
 * 例: JSONを返すように指示したのに、空のテキストや不正な形式が返ってきた場合
 */
export class PromptComplianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptComplianceError";
    Object.setPrototypeOf(this, PromptComplianceError.prototype);
  }
}
