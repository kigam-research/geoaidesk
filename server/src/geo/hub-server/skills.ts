/** Account-scoped skill shelf. All authoritative mutations run in synchronous SQLite transactions. */
import type { HubComment } from "../../../../web/src/geo/contracts/hub-shared.ts";
import type { Actor } from "../hub-shared/records.ts";
import { revisionRegistrantId, revisionState, shareable, skillOwnerId, validName, visibleSkill,
  type HubSkillRecordStore, type ReviewInput, type StoredHubSkill } from "../hub-skills/records.ts";
import { hashValue, HubDatabase, HubServerError, object, sha256, text } from "./core.ts";
import { HUB_FILE_LIMIT } from "./protocol.ts";
import { SQLiteHubStore } from "./records.ts";

function skillId(id: unknown): asserts id is string {
  if (!validName(id)) throw new HubServerError("스킬 이름을 확인해 주세요.", 400);
}
function revisionNumber(n: number) {
  if (!Number.isSafeInteger(n) || n < 1) throw new HubServerError("스킬 판을 찾을 수 없습니다.", 404);
}
/** One permission seam for a future reviewer role; currently every account that sees a revision may review it. */
function checkReviewPermission(skill: StoredHubSkill, revision: number, actor: Actor, state: ReviewInput["state"]) {
  const r = visibleSkill(skill, actor.id)?.revisions.find((r) => r.revision === revision);
  if (!r) throw new HubServerError("스킬 판을 찾을 수 없습니다.", 404);
  if (state === "checked" && revisionRegistrantId(r) === actor.id)
    throw new HubServerError("등록한 사람은 같은 판을 확인함으로 바꿀 수 없습니다. 다른 연구자의 검토가 필요합니다.", 403);
  return r;
}

export class SQLiteHubSkillStore implements HubSkillRecordStore {
  readonly kind = "server" as const;
  readonly shared: SQLiteHubStore;
  constructor(readonly hub: HubDatabase, readonly actor: Actor, readonly device = "") {
    this.shared = new SQLiteHubStore(hub, device);
  }
  async initialize() { /* HubDatabase applies migrations. */ }
  serial<T>(key: string, action: () => Promise<T>) { return this.shared.serial(`skills:${key}`, action); }
  private audit(actor: Actor, action: string, id: string, detail?: unknown) {
    this.hub.audit({ id: actor.id, device: this.device }, `skill.${action}`, id, detail);
  }
  private checkActor(actor: Actor) {
    if (actor.id !== this.actor.id) throw new HubServerError("요청한 계정을 확인해 주세요.", 403);
  }
  private findSync(id: string): StoredHubSkill | null {
    skillId(id);
    const row = this.hub.get<{ record: string }>("SELECT record FROM hub_skills WHERE id=?", id);
    return row ? JSON.parse(row.record) : null;
  }
  private visible(id: string): StoredHubSkill {
    const skill = this.findSync(id);
    const shown = skill && visibleSkill(skill, this.actor.id);
    if (!shown) throw new HubServerError("스킬을 찾을 수 없습니다.", 404);
    return shown;
  }
  async read(id: string) { return this.visible(id); }
  async find(id: string) {
    const skill = this.findSync(id);
    return skill ? visibleSkill(skill, this.actor.id) : null;
  }
  async list() {
    return this.hub.all<{ record: string }>("SELECT record FROM hub_skills ORDER BY updated_at DESC,id")
      .map((r) => visibleSkill(JSON.parse(r.record), this.actor.id)).filter((s): s is StoredHubSkill => !!s);
  }
  async archive(id: string, revision: number) {
    revisionNumber(revision);
    if (!this.visible(id).revisions.some((r) => r.revision === revision)) throw new HubServerError("스킬 판을 찾을 수 없습니다.", 404);
    const row = this.hub.get<{ sha256: string }>("SELECT sha256 FROM hub_skill_archives WHERE skill_id=? AND revision=?", id, revision);
    if (!row) throw new HubServerError("저장된 스킬 파일을 찾을 수 없습니다.", 404);
    return this.hub.blob(row.sha256);
  }
  private checkOwner(id: string, actor: Actor) {
    this.checkActor(actor);
    const skill = this.findSync(id);
    if (skill && skillOwnerId(skill) !== actor.id) throw new HubServerError("등록한 연구자만 새 판을 등록할 수 있습니다.", 403);
    if (!skill && this.hub.get("SELECT skill_id FROM hub_skill_archives WHERE skill_id=? AND uploader_id<>? LIMIT 1", id, actor.id))
      throw new HubServerError("다른 연구자가 등록을 준비하는 스킬입니다.", 403);
    return skill;
  }
  async publish(id: string, revision: number, bytes: Buffer, actor: Actor) {
    skillId(id); revisionNumber(revision);
    if (!Buffer.isBuffer(bytes)) throw new HubServerError("스킬 압축 파일을 보내세요.");
    if (bytes.length > HUB_FILE_LIMIT) throw new HubServerError("스킬 압축 파일은 20 MiB까지 저장할 수 있습니다.", 413);
    this.hub.tx(() => {
      this.checkOwner(id, actor);
      const row = this.hub.get<{ sha256: string }>("SELECT sha256 FROM hub_skill_archives WHERE skill_id=? AND revision=?", id, revision);
      const hash = sha256(bytes);
      if (row && row.sha256 !== hash) throw new HubServerError("스킬 판이 이미 다른 내용으로 저장되어 있습니다.", 409);
      this.hub.putBlob(bytes);
      if (!row) {
        this.hub.run("INSERT INTO hub_skill_archives VALUES (?,?,?,?,?)", id, revision, hash, bytes.length, actor.id);
        this.audit(actor, "archive", id, { revision, sha256: hash, size: bytes.length });
      }
    });
  }
  async write(input: StoredHubSkill, actor: Actor) {
    if (!object(input)) throw new HubServerError("스킬 등록 기록을 확인해 주세요.");
    skillId(input.id);
    if (input.name !== input.id || !Number.isSafeInteger(input.latestRevision) || input.latestRevision < 1 ||
        !Array.isArray(input.revisions) || input.revisions.length !== input.latestRevision)
      throw new HubServerError("스킬 등록 판을 확인해 주세요.", 409);
    for (const values of [input.tags, input.formats]) {
      if (!Array.isArray(values) || values.length > 40 || values.some((v) => typeof v !== "string" || !v.trim() || v.length > 100))
        throw new HubServerError("스킬 태그와 자료 형식을 확인해 주세요.");
    }
    text(input.folderId, "주제 폴더", 300);
    const skill = structuredClone(input);
    this.hub.tx(() => {
      const old = this.checkOwner(skill.id, actor);
      const n = (old?.latestRevision ?? 0) + 1;
      if (skill.latestRevision !== n) throw new HubServerError("바로 다음 스킬 판만 등록할 수 있습니다.", 409);
      if (!this.hub.get("SELECT id FROM hub_folders WHERE id=?", skill.folderId)) throw new HubServerError("주제 폴더를 찾을 수 없습니다.", 404);
      const r = skill.revisions[n - 1];
      if (!object(r) || r.revision !== n || !object(r.licence) || !["institute", "declared", "restricted", "unknown"].includes(r.licence.state) ||
          !object(r.origin) || !["own", "workflow", "github"].includes(r.origin.kind) || !Array.isArray(r.files) || !Array.isArray(r.findings) ||
          !Number.isSafeInteger(r.size) || r.size < 0 || r.size > HUB_FILE_LIMIT)
        throw new HubServerError("스킬 판의 내용을 확인해 주세요.", 409);
      hashValue(r.archiveSha256); hashValue(r.treeHash);
      text(r.description, "스킬 설명", 12000, true);
      text(r.note, "바뀐 점", 4000, true);
      for (const f of r.files) {
        if (!object(f) || typeof f.path !== "string" || !f.path || !Number.isSafeInteger(f.size) || f.size < 0)
          throw new HubServerError("스킬 파일 정보를 확인해 주세요.", 409);
        hashValue(f.sha256);
      }
      const archive = this.hub.get<{ sha256: string; size: number }>("SELECT sha256,size FROM hub_skill_archives WHERE skill_id=? AND revision=?", skill.id, n);
      if (!archive || archive.sha256 !== r.archiveSha256 || archive.size !== r.size)
        throw new HubServerError("스킬 압축 파일이 없거나 해시 또는 크기가 맞지 않습니다.", 409);
      let bytes: Buffer;
      try { bytes = this.hub.blob(archive.sha256); }
      catch (e) {
        if (e instanceof HubServerError && e.status === 404) throw new HubServerError("스킬 압축 파일을 찾을 수 없습니다.", 409);
        throw e;
      }
      if (bytes.length !== r.size) throw new HubServerError("스킬 압축 파일 크기가 맞지 않습니다.", 409);
      const at = this.hub.now();
      r.registeredBy = actor.name; r.registeredById = actor.id; r.registeredAt = at; r.reviews = [];
      skill.revisions = [...(old?.revisions ?? []), r];
      skill.author = old?.author ?? actor.name; skill.authorId = actor.id;
      skill.updatedAt = at; skill.description = r.description; skill.state = revisionState(r); skill.visibility = shareable(r.licence) ? "hub" : "author";
      for (const key of ["mine", "usedBy", "stars", "starredByMe", "comments"]) delete (skill as unknown as Record<string, unknown>)[key];
      this.persist(skill);
      this.audit(actor, "write", skill.id, { revision: n });
    });
  }
  private persist(skill: StoredHubSkill) {
    this.hub.run("INSERT INTO hub_skills VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record,updated_at=excluded.updated_at",
      skill.id, JSON.stringify(skill), skillOwnerId(skill), skill.updatedAt);
  }
  async review(id: string, revision: number, input: ReviewInput, actor: Actor) {
    this.checkActor(actor); revisionNumber(revision);
    if (!object(input) || !["checked", "deprecated", "suspended"].includes(input.state)) throw new HubServerError("검토 상태를 선택해 주세요.");
    const note = text(input.note, "검토 내용", 4000);
    if (input.replacement !== undefined && (input.state !== "deprecated" || !validName(input.replacement) || input.replacement === id))
      throw new HubServerError("대신 쓸 허브 스킬을 확인해 주세요.");
    return this.hub.tx(() => {
      const skill = this.findSync(id);
      if (!skill) throw new HubServerError("스킬을 찾을 수 없습니다.", 404);
      checkReviewPermission(skill, revision, actor, input.state);
      if (input.replacement !== undefined && !this.findSync(input.replacement)) throw new HubServerError("대신 쓸 허브 스킬을 확인해 주세요.");
      const r = skill.revisions.find((r) => r.revision === revision)!;
      const at = this.hub.now();
      r.reviews.push({ state: input.state, by: actor.name, byId: actor.id, verified: true, at, note,
        ...(input.replacement ? { replacement: input.replacement } : {}) });
      skill.state = revisionState(skill.revisions.at(-1)!); skill.updatedAt = at;
      this.persist(skill);
      this.audit(actor, "review", id, { revision, state: input.state });
      return r;
    });
  }
  async comments(id: string): Promise<HubComment[]> {
    const visible = this.visible(id);
    const revisions = new Set(visible.revisions.map((r) => r.revision));
    return this.hub.all<{ record: string }>("SELECT record FROM hub_skill_comments WHERE skill_id=? ORDER BY at,id", id)
      .map((r) => JSON.parse(r.record) as HubComment).filter((c) => revisions.has(c.revision));
  }
  async addComment(id: string, actor: Actor, value: string): Promise<HubComment> {
    this.checkActor(actor);
    const body = text(value, "댓글", 4000);
    return this.hub.tx(() => {
      const skill = this.findSync(id);
      if (!skill) throw new HubServerError("스킬을 찾을 수 없습니다.", 404);
      if (!visibleSkill(skill, actor.id)) throw new HubServerError("이 스킬 판에는 댓글을 남길 수 없습니다.", 403);
      const comment = { id: this.hub.id("comment"), entryId: id, author: actor.name, authorId: actor.id,
        body, revision: skill.latestRevision, at: this.hub.now() };
      this.hub.run("INSERT INTO hub_skill_comments VALUES (?,?,?,?,?)", comment.id, id, actor.id, JSON.stringify(comment), comment.at);
      this.audit(actor, "comment", id, { commentId: comment.id });
      return comment;
    });
  }
  async stars(id: string): Promise<Record<string, true>> {
    this.visible(id);
    return Object.fromEntries(this.hub.all<{ account_id: string }>("SELECT account_id FROM hub_skill_stars WHERE skill_id=? ORDER BY account_id", id).map((r) => [r.account_id, true]));
  }
  async star(id: string, actor: Actor, on: boolean) {
    this.checkActor(actor);
    if (typeof on !== "boolean") throw new HubServerError("별표 상태를 선택해 주세요.");
    return this.hub.tx(() => {
      this.visible(id);
      if (on) this.hub.run("INSERT INTO hub_skill_stars VALUES (?,?,?) ON CONFLICT(skill_id,account_id) DO NOTHING", id, actor.id, actor.name);
      else this.hub.run("DELETE FROM hub_skill_stars WHERE skill_id=? AND account_id=?", id, actor.id);
      this.audit(actor, "star", id, { on });
      return { stars: this.hub.get<{ n: number }>("SELECT COUNT(*) AS n FROM hub_skill_stars WHERE skill_id=?", id)!.n, starredByMe: on };
    });
  }
}
