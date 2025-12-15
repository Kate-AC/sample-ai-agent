import { Result, LocalReadPayload } from "sample-mcp-kit";

export interface LocalRepository {
  /**
   * 指定されたディレクトリ名に一致するディレクトリを検索し、パスの配列を返す
   *
   * @param names 検索するディレクトリ名の配列（例: ["sample-service", "sample-api"]）
   * @param rootPath 検索開始ディレクトリ（未指定の場合は環境変数から取得）
   * @returns 見つかったディレクトリのパスの配列
   */
  findDirsByName: (names: string[], rootPath?: string) => Promise<string[]>;

  /**
   * 環境変数からソースベースパスを取得する
   *
   * @returns ソースベースパス
   */
  getSourceBasePath: () => Promise<string>;

  /**
   * 指定されたパスのファイル内容を読み込む
   *
   * @param filePath 読み込むファイルのパス（絶対パスまたは相対パス）
   * @returns ファイル内容
   */
  readFile: (filePath: string) => Promise<Result<LocalReadPayload>>;
}
