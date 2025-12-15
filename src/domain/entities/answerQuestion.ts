export type SlackMessage = {
  ts: string;
  text: string;
  thread_ts?: string;
  channel?: string;
};

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ThreadContext = {
  messages: SlackMessage[];
  userQuestion: string;
};

export const MAX_ITERATIONS = 10;
