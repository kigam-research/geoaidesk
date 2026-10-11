"use client";

/**
 * GAID actions in the chat composer toolbar (e.g. "make a reusable skill"
 * from the work in this chat). Mounted by chat-tab.tsx next to the prompt
 * budget chip. Owner: gaid-korean-workspace--tasks. Renders nothing until built.
 */
export function GeoChatActions(_props: {
  projectId: string;
  /** Null until the chat's first send creates its session. */
  sessionId: string | null;
  isStreaming: boolean;
}) {
  return null;
}
