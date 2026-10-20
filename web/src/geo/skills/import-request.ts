/** Project-scoped prefill for the existing Settings skill import/acknowledgement gate. */
import { openSettings } from "@/lib/settings-nav";
const EVENT = "gaid:import-skill";
const pending = new Map<string, string>();
export function requestSkillImport(projectId: string, source: string): void {
  pending.set(projectId, source);
  openSettings({ tab: "skills", projectId });
  window.dispatchEvent(new Event(EVENT));
}
export function takeSkillImport(projectId: string): string | null {
  const source = pending.get(projectId) ?? null;
  pending.delete(projectId);
  return source;
}
export function onSkillImport(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
