import { HubDatabase, HubServerError, hashValue, object, sha256, text, type AuditActor } from "./core.ts";
import { LIBRARY_FILE_LIMIT, type LibraryChangesResponse, type LibraryObjectKind, type LibraryPushRequest, type LibraryPushResponse } from "./protocol.ts";
interface ObjectRow { kind: LibraryObjectKind; id: string; version: number; deleted: number; data: string | null }
export class HubLibrary {
  constructor(readonly hub: HubDatabase) {}
  version(accountId: string): number {
    return this.hub.get<{ version: number }>("SELECT version FROM library_versions WHERE account_id=?", accountId)?.version ?? 0;
  }
  changes(accountId: string, since: number): LibraryChangesResponse {
    if (!Number.isSafeInteger(since) || since < 0) throw new HubServerError("서재 동기화 판 번호를 확인해 주세요.");
    // One read transaction gives changes and cursor from the same snapshot if a second process writes concurrently.
    return this.hub.tx(() => ({ version: this.version(accountId), changes: this.hub.all<ObjectRow>(
      "SELECT kind,id,version,deleted,data FROM library_objects WHERE account_id=? AND version>? ORDER BY version,kind,id", accountId, since)
      .map((r) => ({ kind: r.kind, id: r.id, version: r.version, deleted: Boolean(r.deleted), ...(r.deleted ? {} : { data: JSON.parse(r.data!) }) })) }));
  }
  push(actor: AuditActor, body: LibraryPushRequest): LibraryPushResponse {
    if (!object(body) || !Array.isArray(body.changes) || body.changes.length > 500) throw new HubServerError("서재 변경 기록은 한 번에 500개까지 보낼 수 있습니다.");
    const seen = new Set<string>();
    for (const c of body.changes) {
      if (!object(c) || !["item", "folder"].includes(c.kind) || typeof c.id !== "string" ||
          !Number.isSafeInteger(c.baseVersion) || c.baseVersion < 0 || typeof c.deleted !== "boolean" || (!c.deleted && !object(c.data)))
        throw new HubServerError("서재 변경 기록을 확인해 주세요.");
      text(c.id, "서재 식별자", 200);
      const key = JSON.stringify([c.kind, c.id]);
      if (seen.has(key)) throw new HubServerError("같은 서재 항목은 한 번만 보내세요.");
      seen.add(key);
    }
    return this.hub.tx(() => {
      const result: LibraryPushResponse = { version: this.version(actor.id), applied: [], conflicts: [] };
      for (const c of body.changes) {
        const old = this.hub.get<{ version: number }>("SELECT version FROM library_objects WHERE account_id=? AND kind=? AND id=?", actor.id, c.kind, c.id);
        const version = old?.version ?? 0;
        if (c.baseVersion !== version) { result.conflicts.push({ kind: c.kind, id: c.id, version, reason: "stale" }); continue; }
        if (c.kind === "item" && !c.deleted && this.missingFile(actor.id, c.data)) {
          result.conflicts.push({ kind: c.kind, id: c.id, version, reason: "missing-file" }); continue;
        }
        result.version++;
        this.hub.run(`INSERT INTO library_objects VALUES (?,?,?,?,?,?,?) ON CONFLICT(account_id,kind,id) DO UPDATE SET
          version=excluded.version,deleted=excluded.deleted,data=excluded.data,updated_at=excluded.updated_at`,
          actor.id, c.kind, c.id, result.version, c.deleted ? 1 : 0, c.deleted ? null : JSON.stringify(c.data), this.hub.now());
        result.applied.push({ kind: c.kind, id: c.id, version: result.version });
        this.hub.audit(actor, c.deleted ? "library.delete" : "library.write", `${c.kind}:${c.id}`, { version: result.version });
      }
      if (result.applied.length) this.hub.run("INSERT INTO library_versions VALUES (?,?) ON CONFLICT(account_id) DO UPDATE SET version=excluded.version", actor.id, result.version);
      return result;
    });
  }
  private missingFile(accountId: string, data: unknown): boolean {
    if (!object(data) || data.attachments === undefined) return false;
    if (!Array.isArray(data.attachments)) throw new HubServerError("서재 첨부 파일 목록을 확인해 주세요.");
    for (const a of data.attachments) {
      if (!object(a)) throw new HubServerError("서재 첨부 파일 정보를 확인해 주세요.");
      if (a.stored === undefined) continue;
      if (!object(a.stored)) throw new HubServerError("서재 첨부 파일 정보를 확인해 주세요.");
      hashValue(a.stored.sha256);
      const row = this.hub.get("SELECT sha256 FROM library_files WHERE account_id=? AND sha256=?", accountId, a.stored.sha256);
      if (!row) return true;
      this.hub.blob(a.stored.sha256);
    }
    return false;
  }
  hasFile(accountId: string, hash: string): boolean {
    hashValue(hash);
    return Boolean(this.hub.get("SELECT sha256 FROM library_files WHERE account_id=? AND sha256=?", accountId, hash));
  }
  file(accountId: string, hash: string): Buffer {
    if (!this.hasFile(accountId, hash)) throw new HubServerError("서재 파일을 찾을 수 없습니다.", 404);
    return this.hub.blob(hash);
  }
  putFile(actor: AuditActor, hash: string, bytes: Buffer) {
    hashValue(hash);
    if (bytes.length > LIBRARY_FILE_LIMIT) throw new HubServerError("서재 PDF는 64 MiB까지 저장할 수 있습니다.", 413);
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new HubServerError("PDF 파일만 저장할 수 있습니다.");
    this.hub.tx(() => {
      // Check before publication: invalid uploads leave no stored blob or reference.
      if (sha256(bytes) !== hash) throw new HubServerError("파일 내용과 해시가 맞지 않습니다.");
      this.hub.putBlob(bytes);
      if (this.hub.run("INSERT INTO library_files VALUES (?,?,?) ON CONFLICT(account_id,sha256) DO NOTHING", actor.id, hash, bytes.length).changes)
        this.hub.audit(actor, "library.file", hash, { size: bytes.length });
    });
  }
}
