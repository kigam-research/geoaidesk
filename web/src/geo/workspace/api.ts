import { apiFetch } from "@/lib/projects";
import { geoLocale, t } from "@/geo/i18n";
import type { Localized, GeoWorkflowSummary } from "@/geo/contracts/workspace";

export const text = (value: Localized | null | undefined) => value ? (geoLocale() === "en" ? value.en ?? value.ko : value.ko) : "";

export async function request<T>(path: string, projectId: string, body?: unknown, method?: "POST" | "DELETE"): Promise<T> {
  const res = await apiFetch(path, body === undefined ? (method ? { method } : {}) : {
    method: method ?? "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }, projectId);
  const data = await res.json();
  if (!res.ok) throw new RequestError([data.detail, data.output].filter(Boolean).join("\n") || t("workspace.error.status", { status: res.status }), data);
  return data as T;
}

/** A failed request with the server's JSON body (e.g. recipe `issues`). */
export class RequestError extends Error {
  constructor(message: string, readonly body: Record<string, unknown>) { super(message); }
}

export const accepts = (path: string, extensions: string[]) => extensions.some((ext) => path.toLowerCase().endsWith(`.${ext.toLowerCase().replace(/^\./, "")}`));

export function taskDraft(workflow: GeoWorkflowSummary, bindings: Record<string, string>, choices: Record<string, string>): string {
  return t("workspace.setup.draft", {
    prompt: text(workflow.prompt) || text(workflow.description) || text(workflow.title),
    inputs: workflow.inputRoles.filter((role) => bindings[role.id]).map((role) => t("workspace.setup.inputLine", { role: text(role.label), path: bindings[role.id] })).join("\n") || t("workspace.setup.none"),
    choices: workflow.requiredScientificChoices.filter((choice) => choices[choice.id]?.trim()).map((choice) => t("workspace.setup.choiceLine", { choice: text(choice.label), answer: choices[choice.id].trim() })).join("\n") || t("workspace.setup.none"),
    unresolved: workflow.requiredScientificChoices.filter((choice) => !choices[choice.id]?.trim()).map((choice) => text(choice.label)).join(", ") || t("workspace.setup.none"),
    boundary: text(workflow.boundary) || t("workspace.setup.noBoundary"),
  });
}
