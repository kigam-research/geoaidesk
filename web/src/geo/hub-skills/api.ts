/** Shared hub skill client. Installs always name one immutable revision. */
import type { HubSkill, HubSkillDetail, HubSkillRevision, RegisterSkillSource, RegisterSkillPreview, RegisterSkillBody, ReviewBody, InstallSkillPreview, InstallSkillResult } from "@/geo/contracts/hub-skills";
import { HUB_USER_HEADER, type HubComment } from "@/geo/contracts/hub-shared";
import { hubUserName } from "@/geo/hub/shared-api";
import { apiFetch } from "@/lib/projects";

const root = "/geo/hub/skills";
const sid = (id: string) => `/${encodeURIComponent(id)}`;
async function request<T>(path: string, body?: unknown, plain = false): Promise<T> {
  const headers = new Headers();
  const user = hubUserName();
  if (user) headers.set(HUB_USER_HEADER, encodeURIComponent(user));
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await apiFetch(root + path, { headers, ...(body !== undefined ? { method: "POST", body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(await response.text());
  return (plain ? response.text() : response.json()) as Promise<T>;
}
export const hubSkills = {
  list: (q = "", folder = "all") => request<{ skills: HubSkill[] }>(`?${new URLSearchParams({ q, ...(folder !== "all" ? { folder } : {}) })}`),
  detail: (id: string, revision?: number) => request<HubSkillDetail>(`${sid(id)}${revision ? `?revision=${revision}` : ""}`),
  file: (id: string, revision: number, path: string) => request<string>(`${sid(id)}/file?${new URLSearchParams({ revision: String(revision), path })}`, undefined, true),
  preview: (source: RegisterSkillSource) => request<RegisterSkillPreview>("/preview", source),
  register: (body: RegisterSkillBody) => request<HubSkill>("", body),
  review: (id: string, revision: number, body: ReviewBody) => request<HubSkillRevision>(`${sid(id)}/revisions/${revision}/review`, body),
  star: (id: string, on: boolean) => request<{ stars: number; starredByMe: boolean }>(`${sid(id)}/star`, { on }),
  comment: (id: string, body: string) => request<HubComment>(`${sid(id)}/comments`, { body }),
  installPreview: (id: string, projectId: string, revision: number) => request<InstallSkillPreview>(`${sid(id)}/install-preview`, { projectId, revision }),
  install: (id: string, projectId: string, revision: number) => request<InstallSkillResult>(`${sid(id)}/install`, { projectId, revision, acknowledged: true }),
};
