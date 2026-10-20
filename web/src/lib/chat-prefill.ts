/**
 * Cross-panel "prefill the chat composer" handoff (e.g. the LaTeX editor's
 * Ask Kady button). A window event — like CHANGE_EVENT in projects.ts — so
 * distant components don't need prop threading. Two listeners cooperate:
 * the active chat tab's composer appends the text (chat-tab.tsx), and
 * page.tsx switches the right column back to the chat view so the prefilled
 * composer is actually visible.
 *
 * GeoAIDesk (gaid-note-decisions): `send: true` asks the active tab to send
 * the text as its own message (research-note answers; the tab falls back to
 * the composer when it cannot send), `sessionId` restricts the handoff to the
 * tab of that chat, and the return value says what the chat tab did with it.
 */

const PREFILL_EVENT = "kady:prefill-chat";

export interface ChatPrefillOptions {
  send?: boolean;
  sessionId?: string;
}

/** What a chat tab did with the text: started sending it, or put it in its composer. */
export type ChatPrefillResult = "sent" | "filled";

interface PrefillDetail extends ChatPrefillOptions {
  text: string;
  result: ChatPrefillResult | null;
}

/** Returns null when no chat tab took the text. */
export function prefillChat(text: string, options: ChatPrefillOptions = {}): ChatPrefillResult | null {
  const detail: PrefillDetail = { text, send: options.send === true, sessionId: options.sessionId, result: null };
  window.dispatchEvent(new CustomEvent(PREFILL_EVENT, { detail }));
  return detail.result;
}

/** A chat tab's handler returns what it did with the text; other listeners return nothing. */
export function onChatPrefill(handler: (text: string, options: ChatPrefillOptions) => ChatPrefillResult | false | void): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<PrefillDetail>).detail;
    if (!detail?.text) return;
    const result = handler(detail.text, { send: detail.send === true, sessionId: detail.sessionId });
    if (result) detail.result = result;
  };
  window.addEventListener(PREFILL_EVENT, listener);
  return () => window.removeEventListener(PREFILL_EVENT, listener);
}
