import { apiFetch } from "@/lib/projects";
import { t } from "@/geo/i18n";

export interface HandoffFile {
  path: string; size: number; sha256: string; role: "code" | "result" | "user-data"; provenanceStepIds: string[];
}
export interface HandoffPreview {
  request: string; finalAnswer: string; modelRef: string | null; files: HandoffFile[];
  followUps?: string[];
  methodTrial?: { methodId: string | null; revision: number | null; workflowId: string; startedAt: string; siteId?: string;
    assessment?: { outcome: "useful" | "needs-revision" | "failed"; note: string; recordedAt: string } } | null;
  excludedFiles?: { path: string; reason: "policy" | "unavailable" | "too-large" | "file-limit" }[];
  excluded: Record<string, number>;
  truncated: { request: boolean; finalAnswer: boolean; provenanceStepIds: boolean };
}
export interface HubSite { id: string; url: string; authoring?: string }
// skill_hub gaid-method-package v1 §6.
export const authoringPath = "#/author/new?from=gaid";
export const authoringUrl = (site: HubSite) => authoringPath ? new URL(authoringPath, site.url).href : site.url;
export function canSendDirect(site: HubSite): boolean {
  try { const url = new URL(site.url); return !!site.authoring && ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname); }
  catch { return false; }
}

export async function checked(response: Response): Promise<Response> {
  if (response.ok) return response;
  const body = await response.json().catch(() => ({}));
  const code = ["input", "session", "file", "size"].includes(body.code) ? body.code : "request";
  throw new Error(t(`hubHandoff.errors.${code}`));
}
export async function previewHandoff(projectId: string, sessionId: string): Promise<HandoffPreview> {
  return (await checked(await apiFetch("/geo/hub/handoff/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) }, projectId))).json();
}
async function bundleResponse(response: Response) {
  const filename = /filename="([A-Za-z0-9._-]+\.tar\.gz)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "gaid-analysis.tar.gz";
  return { blob: await response.blob(), filename };
}
export async function downloadHandoff(projectId: string, sessionId: string, files: string[], note: string) {
  const response = await checked(await apiFetch("/geo/hub/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, files, note }) }, projectId));
  return bundleResponse(response);
}
export async function directHandoff(projectId: string, sessionId: string, files: string[], note: string, siteId: string) {
  const response = await checked(await apiFetch("/geo/hub/handoff/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, files, note, siteId }) }, projectId));
  if (response.headers.get("Content-Type")?.includes("application/gzip")) return { path: "download-fallback" as const, ...await bundleResponse(response) };
  if (response.status !== 201) throw new Error(t("hubHandoff.errors.request"));
  const data: { url: string; projectId: string } = await response.json();
  return { path: "direct" as const, ...data };
}
/** GAID hub receive: a new method draft in this app's hub with the bundle as its first source. */
export async function sendToHub(projectId: string, sessionId: string, files: string[], note: string): Promise<{ projectId: string }> {
  const response = await checked(await apiFetch("/geo/authoring/handoffs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, files, note }) }, projectId));
  return response.json();
}
export function saveDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
