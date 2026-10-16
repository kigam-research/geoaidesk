/** Client for the shared GAID hub (`/geo/hub/*`, contract web/src/geo/contracts/hub-shared.ts). */
import type { InstallResult } from "@/geo/contracts/authoring";
import {
  HUB_USER_HEADER,
  type HubComment,
  type HubEntry,
  type HubEntryDetail,
  type HubFolder,
  type HubRecommendation,
  type RegisterBody,
} from "@/geo/contracts/hub-shared";
import { apiFetch } from "@/lib/projects";

import { HubApiError } from "./api";

/** The researcher's display name in the shared hub, kept in this browser. */
export const HUB_USER_KEY = "gaid:hub-user";

export function hubUserName(): string | null {
  try {
    const v = window.localStorage.getItem(HUB_USER_KEY)?.trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

export function setHubUserName(name: string): void {
  window.localStorage.setItem(HUB_USER_KEY, name.trim());
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const user = hubUserName();
  if (user) headers.set(HUB_USER_HEADER, encodeURIComponent(user));
  const res = await apiFetch(`/geo/hub${path}`, { ...init, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error) ||
      `HTTP ${res.status}`;
    throw new HubApiError(message, res.status, body);
  }
  return body as T;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });
const eid = (id: string) => `/entries/${encodeURIComponent(id)}`;

export const sharedHub = {
  folders: () => call<{ folders: (HubFolder & { entries: number })[] }>("/folders"),
  createFolder: (name: string) => post<HubFolder>("/folders", { name }),
  entries: (folder?: string) =>
    call<{ entries: HubEntry[] }>(
      `/entries${folder && folder !== "all" ? `?folder=${encodeURIComponent(folder)}` : ""}`,
    ),
  entry: (id: string) => call<HubEntryDetail>(eid(id)),
  register: (body: RegisterBody) => post<HubEntry>("/entries", body),
  star: (id: string, on: boolean) => post<{ stars: number; starredByMe: boolean }>(`${eid(id)}/star`, { on }),
  comment: (id: string, body: string) => post<HubComment>(`${eid(id)}/comments`, { body }),
  install: (id: string, projectId: string) =>
    post<InstallResult>(`${eid(id)}/install`, { projectId, acknowledged: true }),
  recommended: () => call<{ cards: HubRecommendation[] }>("/recommended"),
};
