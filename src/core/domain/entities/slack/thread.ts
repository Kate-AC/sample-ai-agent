export type SlackThreadMessage = {
  ts: string;
  text: string;
  thread_ts?: string;
  channel: string;
};

export type SlackThreadContext = {
  threadMessages: SlackThreadMessage[];
  userQuestion: SlackThreadMessage;
};
