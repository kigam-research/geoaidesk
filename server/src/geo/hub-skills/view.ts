/** Skill views and immutable revision verification, shared by routes and Workflow integrations. */
import type { HubSkill, HubSkillRevision } from "../../../../web/src/geo/contracts/hub-skills.ts";
import { AuthoringError } from "../authoring/store.ts";
import { digest, fileList, readArchive, treeHash } from "./archive.ts";
import { shareable } from "./scan.ts";
import { HubSkillStore, revisionState, type StoredHubSkill } from "./store.ts";

export function revisionOf(skill: StoredHubSkill, revision = skill.latestRevision) {
  const r = skill.revisions.find((r) => r.revision === revision);
  if (!Number.isSafeInteger(revision) || !r) throw new AuthoringError("스킬 판을 찾을 수 없습니다.", 404);
  return r;
}
/** Visibility applies per revision too: a later licence must not expose earlier restricted files. */
export function visibleSkill(skill: StoredHubSkill, user?: string | null): StoredHubSkill | null {
  if (skill.author !== user && !shareable(revisionOf(skill).licence)) return null;
  const revisions = skill.revisions.filter((r) => skill.author === user || shareable(r.licence));
  if (!revisions.length) return null;
  const latest = revisions.at(-1)!;
  return { ...skill, revisions, latestRevision: latest.revision, description: latest.description, state: revisionState(latest), visibility: shareable(latest.licence) ? "hub" : "author" };
}
export async function requireVisible(store: HubSkillStore, id: string, user?: string | null, revision?: number) {
  const skill = visibleSkill(await store.read(id), user);
  if (!skill) throw new AuthoringError("스킬을 찾을 수 없습니다.", 404);
  revisionOf(skill, revision);
  return skill;
}
export async function skillView(store: HubSkillStore, skill: StoredHubSkill, user?: string | null): Promise<HubSkill> {
  const [stars, comments, entries] = await Promise.all([store.stars(skill.id), store.comments(skill.id), store.shared.list()]);
  const allowed = new Set(skill.revisions.map((r) => r.revision));
  const usedBy: HubSkill["usedBy"] = [];
  for (const e of entries) for (const [n, snapshot] of Object.entries(e.snapshots)) {
    const workflows = (snapshot.package.manifest as { workflows?: { schemaVersion?: string; skills?: { source?: string; hub?: { skillId: string; revision: number; treeHash: string } }[] }[] })?.workflows ?? [];
    for (const w of workflows) if (w.schemaVersion === "gaid-workflow/v1") for (const s of w.skills ?? []) {
      const pin = s.source === "hub" ? s.hub : null;
      if (!pin || pin.skillId !== skill.id || !allowed.has(pin.revision)) continue;
      if (skill.revisions.find((r) => r.revision === pin.revision)?.treeHash !== pin.treeHash) continue;
      if (!usedBy.some((u) => u.entryId === e.entry.id && u.revision === Number(n) && u.skillRevision === pin.revision))
        usedBy.push({ entryId: e.entry.id, revision: Number(n), title: e.entry.title, skillRevision: pin.revision });
    }
  }
  return { ...skill, usedBy, stars: Object.keys(stars).length, starredByMe: !!user && Object.hasOwn(stars, user), comments: comments.filter((c) => allowed.has(c.revision)).length };
}
export async function listHubSkills(store: HubSkillStore, options: { q?: string; user?: string | null } = {}): Promise<HubSkill[]> {
  const query = options.q?.trim().toLocaleLowerCase();
  const records = (await store.list()).map((s) => visibleSkill(s, options.user)).filter((s): s is StoredHubSkill => !!s)
    .filter((s) => !query || [s.name, s.description, s.author, ...s.tags, ...s.formats].join(" ").toLocaleLowerCase().includes(query));
  const views = await Promise.all(records.map((s) => skillView(store, s, options.user)));
  return views.sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}
/** Internal trusted read; HTTP callers must apply requireVisible first. No GitHub fetches. */
export async function readHubSkillRevision(store: HubSkillStore, id: string, revision: number): Promise<{ skill: HubSkill; revision: HubSkillRevision; archive: Buffer }> {
  const skill = await store.read(id);
  const r = revisionOf(skill, revision);
  const archive = await store.archive(id, r.revision);
  if (archive.length !== r.size || digest(archive) !== r.archiveSha256)
    throw new AuthoringError("저장된 스킬 압축 파일의 해시가 등록 기록과 맞지 않습니다.", 409);
  const entries = readArchive(archive, skill.name);
  const actual = fileList(entries);
  if (treeHash(entries) !== r.treeHash || JSON.stringify(actual) !== JSON.stringify([...r.files].sort((a, b) => a.path.localeCompare(b.path))))
    throw new AuthoringError("스킬 파일이 등록된 파일 목록이나 내용 지문과 맞지 않습니다.", 409);
  return { skill: await skillView(store, skill, skill.author), revision: r, archive };
}
