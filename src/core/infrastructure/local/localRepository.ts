import { LocalMcp } from "sample-mcp-kit";
import { LocalRepository } from "@core/domain/repositories/local/localRepository";

/**
 * sample-mcp-kitのローカル操作機能をラップするリポジトリ
 */
export const makeLocalRepository = (deps: {
  localMcp: LocalMcp;
}): LocalRepository => {
  const { localMcp } = deps;

  const getSourceBasePath = async (): Promise<string> => {
    const localEnv = await localMcp.mcpSetting.getEnv();
    return String(localEnv.sourceBasePath);
  };

  const findDirsByName = async (
    names: string[],
    rootPath?: string,
  ): Promise<string[]> => {
    // rootPathが未指定の場合は環境変数から取得
    const actualRootPath = rootPath ?? (await getSourceBasePath());

    console.log(
      `[LocalRepository] findDirsByName called with names: ${names} and rootPath: ${actualRootPath}`,
    );
    const result = await localMcp.mcpFunctions.findDirsByName(
      names,
      actualRootPath,
    );
    console.log(
      `[LocalRepository] findDirsByName success: ${result.isSuccess}`,
    );

    if (!result.isSuccess || !result.payload) {
      return [];
    }

    return result.payload.directories.map((dir) => dir.path);
  };

  const readFile = async (filePath: string) => {
    return await localMcp.mcpFunctions.readFile(filePath);
  };

  return {
    findDirsByName,
    getSourceBasePath,
    readFile,
  };
};
