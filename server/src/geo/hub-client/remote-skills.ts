/** `HubSkillRecordStore` over `/hub/v1/skills` (wire: server/src/geo/hub-server/protocol.ts, "Hub skill shelf"). */
import { createHash } from "node:crypto";
import type { HubComment } from "../../../../web/src/geo/contracts/hub-shared.ts";
import type { HubSkillRevision } from "../../../../web/src/geo/contracts/hub-skills.ts";
import { AuthoringError } from "../authoring/store.ts";
import type { Actor, HubRecordStore } from "../hub-shared/records.ts";
import { rememberRemoteSkills } from "../hub-skills/active.ts";
import { validName, type HubSkillRecordStore, type ReviewInput, type StoredHubSkill } from "../hub-skills/records.ts";
import type { SkillsResponse } from "../hub-server/protocol.ts";
import { HubClient, type RequestOptions } from "./client.ts";

const skillPath = (id: string) => {
  if (!validName(id)) throw new AuthoringError("스킬을 찾을 수 없습니다.", 404);
  return `/skills/${encodeURIComponent(id)}`;
};
const revisionPath = (id: string, revision: number) => {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new AuthoringError("스킬 판을 찾을 수 없습니다.", 404);
  return `${skillPath(id)}/revisions/${revision}`;
};

export class RemoteHubSkillStore implements HubSkillRecordStore {
  readonly kind = "remote" as const;
  constructor(readonly client: HubClient, readonly shared: HubRecordStore, private identity?: string,
    private queues = new Map<string, Promise<unknown>>()) {}
  forIdentity(identity: string, shared: HubRecordStore): RemoteHubSkillStore {
    return new RemoteHubSkillStore(this.client, shared, identity, this.queues);
  }
  private request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.client.request<T>(path, { ...options, ...(this.identity ? { identity: this.identity } : {}) });
  }
  async initialize(): Promise<void> { /* Network access is lazy. */ }
  serial<T>(key: string, action: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(key) ?? Promise.resolve()).then(action);
    const settled = next.catch(() => undefined);
    this.queues.set(key, settled);
    void settled.then(() => { if (this.queues.get(key) === settled) this.queues.delete(key); });
    return next;
  }
  async read(id: string): Promise<StoredHubSkill> {
    const record = await this.request<StoredHubSkill>(skillPath(id));
    rememberRemoteSkills([record]);
    return record;
  }
  async find(id: string): Promise<StoredHubSkill | null> {
    try { return await this.read(id); } catch (e) { if (e instanceof AuthoringError && e.status === 404) return null; throw e; }
  }
  async list(): Promise<StoredHubSkill[]> {
    const { skills } = await this.request<SkillsResponse>("/skills");
    rememberRemoteSkills(skills);
    return skills;
  }
  archive(id: string, revision: number): Promise<Buffer> {
    return this.request(`${revisionPath(id, revision)}/archive`, { file: true });
  }
  async publish(id: string, revision: number, bytes: Buffer, _actor: Actor): Promise<void> {
    await this.request(`${revisionPath(id, revision)}/archive`, { method: "PUT", bytes, file: true,
      headers: { "X-Content-SHA256": createHash("sha256").update(bytes).digest("hex") } });
  }
  async write(skill: StoredHubSkill, _actor: Actor): Promise<void> {
    rememberRemoteSkills([await this.request<StoredHubSkill>(skillPath(skill.id), { method: "PUT", body: skill })]);
  }
  review(id: string, revision: number, review: ReviewInput, _actor: Actor): Promise<HubSkillRevision> {
    return this.request(`${revisionPath(id, revision)}/reviews`, { method: "POST", body: review });
  }
  async comments(id: string): Promise<HubComment[]> {
    return (await this.request<{ comments: HubComment[] }>(`${skillPath(id)}/comments`)).comments;
  }
  addComment(id: string, _actor: Actor, body: string): Promise<HubComment> {
    return this.request(`${skillPath(id)}/comments`, { method: "POST", body: { body } });
  }
  async stars(id: string): Promise<Record<string, true>> {
    return (await this.request<{ stars: Record<string, true> }>(`${skillPath(id)}/stars`)).stars;
  }
  star(id: string, _actor: Actor, on: boolean): Promise<{ stars: number; starredByMe: boolean }> {
    return this.request(`${skillPath(id)}/star`, { method: "POST", body: { on } });
  }
}
