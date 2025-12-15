import { GoogleMcp } from "sample-mcp-kit";

export interface OpsSheetHandler {
  getAllValues: () => Promise<string[][]>;
  appendValues: (
    values: string[][],
  ) => Promise<{ success: boolean; message?: string }>;
  updateRow: (
    rowNumber: number,
    values: string[],
  ) => Promise<{ success: boolean; message?: string }>;
}

/**
 * オペシート操作ハンドラー
 * 指定のスプレッドシート・シートに対する操作を提供
 *
 * @param deps.googleMcp Google MCP クライアント
 * @param deps.spreadsheetId Google SheetsのスプレッドシートID（URLの /d/ と /edit の間の文字列）
 * @param deps.sheetName スプレッドシート内のタブ名（例: "sample-main"）
 */
export const makeOpsSheetHandler = (deps: {
  googleMcp: GoogleMcp;
  spreadsheetId: string;
  sheetName: string;
}) => {
  const { googleMcp, spreadsheetId, sheetName } = deps;

  /**
   * mainタブの内容を全て取得する
   *
   * @returns シートの全データ（2次元配列）
   */
  const getAllValues = async (): Promise<string[][]> => {
    const apiPath = `/spreadsheets/${spreadsheetId}/values/${sheetName}`;
    console.log(
      `[OpsSheetHandler] getAllValues called with apiPath: ${apiPath}`,
    );
    const result = await googleMcp.mcpFunctions.getSheetValues(apiPath);
    console.log(`[OpsSheetHandler] getAllValues success: ${result.isSuccess}`);

    if (!result.isSuccess || !result.payload) {
      return [];
    }

    return result.payload.values || [];
  };

  /**
   * mainタブに値を追記する
   *
   * @param values 追記する値（2次元配列）
   * @returns 更新結果
   */
  const appendValues = async (
    values: string[][],
  ): Promise<{ success: boolean; message?: string }> => {
    const valuesJson = JSON.stringify(values);
    const result = await googleMcp.mcpFunctions.appendSheetValues(
      spreadsheetId,
      sheetName,
      valuesJson,
      "USER_ENTERED",
    );

    if (!result.isSuccess) {
      return {
        success: false,
        message: result.message || "追記に失敗しました",
      };
    }

    return {
      success: true,
    };
  };

  /**
   * mainタブの特定の行を更新する
   *
   * @param rowNumber 更新する行番号（1始まり）
   * @param values 更新する値（1次元配列）
   * @returns 更新結果
   */
  const updateRow = async (
    rowNumber: number,
    values: string[],
  ): Promise<{ success: boolean; message?: string }> => {
    // 行番号から範囲を生成（例: main!A2:Z2）
    const range = `${sheetName}!A${rowNumber}:Z${rowNumber}`;
    const values2D = [values]; // 2次元配列に変換
    const valuesJson = JSON.stringify(values2D);

    const result = await googleMcp.mcpFunctions.updateSheetValues(
      spreadsheetId,
      range,
      valuesJson,
      "USER_ENTERED",
    );

    if (!result.isSuccess) {
      return {
        success: false,
        message: result.message || "更新に失敗しました",
      };
    }

    return {
      success: true,
    };
  };

  return {
    getAllValues,
    appendValues,
    updateRow,
  };
};
