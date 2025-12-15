import { SlackThreadMessage } from "@core/domain/entities/slack/thread";
import {
  Result,
  SlackAddReactionPayload,
  SlackMessagePayload,
} from "sample-mcp-kit";

export interface SlackRepository {
  /**
   * 指定されたメッセージURLからメッセージを取得
   */
  fetch: (messageUrl: string) => Promise<SlackThreadMessage | null>;

  /**
   * 指定されたメッセージURLからスレッドの全メッセージを取得（親メッセージを含む）
   */
  fetchAll: (messageUrl: string) => Promise<SlackThreadMessage[] | null>;

  /**
   * Slackに回答を投稿（フィードバックフォーム付き）
   */
  replyWithFeedbackForm: (
    target: SlackThreadMessage,
    text: string,
  ) => Promise<void>;

  /**
   * Slackメッセージにリアクション（スタンプ）を追加する
   *
   * @param messageUrl SlackメッセージのURL
   * @param reactionName リアクション名（例: "white_check_mark", "thumbsup"）
   * @returns 追加結果
   */
  addReaction: (
    messageUrl: string,
    reactionName: string,
  ) => Promise<Result<SlackAddReactionPayload>>;

  /**
   * チャンネルの履歴を取得
   *
   * @param channelId チャンネルID
   * @param oldest 取得開始時刻（Unixタイムスタンプ）
   * @param latest 取得終了時刻（Unixタイムスタンプ）
   * @param limit 取得件数の上限
   * @returns メッセージの配列
   */
  getChannelHistory: (
    channelId: string,
    oldest: number,
    latest: number,
    limit?: number,
  ) => Promise<SlackMessagePayload[]>;
}
