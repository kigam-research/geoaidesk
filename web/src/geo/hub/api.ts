/** Client for `/geo/authoring/*` (contract: web/src/geo/contracts/authoring.ts). */
import type {
  AddLibrarySourcesBody,
  AddLibrarySourcesResult,
  AddSourceBody,
  AddUrlSourceBody,
  GenerateVisualsBody,
  VisualOperation,
  VisualSourceInfo,
  AnswersBody,
  AuthoringAttempt,
  AuthoringHealth,
  AuthoringProject,
  CheckResult,
  CreateProjectBody,
  DraftFileView,
  InstallBody,
  InstallResult,
  MethodPackageRecord,
  OperationBody,
  ProjectSummary,
  SourceDocument,
  ExtractionRecord,
  Decision,
  AttachExampleBody,
  EditExampleBody,
  MethodDraft,
} from "@/geo/contracts/authoring";
import { apiFetch } from "@/lib/projects";

export class HubApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/geo/authoring${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error) ||
      (body && typeof body === "object" && "message" in body && typeof body.message === "string" && body.message) ||
      `HTTP ${res.status}`;
    throw new HubApiError(message, res.status, body);
  }
  return body as T;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });
const pid = (id: string) => `/projects/${encodeURIComponent(id)}`;

export const newOpId = () => `op-${crypto.randomUUID()}`;

export const hubApi = {
  health: () => call<AuthoringHealth>("/health"),
  list: () => call<{ projects: ProjectSummary[] }>("/projects"),
  create: (body: CreateProjectBody) => post<AuthoringProject>("/projects", body),
  get: (id: string) => call<AuthoringProject>(pid(id)),
  remove: (id: string) => call<null>(pid(id), { method: "DELETE" }),
  addSource: (id: string, body: AddSourceBody) =>
    post<{ source: SourceDocument; extraction: ExtractionRecord }>(`${pid(id)}/sources`, body),
  addUrl: (id: string, body: AddUrlSourceBody) =>
    post<{ source: SourceDocument; extraction: ExtractionRecord }>(`${pid(id)}/sources/url`, body),
  visuals: (id: string, rev: number, selection: Omit<GenerateVisualsBody, "opId"> = {}) =>
    post<VisualOperation>(`${pid(id)}/drafts/${rev}/visuals`, { ...selection, opId: newOpId() }),
  visualSource: () => call<VisualSourceInfo>("/visual-source"),
  visualUrl: (id: string, key: string) => `/geo/authoring${pid(id)}/visuals/${encodeURIComponent(key)}`,
  analyze: (id: string, body: OperationBody) => post<AuthoringAttempt>(`${pid(id)}/analyze`, body),
  answers: (id: string, body: AnswersBody) =>
    post<{ decisions: Decision[]; attempt?: AuthoringAttempt }>(`${pid(id)}/answers`, body),
  draft: (id: string, body: OperationBody) => post<AuthoringAttempt>(`${pid(id)}/draft`, body),
  revise: (id: string, body: OperationBody) => post<AuthoringAttempt>(`${pid(id)}/revise`, body),
  workflow: (id: string, rev: number) => call<{ doc: import("@/geo/contracts/workflow-doc").WorkflowDoc | null }>(`${pid(id)}/drafts/${rev}/workflow`),
  files: (id: string, rev: number) => call<{ files: DraftFileView[] }>(`${pid(id)}/drafts/${rev}/files`),
  check: (id: string, rev: number) => call<CheckResult>(`${pid(id)}/drafts/${rev}/check`),
  pack: (id: string, draftRevision: number) =>
    post<MethodPackageRecord>(`${pid(id)}/packages`, { opId: newOpId(), draftRevision }),
  install: (id: string, rev: number, body: InstallBody) =>
    post<InstallResult>(`${pid(id)}/packages/${rev}/install`, body),
  /** Example data of a Workflow input (gaid-workflow-example); each change returns the new draft revision. */
  attachExample: (id: string, body: AttachExampleBody) => post<MethodDraft>(`${pid(id)}/examples`, body),
  editExample: (id: string, roleId: string, body: EditExampleBody) =>
    post<MethodDraft>(`${pid(id)}/examples/${encodeURIComponent(roleId)}`, body),
  removeExample: (id: string, roleId: string, baseRevision: number) =>
    post<MethodDraft>(`${pid(id)}/examples/${encodeURIComponent(roleId)}/remove`, { baseRevision }),
  removeSource: (id: string, sourceId: string) =>
    call<null>(`${pid(id)}/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" }),
  originalUrl: (id: string, sourceId: string) =>
    `/geo/authoring${pid(id)}/sources/${encodeURIComponent(sourceId)}/original`,
};

/** Papers and research notes from 서재 as sources (`/geo/library/authoring`). */
export async function addLibrarySources(body: AddLibrarySourcesBody): Promise<AddLibrarySourcesResult> {
  const res = await apiFetch("/geo/library/authoring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && typeof data.error === "string" && data.error) || `HTTP ${res.status}`);
  return data as AddLibrarySourcesResult;
}

/** Base64 of a File for `AddSourceBody.contentBase64`. */
export async function fileBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
