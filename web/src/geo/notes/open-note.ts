/**
 * 서재 → project hand-off (gaid-note-library): "프로젝트에서 열기" on a research note opens that project, its notebook
 * tab and the note. Like the hub's method hand-off, the request waits until the workspace of that project takes it
 * (the workspace may mount only after the project switch).
 */
export const OPEN_RESEARCH_NOTE_EVENT = "gaid:open-research-note";

export interface OpenResearchNoteRequest {
  projectId: string;
  noteId: string;
}

let pending: OpenResearchNoteRequest | null = null;

export function requestOpenResearchNote(request: OpenResearchNoteRequest): void {
  pending = request;
  window.dispatchEvent(new CustomEvent(OPEN_RESEARCH_NOTE_EVENT));
}

/** The workspace of `projectId` takes a pending request (once). */
export function takeOpenResearchNote(projectId: string): OpenResearchNoteRequest | null {
  if (!pending || pending.projectId !== projectId) return null;
  const request = pending;
  pending = null;
  return request;
}

export function onOpenResearchNoteRequest(handler: () => void): () => void {
  window.addEventListener(OPEN_RESEARCH_NOTE_EVENT, handler);
  return () => window.removeEventListener(OPEN_RESEARCH_NOTE_EVENT, handler);
}
