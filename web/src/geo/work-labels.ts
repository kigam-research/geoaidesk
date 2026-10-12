import { geoLocale, geoText, hasGeoText } from "./i18n";
import type { ModalJobResource } from "@/lib/modal-jobs";

const workText = geoText("work");

/** Translate known UI codes only; unknown values and user-defined names stay intact. */
export function workLabel(group: string, value: string, fallback = value): string {
  const key = group + "." + value;
  return hasGeoText("work." + key) ? workText(key) : fallback;
}

/** Distinguish protocol-generated owner labels from user-defined specialist names. */
export function workJobOwner(agent: string | null, source: string | null, raw: Record<string, unknown> = {}): string | null {
  if ([raw.agent, raw.agentName, raw.agent_name].some((value) => typeof value === "string" && value.trim())) return agent;
  if (agent === "subagent") return workLabel("source", agent);
  if (agent?.startsWith("subagent ")) return workText("source.subagent_run", { runId: agent.slice(9) });
  return agent ?? (source ? workLabel("source", source) : null);
}

export function workResourceName(value: string): string {
  const cpu = /^CPU · (\d+) (core|cores)$/.exec(value);
  return cpu ? workText(cpu[2] === "core" ? "resource.cpu_one" : "resource.cpu_many", { count: Number(cpu[1]) }) : value;
}

export function formatWorkModalResource(resource: ModalJobResource | null): string {
  if (!resource) return "—";
  const name = resource.label && resource.label !== resource.instanceId
    ? workResourceName(resource.label)
    : resource.gpu ?? resource.instanceId ?? workText("resource.custom");
  if (resource.gpu) return `${resource.gpuCount > 1 ? `${resource.gpuCount}× ` : ""}${name}`;
  return resource.cpu ? `${name} · ${resource.cpu} CPU` : name;
}

export function formatWorkModalDuration(startedAt: string | null | undefined, finishedAt: string | null | undefined, now = Date.now()): string {
  if (!startedAt) return workText("duration.not_started");
  const start = Date.parse(startedAt), finish = finishedAt ? Date.parse(finishedAt) : now;
  if (!Number.isFinite(start) || !Number.isFinite(finish)) return "—";
  const elapsed = Math.max(0, Math.floor((finish - start) / 1000));
  const hours = Math.floor(elapsed / 3600), minutes = Math.floor((elapsed % 3600) / 60), seconds = elapsed % 60;
  return hours > 0 ? workText("duration.hours", { hours, minutes, seconds })
    : minutes > 0 ? workText("duration.minutes", { minutes, seconds }) : workText("duration.seconds", { seconds });
}

export function formatWorkModalTimestamp(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(geoLocale(), { dateStyle: "medium", timeStyle: "short" }).format(Date.parse(value));
}

/** Display catalogue metadata without changing Database objects sent to the agent. */
export function workDatabaseDescription(db: { id: string; description: string }): string {
  return workLabel("database.description", db.id, db.description);
}
export function workDatabaseCategory(category: string): string {
  const key = category.toLowerCase().replace(/[^a-z]+/g, "_").replace(/_$/, "");
  return workLabel("database.category", key, category);
}
