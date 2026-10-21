/** Client for `/geo/library/*` (contract: web/src/geo/contracts/library.ts). */
import type {
  CreateLibraryItemBody,
  LibraryItem,
  LibraryItemResponse,
  LibraryListQuery,
  LibraryListResponse,
  ProjectLiterature,
  UploadedLibraryFile,
  ZoteroLibraryState,
} from "@/geo/contracts/library";
import { API_BASE, apiFetch } from "@/lib/projects";
import { withApiToken } from "@/lib/api-auth";

export class LibraryApiError extends Error {
  status: number;
  zoteroState?: ZoteroLibraryState["state"];
  constructor(message: string, status: number, zoteroState?: ZoteroLibraryState["state"]) {
    super(message);
    this.status = status;
    this.zoteroState = zoteroState;
  }
}

async function call<T>(path: string, init?: RequestInit, projectId?: string): Promise<T> {
  const res = await apiFetch(`/geo/library${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  }, projectId);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : `HTTP ${res.status}`;
    const state = body && typeof body === "object" && "state" in body && typeof body.state === "string" ? (body.state as ZoteroLibraryState["state"]) : undefined;
    throw new LibraryApiError(message, res.status, state);
  }
  return body as T;
}

export function listLibrary(query: LibraryListQuery = {}): Promise<LibraryListResponse> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params.set(k, String(v));
  const qs = params.toString();
  return call(qs ? `?${qs}` : "");
}

export const getLibraryItem = (id: string) => call<LibraryItemResponse>(`/items/${encodeURIComponent(id)}`);

export const addLibraryItem = (body: CreateLibraryItemBody) => call<LibraryItem>("/items", { method: "POST", body: JSON.stringify(body) });

export async function uploadLibraryPdf(file: File): Promise<UploadedLibraryFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return call("/files", { method: "POST", body: JSON.stringify({ contentBase64: btoa(binary) }) });
}

/** Adds one item to a project's attached literature (read-modify-write in that project's scope). */
export async function attachToProject(projectId: string, itemId: string): Promise<ProjectLiterature> {
  const current = await call<ProjectLiterature>("/project", undefined, projectId);
  if (current.itemIds.includes(itemId)) return current;
  return call<ProjectLiterature>("/project", { method: "PUT", body: JSON.stringify({ collectionIds: current.collectionIds, itemIds: [...current.itemIds, itemId] }) }, projectId);
}

export const startWorkflowFromItem = (id: string) => call<{ authoringId: string }>(`/items/${encodeURIComponent(id)}/authoring`, { method: "POST" });

export const libraryPdfUrl = (id: string) => withApiToken(`${API_BASE}/geo/library/items/${encodeURIComponent(id)}/pdf`);

/** Zotero deep links (open the item, or its PDF at a page). */
export function zoteroSelectUrl(item: LibraryItem): string | undefined {
  const z = item.zotero;
  if (!z) return undefined;
  return z.libraryType === "group" ? `zotero://select/groups/${z.libraryId}/items/${z.itemKey}` : `zotero://select/library/items/${z.itemKey}`;
}

// --- Zotero (`/geo/library/zotero*`) ---------------------------------------------------------------------------------

/** A refused Zotero call carries a research-language state (`zotero-closed`, `local-api-off`, …). */
export function zoteroState(error: unknown): ZoteroLibraryState["state"] | undefined {
  return error instanceof LibraryApiError && error.zoteroState ? error.zoteroState : undefined;
}
export const connectLocalZotero = () => call<ZoteroLibraryState>("/zotero/local", { method: "POST" });
export const connectWebZotero = (key: string) => call<{ libraries: ZoteroLibraryState[] }>("/zotero/web", { method: "POST", body: JSON.stringify({ key }) });
export const syncZotero = () => call<{ libraries: ZoteroLibraryState[] }>("/zotero/sync", { method: "POST" });
export const readItemText = (id: string) => call<LibraryItem>(`/items/${encodeURIComponent(id)}/read`, { method: "POST" });
export const sendItemToZotero = (id: string) => call<LibraryItem>(`/items/${encodeURIComponent(id)}/send-to-zotero`, { method: "POST" });
