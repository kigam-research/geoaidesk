/**
 * Local (one-PC) skill shelf: the file implementation of `HubSkillRecordStore` (records.ts). Like the local Workflow store
 * it trusts its caller for authorship (display names, `X-GAID-User`); registration and review rules that a hub server
 * enforces itself are applied by register.ts and `review` here. Public reads/install helpers are re-exported from index.ts.
 */
import { randomUUID } from "node:crypto";
import { appendFile, link, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { HUB_SKILL_SCHEMA } from "../../../../web/src/geo/contracts/hub-skills.ts";
import type { HubComment } from "../../../../web/src/geo/contracts/hub-shared.ts";
import { AuthoringError, newId, now } from "../authoring/store.ts";
import type { Actor } from "../hub-shared/records.ts";
import { SharedHubStore, sharedDir } from "../hub-shared/store.ts";
import { revisionRegistrantId, validName, visibleSkill, type HubSkillRecordStore, type ReviewInput, type StoredHubSkill } from "./records.ts";

export { revisionState, validName, type StoredHubSkill } from "./records.ts";
const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === "ENOENT";

export class HubSkillStore implements HubSkillRecordStore {
  readonly kind = "local" as const;
  readonly root: string;
  readonly shared: SharedHubStore;
  constructor(root = sharedDir(), shared?: SharedHubStore) {
    this.root = resolve(root);
    this.shared = shared && shared.root === this.root ? shared : new SharedHubStore(this.root);
  }
  serial<T>(key: string, action: () => Promise<T>) { return this.shared.serial(`skills:${key}`, action); }
  async initialize() { await this.shared.initialize(); await mkdir(join(this.root, "skills"), { recursive: true }); }
  skillDir(id: string) {
    if (!validName(id)) throw new AuthoringError("스킬을 찾을 수 없습니다.", 404);
    return join(this.root, "skills", id);
  }
  packagePath(id: string, revision: number) {
    if (!Number.isSafeInteger(revision) || revision < 1) throw new AuthoringError("스킬 version을 찾을 수 없습니다.", 404);
    return join(this.skillDir(id), "packages", `${revision}.tar.gz`);
  }
  async read(id: string): Promise<StoredHubSkill> {
    try {
      const data = await this.json<{ schemaVersion: string; skill: StoredHubSkill }>(join(this.skillDir(id), "skill.json"));
      if (data.schemaVersion !== HUB_SKILL_SCHEMA || data.skill?.id !== id || !Array.isArray(data.skill.revisions))
        throw new AuthoringError("스킬 등록 기록 형식을 확인해 주세요.", 409);
      return data.skill;
    } catch (e) {
      if (missing(e)) throw new AuthoringError("스킬을 찾을 수 없습니다.", 404);
      throw e;
    }
  }
  async find(id: string) {
    try { return await this.read(id); } catch (e) { if (e instanceof AuthoringError && e.status === 404) return null; throw e; }
  }
  async list() {
    const records: StoredHubSkill[] = [];
    let dirs;
    try { dirs = await readdir(join(this.root, "skills"), { withFileTypes: true }); }
    catch (e) { if (missing(e)) return records; throw e; }
    for (const d of dirs) if (d.isDirectory() && validName(d.name)) { const record = await this.find(d.name); if (record) records.push(record); }
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }
  async write(skill: StoredHubSkill, _actor?: Actor) {
    const { mine: _mine, ...stored } = skill as StoredHubSkill & { mine?: boolean };
    await this.atomic(join(this.skillDir(skill.id), "skill.json"), { schemaVersion: HUB_SKILL_SCHEMA, skill: stored });
  }
  async review(id: string, revision: number, input: ReviewInput, actor: Actor) {
    return this.serial(id, async () => {
      const skill = await this.read(id);
      const r = skill.revisions.find((x) => x.revision === revision);
      if (!r) throw new AuthoringError("스킬 version을 찾을 수 없습니다.", 404);
      if (input.state === "checked" && revisionRegistrantId(r) === actor.id) throw new AuthoringError("등록한 사람은 같은 version을 확인함으로 바꿀 수 없습니다. 다른 연구자의 검토가 필요합니다.", 403);
      r.reviews.push({ state: input.state, by: actor.name, byId: actor.id, verified: false, at: now(), note: input.note, ...(input.replacement ? { replacement: input.replacement } : {}) });
      if (skill.latestRevision === revision) skill.state = input.state;
      skill.updatedAt = now();
      await this.write(skill);
      return r;
    });
  }
  async archive(id: string, revision: number) {
    try { return await readFile(this.packagePath(id, revision)); }
    catch (e) { if (missing(e)) throw new AuthoringError("저장된 스킬 파일을 찾을 수 없습니다.", 404); throw e; }
  }
  async publish(id: string, revision: number, bytes: Buffer, _actor?: Actor) {
    const target = this.packagePath(id, revision);
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, bytes);
    try { await link(tmp, target); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      if (!(await readFile(target)).equals(bytes)) throw new AuthoringError("스킬 version이 이미 다른 내용으로 저장되어 있습니다.", 409);
    } finally { await unlink(tmp); }
  }
  async comments(id: string): Promise<HubComment[]> {
    try { return (await readFile(join(this.skillDir(id), "comments.jsonl"), "utf8")).split("\n").filter((s) => s.trim()).map((s) => JSON.parse(s)); }
    catch (e) {
      if (missing(e)) return [];
      if (e instanceof SyntaxError) throw new AuthoringError("댓글 기록을 읽지 못했습니다. 서버 기록을 확인해 주세요.", 409);
      throw e;
    }
  }
  async addComment(id: string, actor: Actor, body: string) {
    return this.serial(id, async () => {
      const record = await this.read(id); await this.comments(id);
      // A comment must not bind to a latest revision hidden from this researcher.
      if (visibleSkill(record, actor.id)?.latestRevision !== record.latestRevision) throw new AuthoringError("최신 판의 라이선스를 확인할 수 없어 댓글을 달 수 없습니다.", 403);
      const comment: HubComment = { id: newId("comment"), entryId: id, author: actor.name, body, revision: record.latestRevision, at: now() };
      await appendFile(join(this.skillDir(id), "comments.jsonl"), JSON.stringify(comment) + "\n");
      return comment;
    });
  }
  async stars(id: string): Promise<Record<string, true>> {
    try { return await this.json(join(this.skillDir(id), "stars.json")); }
    catch (e) { if (missing(e)) return {}; throw e; }
  }
  async star(id: string, actor: Actor, on: boolean) {
    return this.serial(id, async () => {
      await this.read(id);
      const stars = Object.assign(Object.create(null) as Record<string, true>, await this.stars(id));
      if (on) stars[actor.id] = true; else delete stars[actor.id];
      await this.atomic(join(this.skillDir(id), "stars.json"), stars);
      return { stars: Object.keys(stars).length, starredByMe: Object.hasOwn(stars, actor.id) };
    });
  }
  private async json<T>(file: string): Promise<T> {
    try { return JSON.parse(await readFile(file, "utf8")); }
    catch (e) { if (e instanceof SyntaxError) throw new AuthoringError("스킬 기록을 읽지 못했습니다. 서버 기록을 확인해 주세요.", 409); throw e; }
  }
  private async atomic(file: string, data: unknown) {
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2) + "\n");
    await rename(tmp, file);
  }
}
