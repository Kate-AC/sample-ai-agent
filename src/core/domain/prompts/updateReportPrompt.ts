import { Report } from "@core/domain/entities/report";

/**
 * 前回の報告書と新しいログを統合し、最新の報告書へ更新するためのプロンプト
 */
export const updateReportPrompt = (
  previousReport: Report,
  additionalText: string = "",
): string => {
  return `
### 重要指令：
あなたは「調査状況の更新」を最優先任務とする分析官です。
**いかなる場合も、回答の冒頭で**最新の状況を反映したJSON報告書を出力してください。
**空の返答は絶対に禁止です。**回答が存在しない場合は前回のJSON報告書をそのまま返してください。

### 出力フォーマット（厳守）:
**回答の冒頭に、必ず以下のJSONスキーマを出力してください。JSON以外のテキスト（説明、マークダウン、コードブロック、解説、挨拶など）をJSONの後に追加することは厳禁です。**

{
  "status": "processing" | "completed",
  "confirmedFacts": "前回の報告書に最新ログの事実を統合したリスト（string[]）",
  "sourceUrls": "実行ログから得られた情報源のURLリスト（string[]）",
  "toolExecutionSummary": "実行済みツールの履歴と成果（string[]）",
  "missingInformation": "未だ解決していない事項、または新たに発生した調査課題（string[]）",
  "logicSummary": "最新のログを踏まえた現在の推論の要約",
  "overwritableInfo": "別のプロンプトからの指示で上書き可能な項目。未指定の場合はnull（unknown | null）"
}

**重要**:
- ツール（Tool Use）を呼び出す場合でも、**必ずその前に**上記のJSONを出力してください。
- JSONの後に説明やマークダウンを追加することは厳禁です。
- 回答が空になることは絶対に避けてください。最低限、上記のJSONは必ず出力してください。

### 更新の鉄則:
1. **マージの徹底**: 前回の報告書の内容を維持しつつ、最新ログから得られた「新しい事実」を確実に追加せよ。
2. **矛盾の解消**: 前回の内容と最新ログに矛盾がある場合、最新のエビデンスを優先して書き換えよ。
3. **情報源の参照**: 実行ログから得られた情報源のURLを "sourceUrls" に追加せよ。
4. **継続の義務**: 調査が完了していない（statusがprocessing）なら、"missingInformation" に次に行うべきアクションを具体化せよ。
5. **JSONファースト**: ツール（Tool Use）を呼び出す場合でも、必ずその「前」にこのJSONを出力せよ。JSONの後に説明を追加しないこと。
6. **前回報告書の参照**: ツール実行結果が得られない場合や、新しい情報がない場合は、前回の報告書の内容をそのまま維持せよ。前回の報告書を必ず参照し、それを基に更新せよ。
7. **overwritableInfoの優先**: システムプロンプトや追加指示でoverwritableInfoへの出力指示がある場合、その指示に従い積極的にoverwritableInfoへ記載せよ。指示がない場合はnullのままでよい。

${additionalText}

---
### 【前回の調査報告書】:
${JSON.stringify(previousReport)}
`.trim();
};
