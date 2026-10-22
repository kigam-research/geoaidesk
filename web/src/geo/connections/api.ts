import { apiFetch } from "@/lib/projects";
import { geoLocale } from "@/geo/i18n";
import type { ConnectionFocus, ConnectionMapResponse } from "@/geo/contracts/connections";

export async function fetchConnections(projectId: string, focus: ConnectionFocus, depth: 1 | 2, signal?: AbortSignal): Promise<ConnectionMapResponse> {
  const query = new URLSearchParams({ focus, depth: String(depth), locale: geoLocale() });
  const response = await apiFetch("/geo/connections?" + query, { signal }, projectId);
  if (!response.ok) throw new Error("Could not load connections");
  return response.json();
}
