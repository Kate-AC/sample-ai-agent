import { makeScheduleYamlGetter } from "@projects/shared/application/services/scheduleYamlGetter";
import { LocalRepository } from "@core/domain/repositories/local/localRepository";
import { Result, LocalReadPayload } from "sample-mcp-kit";

describe("makeScheduleYamlGetter", () => {
  const createMockLocalRepository = (): LocalRepository => {
    return {
      findDirsByName: jest.fn(),
      getSourceBasePath: jest.fn(),
      readFile: jest.fn(),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("invoke", () => {
    it("schedule.yamlの内容を取得できること", async () => {
      const mockLocalRepository = createMockLocalRepository();
      const mockYamlContent =
        "schedule:\n  - name: test\n    cron: '0 0 * * *'";

      const mockFileResult: Result<LocalReadPayload> = {
        isSuccess: true,
        status: 200,
        payload: {
          content: mockYamlContent,
          path: "/workspace/sample-api/config/schedule.yaml",
          size: mockYamlContent.length,
          modifiedAt: new Date().toISOString(),
        },
      };

      (mockLocalRepository.getSourceBasePath as jest.Mock).mockResolvedValue(
        "/workspace",
      );
      (mockLocalRepository.readFile as jest.Mock).mockResolvedValue(
        mockFileResult,
      );

      const getter = makeScheduleYamlGetter({
        localRepository: mockLocalRepository,
      });

      const result = await getter.invoke();

      expect(result).toBe(mockYamlContent);
      expect(mockLocalRepository.getSourceBasePath).toHaveBeenCalled();
      expect(mockLocalRepository.readFile).toHaveBeenCalledWith(
        "/workspace/sample-api/config/schedule.yaml",
      );
    });

    it("ファイル読み込みが失敗した場合はエラーをスローすること", async () => {
      const mockLocalRepository = createMockLocalRepository();
      const mockErrorResult: Result<LocalReadPayload> = {
        isSuccess: false,
        status: 404,
        message: "ファイルが見つかりません",
        payload: null as any,
      };

      (mockLocalRepository.getSourceBasePath as jest.Mock).mockResolvedValue(
        "/workspace",
      );
      (mockLocalRepository.readFile as jest.Mock).mockResolvedValue(
        mockErrorResult,
      );

      const getter = makeScheduleYamlGetter({
        localRepository: mockLocalRepository,
      });

      await expect(getter.invoke()).rejects.toThrow(
        "Failed to read schedule.yaml",
      );
    });

    it("payloadがnullの場合はエラーをスローすること", async () => {
      const mockLocalRepository = createMockLocalRepository();
      const mockErrorResult: Result<LocalReadPayload> = {
        isSuccess: true,
        status: 200,
        payload: null as any,
      };

      (mockLocalRepository.getSourceBasePath as jest.Mock).mockResolvedValue(
        "/workspace",
      );
      (mockLocalRepository.readFile as jest.Mock).mockResolvedValue(
        mockErrorResult,
      );

      const getter = makeScheduleYamlGetter({
        localRepository: mockLocalRepository,
      });

      await expect(getter.invoke()).rejects.toThrow(
        "Failed to read schedule.yaml",
      );
    });

    it("異なるベースパスでも正しく動作すること", async () => {
      const mockLocalRepository = createMockLocalRepository();
      const mockYamlContent = "schedule:\n  - name: test";

      const mockFileResult: Result<LocalReadPayload> = {
        isSuccess: true,
        status: 200,
        payload: {
          content: mockYamlContent,
          path: "/custom/path/sample-api/config/schedule.yaml",
          size: mockYamlContent.length,
          modifiedAt: new Date().toISOString(),
        },
      };

      (mockLocalRepository.getSourceBasePath as jest.Mock).mockResolvedValue(
        "/custom/path",
      );
      (mockLocalRepository.readFile as jest.Mock).mockResolvedValue(
        mockFileResult,
      );

      const getter = makeScheduleYamlGetter({
        localRepository: mockLocalRepository,
      });

      const result = await getter.invoke();

      expect(result).toBe(mockYamlContent);
      expect(mockLocalRepository.readFile).toHaveBeenCalledWith(
        "/custom/path/sample-api/config/schedule.yaml",
      );
    });
  });
});
