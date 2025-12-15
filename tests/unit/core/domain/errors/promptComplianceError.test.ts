import { PromptComplianceError } from "@core/domain/errors/promptComplianceError";

describe("PromptComplianceError", () => {
  describe("エラーの作成", () => {
    it("エラーメッセージを指定して作成できること", () => {
      const error = new PromptComplianceError("テストエラー");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PromptComplianceError);
      expect(error.message).toBe("テストエラー");
      expect(error.name).toBe("PromptComplianceError");
    });

    it("エラーメッセージが空文字列でも作成できること", () => {
      const error = new PromptComplianceError("");

      expect(error.message).toBe("");
      expect(error.name).toBe("PromptComplianceError");
    });

    it("エラーメッセージが長文でも作成できること", () => {
      const longMessage = "a".repeat(1000);
      const error = new PromptComplianceError(longMessage);

      expect(error.message).toBe(longMessage);
    });
  });

  describe("エラーの型チェック", () => {
    it("Error型として扱えること", () => {
      const error = new PromptComplianceError("テスト");

      expect(error instanceof Error).toBe(true);
    });

    it("PromptComplianceError型として扱えること", () => {
      const error = new PromptComplianceError("テスト");

      expect(error instanceof PromptComplianceError).toBe(true);
    });
  });

  describe("エラーのスロー", () => {
    it("エラーをスローできること", () => {
      expect(() => {
        throw new PromptComplianceError("テストエラー");
      }).toThrow(PromptComplianceError);

      expect(() => {
        throw new PromptComplianceError("テストエラー");
      }).toThrow("テストエラー");
    });
  });
});
