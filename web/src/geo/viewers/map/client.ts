import { apiFetch, API_BASE, getActiveProjectId } from "@/lib/projects";
import { withApiToken } from "@/lib/api-auth";
import type { RasterTileQuery } from "../../contracts/maps";
import { mapText as t } from "./strings";

/** All requests use explicit project scope and are abortable on replacement/unmount. */
export async function mapPost<T>(endpoint: string, body: unknown, projectId: string | undefined, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    signal.throwIfAborted();
    const res = await apiFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }, projectId);
    const value = await res.json();
    // Pan/zoom, overlay and area requests share four server reader slots.
    // Retry only explicit capacity responses, never invalid data or source errors.
    if (res.status === 429 && attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(value.detail ?? value.error ?? t("requestError"));
    return value as T;
  }
  throw new Error(t("requestError"));
}
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Versioned tile URL loaded by OpenLayers itself (explicit project scope, optional access token). */
export function tileUrl(query: RasterTileQuery, projectId?: string): string {
  const params = new URLSearchParams({ project: projectId ?? getActiveProjectId(), path: query.path, band: String(query.band), crs: query.crs,
    bbox: query.bbox.map(n => String(n)).join(","), size: String(query.size), v: query.v });
  if (query.categorical) params.set("categorical", "1");
  else { params.set("low", String(query.low)); params.set("high", String(query.high)); }
  return withApiToken(`${API_BASE}/geo/raster-tile?${params}`);
}
