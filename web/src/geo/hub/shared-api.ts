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
  type EditEntryResult,
  type HubMe,
} from "@/geo/contracts/hub-shared";
import { apiFetch } from "@/lib/projects";

import { HubApiError } from "./api";
import { hubServer, HubServerError } from "@/geo/hub-server/api";

/** The researcher's display name in the shared hub, kept in this browser. */
export const HUB_USER_KEY = "gaid:hub-user";
export const HUB_IDENTITY_CHANGED = "gaid:hub-identity-changed";
export type HubIdentity = HubMe & { configured: boolean };
let identity: HubIdentity | null = null;
let refreshing: Promise<HubIdentity> | null = null;

/** Refresh before a named action: an expired account must never become a browser display name. */
export function refreshHubIdentity(): Promise<HubIdentity> {
  if (!refreshing) refreshing = readHubIdentity().finally(() => { refreshing = null; });
  return refreshing;
}

async function readHubIdentity(): Promise<HubIdentity> {
  let configured = false;
  try { configured = Boolean((await hubServer.status()).url); }
  catch (error) {
    // Older GAID backends have no connection service and retain the local display-name behaviour.
    if (!(error instanceof HubServerError && error.status === 404)) throw error;
  }
  let me: HubMe;
  try { me = await call<HubMe>("/me"); }
  catch (error) {
    if (configured && error instanceof HubApiError && error.status === 401) me = { name: null, account: false };
    else if (!configured && error instanceof HubApiError && error.status === 404) me = { name: localHubUserName(), account: false };
    else throw error;
  }
  identity = { ...me, configured: configured || Boolean(me.account) };
  window.dispatchEvent(new Event(HUB_IDENTITY_CHANGED));
  return identity;
}

export function hubIdentity(): HubIdentity | null { return identity; }

export function hubUserName(): string | null {
  if (identity?.configured) return identity.account ? identity.name : null;
  return localHubUserName();
}

function localHubUserName(): string | null {
  try {
    const v = window.localStorage.getItem(HUB_USER_KEY)?.trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

export function setHubUserName(name: string): void {
  if (identity?.configured) return;
  window.localStorage.setItem(HUB_USER_KEY, name.trim());
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const user = identity?.configured ? null : localHubUserName();
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
  entries: (folder?: string, q?: string) => {
    const params = new URLSearchParams();
    if (folder && folder !== "all") params.set("folder", folder);
    if (q?.trim()) params.set("q", q.trim());
    return call<{ entries: HubEntry[] }>(`/entries${params.size ? `?${params}` : ""}`);
  },
  catalogueSkillSource: (id: string, name: string) => call<{ content: string }>(`/catalogue/${encodeURIComponent(id)}/skill-source?name=${encodeURIComponent(name)}`),
  catalogue: (id: string) => call<{ doc: import("@/geo/contracts/workflow-doc").WorkflowDoc }>(`/catalogue/${encodeURIComponent(id)}`),
  skillSource: (id: string, revision: number, name: string) => call<{ content: string }>(`${eid(id)}/skill-source?revision=${revision}&name=${encodeURIComponent(name)}`),
  entry: (id: string) => call<HubEntryDetail>(eid(id)),
  register: (body: RegisterBody) => post<HubEntry>("/entries", body),
  /** The draft to open for "방법 고치기" (author) or "복사해서 고치기" (anyone else). */
  edit: (id: string) => post<EditEntryResult>(`${eid(id)}/edit`, {}),
  star: (id: string, on: boolean) => post<{ stars: number; starredByMe: boolean }>(`${eid(id)}/star`, { on }),
  comment: (id: string, body: string) => post<HubComment>(`${eid(id)}/comments`, { body }),
  install: (id: string, projectId: string, revision: number) =>
    post<InstallResult>(`${eid(id)}/install`, { projectId, acknowledged: true, revision }),
  recommended: () => call<{ cards: HubRecommendation[] }>("/recommended"),
};
