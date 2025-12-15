import { GoogleDocsDocumentPayload } from "sample-mcp-kit/dist/src/platforms/google/domain/repositories/googleRepositoryPayload";

/**
 * GoogleDocsDocumentPayloadからテキストを抽出する
 * tabs > body.content の優先順で取得し、paragraph/tableの内容を連結して返す
 */
export const extractTextFromDocument = (
  doc: GoogleDocsDocumentPayload,
): string => {
  const parts: string[] = [];

  // tabsがある場合はtabsから取得
  if (doc.tabs && doc.tabs.length > 0) {
    for (const tab of doc.tabs) {
      const content = tab.documentTab?.body?.content;
      if (content) {
        parts.push(extractTextFromTabContent(content));
      }
    }
  }

  // body.contentから取得（tabsがない場合のフォールバック）
  if (parts.length === 0 && doc.body?.content) {
    parts.push(extractTextFromBodyContent(doc.body.content));
  }

  return parts.join("\n");
};

type TabContent = NonNullable<
  NonNullable<
    NonNullable<GoogleDocsDocumentPayload["tabs"]>[number]["documentTab"]
  >["body"]
>["content"];

const extractTextFromTabContent = (content: TabContent): string => {
  if (!content) return "";
  const parts: string[] = [];

  for (const element of content) {
    if (element.paragraph?.elements) {
      for (const el of element.paragraph.elements) {
        if (el.textRun?.content) {
          parts.push(el.textRun.content);
        }
      }
    }
    if (element.table?.tableRows) {
      for (const row of element.table.tableRows) {
        if (row.tableCells) {
          const cellTexts: string[] = [];
          for (const cell of row.tableCells) {
            if (cell.content) {
              for (const cellContent of cell.content) {
                if (cellContent.paragraph?.elements) {
                  for (const el of cellContent.paragraph.elements) {
                    if (el.textRun?.content) {
                      cellTexts.push(el.textRun.content.trim());
                    }
                  }
                }
              }
            }
          }
          parts.push(cellTexts.join("\t"));
        }
      }
    }
  }

  return parts.join("");
};

const extractTextFromBodyContent = (
  content: GoogleDocsDocumentPayload["body"]["content"],
): string => {
  const parts: string[] = [];

  for (const element of content) {
    if (element.paragraph?.elements) {
      for (const el of element.paragraph.elements) {
        if (el.textRun?.content) {
          parts.push(el.textRun.content);
        }
      }
    }
    if (element.table?.rows) {
      for (const row of element.table.rows) {
        const cellTexts: string[] = [];
        for (const cell of row.cells) {
          for (const cellContent of cell.content) {
            if (cellContent.paragraph?.elements) {
              for (const el of cellContent.paragraph.elements) {
                if (el.textRun?.content) {
                  cellTexts.push(el.textRun.content.trim());
                }
              }
            }
          }
        }
        parts.push(cellTexts.join("\t"));
      }
    }
  }

  return parts.join("");
};
