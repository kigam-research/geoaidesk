/** Client for `/geo/library/*` (contract: web/src/geo/contracts/library.ts). */
import type {
  AddLibraryNoteBody,
  AddLibraryNoteResponse,
  CitationResolution,
  CreateLibraryItemBody,
  CslItem,
  ExportFormat,
  FolderCheckResponse,
  FolderMembershipResult,
  ImportPreview,
  LibraryCollection,
  LookupBody,
  LookupResponse,
  LibraryItem,
  LibraryItemResponse,
  LibraryListQuery,
  LibraryListResponse,
  LibraryNoteCandidatesResponse,
  ProjectLiterature,
  SendToZoteroResult,
  UploadedLibraryFile,
  ZoteroLibraryState,
} from "@/geo/contracts/library";
import { API_BASE, apiFetch } from "@/lib/projects";
import { withApiToken } from "@/lib/api-auth";

export class LibraryApiError extends Error {
  status: number;
  zoteroState?: ZoteroLibraryState["state"];
  /** Error code and HTTP status of a refused Zotero call, for 기술 정보. */
  zoteroDetail?: string;
  constructor(message: string, status: number, zoteroState?: ZoteroLibraryState["state"], zoteroDetail?: string) {
    super(message);
    this.status = status;
    this.zoteroState = zoteroState;
    this.zoteroDetail = zoteroDetail;
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
    const detail = body && typeof body === "object" && "detail" in body && typeof body.detail === "string" ? body.detail : undefined;
    throw new LibraryApiError(message, res.status, state, detail);
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

// --- Research notes in the library (gaid-note-library) ------------------------------------------------------------------
/** "서재에 넣기" for a research note; the same note again returns its existing item (`created: false`). */
export const addNoteToLibrary = (body: AddLibraryNoteBody, projectId?: string) =>
  call<AddLibraryNoteResponse>("/notes", { method: "POST", body: JSON.stringify(body) }, projectId);
/** Research notes of the projects on this GAID, with their library item when already brought in. */
export const listNoteCandidates = () => call<LibraryNoteCandidatesResponse>("/notes/candidates");
/** Removes a library item (a research note item only; the note file stays). */
export const removeLibraryItem = (id: string) => call<null>(`/items/${encodeURIComponent(id)}`, { method: "DELETE" });

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

/** Adds a folder to a project's citation scope (its attached folders). */
export async function attachFolderToProject(projectId: string, folderId: string): Promise<ProjectLiterature> {
  const current = await call<ProjectLiterature>("/project", undefined, projectId);
  if (current.collectionIds.includes(folderId)) return current;
  return call<ProjectLiterature>("/project", { method: "PUT", body: JSON.stringify({ collectionIds: [...current.collectionIds, folderId], itemIds: current.itemIds }) }, projectId);
}

// --- Folders -----------------------------------------------------------------------------------------------------------
export const createFolder = (name: string, parentId?: string) => call<LibraryCollection>("/collections", { method: "POST", body: JSON.stringify({ name, ...(parentId ? { parentId } : {}) }) });
export const renameFolder = (id: string, name: string) => call<LibraryCollection>(`/collections/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ name }) });
export const deleteFolder = (id: string) => call<{ folders: number }>(`/collections/${encodeURIComponent(id)}`, { method: "DELETE" });
export const setFolderItems = (id: string, itemIds: string[], action: "add" | "remove") =>
  call<FolderMembershipResult>(`/collections/${encodeURIComponent(id)}/items`, { method: "POST", body: JSON.stringify({ itemIds, action }) });
export const checkFolder = (id: string) => call<FolderCheckResponse>(`/collections/${encodeURIComponent(id)}/check`);
export const sendFolderToZotero = (id: string) => call<SendToZoteroResult>(`/collections/${encodeURIComponent(id)}/send-to-zotero`, { method: "POST" });

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
/** Technical detail of a failed Zotero call (code and HTTP status, or the server's message). */
export function zoteroDetail(error: unknown): string | undefined {
  if (error instanceof LibraryApiError) return error.zoteroDetail ?? `${error.message} · HTTP ${error.status}`;
  return error instanceof Error ? error.message : undefined;
}
export const connectLocalZotero = () => call<ZoteroLibraryState>("/zotero/local", { method: "POST" });
export const connectWebZotero = (key: string) => call<{ libraries: ZoteroLibraryState[] }>("/zotero/web", { method: "POST", body: JSON.stringify({ key }) });
export const disconnectZotero = (connection: ZoteroLibraryState["connection"]) => call<{ libraries: ZoteroLibraryState[] }>("/zotero/disconnect", { method: "POST", body: JSON.stringify({ connection }) });
export const syncZotero = () => call<{ libraries: ZoteroLibraryState[] }>("/zotero/sync", { method: "POST" });
export const readItemText = (id: string) => call<LibraryItem>(`/items/${encodeURIComponent(id)}/read`, { method: "POST" });
export const sendItemToZotero = (id: string) => call<SendToZoteroResult>(`/items/${encodeURIComponent(id)}/send-to-zotero`, { method: "POST" });

// --- Reference details and bibliography files ------------------------------------------------------------------------
export const lookupReference = (body: LookupBody) => call<LookupResponse>("/lookup", { method: "POST", body: JSON.stringify(body) });
export const previewImport = (text: string, format: "bibtex" | "ris" | "csl-json") => call<ImportPreview>("/import", { method: "POST", body: JSON.stringify({ text, format }) });
export const confirmImport = (items: CslItem[]) => call<{ added: number; duplicates: number; failed: number }>("/import/confirm", { method: "POST", body: JSON.stringify({ items }) });
/** Bibliography download: the whole library, or one folder with its subfolders. */
export function exportUrl(format: ExportFormat, folderId?: string, lang?: "ko" | "en"): string {
  const params = new URLSearchParams({ format });
  if (folderId) params.set("collectionId", folderId);
  if (lang) params.set("lang", lang);
  return withApiToken(`${API_BASE}/geo/library/export?${params}`);
}
export const resolveCitations = (keys: string[]) => call<CitationResolution[]>(`/citations?keys=${encodeURIComponent(keys.join(","))}`);
