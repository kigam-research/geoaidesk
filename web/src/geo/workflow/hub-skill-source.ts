/** SKILL.md of a pinned hub skill revision for the Workflow view (gaid-hub-skills; `GET /geo/hub/skills/:id?revision=`). */
import { HUB_USER_HEADER } from "@/geo/contracts/hub-shared";
import type { HubSkillDetail } from "@/geo/contracts/hub-skills";
import { hubUserName } from "@/geo/hub/shared-api";
import { apiFetch } from "@/lib/projects";

export async function loadHubSkillSource(skillId: string, revision: number): Promise<{ content: string }> {
  const headers = new Headers();
  const user = hubUserName();
  if (user) headers.set(HUB_USER_HEADER, encodeURIComponent(user));
  const res = await apiFetch(`/geo/hub/skills/${encodeURIComponent(skillId)}?revision=${revision}`, { headers });
  if (!res.ok) throw new Error(`hub skill ${res.status}`);
  const detail = (await res.json()) as HubSkillDetail;
  return { content: detail.content };
}
