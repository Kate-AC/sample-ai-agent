import {
  makeClaudeToolUseResultLimiter,
  sampleEvenly,
  sampleWithFirst,
  sampleWithFirst10,
  sampleWithFirst30,
  sampleWithFirst50,
} from "@core/application/services/claude/claudeToolUseResultLimiter";

describe("makeClaudeToolUseResultLimiter", () => {
  describe("limit", () => {
    it("faq_searchの結果を制限できること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = {
        matches: Array.from({ length: 200 }, (_, i) => ({
          text: `text${i}`,
          context: `context${i}`,
          position: i,
        })),
      };

      const limited = limiter.limit("faq_search", result);

      expect(limited.matches).toHaveLength(100);
      expect(limited.total).toBe(200);
      expect(limited.matches[0]).toEqual({
        text: "text0",
        context: "context0",
        position: 0,
      });
    });

    it("growi_searchPagesの結果を制限できること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = {
        data: Array.from({ length: 100 }, (_, i) => ({
          data: {
            _id: `id${i}`,
            path: `path${i}`,
            snippet: `snippet${i}`,
          },
          meta: { score: i },
        })),
      };

      const limited = limiter.limit("growi_searchPages", result);

      expect(limited.data).toHaveLength(30);
      expect(limited.data[0].data._id).toBe("id0");
    });

    it("redmine_getIssuesの結果を制限できること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = {
        issues: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          subject: `subject${i}`,
          status: "open",
          description: `description${i}`,
        })),
      };

      const limited = limiter.limit("redmine_getIssues", result);

      expect(limited.issues).toHaveLength(30);
      expect(limited.issues[0].id).toBe(0);
    });

    it("google_searchDriveFilesの結果を制限できること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = {
        files: Array.from({ length: 200 }, (_, i) => ({
          id: `file${i}`,
          name: `name${i}`,
        })),
      };

      const limited = limiter.limit("google_searchDriveFiles", result);

      expect(limited.files).toHaveLength(100);
    });

    it("slack_searchMessagesの結果を制限できること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = {
        ok: true,
        query: "test",
        messages: {
          total: 100,
          matches: Array.from({ length: 100 }, (_, i) => ({
            user: `user${i}`,
            text: `text${i}`,
            ts: `ts${i}`,
            channel: `channel${i}`,
          })),
        },
      };

      const limited = limiter.limit("slack_searchMessages", result);

      expect(limited.messages.matches).toHaveLength(50);
      expect(limited.messages.total).toBe(100);
    });

    it("slack_getConversationHistoryの結果を制限できること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = {
        ok: true,
        messages: Array.from({ length: 50 }, (_, i) => ({
          text: "a".repeat(10000),
          ts: `ts${i}`,
          user: `user${i}`,
          channel: `channel${i}`,
        })),
      };

      const limited = limiter.limit("slack_getConversationHistory", result);

      expect(limited.messages).toHaveLength(10);
      expect(limited.total).toBe(50);
      // テキストが5000文字に切り詰められていること
      expect(limited.messages[0].text.length).toBeLessThanOrEqual(5003); // 5000 + "..."
      // 不要なフィールドが除外されていること
      expect(limited.messages[0].channel).toBeUndefined();
    });

    it("local_searchCodeの結果をサンプリングできること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = {
        pattern: "somePattern",
        results: Array.from({ length: 200 }, (_, i) => ({
          file: `file${i}.ts`,
          line: `line content ${i}`,
          lineNumber: i + 1,
        })),
      };

      const limited = limiter.limit("local_searchCode", result);

      expect(limited.results).toHaveLength(100);
      expect(limited.pattern).toBe("somePattern");
      expect(limited.results[0].file).toBe("file0.ts");
    });

    it("local_searchCodeのline文字列を300文字に切り詰めること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const longLine = "a".repeat(500);
      const result = {
        pattern: "test",
        results: [
          {
            file: "test.ts",
            line: longLine,
            lineNumber: 1,
          },
        ],
      };

      const limited = limiter.limit("local_searchCode", result);

      expect(limited.results[0].line).toHaveLength(303); // 300 + "..."
      expect(limited.results[0].line).toMatch(/\.\.\.$/);
    });

    it("local_searchCodeのcontext.before行を300文字に切り詰めること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const longContextLine = "b".repeat(500);
      const result = {
        pattern: "test",
        results: [
          {
            file: "test.ts",
            line: "short line",
            lineNumber: 10,
            context: {
              before: [longContextLine, "short context"],
            },
          },
        ],
      };

      const limited = limiter.limit("local_searchCode", result);

      expect(limited.results[0].context.before[0]).toHaveLength(303);
      expect(limited.results[0].context.before[0]).toMatch(/\.\.\.$/);
      expect(limited.results[0].context.before[1]).toBe("short context");
    });

    it("local_searchCodeでcontextがない場合はundefinedのままであること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = {
        pattern: "test",
        results: [
          {
            file: "test.ts",
            line: "some line",
            lineNumber: 1,
          },
        ],
      };

      const limited = limiter.limit("local_searchCode", result);

      expect(limited.results[0].context).toBeUndefined();
    });

    it("datadog_searchLogsByCompanyCodeの結果をサンプリング＆トリミングできること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = {
        data: Array.from({ length: 100 }, (_, i) => ({
          id: `log${i}`,
          attributes: {
            timestamp: `2026-03-07T00:00:${i}Z`,
            host: "host1",
            service: "sample-service",
            status: "error",
            message: "Error occurred",
            attributes: {
              context: {
                company_code: "ZH567",
                exception: {
                  class: "RuntimeException",
                  message: "Something failed",
                  file: "/app/src/Service.php",
                  trace: "a".repeat(50000), // 巨大なスタックトレース
                  stack: "b".repeat(50000), // 巨大なスタック
                  previous: {
                    class: "PreviousException",
                    message: "Root cause",
                    trace: "c".repeat(30000),
                    stack: "d".repeat(30000),
                  },
                },
              },
            },
            tags: ["env:live"],
          },
        })),
      };

      const limited = limiter.limit("datadog_searchLogsByCompanyCode", result);

      // 50件にサンプリングされること
      expect(limited.data).toHaveLength(50);

      const firstLog = limited.data[0];
      // 必要なフィールドが保持されること
      expect(firstLog.id).toBe("log0");
      expect(firstLog.attributes.timestamp).toBe("2026-03-07T00:00:0Z");
      expect(firstLog.attributes.service).toBe("sample-service");
      expect(firstLog.attributes.status).toBe("error");
      expect(firstLog.attributes.tags).toEqual(["env:live"]);

      // context内の情報が保持されること
      const ctx = firstLog.attributes.attributes.context;
      expect(ctx.company_code).toBe("ZH567");
      expect(ctx.exception.class).toBe("RuntimeException");
      expect(ctx.exception.message).toBe("Something failed");
      expect(ctx.exception.file).toBe("/app/src/Service.php");

      // trace/stackが除去されていること
      expect(ctx.exception.trace).toBeUndefined();
      expect(ctx.exception.stack).toBeUndefined();

      // previous内のtrace/stackも除去されていること
      expect(ctx.exception.previous.class).toBe("PreviousException");
      expect(ctx.exception.previous.message).toBe("Root cause");
      expect(ctx.exception.previous.trace).toBeUndefined();
      expect(ctx.exception.previous.stack).toBeUndefined();

      // 全体のJSONサイズが大幅に削減されていること
      const originalSize = JSON.stringify(result).length;
      const limitedSize = JSON.stringify(limited).length;
      expect(limitedSize).toBeLessThan(originalSize * 0.01); // 99%以上削減
    });

    it("datadog_searchLogsFromUrlの結果もトリミングされること", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = {
        data: [
          {
            id: "log1",
            attributes: {
              timestamp: "2026-03-07T00:00:00Z",
              service: "sample-service",
              status: "error",
              message: "x".repeat(5000), // 長いメッセージ
              attributes: {
                context: {
                  exception: {
                    class: "Exception",
                    message: "y".repeat(3000), // 長いexceptionメッセージ
                    trace: "z".repeat(100000),
                  },
                },
              },
            },
          },
        ],
      };

      const limited = limiter.limit("datadog_searchLogsFromUrl", result);

      // messageが2000文字+...に切り詰められること
      expect(limited.data[0].attributes.message.length).toBeLessThanOrEqual(
        2003,
      );
      // exception.messageが1000文字+...に切り詰められること
      const exMsg =
        limited.data[0].attributes.attributes.context.exception.message;
      expect(exMsg.length).toBeLessThanOrEqual(1003);
      // traceが除去されていること
      expect(
        limited.data[0].attributes.attributes.context.exception.trace,
      ).toBeUndefined();
    });

    it("未知のツール名の場合はそのまま返すこと", () => {
      const limiter = makeClaudeToolUseResultLimiter();
      const result = { data: "test" };

      const limited = limiter.limit("unknown_tool", result);

      expect(limited).toEqual(result);
    });
  });
});

describe("sampleEvenly", () => {
  it("配列全体から均等にサンプリングできること", () => {
    const array = Array.from({ length: 200 }, (_, i) => i);
    const sampled = sampleEvenly(array, 100);

    expect(sampled).toHaveLength(100);
    expect(sampled[0]).toBe(0);
    expect(sampled[99]).toBeGreaterThan(0);
  });

  it("配列の長さがmaxTotalItems以下の場合はそのまま返すこと", () => {
    const array = [1, 2, 3, 4, 5];
    const sampled = sampleEvenly(array, 10);

    expect(sampled).toEqual(array);
  });
});

describe("sampleWithFirst", () => {
  it("先頭から指定数取得 + 残りからサンプリングできること", () => {
    const array = Array.from({ length: 100 }, (_, i) => i);
    const sampled = sampleWithFirst(array, 10, 30);

    expect(sampled).toHaveLength(30);
    expect(sampled[0]).toBe(0);
    expect(sampled[9]).toBe(9);
  });

  it("配列の長さがmaxTotalItems以下の場合はそのまま返すこと", () => {
    const array = [1, 2, 3, 4, 5];
    const sampled = sampleWithFirst(array, 10, 30);

    expect(sampled).toEqual(array);
  });
});

describe("sampleWithFirst10", () => {
  it("先頭10件 + 残りからサンプリングできること", () => {
    const array = Array.from({ length: 100 }, (_, i) => i);
    const sampled = sampleWithFirst10(array, 30);

    expect(sampled).toHaveLength(30);
    expect(sampled[0]).toBe(0);
    expect(sampled[9]).toBe(9);
  });
});

describe("sampleWithFirst30", () => {
  it("先頭30件 + 残りからサンプリングできること", () => {
    const array = Array.from({ length: 100 }, (_, i) => i);
    const sampled = sampleWithFirst30(array, 50);

    expect(sampled).toHaveLength(50);
    expect(sampled[0]).toBe(0);
    expect(sampled[29]).toBe(29);
  });
});

describe("sampleWithFirst50", () => {
  it("先頭50件 + 残りからサンプリングできること", () => {
    const array = Array.from({ length: 200 }, (_, i) => i);
    const sampled = sampleWithFirst50(array, 100);

    expect(sampled).toHaveLength(100);
    expect(sampled[0]).toBe(0);
    expect(sampled[49]).toBe(49);
  });
});
