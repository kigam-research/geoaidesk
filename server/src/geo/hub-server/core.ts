/** Standalone hub storage. No imports from the researcher's config, credentials or agent runtime. */
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export class HubServerError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export interface HubServerOptions {
  home: string;
  now?: () => Date | string | number;
  random?: (size: number) => Buffer;
}
export interface AuditActor { id: string; device?: string }
export const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
export const HASH = /^[a-f0-9]{64}$/;
export const ENTRY_ID = /^[a-z0-9][a-z0-9-]{5,79}$/;
export const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export function text(v: unknown, label: string, max: number, empty = false): string {
  if (typeof v !== "string") throw new HubServerError(`${label}을(를) 확인해 주세요.`);
  const out = v.trim();
  if ((!empty && !out) || [...out].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(out))
    throw new HubServerError(`${label}을(를) 확인해 주세요.`);
  return out;
}
export function entryId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !ENTRY_ID.test(id)) throw new HubServerError("등록 식별자가 올바르지 않습니다.", 400);
}
export function filePath(file: unknown): asserts file is string {
  if (typeof file !== "string" || file.length > 512 ||
      !/^(?:packages\/[1-9][0-9]*\.tar\.gz|visuals\/[1-9][0-9]*\/[a-f0-9]{64}\.(?:png|jpg|jpeg|webp|gif))$/.test(file))
    throw new HubServerError("등록 파일 경로를 확인해 주세요.");
}
export function hashValue(value: unknown): asserts value is string {
  if (typeof value !== "string" || !HASH.test(value)) throw new HubServerError("파일 해시를 확인해 주세요.");
}

/** Resolve existing symlinks as well as the lexical path before creating any data. */
export function dataHome(input: string): string {
  const absolute = resolve(input);
  let ancestor = absolute;
  const tail: string[] = [];
  while (!existsSync(ancestor)) {
    tail.unshift(basename(ancestor));
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  const real = resolve(realpathSync(ancestor), ...tail);
  for (const candidate of [absolute, real]) {
    let at = candidate;
    for (;;) {
      if (existsSync(join(at, ".git"))) throw new HubServerError("허브 데이터는 Git 저장소 밖에 저장해야 합니다.");
      const parent = dirname(at);
      if (parent === at) break;
      at = parent;
    }
  }
  return real;
}

const MIGRATIONS = [
  { version: 1, sql: `
CREATE TABLE accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','member')), password TEXT NOT NULL, created_at TEXT NOT NULL, disabled_at TEXT);
CREATE TABLE sessions (token_sha256 TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), device TEXT NOT NULL,
 created_at TEXT NOT NULL, last_used TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX sessions_account ON sessions(account_id);
CREATE TABLE invites (id TEXT PRIMARY KEY, code_sha256 TEXT NOT NULL UNIQUE, email TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','member')), created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL, used_at TEXT, account_id TEXT REFERENCES accounts(id));
CREATE TABLE audit_events (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL,
 detail TEXT NOT NULL, device TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE login_failures (email TEXT NOT NULL, ip TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX login_failures_email ON login_failures(email, at);
CREATE INDEX login_failures_ip ON login_failures(ip, at);
CREATE TABLE hub_folders (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE hub_entries (id TEXT PRIMARY KEY, record TEXT NOT NULL, author_id TEXT NOT NULL REFERENCES accounts(id), updated_at TEXT NOT NULL);
-- Files can be uploaded before publishing the first record. uploader_id reserves an unpublished entry for its author.
CREATE TABLE hub_files (entry_id TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL,
 uploader_id TEXT NOT NULL REFERENCES accounts(id), PRIMARY KEY(entry_id, path));
CREATE TABLE hub_stars (entry_id TEXT NOT NULL REFERENCES hub_entries(id), account_id TEXT NOT NULL, display_name TEXT NOT NULL,
 PRIMARY KEY(entry_id, account_id));
CREATE TABLE hub_comments (id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES hub_entries(id), account_id TEXT NOT NULL,
 record TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE hub_installs (id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES hub_entries(id), account_id TEXT NOT NULL,
 record TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE library_versions (account_id TEXT PRIMARY KEY REFERENCES accounts(id), version INTEGER NOT NULL);
CREATE TABLE library_objects (account_id TEXT NOT NULL REFERENCES accounts(id), kind TEXT NOT NULL CHECK(kind IN ('item','folder')),
 id TEXT NOT NULL, version INTEGER NOT NULL, deleted INTEGER NOT NULL, data TEXT, updated_at TEXT NOT NULL,
 PRIMARY KEY(account_id,kind,id));
CREATE INDEX library_objects_version ON library_objects(account_id,version);
CREATE TABLE library_files (account_id TEXT NOT NULL REFERENCES accounts(id), sha256 TEXT NOT NULL, size INTEGER NOT NULL,
 PRIMARY KEY(account_id,sha256));
CREATE TABLE hub_imports (source TEXT NOT NULL, entry_id TEXT NOT NULL, digest TEXT NOT NULL, at TEXT NOT NULL,
 PRIMARY KEY(source,entry_id));
` },
  { version: 2, sql: `
CREATE TABLE hub_skills (id TEXT PRIMARY KEY, record TEXT NOT NULL, author_id TEXT NOT NULL REFERENCES accounts(id), updated_at TEXT NOT NULL);
-- A first upload reserves the entire unpublished skill id for its uploader.
CREATE TABLE hub_skill_archives (skill_id TEXT NOT NULL, revision INTEGER NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL,
 uploader_id TEXT NOT NULL REFERENCES accounts(id), PRIMARY KEY(skill_id,revision));
CREATE TABLE hub_skill_stars (skill_id TEXT NOT NULL REFERENCES hub_skills(id), account_id TEXT NOT NULL, display_name TEXT NOT NULL,
 PRIMARY KEY(skill_id,account_id));
CREATE TABLE hub_skill_comments (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES hub_skills(id), account_id TEXT NOT NULL,
 record TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE hub_skill_imports (source TEXT NOT NULL, skill_id TEXT NOT NULL, digest TEXT NOT NULL, at TEXT NOT NULL,
 PRIMARY KEY(source,skill_id));
` },
  { version: 3, sql: `
CREATE TABLE feed_sources (id TEXT PRIMARY KEY, record TEXT NOT NULL, last_success TEXT);
CREATE TABLE feed_items (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES feed_sources(id), record TEXT NOT NULL,
 published_at TEXT, fetched_at TEXT NOT NULL, sort_at TEXT NOT NULL);
-- sort_at: publishedAt; undated items from a source's first collection sort below every dated item (backfill), later
-- undated items by the time they were first collected.
CREATE INDEX feed_items_source_time ON feed_items(source_id,sort_at DESC);
` },
  // gaid-orcid phase 2: authenticated ORCID iD per account (one account per iD and environment), single-use sign-in states.
  { version: 4, sql: `
CREATE TABLE account_orcid (account_id TEXT PRIMARY KEY REFERENCES accounts(id), orcid TEXT NOT NULL,
 environment TEXT NOT NULL CHECK(environment IN ('production','sandbox')), name TEXT, authenticated_at TEXT NOT NULL,
 UNIQUE(orcid, environment));
CREATE TABLE orcid_states (state_sha256 TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), nonce TEXT NOT NULL,
 redirect_uri TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
` },
];
export const HUB_TABLES = ["schema_migrations", "accounts", "sessions", "invites", "audit_events", "login_failures",
  "hub_folders", "hub_entries", "hub_files", "hub_stars", "hub_comments", "hub_installs", "library_versions",
  "library_objects", "library_files", "hub_imports", "hub_skills", "hub_skill_archives", "hub_skill_stars", "hub_skill_comments", "hub_skill_imports", "feed_sources", "feed_items", "account_orcid", "orcid_states"] as const;

export class HubDatabase {
  readonly home: string;
  readonly db: DatabaseSync;
  readonly server: { serverId: string; created: string };
  readonly random: (size: number) => Buffer;
  private readonly clock: () => Date | string | number;
  constructor(options: HubServerOptions) {
    this.home = dataHome(options.home);
    this.random = options.random ?? randomBytes;
    this.clock = options.now ?? (() => new Date());
    mkdirSync(join(this.home, "blobs"), { recursive: true, mode: 0o700 });
    chmodSync(this.home, 0o700);
    const identity = join(this.home, "server.json");
    if (!existsSync(identity)) {
      try {
        writeFileSync(identity, JSON.stringify({ serverId: this.id("hub"), created: this.now() }) + "\n", { flag: "wx", mode: 0o600 });
      } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
    }
    this.server = JSON.parse(readFileSync(identity, "utf8"));
    if (!object(this.server) || typeof this.server.serverId !== "string" || typeof this.server.created !== "string")
      throw new HubServerError("허브 서버 식별 기록을 읽지 못했습니다.", 409);
    this.db = new DatabaseSync(join(this.home, "hub.sqlite"));
    chmodSync(join(this.home, "hub.sqlite"), 0o600);
    try {
      this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
      this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
      this.tx(() => {
        const current = this.get<{ version: number | null }>("SELECT MAX(version) AS version FROM schema_migrations")?.version ?? 0;
        if (current > MIGRATIONS.at(-1)!.version) throw new HubServerError("이 데이터는 더 최신 허브 서버가 필요합니다.", 409);
        for (const migration of MIGRATIONS) if (migration.version > current) {
          this.db.exec(migration.sql);
          this.run("INSERT INTO schema_migrations VALUES (?,?)", migration.version, this.now());
        }
        this.run("INSERT INTO hub_folders (id,name,created_by,created_at) VALUES ('general','일반','GAID',?) ON CONFLICT(id) DO NOTHING", this.now());
      });
    } catch (e) { this.db.close(); throw e; }
  }
  now(): string { return new Date(this.clock()).toISOString(); }
  id(prefix: string): string { return `${prefix}-${this.random(16).toString("hex")}`; }
  get<T>(sql: string, ...args: SQLInputValue[]): T | undefined { return this.db.prepare(sql).get(...args) as T | undefined; }
  all<T>(sql: string, ...args: SQLInputValue[]): T[] { return this.db.prepare(sql).all(...args) as T[]; }
  run(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).run(...args); }
  private transactionDepth = 0;
  tx<T>(fn: () => T): T {
    const depth = this.transactionDepth++;
    const begin = depth ? `SAVEPOINT nested_${depth}` : "BEGIN IMMEDIATE";
    try { this.db.exec(begin); }
    catch (e) { this.transactionDepth--; throw e; }
    try {
      const out = fn();
      this.db.exec(depth ? `RELEASE SAVEPOINT nested_${depth}` : "COMMIT");
      return out;
    } catch (e) {
      this.db.exec(depth ? `ROLLBACK TO SAVEPOINT nested_${depth}; RELEASE SAVEPOINT nested_${depth}` : "ROLLBACK");
      throw e;
    } finally { this.transactionDepth--; }
  }
  /** CLI import only; never share this connection with a serving app during the callback. */
  async importTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.transactionDepth) throw new Error("An import transaction is already open");
    this.db.exec("BEGIN IMMEDIATE");
    this.transactionDepth++;
    try { const out = await fn(); this.db.exec("COMMIT"); return out; }
    catch (e) { this.db.exec("ROLLBACK"); throw e; }
    finally { this.transactionDepth--; }
  }
  audit(actor: AuditActor, action: string, target: string, detail: unknown = {}) {
    this.run("INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)", this.id("audit"), actor.id, action, target,
      JSON.stringify(detail), actor.device ?? "", this.now());
  }
  blobPath(hash: string): string { hashValue(hash); return join(this.home, "blobs", hash); }
  private simulatedBlobs: Map<string, Buffer> | null = null;
  async simulateBlobWrites<T>(fn: () => Promise<T>): Promise<T> {
    if (this.simulatedBlobs) throw new Error("Blob simulation already active");
    this.simulatedBlobs = new Map();
    try { return await fn(); } finally { this.simulatedBlobs = null; }
  }
  putBlob(bytes: Buffer): string {
    const hash = sha256(bytes);
    const target = this.blobPath(hash);
    if (existsSync(target)) {
      if (sha256(readFileSync(target)) !== hash) throw new HubServerError("저장된 파일 해시가 맞지 않습니다.", 409);
      return hash;
    }
    if (this.simulatedBlobs) { this.simulatedBlobs.set(hash, bytes); return hash; }
    const tmp = join(this.home, "blobs", `.tmp-${this.random(16).toString("hex")}`);
    try { writeFileSync(tmp, bytes, { flag: "wx", mode: 0o600 }); renameSync(tmp, target); }
    finally { rmSync(tmp, { force: true }); }
    return hash;
  }
  blob(hash: string): Buffer {
    hashValue(hash);
    const simulated = this.simulatedBlobs?.get(hash);
    if (simulated) return simulated;
    let bytes: Buffer;
    try { bytes = readFileSync(this.blobPath(hash)); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new HubServerError("저장 파일을 찾을 수 없습니다.", 404); throw e; }
    if (sha256(bytes) !== hash) throw new HubServerError("저장된 파일 해시가 맞지 않습니다.", 409);
    return bytes;
  }
  counts(): Record<string, number> {
    return Object.fromEntries(HUB_TABLES.map((table) => [table, this.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)!.n]));
  }
  close() { this.db.close(); }
}
