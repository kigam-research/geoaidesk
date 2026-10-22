import { apiFetch } from "@/lib/projects";
import type { OrcidConfirmBody, OrcidConfirmResult, OrcidStatus, OrcidWorksPreview } from "@/geo/contracts/orcid";

export class OrcidApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(path = "", init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/geo/orcid${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new OrcidApiError(typeof body?.error === "string" ? body.error : `HTTP ${res.status}`, res.status);
  return body as T;
}

export const getOrcid = () => call<OrcidStatus>();
export const linkOrcid = (orcid: string) => call<OrcidStatus>("", { method: "PUT", body: JSON.stringify({ orcid }) });
export const unlinkOrcid = () => call<OrcidStatus>("", { method: "DELETE" });
export const previewOrcidWorks = () => call<OrcidWorksPreview>("/works", { method: "POST", body: "{}" });
// No short client timeout: enriching the selected DOIs can take tens of seconds.
export const confirmOrcidWorks = (body: OrcidConfirmBody) => call<OrcidConfirmResult>("/works/confirm", { method: "POST", body: JSON.stringify(body) });

export function orcidProblem(error: unknown): string {
  if (!(error instanceof OrcidApiError)) return "failed";
  return ({ 400: "invalid", 404: "notFound", 409: "notLinked", 502: "unavailable" } as Record<number, string>)[error.status] ?? "failed";
}
