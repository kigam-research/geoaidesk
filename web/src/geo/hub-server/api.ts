/** Browser calls only its own GAID; session tokens never enter browser storage. */
import type { HubAccount, HubInvite, HubInviteBody, HubServerStatus, HubUpdateMeBody, HubUpdateUserBody, LibrarySyncResult, LibrarySyncStatus } from "@/geo/contracts/hub-server";
import { apiFetch } from "@/lib/projects";

export const HUB_CONNECTION_CHANGED = "gaid:hub-connection-changed";
export class HubServerError extends Error {
  constructor(public status: number, public detail: string) { super(detail); }
}
export async function hubRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await apiFetch(path, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new HubServerError(response.status, typeof data?.error === "string" ? data.error : `HTTP ${response.status}`);
  return data as T;
}
const base = "/geo/hub-server";
export function connectionChanged() { window.dispatchEvent(new Event(HUB_CONNECTION_CHANGED)); }
export const hubServer = {
  status: () => hubRequest<HubServerStatus>(`${base}/status`),
  config: (url: string | null) => hubRequest<HubServerStatus>(`${base}/config`, "PUT", { url }),
  login: (email: string, password: string) => hubRequest<HubServerStatus>(`${base}/login`, "POST", { email, password }),
  accept: (code: string, displayName: string, password: string) => hubRequest<HubServerStatus>(`${base}/accept-invite`, "POST", { code, displayName, password }),
  logout: () => hubRequest<HubServerStatus>(`${base}/logout`, "POST", {}),
  update: (body: HubUpdateMeBody) => hubRequest<HubServerStatus>(`${base}/me`, "PATCH", body),
  users: () => hubRequest<{ users: HubAccount[] }>(`${base}/admin/users`),
  updateUser: (id: string, body: HubUpdateUserBody) => hubRequest<HubAccount>(`${base}/admin/users/${encodeURIComponent(id)}`, "PATCH", body),
  invites: () => hubRequest<{ invites: HubInvite[] }>(`${base}/admin/invites`),
  invite: (body: HubInviteBody) => hubRequest<HubInvite>(`${base}/admin/invites`, "POST", body),
  revoke: (id: string) => hubRequest<void>(`${base}/admin/invites/${encodeURIComponent(id)}`, "DELETE"),
  syncStatus: () => hubRequest<LibrarySyncStatus>("/geo/library/sync"),
  sync: () => hubRequest<LibrarySyncResult>("/geo/library/sync", "POST", {}),
};
