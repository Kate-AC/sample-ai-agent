import { LocalRepository } from "@core/domain/repositories/local/localRepository";

export interface ScheduleYamlGetter {
  invoke: () => Promise<string>;
}

/**
 * schedule.yamlの内容を取得するサービスクラス
 */
export const makeScheduleYamlGetter = (deps: {
  localRepository: LocalRepository;
}): ScheduleYamlGetter => {
  return {
    invoke: async (): Promise<string> => {
      // 環境変数からベースパスを取得
      const basePath = await deps.localRepository.getSourceBasePath();
      const scheduleYamlPath = basePath + "/sample-api/config/schedule.yaml";
      const fileResult = await deps.localRepository.readFile(scheduleYamlPath);

      if (!fileResult.isSuccess || !fileResult.payload) {
        throw new Error(
          `Failed to read schedule.yaml from ${scheduleYamlPath}: ${fileResult.message || "Unknown error"}`,
        );
      }

      return fileResult.payload.content;
    },
  };
};
