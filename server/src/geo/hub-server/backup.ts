/** Consistent database snapshot and immutable, content-addressed blobs. */
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dataHome, HASH, HUB_TABLES, HubDatabase, HubServerError, object, sha256 } from "./core.ts";

interface BackupManifest {
  schema: "gaid-hub-backup/v1";
  serverId: string;
  createdAt: string;
  rows: Record<string, number>;
  files: { path: string; sha256: string; size: number }[];
}
const inside = (base: string, target: string) => { const rel = relative(base, target); return !rel || (!rel.startsWith("..") && !isAbsolute(rel)); };
const hashes = (db: DatabaseSync) => db.prepare("SELECT sha256 FROM hub_files UNION SELECT sha256 FROM library_files ORDER BY sha256").all() as { sha256: string }[];
function databaseCheck(db: DatabaseSync) {
  const integrity = db.prepare("PRAGMA integrity_check").all();
  if (integrity.length !== 1 || Object.values(integrity[0])[0] !== "ok" || db.prepare("PRAGMA foreign_key_check").all().length)
    throw new HubServerError("백업 데이터베이스 무결성 검사에 실패했습니다.", 409);
}
export function backupHub(hub: HubDatabase, destination: string): BackupManifest {
  const target = dataHome(destination);
  if (inside(hub.home, target) || inside(target, hub.home)) throw new HubServerError("백업은 운영 데이터와 분리된 폴더에 저장하세요.");
  if (existsSync(target) && readdirSync(target).length) throw new HubServerError("백업 폴더가 비어 있지 않습니다.", 409);
  mkdirSync(target, { recursive: true, mode: 0o700 });
  try {
    hub.tx(() => hub.audit({ id: "operator", device: "CLI" }, "backup.create", "hub"));
    const database = join(target, "hub.sqlite");
    // VACUUM INTO accepts a bound path and snapshots committed transactions, including WAL pages.
    hub.db.prepare("VACUUM INTO ?").run(database);
    chmodSync(database, 0o600);
    const snapshot = new DatabaseSync(database, { readOnly: true });
    let rows: Record<string, number>;
    let blobs: { sha256: string }[];
    try {
      databaseCheck(snapshot);
      rows = Object.fromEntries(HUB_TABLES.map((table) => [table, (snapshot.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n]));
      blobs = hashes(snapshot);
    } finally { snapshot.close(); }
    const manifest: BackupManifest = { schema: "gaid-hub-backup/v1", serverId: hub.server.serverId, createdAt: hub.now(), rows, files: [] };
    const add = (path: string, bytes: Buffer) => {
      writeFileSync(join(target, path), bytes, { mode: 0o600 });
      manifest.files.push({ path, sha256: sha256(bytes), size: bytes.length });
    };
    manifest.files.push({ path: "hub.sqlite", sha256: sha256(readFileSync(database)), size: lstatSync(database).size });
    add("server.json", readFileSync(join(hub.home, "server.json")));
    mkdirSync(join(target, "blobs"), { mode: 0o700 });
    for (const row of blobs) add(`blobs/${row.sha256}`, hub.blob(row.sha256));
    writeFileSync(join(target, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
    return manifest;
  } catch (e) { rmSync(target, { recursive: true, force: true }); throw e; }
}
export function checkBackup(directory: string): { serverId: string; files: number; rows: Record<string, number> } {
  const source = resolve(directory);
  const manifest = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8")) as BackupManifest;
  if (!object(manifest) || manifest.schema !== "gaid-hub-backup/v1" || !Array.isArray(manifest.files) || !object(manifest.rows))
    throw new HubServerError("백업 명세 형식을 확인해 주세요.", 409);
  const temporary = mkdtempSync(join(dirname(source), ".hub-restore-check-"));
  try {
    const names = new Set<string>();
    for (const f of manifest.files) {
      if (!object(f) || typeof f.path !== "string" || !(f.path === "hub.sqlite" || f.path === "server.json" || /^blobs\/[a-f0-9]{64}$/.test(f.path)) ||
          names.has(f.path) || typeof f.sha256 !== "string" || !HASH.test(f.sha256) || !Number.isSafeInteger(f.size) || f.size < 0)
        throw new HubServerError("백업 파일 목록을 확인해 주세요.", 409);
      names.add(f.path);
      const from = join(source, f.path);
      if (!lstatSync(from).isFile()) throw new HubServerError("백업 파일 형식이 올바르지 않습니다.", 409);
      const bytes = readFileSync(from);
      if (bytes.length !== f.size || sha256(bytes) !== f.sha256) throw new HubServerError("백업 파일 크기 또는 해시가 맞지 않습니다.", 409);
      mkdirSync(dirname(join(temporary, f.path)), { recursive: true, mode: 0o700 });
      copyFileSync(from, join(temporary, f.path));
    }
    if (!names.has("hub.sqlite") || !names.has("server.json")) throw new HubServerError("백업에 필수 파일이 없습니다.", 409);
    const restored = new HubDatabase({ home: temporary });
    try {
      databaseCheck(restored.db);
      const actual = restored.counts();
      if (restored.server.serverId !== manifest.serverId || HUB_TABLES.some((table) => actual[table] !== manifest.rows[table]))
        throw new HubServerError("복원한 데이터의 식별자 또는 행 수가 맞지 않습니다.", 409);
      for (const row of hashes(restored.db)) {
        if (!names.has(`blobs/${row.sha256}`)) throw new HubServerError("백업에서 참조한 파일이 빠졌습니다.", 409);
        restored.blob(row.sha256);
      }
      return { serverId: restored.server.serverId, files: names.size, rows: actual };
    } finally { restored.close(); }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
