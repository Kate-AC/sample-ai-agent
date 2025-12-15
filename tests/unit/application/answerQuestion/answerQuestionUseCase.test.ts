import { makeAnswerQuestionUseCase } from "application/usecases/answerQuestion/answerQuestionUseCase";

describe("makeAnswerQuestionUseCase", () => {
  describe("正常系", () => {
    it("ユースケースオブジェクトを生成できること", () => {
      const useCase = makeAnswerQuestionUseCase();

      expect(useCase).toBeDefined();
      expect(useCase).toHaveProperty("invoke");
      expect(typeof useCase.invoke).toBe("function");
    });

    it("カスタム依存関係を受け取れること", () => {
      const mockMcp = {
        mcpFunctions: {},
        mcpMetadata: {} as any,
        mcpSetting: {} as any,
      };

      const mockMcpRegistry = {
        getMcp: jest.fn().mockReturnValue(mockMcp),
        getAllMcpNames: jest.fn().mockReturnValue(["slack"]),
      };

      const mockAiModelRegistry = {
        useAiModel: jest.fn().mockReturnValue({
          aiModelFunctions: {
            ask: jest.fn(),
          },
          aiModelMetadata: {} as any,
          aiModelSetting: {} as any,
        }),
      };

      const useCase = makeAnswerQuestionUseCase({
        mcpRegistry: mockMcpRegistry as any,
        aiModelRegistry: mockAiModelRegistry as any,
      });

      expect(useCase).toBeDefined();
      expect(useCase).toHaveProperty("invoke");
      expect(typeof useCase.invoke).toBe("function");

      // 依存関係が使用されたことを確認
      expect(mockMcpRegistry.getMcp).toHaveBeenCalled();
      expect(mockAiModelRegistry.useAiModel).toHaveBeenCalledWith("claude");
    });
  });
});
