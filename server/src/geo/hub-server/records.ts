import { isDeepStrictEqual } from "node:util";
import type { AuthoringInstall } from "../../../../web/src/geo/contracts/authoring.ts";
import type { HubComment, HubFolder, HubRemoval } from "../../../../web/src/geo/contracts/hub-shared.ts";
import { allowedHubVersion, bumpHubVersion, hubRevisionVersions, parseHubVersion } from "../../../../web/src/geo/contracts/hub-version.ts";
import type { Actor, HubRecordStore } from "../hub-shared/records.ts";
import type { StoredEntry } from "../hub-shared/store.ts";
import { HUB_FILE_LIMIT } from "./protocol.ts";
import { entryId, filePath, hashValue, HubDatabase, HubServerError, object, sha256, text } from "./core.ts";

export class SQLiteHubStore implements HubRecordStore {
  readonly kind = "server" as const;
  private queues = new Map<string, Promise<unknown>>();
  constructor(readonly hub: HubDatabase, readonly device = "") {}
  async initialize() { /* Migrations and default folder are initialized by HubDatabase. */ }
  serial<T>(key: string, action: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(key) ?? Promise.resolve()).then(action);
    const settled = next.catch(() => {});
    this.queues.set(key, settled);
    void settled.then(() => { if (this.queues.get(key) === settled) this.queues.delete(key); });
    return next;
  }
  private audit(actor: Actor, action: string, target: string, detail?: unknown) {
    this.hub.audit({ id: actor.id, device: this.device }, action, target, detail);
  }
  async folders(): Promise<HubFolder[]> {
    return this.hub.all<{ id: string; name: string; created_by: string; created_at: string }>(
      "SELECT * FROM hub_folders ORDER BY CASE WHEN id='general' THEN 0 ELSE 1 END,created_at,id").map((r) => ({ id: r.id, name: r.name, createdBy: r.created_by, createdAt: r.created_at }));
  }
  async addFolder(value: string, actor: Actor): Promise<HubFolder> {
    const name = text(value, "폴더 이름", 80);
    return this.hub.tx(() => {
      if (this.hub.get("SELECT id FROM hub_folders WHERE name=?", name)) throw new HubServerError("같은 이름의 폴더가 있습니다.", 409);
      const folder = { id: this.hub.id("folder"), name, createdBy: actor.name, createdAt: this.hub.now() };
      this.hub.run("INSERT INTO hub_folders VALUES (?,?,?,?)", folder.id, name, actor.name, folder.createdAt);
      this.audit(actor, "folder.create", folder.id);
      return folder;
    });
  }
  private removal(id: string): HubRemoval | null {
    const row = this.hub.get<{ account_id: string; display_name: string; reason: string; at: string }>(
      "SELECT account_id,display_name,reason,at FROM hub_entry_removals WHERE entry_id=?", id);
    return row ? { at: row.at, by: row.display_name, byId: row.account_id, reason: row.reason } : null;
  }
  /** `includeRemoved`: ownership checks and the removed list; every other read treats a removed entry as missing. */
  private findSync(id: string, includeRemoved = false): StoredEntry | null {
    entryId(id);
    if (!includeRemoved && this.removal(id)) return null;
    const row = this.hub.get<{ record: string }>("SELECT record FROM hub_entries WHERE id=?", id);
    if (!row) return null;
    const record = JSON.parse(row.record) as StoredEntry;
    // The author's current authenticated ORCID iD (gaid-orcid phase 2), never taken from the stored record.
    delete record.entry.authorOrcid;
    const orcid = record.entry.authorId ? this.hub.get<{ orcid: string; environment: "production" | "sandbox" }>(
      "SELECT orcid, environment FROM account_orcid WHERE account_id=?", record.entry.authorId) : undefined;
    if (orcid) record.entry.authorOrcid = { id: orcid.orcid, environment: orcid.environment };
    record.installs = this.hub.all<{ record: string }>("SELECT record FROM hub_installs WHERE entry_id=? ORDER BY at,id", id).map((r) => JSON.parse(r.record));
    return record;
  }
  async read(id: string): Promise<StoredEntry> {
    const row = this.findSync(id);
    if (!row) throw new HubServerError("등록한 Workflow를 찾을 수 없습니다.", 404);
    return row;
  }
  async find(id: string): Promise<StoredEntry | null> { return this.findSync(id); }
  async list(): Promise<StoredEntry[]> {
    return this.hub.all<{ id: string }>("SELECT id FROM hub_entries WHERE id NOT IN (SELECT entry_id FROM hub_entry_removals) ORDER BY updated_at DESC,id").map((r) => this.findSync(r.id)!);
  }
  async remove(id: string, actor: Actor, value: string): Promise<void> {
    const reason = text(value ?? "", "제거 사유", 500, true);
    this.hub.tx(() => {
      const record = this.findSync(id, true);
      if (!record) throw new HubServerError("등록한 Workflow를 찾을 수 없습니다.", 404);
      if (record.entry.authorId !== actor.id && !actor.admin) throw new HubServerError("등록한 연구자나 관리자만 Workflow를 허브에서 제거할 수 있습니다.", 403);
      if (this.removal(id)) throw new HubServerError("이미 허브에서 제거한 Workflow입니다.", 409);
      this.hub.run("INSERT INTO hub_entry_removals VALUES (?,?,?,?,?)", id, actor.id, actor.name, reason, this.hub.now());
      this.audit(actor, "entry.remove", id, { reason, revision: record.entry.latestRevision });
    });
  }
  async removed(actor: Actor | null): Promise<StoredEntry[]> {
    if (!actor?.admin) return [];
    return this.hub.all<{ entry_id: string }>("SELECT entry_id FROM hub_entry_removals ORDER BY at DESC,entry_id").map((r) => {
      const record = this.findSync(r.entry_id, true)!;
      record.entry.removed = this.removal(r.entry_id)!;
      return record;
    });
  }
  async restore(id: string, actor: Actor): Promise<StoredEntry> {
    return this.hub.tx(() => {
      if (!actor.admin) throw new HubServerError("관리자만 제거한 Workflow를 복원할 수 있습니다.", 403);
      if (!this.findSync(id, true)) throw new HubServerError("등록한 Workflow를 찾을 수 없습니다.", 404);
      if (!this.removal(id)) throw new HubServerError("제거한 Workflow가 아닙니다.", 404);
      this.hub.run("DELETE FROM hub_entry_removals WHERE entry_id=?", id);
      this.audit(actor, "entry.restore", id);
      return this.findSync(id)!;
    });
  }
  private checkOwner(id: string, actor: Actor) {
    const record = this.findSync(id, true);
    if (record && this.removal(id)) throw new HubServerError("허브에서 제거한 Workflow입니다. 관리자가 복원한 뒤에 새 version을 등록할 수 있습니다.", 409);
    if (record && record.entry.authorId !== actor.id) throw new HubServerError("등록한 연구자만 Workflow를 바꿀 수 있습니다.", 403);
    if (!record && this.hub.get("SELECT entry_id FROM hub_files WHERE entry_id=? AND uploader_id<>? LIMIT 1", id, actor.id))
      throw new HubServerError("다른 연구자가 등록을 준비하는 Workflow입니다.", 403);
    return record;
  }
  async write(input: StoredEntry, actor: Actor): Promise<void> {
    if (!object(input) || input.schemaVersion !== "gaid-hub-entry/v1" || !object(input.entry) || !object(input.snapshots))
      throw new HubServerError("등록 기록 형식을 확인해 주세요.");
    entryId(input.entry.id);
    const record = structuredClone(input);
    const e = record.entry;
    text(record.authoringProjectId, "초안 식별자", 80);
    for (const key of ["methodId", "slug", "title", "summary", "folderId", "updatedAt"] as const)
      text(e[key], "등록 정보", key === "summary" ? 12000 : 300);
    if (!["workflow", "skill"].includes(e.kind) || !Array.isArray(e.tags) || e.tags.length > 100 ||
        e.tags.some((v) => typeof v !== "string" || v.length > 300) || !Number.isSafeInteger(e.latestRevision) ||
        e.latestRevision < 1 || !Array.isArray(e.revisions) || e.revisions.length !== e.latestRevision ||
        Object.keys(record.snapshots).length !== e.latestRevision || !Number.isFinite(Date.parse(e.updatedAt)))
      throw new HubServerError("등록 판과 메타데이터를 확인해 주세요.", 409);
    this.hub.tx(() => {
      const previous = this.checkOwner(e.id, actor);
      if (!this.hub.get("SELECT id FROM hub_folders WHERE id=?", e.folderId)) throw new HubServerError("주제 폴더를 찾을 수 없습니다.", 404);
      const oldN = previous?.entry.latestRevision ?? 0;
      if ((!previous && e.latestRevision !== 1) || (previous && e.latestRevision !== oldN && e.latestRevision !== oldN + 1))
        throw new HubServerError("바로 다음 판만 등록할 수 있습니다.", 409);
      if (previous) {
        if (!isDeepStrictEqual(e.basedOn, previous.entry.basedOn)) throw new HubServerError("원본 관계는 바꿀 수 없습니다.", 409);
        if (!isDeepStrictEqual(e.revisions.slice(0, oldN), previous.entry.revisions) ||
            Array.from({ length: oldN }, (_, i) => String(i + 1)).some((n) => !isDeepStrictEqual(record.snapshots[n], previous.snapshots[n])))
          throw new HubServerError("이전 판의 기록과 파일 정보는 바꿀 수 없습니다.", 409);
      }
      for (let n = 1; n <= e.latestRevision; n++) {
        const snapshot = record.snapshots[String(n)];
        const revision = e.revisions[n - 1];
        if (!object(snapshot) || !object(snapshot.draft) || !object(snapshot.package) || !object(snapshot.visuals) ||
            !object(revision) || revision.revision !== n || typeof revision.note !== "string" || revision.note.length > 16000)
          throw new HubServerError("등록 판의 내용이 올바르지 않습니다.", 409);
        const pkg = snapshot.package;
        hashValue(pkg.sha256);
        if (revision.packageSha256 !== pkg.sha256 || revision.packageDigest !== pkg.packageDigest ||
            revision.packageRevision !== pkg.revision || revision.draftRevision !== snapshot.draft.revision ||
            !Number.isSafeInteger(pkg.size) || pkg.size < 0 || pkg.size > HUB_FILE_LIMIT)
          throw new HubServerError("등록 판과 패키지 정보가 맞지 않습니다.", 409);
        const checkFile = (file: string, expected?: string, expectedSize?: number) => {
          filePath(file);
          const stored = this.hub.get<{ sha256: string; size: number }>("SELECT sha256,size FROM hub_files WHERE entry_id=? AND path=?", e.id, file);
          if (!stored || (expected !== undefined && stored.sha256 !== expected) || (expectedSize !== undefined && stored.size !== expectedSize))
            throw new HubServerError("등록 판에 필요한 파일이 없거나 해시가 맞지 않습니다.", 409);
          // An existing row with a lost/corrupted blob is not a publishable snapshot.
          this.hub.blob(stored.sha256);
        };
        checkFile(`packages/${n}.tar.gz`, pkg.sha256, pkg.size);
        for (const visual of Object.values(snapshot.visuals)) {
          if (!object(visual) || typeof visual.file !== "string" || !visual.file.startsWith(`visuals/${n}/`) ||
              typeof visual.caption !== "string" || typeof visual.mediaType !== "string") throw new HubServerError("등록 그림 정보를 확인해 주세요.", 409);
          checkFile(visual.file);
          if (visual.dark !== undefined) {
            if (!object(visual.dark) || typeof visual.dark.file !== "string" || !visual.dark.file.startsWith(`visuals/${n}/`))
              throw new HubServerError("어두운 화면용 그림 정보를 확인해 주세요.", 409);
            checkFile(visual.dark.file);
          }
        }
        if (n > oldN) {
          // gaid-hub-versions: the first registration is 0.1.0, each update one patch/minor/major step; a client from before
          // versions sends none and gets the patch step.
          const before = n === 1 ? null : hubRevisionVersions(e.revisions.slice(0, n - 1)).at(-1)!;
          if (revision.version === undefined) revision.version = before === null ? "0.1.0" : bumpHubVersion(before, "patch");
          if (!parseHubVersion(revision.version) || !allowedHubVersion(before, revision.version))
            throw new HubServerError("version은 처음 등록이 0.1.0이고, 다음 등록은 바로 다음 patch, minor 또는 major version이어야 합니다.", 409);
          revision.registeredBy = actor.name;
          revision.registeredById = actor.id;
          revision.registeredAt = this.hub.now();
        }
      }
      e.author = actor.name;
      e.authorId = actor.id;
      e.updatedAt = this.hub.now();
      // Views and installs are not authoritative metadata from a client.
      for (const key of ["mine", "stars", "starredByMe", "comments", "trials", "implementation", "authorOrcid"]) delete (e as unknown as Record<string, unknown>)[key];
      const { installs: _ignored, ...stored } = record;
      this.hub.run(`INSERT INTO hub_entries VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record,updated_at=excluded.updated_at`,
        e.id, JSON.stringify(stored), actor.id, e.updatedAt);
      this.audit(actor, "entry.write", e.id, { revision: e.latestRevision });
    });
  }
  async recordInstall(id: string, install: AuthoringInstall, actor: Actor): Promise<void> {
    if (!object(install) || !Number.isSafeInteger(install.packageRevision) || install.packageRevision < 1 ||
        typeof install.installedAt !== "string" || !Number.isFinite(Date.parse(install.installedAt))) throw new HubServerError("설치 기록을 확인해 주세요.");
    text(install.projectId, "프로젝트 식별자", 200);
    text(install.methodKey, "Workflow 식별자", 300);
    this.hub.tx(() => {
      const record = this.findSync(id);
      if (!record) throw new HubServerError("등록한 Workflow를 찾을 수 없습니다.", 404);
      if (!Object.values(record.snapshots).some((s) => s.package.revision === install.packageRevision))
        throw new HubServerError("설치한 판을 찾을 수 없습니다.", 409);
      const value = JSON.stringify({ packageRevision: install.packageRevision, projectId: install.projectId,
        methodKey: install.methodKey, installedAt: install.installedAt });
      const key = `install-${sha256(`${id}\n${actor.id}\n${value}`)}`;
      if (this.hub.run("INSERT INTO hub_installs VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING", key, id, actor.id, value, install.installedAt).changes)
        this.audit(actor, "entry.install", id, { packageRevision: install.packageRevision });
    });
  }
  async bytes(id: string, file: string): Promise<Buffer> {
    entryId(id); filePath(file);
    // Staged uploads are not exposed until their record is published.
    await this.read(id);
    const row = this.hub.get<{ sha256: string }>("SELECT sha256 FROM hub_files WHERE entry_id=? AND path=?", id, file);
    if (!row) throw new HubServerError("등록 파일을 찾을 수 없습니다.", 404);
    return this.hub.blob(row.sha256);
  }
  async immutableBytes(id: string, file: string, bytes: Buffer, actor: Actor): Promise<void> {
    entryId(id); filePath(file);
    if (bytes.length > HUB_FILE_LIMIT) throw new HubServerError("등록 파일은 20 MiB까지 저장할 수 있습니다.", 413);
    if (file.startsWith("visuals/") && file.split("/").at(-1)!.split(".")[0] !== sha256(bytes))
      throw new HubServerError("그림 파일 이름과 해시가 맞지 않습니다.");
    this.hub.tx(() => {
      this.checkOwner(id, actor);
      const row = this.hub.get<{ sha256: string }>("SELECT sha256 FROM hub_files WHERE entry_id=? AND path=?", id, file);
      const hash = sha256(bytes);
      if (row && row.sha256 !== hash) throw new HubServerError("등록 파일이 이미 다른 내용으로 저장되어 있습니다.", 409);
      this.hub.putBlob(bytes);
      if (!row) {
        this.hub.run("INSERT INTO hub_files VALUES (?,?,?,?,?)", id, file, hash, bytes.length, actor.id);
        this.audit(actor, "entry.file", id, { path: file, sha256: hash, size: bytes.length });
      }
    });
  }
  async comments(id: string): Promise<HubComment[]> {
    await this.read(id);
    return this.hub.all<{ record: string }>("SELECT record FROM hub_comments WHERE entry_id=? ORDER BY at,id", id).map((r) => JSON.parse(r.record));
  }
  async addComment(id: string, actor: Actor, value: string): Promise<HubComment> {
    const body = text(value, "댓글", 4000);
    return this.hub.tx(() => {
      const entry = this.findSync(id);
      if (!entry) throw new HubServerError("등록한 Workflow를 찾을 수 없습니다.", 404);
      const comment = { id: this.hub.id("comment"), entryId: id, author: actor.name, authorId: actor.id,
        body, revision: entry.entry.latestRevision, at: this.hub.now() };
      this.hub.run("INSERT INTO hub_comments VALUES (?,?,?,?,?)", comment.id, id, actor.id, JSON.stringify(comment), comment.at);
      this.audit(actor, "entry.comment", id, { commentId: comment.id });
      return comment;
    });
  }
  async stars(id: string): Promise<Record<string, true>> {
    await this.read(id);
    return Object.fromEntries(this.hub.all<{ account_id: string }>("SELECT account_id FROM hub_stars WHERE entry_id=? ORDER BY account_id", id).map((r) => [r.account_id, true]));
  }
  async star(id: string, actor: Actor, on: boolean) {
    if (typeof on !== "boolean") throw new HubServerError("별표 상태를 선택해 주세요.");
    return this.hub.tx(() => {
      if (!this.findSync(id)) throw new HubServerError("등록한 Workflow를 찾을 수 없습니다.", 404);
      if (on) this.hub.run("INSERT INTO hub_stars VALUES (?,?,?) ON CONFLICT(entry_id,account_id) DO NOTHING", id, actor.id, actor.name);
      else this.hub.run("DELETE FROM hub_stars WHERE entry_id=? AND account_id=?", id, actor.id);
      this.audit(actor, "entry.star", id, { on });
      return { stars: this.hub.get<{ n: number }>("SELECT COUNT(*) AS n FROM hub_stars WHERE entry_id=?", id)!.n, starredByMe: on };
    });
  }
}
