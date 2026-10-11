/**
 * Client for the GeoAIDesk context routes (server/src/geo/routes/catalogue.ts).
 * Shapes mirror server/src/geo/context.ts (`PromptBudget`, `SessionExposure`).
 */
import { apiFetch } from "@/lib/projects";

export type ExposureMode = "all" | "catalogue" | `workflow:${string}`;

export interface PromptBudget {
  schemaVersion: "gaid-prompt-budget/v1";
  model: { ref: string; contextWindow: number; maxOutputTokens: number } | null;
  initialPrompt: {
    systemPromptChars: number;
    toolSchemaChars: number;
    tools: number;
    estimatedTokens: number;
    method: "chars/4";
  };
  skills: { mode: ExposureMode; exposed: number; installed: number };
  remainingTokens: number | null;
  remainingFraction: number | null;
  observed: { tokens: number | null; percent: number | null } | null;
}

export interface SessionContext {
  exposure: { mode: ExposureMode; skills?: string[]; catalogueLabel?: string } | null;
  budget: PromptBudget;
}

export interface CatalogueWorkflow {
  id: string;
  title: { ko: string; en?: string };
}

export interface CatalogueSummary {
  status: { state: "off" | "ready" | "error"; version?: string; message?: string };
  workflows: CatalogueWorkflow[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getSessionContext(projectId: string, sessionId: string, modelRef?: string): Promise<SessionContext> {
  const query = new URLSearchParams({ sessionId });
  if (modelRef) query.set("model", modelRef);
  return json(await apiFetch(`/geo/context?${query}`, {}, projectId));
}

/** Budget of a chat not created yet, measured with the project's new-chat settings. */
export async function getPreviewContext(projectId: string, modelRef?: string, exposure?: string): Promise<SessionContext> {
  const params = new URLSearchParams({ ...(modelRef ? { model: modelRef } : {}), ...(exposure ? { exposure } : {}) });
  const query = params.size ? `?${params}` : "";
  return json(await apiFetch(`/geo/context/preview${query}`, {}, projectId));
}

export async function getCatalogueSummary(projectId: string): Promise<CatalogueSummary> {
  return json(await apiFetch("/geo/catalogue", {}, projectId));
}

export async function getNewChatExposure(projectId: string): Promise<ExposureMode> {
  const body = await json<{ newChatExposure: ExposureMode }>(await apiFetch("/geo/context/settings", {}, projectId));
  return body.newChatExposure;
}

export async function putNewChatExposure(projectId: string, mode: ExposureMode): Promise<ExposureMode> {
  const body = await json<{ newChatExposure: ExposureMode }>(
    await apiFetch(
      "/geo/context/settings",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newChatExposure: mode }) },
      projectId,
    ),
  );
  return body.newChatExposure;
}
