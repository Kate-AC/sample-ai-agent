import { makeLocalRepository } from "@core/infrastructure/local/localRepository";
import { LocalMcp, Result, LocalReadPayload } from "sample-mcp-kit";

describe("makeLocalRepository", () => {
  const createMockLocalMcp = (): LocalMcp => {
    return {
      mcpFunctions: {
        findDirsByName: jest.fn(),
        readFile: jest.fn(),
      },
      mcpMetadata: {} as any,
      mcpSetting: {
        getEnv: jest.fn(),
      },
    } as unknown as LocalMcp;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findDirsByName", () => {
    it("ディレクトリ名で検索できること", async () => {
      const mockLocalMcp = createMockLocalMcp();
      const mockResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {
          directories: [
            { path: "/path/to/sample-service" },
            { path: "/path/to/sample-api" },
          ],
        },
      };

      (mockLocalMcp.mcpSetting.getEnv as jest.Mock).mockResolvedValue({
        sourceBasePath: "/workspace",
      });
      (mockLocalMcp.mcpFunctions.findDirsByName as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeLocalRepository({ localMcp: mockLocalMcp });

      const result = await repository.findDirsByName([
        "sample-service",
        "sample-api",
      ]);

      expect(result).toEqual([
        "/path/to/sample-service",
        "/path/to/sample-api",
      ]);
      expect(mockLocalMcp.mcpFunctions.findDirsByName).toHaveBeenCalledWith(
        ["sample-service", "sample-api"],
        "/workspace",
      );
    });

    it("rootPathを指定できること", async () => {
      const mockLocalMcp = createMockLocalMcp();
      const mockResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {
          directories: [{ path: "/custom/path/to/dir" }],
        },
      };

      (mockLocalMcp.mcpFunctions.findDirsByName as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeLocalRepository({ localMcp: mockLocalMcp });

      const result = await repository.findDirsByName(
        ["test-dir"],
        "/custom/root",
      );

      expect(result).toEqual(["/custom/path/to/dir"]);
      expect(mockLocalMcp.mcpFunctions.findDirsByName).toHaveBeenCalledWith(
        ["test-dir"],
        "/custom/root",
      );
    });

    it("エラーが発生した場合は空配列を返すこと", async () => {
      const mockLocalMcp = createMockLocalMcp();
      const mockErrorResult: Result<any> = {
        isSuccess: false,
        status: 500,
        message: "エラー",
        payload: null,
      };

      (mockLocalMcp.mcpSetting.getEnv as jest.Mock).mockResolvedValue({
        sourceBasePath: "/workspace",
      });
      (mockLocalMcp.mcpFunctions.findDirsByName as jest.Mock).mockResolvedValue(
        mockErrorResult,
      );

      const repository = makeLocalRepository({ localMcp: mockLocalMcp });

      const result = await repository.findDirsByName(["test-dir"]);

      expect(result).toEqual([]);
    });

    it("payloadがnullの場合は空配列を返すこと", async () => {
      const mockLocalMcp = createMockLocalMcp();
      const mockResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: null,
      };

      (mockLocalMcp.mcpSetting.getEnv as jest.Mock).mockResolvedValue({
        sourceBasePath: "/workspace",
      });
      (mockLocalMcp.mcpFunctions.findDirsByName as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeLocalRepository({ localMcp: mockLocalMcp });

      const result = await repository.findDirsByName(["test-dir"]);

      expect(result).toEqual([]);
    });

    it("ログを出力すること", async () => {
      const mockLocalMcp = createMockLocalMcp();
      const mockResult: Result<any> = {
        isSuccess: true,
        status: 200,
        payload: {
          directories: [],
        },
      };

      (mockLocalMcp.mcpSetting.getEnv as jest.Mock).mockResolvedValue({
        sourceBasePath: "/workspace",
      });
      (mockLocalMcp.mcpFunctions.findDirsByName as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeLocalRepository({ localMcp: mockLocalMcp });

      await repository.findDirsByName(["test-dir"]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[LocalRepository] findDirsByName called"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[LocalRepository] findDirsByName success"),
      );
    });
  });

  describe("getSourceBasePath", () => {
    it("環境変数からソースベースパスを取得できること", async () => {
      const mockLocalMcp = createMockLocalMcp();
      const mockEnv = {
        sourceBasePath: "/workspace",
      };

      (mockLocalMcp.mcpSetting.getEnv as jest.Mock).mockResolvedValue(mockEnv);

      const repository = makeLocalRepository({ localMcp: mockLocalMcp });

      const result = await repository.getSourceBasePath();

      expect(result).toBe("/workspace");
      expect(mockLocalMcp.mcpSetting.getEnv).toHaveBeenCalled();
    });

    it("数値のsourceBasePathを文字列に変換できること", async () => {
      const mockLocalMcp = createMockLocalMcp();
      const mockEnv = {
        sourceBasePath: 12345,
      };

      (mockLocalMcp.mcpSetting.getEnv as jest.Mock).mockResolvedValue(mockEnv);

      const repository = makeLocalRepository({ localMcp: mockLocalMcp });

      const result = await repository.getSourceBasePath();

      expect(result).toBe("12345");
    });
  });

  describe("readFile", () => {
    it("ファイルを読み込めること", async () => {
      const mockLocalMcp = createMockLocalMcp();
      const mockPayload: LocalReadPayload = {
        content: "ファイル内容",
        path: "/path/to/file.txt",
        size: 100,
        modifiedAt: new Date().toISOString(),
      };
      const mockResult: Result<LocalReadPayload> = {
        isSuccess: true,
        status: 200,
        payload: mockPayload,
      };

      (mockLocalMcp.mcpFunctions.readFile as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const repository = makeLocalRepository({ localMcp: mockLocalMcp });

      const result = await repository.readFile("/path/to/file.txt");

      expect(result).toEqual(mockResult);
      expect(mockLocalMcp.mcpFunctions.readFile).toHaveBeenCalledWith(
        "/path/to/file.txt",
      );
    });

    it("エラーが発生した場合はエラー結果を返すこと", async () => {
      const mockLocalMcp = createMockLocalMcp();
      const mockErrorResult: Result<LocalReadPayload> = {
        isSuccess: false,
        status: 404,
        message: "ファイルが見つかりません",
        payload: null as any,
      };

      (mockLocalMcp.mcpFunctions.readFile as jest.Mock).mockResolvedValue(
        mockErrorResult,
      );

      const repository = makeLocalRepository({ localMcp: mockLocalMcp });

      const result = await repository.readFile("/path/to/nonexistent.txt");

      expect(result).toEqual(mockErrorResult);
      expect(result.isSuccess).toBe(false);
    });
  });
});
