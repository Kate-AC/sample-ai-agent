import { GoogleMcp } from "sample-mcp-kit";

export interface GoogleDocsTabWriter {
  addTab: (documentId: string, tabName: string) => Promise<string>;
  writeToTab: (
    documentId: string,
    tabId: string,
    text: string,
  ) => Promise<void>;
}

export const makeGoogleDocsTabWriter = (deps: {
  googleMcp: GoogleMcp;
}): GoogleDocsTabWriter => {
  return {
    addTab: async (documentId: string, tabName: string): Promise<string> => {
      const result = await deps.googleMcp.mcpFunctions.batchUpdateDocument(
        documentId,
        JSON.stringify([
          {
            addDocumentTab: {
              tabProperties: {
                title: tabName,
              },
            },
          },
        ]),
      );

      if (!result.isSuccess || !result.payload) {
        throw new Error(
          `Failed to create tab "${tabName}": ${result.message || "Unknown error"}`,
        );
      }

      const addTabReply = result.payload.replies?.find(
        (r: Record<string, any>) => r.addDocumentTab,
      );
      const tabId = addTabReply?.addDocumentTab?.tabProperties?.tabId;

      if (!tabId) {
        throw new Error(
          `Failed to get new tab ID from response for tab "${tabName}"`,
        );
      }

      return tabId;
    },

    writeToTab: async (
      documentId: string,
      tabId: string,
      text: string,
    ): Promise<void> => {
      const result = await deps.googleMcp.mcpFunctions.batchUpdateDocument(
        documentId,
        JSON.stringify([
          {
            insertText: {
              location: {
                index: 1,
                tabId,
              },
              text,
            },
          },
        ]),
      );

      if (!result.isSuccess) {
        throw new Error(
          `Failed to insert text to tab "${tabId}": ${result.message || "Unknown error"}`,
        );
      }
    },
  };
};
