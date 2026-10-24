/** A researcher-saved external page. GAID stores the link, never fetches it. */
export const NOTEBOOK_URL_MAX = 2048;

export function normalizeNotebookUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > NOTEBOOK_URL_MAX) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.href.length > NOTEBOOK_URL_MAX) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** GET/PUT /geo/notebook-link, scoped by X-Project-Id. Null removes the link. */
export interface ProjectNotebookLink {
  url: string | null;
  updatedAt: string | null;
}
