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
