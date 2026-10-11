/**
 * Start-task hand-off: GAID components ask the workspace page to open a new
 * chat tab holding a task draft (app/page.tsx listens while active). The tab's
 * session is created on its first send with `geoExposure`, so the draft and
 * the exposure survive reloads like any other unsent draft.
 */
import { GEO_START_TASK_EVENT, type GeoStartTaskDetail } from "@/geo/contracts/workspace";

/** `no-workspace`: no workspace page is listening (e.g. the Projects screen). */
export function startGeoTask(detail: GeoStartTaskDetail): "opened" | "tab-limit" | "no-workspace" {
  const task: GeoStartTaskDetail = { ...detail, result: undefined };
  window.dispatchEvent(new CustomEvent<GeoStartTaskDetail>(GEO_START_TASK_EVENT, { detail: task }));
  return task.result ?? "no-workspace";
}

export function onStartGeoTask(handler: (detail: GeoStartTaskDetail) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<GeoStartTaskDetail>).detail);
  window.addEventListener(GEO_START_TASK_EVENT, listener);
  return () => window.removeEventListener(GEO_START_TASK_EVENT, listener);
}
