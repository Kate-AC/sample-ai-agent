export const buildDuplicateCheckPrompt = (
  datadogLogs: string,
  sheetContents: string,
): string => {
  return `
### 指令:
あなたはDatadogログの内容と2次オペ対応シートの既存エントリを比較し、以下の2つを判定するアシスタントです。
1. 同一のエラーが既に記録されているか（重複チェック）
2. 重複ありの場合、このエラーに対する適切なスタンプ分類（seikan/retry/youkakunin）

### Datadogログ:
${datadogLogs}

### 現在のシート内容:
各行の形式: ID, 日時, エラー内容, 原因・対応, SQL, SlackURL
※ エラー内容列の構成:
  - 前半: 要約テキスト（人間が書いた簡潔な説明）
  - 「---」区切りの後: 「【元のDatadogログ】」として元のエラーメッセージ（Log Explorerの表示メッセージ）が記載されている場合があります
  - **比較時は要約だけでなく、元のエラーメッセージも必ず参照してください。** 元のメッセージの方がより正確な情報を含んでいます。
${sheetContents}

### 重複判定ルール:

**基本方針: 同じ種類のエラーパターンかどうかを判定する。細かい差異にこだわらず、大まかに同じ問題であれば一致とする。**

比較する2つの軸:
1. **エラー種別**: エラーの大分類（認証エラー/タイムアウト/サーバーエラー/データ不整合等）
2. **影響処理**: 影響を受けている処理の大分類（在庫同期/注文取得/出荷実績連携等）

**以下の違いは無視してください:**
- 荷主コード（OL001, XZ730等）の違い → 同じエラーパターン
- 企業名・ショップ名の違い → 同じエラーパターン
- ECプラットフォームの違い（Rakuten vs TikTok等）でも、エラー種別と影響処理が同じなら → 同じエラーパターン
  例: 「Rakutenの在庫同期で認証エラー」と「TikTokの在庫同期でステータスエラー」→ どちらも在庫同期の失敗なので同じ
- タイムスタンプや具体的なID値の違い → 同じエラーパターン
- 件数の違い（1件 vs 9件） → 同じエラーパターン

**不一致とするのは以下の場合:**
- エラーの大分類が明確に異なる場合（例: 認証エラー vs タイムアウト vs 型エラー vs 500サーバーエラー）
- 影響処理が根本的に異なる場合（例: 在庫同期 vs 出荷実績連携 vs 注文取得）
- エラーメッセージの具体的な内容が異なる場合（例: 「foreach不正な型」vs「Undefined array key」は別のバグ）

**重要: 元のエラーメッセージ（【元のDatadogログ】）が存在する場合、エラーメッセージ同士を直接比較してください。**
同じ処理（在庫同期等）でも、エラーメッセージが具体的に異なれば別のエラーです。
逆に、荷主コードや件数が違うだけでメッセージのパターンが同じなら一致です。

### 判定手順（必ずこの順番で思考すること）:

**Step 1: Datadogログから以下を特定する**
- エラー種別: (例: 認証エラー, タイムアウト, サーバーエラー, データ不整合)
- 影響処理: (例: 在庫同期, 注文取得, 出荷実績連携)

**Step 2: シートの各エントリと比較する**
- 各エントリの要約テキストと元のエラーメッセージの両方を読む
- 元のエラーメッセージがある場合、ログのメッセージと直接比較する
- エラー種別と影響処理が同じ、かつエラーメッセージのパターンも同じなら一致

**Step 3: 判定結果を出力する**

### スタンプ分類ルール（一致ありの場合のみ判定すること、優先度順）:
Datadogログの内容とシートの既存エントリの情報から、以下のルールでスタンプを判定してください。

**1. "seikan"（静観）** — エラーが発生しているが、オペレーション側では対応不要と判断できる場合
   以下のいずれかに該当する場合に選択する:
   - DuplicateEntry等、データ自体は正常に保存されているがタイミングの問題でエラーが発生している場合
   - 一時的なアクセスエラーであり、次回のアクセスでは正常に処理される可能性が高い場合
   - 認証トークンの期限切れ等、こちら側では対処できない外部要因の場合（在庫同期や出荷実績連携の失敗を伴っていても、トークンが復旧しない限りリトライしても無意味なため静観とする）
   - 対象の商品や注文がすでに削除されており、API経由でアクセスできない場合
   - 広い意味で荷主側やEC事業者側の問題であり、オペレーション側からは何も対応できない場合
   - Shopify bulk operation関連のエラー（"A bulk query operation already in progress"、ModelNotFoundException等）はタイミングの問題であり次回リコンサイルで自動復旧する
   **注意**: 認証エラー（401 Unauthorized等）が原因の場合は必ず"seikan"とする。リトライしてもトークンが無効なままでは復旧しない。

**2. "retry"（リトライ）** — データの整合性に問題があるが、定期実行やリコンサイルにより自動復旧が見込まれる場合
   - データ不整合が存在するが、次回の定期実行（リコンサイル、バッチ処理等）で自動的に修正される見込みがある場合

**3. "youkakunin"（要確認）** — データの整合性に問題があり、自動復旧の見込みがない場合。または、判断がつかない場合
   - データ不整合があり、定期実行やリトライでは解決できない場合
   - 手動でのリカバリ操作が必要な場合
   - 上記の「seikan」「retry」のどちらにも該当しないと判断した場合
   - 情報が不足しており、正確な判断ができない場合

**補足**: 重複ありの場合、シートの既存エントリの「原因・対応」列の内容も参考にしてスタンプを判定してください。

### 出力フォーマット（厳守）:
以下の形式で出力してください。

まず比較分析を記述し、最後にJSON結果を出力してください:

[比較分析]
- ログのエラー種別: (特定したエラー種別)
- ログの影響処理: (特定した影響処理)
- 最も近いシートエントリ: (IDまたは「該当なし」)
- エラー種別の比較: (同じ/異なる/不明)
- 影響処理の比較: (同じ/異なる/不明)
- 総合判定: (両方とも明確に異なる場合のみ不一致、それ以外は一致)

[結果]
一致あり: {"matched": true, "entryId": "シートのID", "stampName": "seikan"}
一致なし: {"matched": false, "entryId": null}
`.trim();
};

export type StampName = "seikan" | "retry" | "youkakunin";

export type DuplicateCheckResult = {
  matched: boolean;
  entryId: string | null;
  stampName: StampName;
};

const VALID_STAMP_NAMES: StampName[] = ["seikan", "retry", "youkakunin"];

export const parseDuplicateCheckResult = (
  text: string,
): DuplicateCheckResult => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch)
    return { matched: false, entryId: null, stampName: "youkakunin" };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.matched === "boolean") {
      const stampName: StampName = VALID_STAMP_NAMES.includes(parsed.stampName)
        ? parsed.stampName
        : "youkakunin";
      return {
        matched: parsed.matched,
        entryId: typeof parsed.entryId === "string" ? parsed.entryId : null,
        stampName,
      };
    }
  } catch {
    // パース失敗時は安全側に倒す
  }
  return { matched: false, entryId: null, stampName: "youkakunin" };
};
