/**
 * Navigation between GAID's places (gaid-ia-connect-workspace, ADR 2026-10-24 gaid-connect-workspace): GAID Workspace,
 * GAID Connect and the researcher's 서재, which opens as a full screen over either place and returns to it.
 * Components anywhere in the app ask for 서재 with `openLibrary()`; `app/page.tsx` listens and shows it.
 */
export type GaidPlace = "workspace" | "connect";

export const OPEN_LIBRARY_EVENT = "gaid:open-library";

export interface OpenLibraryDetail {
  /** Library item to select when the screen opens. */
  itemId?: string;
}

/** Opens the full 서재 screen (optionally on one item) over the current place. */
export function openLibrary(detail: OpenLibraryDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenLibraryDetail>(OPEN_LIBRARY_EVENT, { detail }));
}

/**
 * Workspace home → project hand-off: opening a recent chat or the Workflow list of a project. The request is kept until
 * the workspace of that project takes it (it mounts after the switch), like `openMethodSetup` in `geo/hub/handoff.ts`.
 */
export interface WorkspaceOpenRequest {
  projectId: string;
  /** Chat to open in a tab. */
  sessionId?: string;
  title?: string;
  /** Show the Workflow list in the right pane. */
  workflows?: boolean;
}

export const WORKSPACE_OPEN_EVENT = "gaid:workspace-open";
let pendingOpen: WorkspaceOpenRequest | null = null;

export function requestWorkspaceOpen(request: WorkspaceOpenRequest): void {
  pendingOpen = request;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(WORKSPACE_OPEN_EVENT));
}

/** The workspace of `projectId` takes a pending request (once). */
export function takeWorkspaceOpen(projectId: string): WorkspaceOpenRequest | null {
  if (!pendingOpen || pendingOpen.projectId !== projectId) return null;
  const request = pendingOpen;
  pendingOpen = null;
  return request;
}

export function onWorkspaceOpenRequest(handler: () => void): () => void {
  window.addEventListener(WORKSPACE_OPEN_EVENT, handler);
  return () => window.removeEventListener(WORKSPACE_OPEN_EVENT, handler);
}
