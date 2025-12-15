import { SlackRepository } from "@core/domain/repositories/slack/slackRepository";
import { OpsResolutionWorkflow } from "./opsResolutionWorkflow";
import { QuickDuplicateCheckWorkflow } from "./quickDuplicateCheckWorkflow";

export interface OpsMonitoringWorkflow {
  invoke: (
    channelId: string,
    oldest?: Date,
    latest?: Date,
    isDryRun?: boolean,
  ) => Promise<void>;
}

export const makeOpsMonitoringWorkflow = (deps: {
  slackRepository: SlackRepository;
  opsResolutionWorkflow: OpsResolutionWorkflow;
  quickDuplicateCheckWorkflow: QuickDuplicateCheckWorkflow;
}): OpsMonitoringWorkflow => {
  return {
    invoke: async (
      channelId: string,
      oldest?: Date,
      latest?: Date,
      isDryRun = true,
    ): Promise<void> => {
      // デフォルト値の計算（JSTの現在時刻から30分前）
      const now = new Date();
      const defaultOldest = oldest ?? new Date(now.getTime() - 60 * 60 * 1000); // 60分前
      const defaultLatest = latest ?? now;

      // Unixタイムスタンプに変換
      const oldestTimestamp = Math.floor(defaultOldest.getTime() / 1000);
      const latestTimestamp = Math.floor(defaultLatest.getTime() / 1000);

      // チャンネルの履歴を取得
      const messages = (
        await deps.slackRepository.getChannelHistory(
          channelId,
          oldestTimestamp,
          latestTimestamp,
          100,
        )
      ).filter((message) => {
        const reactions = message.reactions ?? [];
        return !reactions.some((reaction) => reaction.name === "ai-check");
      });

      // 古い投稿から処理するために配列を反転
      messages.reverse();

      if (messages.length === 0) {
        const durationMinutes = Math.floor(
          (latestTimestamp - oldestTimestamp) / 60,
        );
        console.log(
          `[OpsMonitoringWorkflow] No messages found between ${defaultOldest.toISOString()} and ${defaultLatest.toISOString()} (${durationMinutes} minutes)`,
        );
        return;
      }

      const durationMinutes = Math.floor(
        (latestTimestamp - oldestTimestamp) / 60,
      );
      console.log(
        `[OpsMonitoringWorkflow] Found ${messages.length} messages between ${defaultOldest.toISOString()} and ${defaultLatest.toISOString()} (${durationMinutes} minutes)`,
      );

      let processedCount = 0;
      let errorCount = 0;

      // 各メッセージに対してopsResolutionWorkflowを直列実行
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const messageUrl = `https://example.slack.com/archives/${channelId}/p${message.ts.replace(".", "")}`;

        console.log(
          `[OpsMonitoringWorkflow] Processing message ${i + 1}/${messages.length}: ${messageUrl}`,
        );

        try {
          const quickCheckResult =
            await deps.quickDuplicateCheckWorkflow.invoke(messageUrl, isDryRun);

          if (quickCheckResult.skipped) {
            processedCount++;
            console.log(
              `[OpsMonitoringWorkflow] ⏭️ Quick duplicate check skipped message ${i + 1}/${messages.length}: ${messageUrl}`,
            );
            continue;
          }

          await deps.opsResolutionWorkflow.invoke(messageUrl, isDryRun);
          processedCount++;
          console.log(
            `[OpsMonitoringWorkflow] ✅ Successfully processed ${processedCount}/${messages.length}: ${messageUrl}`,
          );
        } catch (error) {
          errorCount++;
          console.error(
            `[OpsMonitoringWorkflow] ❌ Failed to process ${messageUrl} (${errorCount} errors):`,
            error,
          );
          // エラーが発生しても次のメッセージの処理を続ける
        }
      }

      console.log(
        `[OpsMonitoringWorkflow] ✅ Finished processing all messages (Total: ${messages.length}, Processed: ${processedCount}, Errors: ${errorCount})`,
      );
    },
  };
};
