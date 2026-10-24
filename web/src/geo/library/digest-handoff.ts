/**
 * 서재 → project hand-off for 문헌 정리 만들기 (gaid-library-prep): the project's workspace opens a new chat whose composer
 * holds the request message (never sent automatically). Like open-note.ts, the request waits until the workspace of that
 * project takes it (it may mount only after the project switch), then goes through the usual start-task event.
 */
import type { GeoStartTaskDetail } from "@/geo/contracts/workspace";

export const DIGEST_CHAT_EVENT = "gaid:digest-chat";

export interface DigestChatRequest {
  projectId: string;
  task: Omit<GeoStartTaskDetail, "result">;
}

let pending: DigestChatRequest | null = null;

export function requestDigestChat(request: DigestChatRequest): void {
  pending = request;
  window.dispatchEvent(new CustomEvent(DIGEST_CHAT_EVENT));
}

/** The workspace of `projectId` takes a pending request (once). */
export function takeDigestChat(projectId: string): DigestChatRequest | null {
  if (!pending || pending.projectId !== projectId) return null;
  const request = pending;
  pending = null;
  return request;
}

export function onDigestChatRequest(handler: () => void): () => void {
  window.addEventListener(DIGEST_CHAT_EVENT, handler);
  return () => window.removeEventListener(DIGEST_CHAT_EVENT, handler);
}
