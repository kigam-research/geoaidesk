/** Standalone hub through real Fastify injection and isolated on-disk SQLite/blob homes. */
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildHubServer, HubDatabase, type HubServerApp } from "../src/geo/hub-server/index.ts";
import { backupHub, checkBackup } from "../src/geo/hub-server/backup.ts";
import { importHub } from "../src/geo/hub-server/import.ts";
import { sha256 } from "../src/geo/hub-server/core.ts";
import { SharedHubStore, type StoredEntry } from "../src/geo/hub-shared/store.ts";
import { zoteroCollectionId } from "../src/geo/library/zotero/sync.ts";
import { HUB_FILE_LIMIT, LIBRARY_FILE_LIMIT } from "../src/geo/hub-server/protocol.ts";
const API = "/hub/v1";
const work = join(homedir(), "data/geoaidesk/work/gaid-backend--hub-server/tests");
const password = "a correct password 123";
let root: string;
let app: HubServerApp;
let time: number;
beforeEach(() => {
  mkdirSync(work, { recursive: true });
  root = mkdtempSync(join(work, "case-"));
  time = Date.parse("2026-10-22T00:00:00.000Z");
  app = buildHubServer({ home: join(root, "hub"), now: () => time });
});
afterEach(async () => { await app.close(); rmSync(root, { recursive: true, force: true }); });
async function user(email = "member@example.org", role: "member" | "admin" = "member", displayName = "연구자") {
  const invite = app.accounts.invite({ email, role });
  const response = await app.inject({ method: "POST", url: `${API}/auth/invites/accept`, payload: { code: invite.code, displayName, password, device: "test-PC" } });
  expect(response.statusCode, response.body).toBe(200);
  const session = response.json();
  return { ...session, headers: { authorization: `Bearer ${session.token}` }, invite };
}
function record(id = "entry-example", bytes = Buffer.from("package archive")): StoredEntry {
  const at = new Date(time).toISOString();
  const pkg = { revision: 1, draftRevision: 1, methodId: "method-example", slug: "sample-workflow", sha256: sha256(bytes), size: bytes.length,
    packageDigest: "ab".repeat(32), createdAt: at, manifest: {}, archive: "packages/1.tar.gz" };
  return { schemaVersion: "gaid-hub-entry/v1", authoringProjectId: "authoring-example", entry: {
    id, methodId: pkg.methodId, slug: pkg.slug, title: "시험 Workflow", summary: "시험 절차", kind: "workflow", tags: [], author: "위조한 이름", authorId: "forged-id",
    folderId: "general", cover: null, latestRevision: 1, updatedAt: at,
    revisions: [{ revision: 1, authoringProjectId: "authoring-example", draftRevision: 1, packageRevision: 1, packageSha256: pkg.sha256,
      packageDigest: pkg.packageDigest, registeredAt: at, registeredBy: "위조한 이름", registeredById: "forged-id", note: "첫 판" }],
  }, snapshots: { "1": { draft: { revision: 1 } as never, package: pkg, visuals: {} } }, installs: [] };
}
function upload(headers: Record<string, string>, id = "entry-example", path = "packages/1.tar.gz", bytes = Buffer.from("package archive")) {
  return app.inject({ method: "PUT", url: `${API}/entries/${id}/files/${path}`, headers: { ...headers, "content-type": "application/octet-stream", "x-content-sha256": sha256(bytes) }, payload: bytes });
}
async function publish(headers: Record<string, string>, r = record()) {
  expect((await upload(headers, r.entry.id)).statusCode).toBe(204);
  const result = await app.inject({ method: "PUT", url: `${API}/entries/${r.entry.id}`, headers, payload: r });
  expect(result.statusCode, result.body).toBe(200);
  return result.json<StoredEntry>();
}
function nextRevision(previous: StoredEntry, bytes = Buffer.from("second package")) {
  const r = structuredClone(previous);
  const n = ++r.entry.latestRevision;
  r.snapshots[n] = structuredClone(r.snapshots[n - 1]);
  r.snapshots[n].package = { ...r.snapshots[n].package, revision: n, draftRevision: n, sha256: sha256(bytes), size: bytes.length };
  r.snapshots[n].draft.revision = n;
  const { version: _previousVersion, ...earlier } = r.entry.revisions[n - 2];
  r.entry.revisions.push({ ...earlier, revision: n, packageRevision: n, draftRevision: n, packageSha256: sha256(bytes), registeredBy: "위조자", registeredById: "forged" });
  return r;
}
const put = (headers: Record<string, string>, r: StoredEntry) => app.inject({ method: "PUT", url: `${API}/entries/${r.entry.id}`, headers, payload: r });

describe("home and process surface", () => {
  it("serves health without credentials and preserves identity across reopen", async () => {
    const first = (await app.inject(`${API}/health`)).json();
    expect(first).toMatchObject({ schema: "gaid-hub-server/v1", name: "gaid-hub-server" });
    await app.close();
    app = buildHubServer({ home: join(root, "hub") });
    expect((await app.inject(`${API}/health`)).json().serverId).toBe(first.serverId);
    expect(app.hub.get("PRAGMA journal_mode")).toMatchObject({ journal_mode: "wal" });
    expect(app.hub.get("PRAGMA foreign_keys")).toMatchObject({ foreign_keys: 1 });
    expect(app.hub.counts().schema_migrations).toBe(5);
  });
  it.each([{ origin: "http://localhost" }, { origin: "" }, { "sec-fetch-site": "none" }])("refuses browser headers before routing: %j", async (headers) => {
    for (const url of [`${API}/health`, "/projects", `${API}/auth/login`]) {
      const response = await app.inject({ method: "GET", url, headers });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toHaveProperty("error");
    }
  });
  it("has no workspace, shell, UI or credential routes", async () => {
    const u = await user();
    for (const url of ["/", "/projects", "/geo/hub/entries", "/api/credentials", "/sandbox"]) {
      expect((await app.inject({ url, headers: u.headers })).statusCode).toBe(404);
    }
    expect((await app.inject(`${API}/entries`)).statusCode).toBe(401);
  });
  it("refuses data homes in a checkout, including symlink and nonexistent descendants", () => {
    const repo = join(root, "fake-repo"); mkdirSync(repo); mkdirSync(join(repo, ".git"));
    symlinkSync(repo, join(root, "alias"));
    expect(() => new HubDatabase({ home: join(repo, "a/b") })).toThrow(/Git/);
    expect(() => new HubDatabase({ home: join(root, "alias", "data") })).toThrow(/Git/);
    // Recorded jobs run an exported source tree without .git. Cover a real worktree marker without relying on cwd.
    const worktree = join(root, "fake-worktree"); mkdirSync(worktree);
    writeFileSync(join(worktree, ".git"), "gitdir: /unused-test-gitdir\n");
    expect(() => new HubDatabase({ home: join(worktree, "data") })).toThrow(/Git/);
  });
});
describe("accounts and invites", () => {
  it("accepts an invite, normalizes email, logs in, reads me and logs out; hashes credentials", async () => {
    const u = await user(" Member@Example.org ");
    expect(u.account.email).toBe("member@example.org");
    const me = await app.inject({ url: `${API}/auth/me`, headers: { ...u.headers, "x-gaid-user": "forged" } });
    expect(me.json().account.id).toBe(u.account.id);
    const row = app.hub.get<{ password: string }>("SELECT password FROM accounts WHERE id=?", u.account.id)!;
    expect(JSON.parse(row.password)).toMatchObject({ N: 16384, r: 8, p: 1 });
    expect(row.password).not.toContain(password);
    expect(app.hub.get("SELECT * FROM sessions WHERE token_sha256=?", u.token)).toBeUndefined();
    const login = await app.inject({ method: "POST", url: `${API}/auth/login`, payload: { email: "MEMBER@example.org", password, device: "second-PC" } });
    expect(login.statusCode).toBe(200);
    expect(login.json().token).toHaveLength(43);
    expect((await app.inject({ method: "POST", url: `${API}/auth/logout`, headers: u.headers, payload: {} })).statusCode).toBe(204);
    expect((await app.inject({ url: `${API}/auth/me`, headers: u.headers })).statusCode).toBe(401);
    const audit = app.hub.all<{ action: string; device: string }>("SELECT action,device FROM audit_events WHERE account_id=?", u.account.id);
    expect(audit.some((e) => e.action === "session.create" && e.device === "second-PC")).toBe(true);
  });
  it("returns 401 on incorrect or unknown credentials", async () => {
    await user();
    for (const email of ["member@example.org", "unknown@example.org"]) expect((await app.inject({ method: "POST", url: `${API}/auth/login`, payload: { email, password: "wrong" } })).statusCode).toBe(401);
  });
  it("rate limits failed logins by email and persists failures across restart", async () => {
    await user();
    for (let n = 0; n < 10; n++) expect((await app.inject({ method: "POST", url: `${API}/auth/login`, remoteAddress: `10.0.0.${n + 1}`, payload: { email: "member@example.org", password: "wrong" } })).statusCode).toBe(401);
    await app.close(); app = buildHubServer({ home: join(root, "hub"), now: () => time });
    const blocked = await app.inject({ method: "POST", url: `${API}/auth/login`, payload: { email: "member@example.org", password } });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["retry-after"]).toBe("900");
    time += 15 * 60_000 + 1;
    expect((await app.inject({ method: "POST", url: `${API}/auth/login`, payload: { email: "member@example.org", password } })).statusCode).toBe(200);
  });
  it("rate limits one IP trying different emails", async () => {
    for (let n = 0; n < 10; n++) expect((await app.inject({ method: "POST", url: `${API}/auth/login`, payload: { email: `unknown${n}@example.org`, password: "wrong" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: `${API}/auth/login`, payload: { email: "different@example.org", password } })).statusCode).toBe(429);
  });
  it("keeps invite codes one-time, expiring and absent from list responses", async () => {
    const admin = await user("admin@example.org", "admin");
    const create = await app.inject({ method: "POST", url: `${API}/admin/invites`, headers: admin.headers, payload: { email: "new@example.org", role: "member" } });
    const inv = create.json().invite;
    expect(create.statusCode).toBe(201); expect(inv.code).toHaveLength(43);
    expect((await app.inject({ url: `${API}/admin/invites`, headers: admin.headers })).body).not.toContain(inv.code);
    const accept = () => app.inject({ method: "POST", url: `${API}/auth/invites/accept`, payload: { code: inv.code, displayName: "새 사용자", password } });
    expect((await accept()).statusCode).toBe(200);
    expect((await accept()).statusCode).toBe(410);
    expect((await app.inject({ method: "DELETE", url: `${API}/admin/invites/${inv.id}`, headers: admin.headers })).statusCode).toBe(409);
    const expired = app.accounts.invite({ email: "expired@example.org", role: "member" });
    time += 8 * 86_400_000;
    expect((await app.inject({ method: "POST", url: `${API}/auth/invites/accept`, payload: { code: expired.code, displayName: "만료", password } })).statusCode).toBe(410);
  });
  it("allows only one concurrent acceptance of an invite", async () => {
    const invite = app.accounts.invite({ email: "one@example.org", role: "admin" });
    const results = await Promise.all([1, 2].map(() => app.inject({ method: "POST", url: `${API}/auth/invites/accept`, payload: { code: invite.code, displayName: "하나", password } })));
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 410]);
    expect(app.accounts.users()).toHaveLength(1);
  });
  it("rejects invalid names, short/long passwords and unknown codes", async () => {
    const inv = app.accounts.invite({ email: "one@example.org", role: "member" });
    for (const patch of [{ displayName: "" }, { displayName: "x".repeat(41) }, { displayName: "a\nb" }, { password: "short" }, { password: "x".repeat(201) }]) {
      expect((await app.inject({ method: "POST", url: `${API}/auth/invites/accept`, payload: { code: inv.code, displayName: "이름", password, ...patch } })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: "POST", url: `${API}/auth/invites/accept`, payload: { code: "unknown", displayName: "이름", password } })).statusCode).toBe(404);
  });
  it("supports revoking unused invites and rejects members from admin routes", async () => {
    const admin = await user("admin@example.org", "admin"); const member = await user();
    const inv = app.accounts.invite({ email: "unused@example.org", role: "member" });
    expect((await app.inject({ url: `${API}/admin/users`, headers: member.headers })).statusCode).toBe(403);
    expect((await app.inject({ method: "DELETE", url: `${API}/admin/invites/${inv.id}`, headers: admin.headers })).statusCode).toBe(204);
    expect((await app.inject({ method: "POST", url: `${API}/auth/invites/accept`, payload: { code: inv.code, displayName: "이름", password } })).statusCode).toBe(404);
  });
  it("protects the last admin, disables accounts and ends their sessions", async () => {
    const admin = await user("admin@example.org", "admin"); const member = await user();
    const patch = (id: string, payload: unknown) => app.inject({ method: "PATCH", url: `${API}/admin/users/${id}`, headers: admin.headers, payload });
    expect((await patch(admin.account.id, { role: "member" })).statusCode).toBe(409);
    expect((await patch(admin.account.id, { disabled: true })).statusCode).toBe(409);
    expect((await patch(member.account.id, { disabled: true })).statusCode).toBe(200);
    expect((await app.inject({ url: `${API}/auth/me`, headers: member.headers })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: `${API}/auth/login`, payload: { email: member.account.email, password } })).statusCode).toBe(403);
    expect((await patch(member.account.id, { disabled: false, role: "admin" })).statusCode).toBe(200);
    expect((await patch(admin.account.id, { role: "member" })).statusCode).toBe(200);
  });
  it("changes display name and password only with the current password, ends other sessions", async () => {
    const u = await user();
    const login = (await app.inject({ method: "POST", url: `${API}/auth/login`, payload: { email: u.account.email, password } })).json();
    expect((await app.inject({ method: "PATCH", url: `${API}/auth/me`, headers: u.headers, payload: { password: { current: "wrong", next: "a new password" } } })).statusCode).toBe(403);
    expect((await app.inject({ method: "PATCH", url: `${API}/auth/me`, headers: u.headers, payload: { displayName: "바뀐 이름", password: { current: password, next: "a new password" } } })).json().account.displayName).toBe("바뀐 이름");
    expect((await app.inject({ url: `${API}/auth/me`, headers: { authorization: `Bearer ${login.token}` } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: `${API}/auth/login`, payload: { email: u.account.email, password } })).statusCode).toBe(401);
    expect((await app.inject({ url: `${API}/auth/me`, headers: u.headers })).statusCode).toBe(200);
  });
  it("touches sliding sessions at most once a minute and expires them", async () => {
    const u = await user();
    const session = () => app.hub.get<{ last_used: string; expires_at: string }>("SELECT * FROM sessions WHERE token_sha256=?", sha256(u.token))!;
    const before = session(); time += 30_000;
    await app.inject({ url: `${API}/auth/me`, headers: u.headers }); expect(session()).toMatchObject(before);
    time += 30_000; await app.inject({ url: `${API}/auth/me`, headers: u.headers });
    expect(session().expires_at > before.expires_at).toBe(true);
    time += 91 * 86_400_000;
    expect((await app.inject({ url: `${API}/auth/me`, headers: u.headers })).statusCode).toBe(401);
  });
});
describe("hub records and files", () => {
  it("derives ownership/revision identity from the account and ignores installs in PUT", async () => {
    const u = await user(); const r = record();
    r.installs.push({ packageRevision: 1, projectId: "forged", methodKey: "forged", installedAt: new Date(time).toISOString() });
    const stored = await publish(u.headers, r);
    expect(stored.entry).toMatchObject({ author: u.account.displayName, authorId: u.account.id });
    expect(stored.entry.revisions[0]).toMatchObject({ registeredBy: u.account.displayName, registeredById: u.account.id });
    expect(stored.installs).toEqual([]);
  });
  it("refuses non-authors for revisions and files, including admin accounts", async () => {
    const owner = await user(); const other = await user("other@example.org", "admin");
    const stored = await publish(owner.headers);
    expect((await put(other.headers, stored)).statusCode).toBe(403);
    expect((await upload(other.headers, stored.entry.id, "packages/2.tar.gz")).statusCode).toBe(403);
    expect((await upload(other.headers)).statusCode).toBe(403);
  });
  it("appends exactly the next revision, allows draft-link/metadata edits, preserves old snapshots", async () => {
    const u = await user(); const first = await publish(u.headers);
    const bytes = Buffer.from("second package"); const second = nextRevision(first, bytes);
    expect((await put(u.headers, second)).statusCode).toBe(409);
    expect((await upload(u.headers, first.entry.id, "packages/2.tar.gz", bytes)).statusCode).toBe(204);
    time += 1000;
    second.entry.slug = "renamed-workflow"; second.entry.methodId = "local/renamed-workflow";
    second.snapshots["2"].package.slug = second.entry.slug; second.snapshots["2"].package.methodId = second.entry.methodId;
    const response = await put(u.headers, second);
    expect(response.statusCode, response.body).toBe(200);
    const saved = response.json<StoredEntry>();
    expect(saved.entry.revisions[0]).toEqual(first.entry.revisions[0]);
    expect(saved.entry.revisions[1].registeredById).toBe(u.account.id);
    expect(saved.entry.revisions[1].registeredBy).toBe(u.account.displayName);
    saved.authoringProjectId = "authoring-on-another-PC"; saved.entry.title = "고친 제목";
    expect((await put(u.headers, saved)).statusCode).toBe(200);
    saved.snapshots["1"].draft.revision = 99;
    expect((await put(u.headers, saved)).statusCode).toBe(409);
    const changedRevision = structuredClone(first); changedRevision.entry.revisions[0].note = "바꾼 이력";
    expect((await put(u.headers, changedRevision)).statusCode).toBe(409);
  });
  it("assigns 0.1.0 first, a patch step to a client without versions, and accepts only one patch/minor/major step", async () => {
    const u = await user(); const first = await publish(u.headers);
    expect(first.entry.revisions[0].version).toBe("0.1.0");
    const bytes = Buffer.from("second package"); const second = nextRevision(first, bytes);
    expect((await upload(u.headers, first.entry.id, "packages/2.tar.gz", bytes)).statusCode).toBe(204);
    for (const version of ["0.1.0", "0.1.2", "0.3.0", "2.0.0", "1.0"]) {
      second.entry.revisions[1].version = version;
      expect((await put(u.headers, second)).statusCode, version).toBe(409);
    }
    second.entry.revisions[1].version = "1.0.0";
    const major = await put(u.headers, second);
    expect(major.statusCode, major.body).toBe(200);
    expect(major.json<StoredEntry>().entry.revisions.map((r) => r.version)).toEqual(["0.1.0", "1.0.0"]);
    const bytes3 = Buffer.from("third package"); const third = nextRevision(major.json<StoredEntry>(), bytes3);
    expect((await upload(u.headers, first.entry.id, "packages/3.tar.gz", bytes3)).statusCode).toBe(204);
    const patch = await put(u.headers, third);
    expect(patch.statusCode, patch.body).toBe(200);
    expect(patch.json<StoredEntry>().entry.revisions.at(-1)!.version).toBe("1.0.1");
  });
  it("removes an entry for its author or an admin, hides it everywhere and lets only an admin restore it", async () => {
    const owner = await user(); const other = await user("other@example.org"); const admin = await user("admin@example.org", "admin");
    const stored = await publish(owner.headers);
    const id = stored.entry.id;
    const remove = (headers: Record<string, string>, reason = "중복 등록") =>
      app.inject({ method: "POST", url: `${API}/entries/${id}/remove`, headers, payload: { reason } });
    expect((await remove(other.headers)).statusCode).toBe(403);
    expect((await remove(owner.headers)).statusCode).toBe(204);
    expect((await remove(owner.headers)).statusCode).toBe(409);
    expect((await app.inject({ url: `${API}/entries`, headers: other.headers })).json().entries).toEqual([]);
    expect((await app.inject({ url: `${API}/entries/${id}`, headers: owner.headers })).statusCode).toBe(404);
    expect((await app.inject({ url: `${API}/entries/${id}/files/packages/1.tar.gz`, headers: owner.headers })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: `${API}/entries/${id}/comments`, headers: other.headers, payload: { body: "의견" } })).statusCode).toBe(404);
    // The author cannot publish over a removed entry, not even a second revision.
    const bytes = Buffer.from("second package");
    expect((await upload(owner.headers, id, "packages/2.tar.gz", bytes)).statusCode).toBe(409);
    expect((await put(owner.headers, stored)).statusCode).toBe(409);
    expect((await app.inject({ url: `${API}/admin/entries/removed`, headers: owner.headers })).statusCode).toBe(403);
    const listed = await app.inject({ url: `${API}/admin/entries/removed`, headers: admin.headers });
    expect(listed.json().entries.map((e: StoredEntry) => [e.entry.id, e.entry.removed?.by, e.entry.removed?.reason]))
      .toEqual([[id, owner.account.displayName, "중복 등록"]]);
    expect((await app.inject({ method: "POST", url: `${API}/admin/entries/${id}/restore`, headers: owner.headers })).statusCode).toBe(403);
    const restored = await app.inject({ method: "POST", url: `${API}/admin/entries/${id}/restore`, headers: admin.headers });
    expect(restored.statusCode, restored.body).toBe(200);
    expect(restored.json<StoredEntry>().entry.removed).toBeUndefined();
    expect(restored.json<StoredEntry>().entry.revisions).toEqual(stored.entry.revisions);
    expect((await app.inject({ url: `${API}/entries`, headers: other.headers })).json().entries).toHaveLength(1);
    expect((await app.inject({ method: "POST", url: `${API}/admin/entries/${id}/restore`, headers: admin.headers })).statusCode).toBe(404);
    // An admin may remove someone else's entry.
    expect((await remove(admin.headers, "")).statusCode).toBe(204);
    const actions = app.hub.all<{ action: string; account_id: string }>("SELECT action,account_id FROM audit_events WHERE target=? AND action LIKE 'entry.re%' ORDER BY rowid", id);
    expect(actions).toEqual([
      { action: "entry.remove", account_id: owner.account.id },
      { action: "entry.restore", account_id: admin.account.id },
      { action: "entry.remove", account_id: admin.account.id },
    ]);
  });
  it("rejects skipped revisions, deleted history and basedOn changes", async () => {
    const u = await user(); const first = await publish(u.headers);
    const skip = nextRevision(nextRevision(first));
    expect((await put(u.headers, skip)).statusCode).toBe(409);
    for (const patch of [{ latestRevision: 0 }, { basedOn: { entryId: "entry-another", revision: 1, title: "original", author: "other" } }]) {
      const r = structuredClone(first); Object.assign(r.entry, patch);
      expect((await put(u.headers, r)).statusCode).toBe(409);
    }
    const extra = structuredClone(first); extra.snapshots["99"] = extra.snapshots["1"];
    expect((await put(u.headers, extra)).statusCode).toBe(409);
  });
  it("requires all package/light/dark files and matching package checksums", async () => {
    const u = await user(); const r = record();
    expect((await put(u.headers, r)).statusCode).toBe(409);
    await upload(u.headers);
    const pic = Buffer.from("light picture"), dark = Buffer.from("dark picture");
    const file = `visuals/1/${sha256(pic)}.png`, darkFile = `visuals/1/${sha256(dark)}.png`;
    r.snapshots["1"].visuals.cover = { file, caption: "개념 그림", mediaType: "image/png", dark: { file: darkFile, mediaType: "image/png" } };
    expect((await put(u.headers, r)).statusCode).toBe(409);
    await upload(u.headers, r.entry.id, file, pic);
    expect((await put(u.headers, r)).statusCode).toBe(409);
    await upload(u.headers, r.entry.id, darkFile, dark);
    expect((await put(u.headers, r)).statusCode).toBe(200);
    const wrong = record("entry-wrong"); await upload(u.headers, wrong.entry.id);
    wrong.snapshots["1"].package.sha256 = "ff".repeat(32); wrong.entry.revisions[0].packageSha256 = "ff".repeat(32);
    expect((await put(u.headers, wrong)).statusCode).toBe(409);
  });
  it("makes uploads write-once and validates bytes, paths and staged ownership", async () => {
    const u = await user(); const other = await user("other@example.org");
    expect((await upload(u.headers)).statusCode).toBe(204);
    expect((await upload(u.headers)).statusCode).toBe(204);
    expect((await upload(u.headers, undefined, undefined, Buffer.from("different"))).statusCode).toBe(409);
    expect((await upload(other.headers, undefined, "packages/2.tar.gz")).statusCode).toBe(403);
    expect((await put(other.headers, record())).statusCode).toBe(403);
    expect((await app.inject({ url: `${API}/entries/entry-example/files/packages/1.tar.gz`, headers: u.headers })).statusCode).toBe(404);
    expect((await upload(u.headers, undefined, "packages/../entry.json")).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: `${API}/entries/entry-example/files/packages/2.tar.gz`, headers: { ...u.headers, "content-type": "application/octet-stream", "x-content-sha256": "00".repeat(32) }, payload: Buffer.from("wrong") })).statusCode).toBe(400);
    expect((await upload(u.headers, undefined, `visuals/1/${"00".repeat(32)}.png`, Buffer.from("wrong picture"))).statusCode).toBe(400);
  });
  it("records per-account stars, comments and installs separately from author writes", async () => {
    const owner = await user(); const other = await user("other@example.org", "member", "댓글 연구자");
    const saved = await publish(owner.headers);
    for (let n = 0; n < 2; n++) expect((await app.inject({ method: "POST", url: `${API}/entries/${saved.entry.id}/star`, headers: other.headers, payload: { on: true } })).json()).toEqual({ stars: 1, starredByMe: true });
    expect((await app.inject({ url: `${API}/entries/${saved.entry.id}/stars`, headers: owner.headers })).json().stars).toEqual({ [other.account.id]: true });
    const comment = await app.inject({ method: "POST", url: `${API}/entries/${saved.entry.id}/comments`, headers: other.headers, payload: { body: "연구에 사용했습니다.", author: "위조", authorId: owner.account.id } });
    expect(comment.statusCode).toBe(201);
    expect(comment.json()).toMatchObject({ author: "댓글 연구자", authorId: other.account.id, revision: 1 });
    const install = { packageRevision: 1, projectId: "research-project", methodKey: "project:example", installedAt: new Date(time).toISOString() };
    for (let n = 0; n < 2; n++) expect((await app.inject({ method: "POST", url: `${API}/entries/${saved.entry.id}/installs`, headers: other.headers, payload: { install } })).statusCode).toBe(204);
    saved.entry.title = "변경한 제목";
    expect((await put(owner.headers, saved)).json().installs).toEqual([install]);
    expect((await app.inject({ url: `${API}/entries/${saved.entry.id}/comments`, headers: other.headers })).json().comments).toHaveLength(1);
    expect((await app.inject({ method: "POST", url: `${API}/entries/${saved.entry.id}/star`, headers: other.headers, payload: { on: false } })).json()).toEqual({ stars: 0, starredByMe: false });
  });
  it("enforces unique folders and returns newest entries first", async () => {
    const u = await user();
    const create = (name: string) => app.inject({ method: "POST", url: `${API}/folders`, headers: u.headers, payload: { name } });
    expect((await create("광물 탐사")).statusCode).toBe(201);
    expect((await create("광물 탐사")).statusCode).toBe(409);
    expect((await create("일반")).statusCode).toBe(409);
    await publish(u.headers); time += 1000; await publish(u.headers, record("entry-later"));
    expect((await app.inject({ url: `${API}/entries`, headers: u.headers })).json().entries.map((r: StoredEntry) => r.entry.id)).toEqual(["entry-later", "entry-example"]);
    expect((await app.inject({ url: `${API}/folders`, headers: u.headers })).json().folders[0]).toMatchObject({ id: "general", name: "일반" });
  });
  it("enforces route-specific body limits", async () => {
    const u = await user();
    expect((await upload(u.headers, undefined, undefined, Buffer.alloc(HUB_FILE_LIMIT + 1))).statusCode).toBe(413);
    expect((await app.inject({ method: "PUT", url: `${API}/library/files/${"00".repeat(32)}`, headers: { ...u.headers, "content-type": "application/pdf" }, payload: Buffer.alloc(LIBRARY_FILE_LIMIT + 1) })).statusCode).toBe(413);
    expect((await app.inject({ method: "POST", url: `${API}/auth/login`, payload: { email: "a@example.org", password: "x".repeat(17000) } })).statusCode).toBe(413);
  });
});
describe("per-account library synchronization", () => {
  it("preserves real Zotero collection ids, including encoded connection identities longer than 200 characters", async () => {
    const u = await user();
    const ids = [
      zoteroCollectionId({ connection: "local", serverId: "zotero-pc70", libraryType: "user", libraryId: "123456" }, "ABCD1234"),
      zoteroCollectionId({ connection: "local", serverId: `http://pc70:23119/${"연구 서재 ".repeat(4)}?workspace=A&B=1`, libraryType: "user", libraryId: "123456" }, "EFGH5678"),
    ];
    expect(ids[1].length).toBeGreaterThan(200);
    expect(ids[1].length).toBeLessThan(1024);
    const push = (changes: unknown[]) => app.inject({ method: "POST", url: `${API}/library/changes`, headers: u.headers, payload: { changes } });
    const changes = ids.map((id) => ({ kind: "folder", id, baseVersion: 0, deleted: false, data: { id, name: "Zotero 서재" } }));
    const item = { kind: "item", id: "li-zotero-member", baseVersion: 0, deleted: false, data: { collectionIds: ids, attachments: [] } };
    const created = await push([...changes, item]);
    expect(created.statusCode, created.body).toBe(200);
    expect(created.json().conflicts).toEqual([]);
    expect(created.json().applied.map((c: { id: string }) => c.id)).toEqual([...ids, item.id]);
    const pulled = (await app.inject({ url: `${API}/library/changes?since=0`, headers: u.headers })).json();
    expect(pulled.changes.slice(0, 2).map((c: { id: string }) => c.id)).toEqual(ids);
    expect(pulled.changes[2].data.collectionIds).toEqual(ids);
    expect((await push([{ ...changes[1], baseVersion: 2, deleted: true }])).json().applied[0]).toEqual({ kind: "folder", id: ids[1], version: 4 });
    expect((await app.inject({ url: `${API}/library/changes?since=3`, headers: u.headers })).json().changes).toEqual([{ kind: "folder", id: ids[1], version: 4, deleted: true }]);
    for (const id of ["zc-" + "x".repeat(1022), "zc-%invalid"]) expect((await push([{ ...changes[0], id }])).statusCode).toBe(400);
  });
  it("pushes versions, pulls incrementally, conflicts stale changes and retains tombstones", async () => {
    const u = await user();
    const push = (changes: unknown[]) => app.inject({ method: "POST", url: `${API}/library/changes`, headers: u.headers, payload: { changes } });
    const c = { kind: "item", id: "li-example", baseVersion: 0, deleted: false, data: { title: "논문", attachments: [] } };
    expect((await push([c, { ...c, kind: "folder", id: "lc-example", data: { name: "광물" } }])).json()).toMatchObject({ version: 2, applied: [{ version: 1 }, { version: 2 }], conflicts: [] });
    const stale = (await push([c])).json();
    expect(stale).toMatchObject({ version: 2, applied: [], conflicts: [{ kind: "item", id: c.id, version: 1, reason: "stale" }] });
    expect((await push([{ ...c, baseVersion: 1, deleted: true }])).json().version).toBe(3);
    const pull = await app.inject({ url: `${API}/library/changes?since=2`, headers: u.headers });
    expect(pull.json()).toEqual({ version: 3, changes: [{ kind: "item", id: c.id, version: 3, deleted: true }] });
    expect((await push([c])).json().conflicts[0].reason).toBe("stale");
    expect((await push([{ ...c, baseVersion: 3 }])).json().applied[0].version).toBe(4);
    expect((await app.inject({ url: `${API}/library/changes?since=4`, headers: u.headers })).json().changes).toEqual([]);
  });
  it("requires an owned PDF before accepting item references; deduplicates retries", async () => {
    const u = await user(); const pdf = Buffer.from("%PDF-1.7\nsynthetic test PDF"); const hash = sha256(pdf);
    const change = { kind: "item", id: "li-pdf", baseVersion: 0, deleted: false, data: { title: "PDF 논문", attachments: [{ stored: { sha256: hash } }] } };
    const push = () => app.inject({ method: "POST", url: `${API}/library/changes`, headers: u.headers, payload: { changes: [change] } });
    expect((await push()).json()).toMatchObject({ version: 0, conflicts: [{ reason: "missing-file" }] });
    const file = (method: "GET" | "HEAD" | "PUT", headers = u.headers, bytes = pdf, id = hash) => app.inject({ method, url: `${API}/library/files/${id}`, headers: { ...headers, "content-type": "application/pdf" }, ...(method === "PUT" ? { payload: bytes } : {}) });
    expect((await file("HEAD")).statusCode).toBe(404);
    expect((await file("PUT")).statusCode).toBe(204); expect((await file("PUT")).statusCode).toBe(204);
    expect(app.hub.counts().library_files).toBe(1);
    expect((await push()).json().applied).toHaveLength(1);
    expect((await file("HEAD")).statusCode).toBe(200);
    expect((await file("GET")).rawPayload.equals(pdf)).toBe(true);
    expect((await file("PUT", u.headers, Buffer.from("not PDF"), sha256("not PDF"))).statusCode).toBe(400);
    expect((await file("PUT", u.headers, Buffer.from("%PDF-wrong"))).statusCode).toBe(400);
  });
  it("isolates objects and file ownership from every other account, including admins", async () => {
    const member = await user(); const admin = await user("admin@example.org", "admin");
    const pdf = Buffer.from("%PDF-1.7\nprivate"); const hash = sha256(pdf);
    expect((await app.inject({ method: "PUT", url: `${API}/library/files/${hash}`, headers: { ...member.headers, "content-type": "application/pdf" }, payload: pdf })).statusCode).toBe(204);
    const data = { kind: "item", id: "li-private", baseVersion: 0, deleted: false, data: { title: "비공개", attachments: [{ stored: { sha256: hash } }] } };
    await app.inject({ method: "POST", url: `${API}/library/changes`, headers: member.headers, payload: { changes: [data] } });
    expect((await app.inject({ url: `${API}/library/changes?accountId=${member.account.id}`, headers: admin.headers })).json()).toEqual({ version: 0, changes: [] });
    for (const method of ["HEAD", "GET"] as const) expect((await app.inject({ method, url: `${API}/library/files/${hash}?accountId=${member.account.id}`, headers: admin.headers })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: `${API}/library/changes`, headers: admin.headers, payload: { changes: [data] } })).json().conflicts[0].reason).toBe("missing-file");
    await app.inject({ method: "PUT", url: `${API}/library/files/${hash}`, headers: { ...admin.headers, "content-type": "application/pdf" }, payload: pdf });
    expect((await app.inject({ method: "POST", url: `${API}/library/changes`, headers: admin.headers, payload: { changes: [data] } })).json().version).toBe(1);
  });
  it("rejects malformed batches atomically and invalid since cursors", async () => {
    const u = await user();
    const good = { kind: "folder", id: "lc-folder", baseVersion: 0, deleted: false, data: { name: "folder" } };
    for (const changes of [[good, { ...good, baseVersion: -1 }], [good, good], [{ ...good, deleted: false, data: null }]]) {
      expect((await app.inject({ method: "POST", url: `${API}/library/changes`, headers: u.headers, payload: { changes } })).statusCode).toBe(400);
      expect(app.hub.counts().library_objects).toBe(0);
    }
    for (const since of ["-1", "NaN", "1.5", "9007199254740992"]) expect((await app.inject({ url: `${API}/library/changes?since=${since}`, headers: u.headers })).statusCode).toBe(400);
  });
});
describe("backup, restore check and legacy import", () => {
  it("backs up a live WAL database, restores it and verifies referenced blobs and row counts", async () => {
    const u = await user("admin@example.org", "admin");
    await publish(u.headers);
    const pdf = Buffer.from("%PDF-1.7\nbackup me");
    app.library.putFile({ id: u.account.id, device: "test" }, sha256(pdf), pdf);
    app.library.push({ id: u.account.id }, { changes: [{ kind: "item", id: "li-backup", baseVersion: 0, deleted: false, data: { title: "backup", attachments: [{ stored: { sha256: sha256(pdf) } }] } }] });
    const dest = join(root, "backup");
    const manifest = backupHub(app.hub, dest);
    expect(manifest.files).toHaveLength(4);
    expect(checkBackup(dest)).toEqual({ serverId: app.hub.server.serverId, files: 4, rows: manifest.rows });
    expect(() => backupHub(app.hub, dest)).toThrow(/비어/);
    const restored = buildHubServer({ home: dest, now: () => time });
    try {
      expect((await restored.inject({ url: `${API}/auth/me`, headers: u.headers })).statusCode).toBe(200);
      expect((await restored.inject({ url: `${API}/entries/entry-example`, headers: u.headers })).json().entry.title).toBe("시험 Workflow");
      expect((await restored.inject({ url: `${API}/library/changes`, headers: u.headers })).json().version).toBe(1);
    } finally { await restored.close(); }
  });
  it("detects tampered blob hashes, missing references, and wrong row counts", async () => {
    const u = await user(); await publish(u.headers);
    const target = join(root, "backup"); const manifest = backupHub(app.hub, target);
    const hash = manifest.files.find((f) => f.path.startsWith("blobs/"))!;
    const original = readFileSync(join(target, hash.path));
    writeFileSync(join(target, hash.path), "tampered");
    expect(() => checkBackup(target)).toThrow(/해시/);
    writeFileSync(join(target, hash.path), original);
    const reduced = structuredClone(manifest); reduced.files = reduced.files.filter((f) => f.path !== hash.path);
    writeFileSync(join(target, "manifest.json"), JSON.stringify(reduced));
    expect(() => checkBackup(target)).toThrow(/빠졌/);
    manifest.rows.accounts++;
    writeFileSync(join(target, "manifest.json"), JSON.stringify(manifest));
    expect(() => checkBackup(target)).toThrow(/행 수/);
  });
  async function legacy() {
    const source = new SharedHubStore(join(root, "legacy")); await source.initialize();
    const actor = { id: "이전 작성자", name: "이전 작성자" };
    const r = record(); r.entry.author = actor.name; delete r.entry.authorId;
    r.entry.revisions[0].registeredBy = actor.name; delete r.entry.revisions[0].registeredById;
    const folder = await source.addFolder("공유 연구", actor); r.entry.folderId = folder.id;
    await source.immutableBytes(r.entry.id, "packages/1.tar.gz", Buffer.from("package archive"));
    await source.write(r); await source.star(r.entry.id, actor, true);
    await source.star(r.entry.id, { id: "계정 없는 동료", name: "계정 없는 동료" }, true);
    await source.addComment(r.entry.id, { id: "계정 없는 동료", name: "계정 없는 동료" }, "이전 댓글");
    await source.recordInstall(r.entry.id, { packageRevision: 1, projectId: "legacy-project", methodKey: "project:sample-workflow", installedAt: new Date(time).toISOString() });
    const second = nextRevision(r);
    second.entry.revisions[1].registeredBy = actor.name; delete second.entry.revisions[1].registeredById;
    await source.immutableBytes(r.entry.id, "packages/2.tar.gz", Buffer.from("second package"));
    second.installs = (await source.read(r.entry.id)).installs;
    await source.write(second);
    return source;
  }
  it("dry-runs without source, record or blob changes, then imports explicit authors idempotently", async () => {
    const u = await user("mapped@example.org", "member", "새 계정 이름");
    const source = await legacy();
    const before = readFileSync(join(source.root, "entries/entry-example/entry.json"));
    const args = { from: source.root, authors: { "이전 작성자": u.account.email } };
    const counts = app.hub.counts(); const blobs = readdirSync(join(app.hub.home, "blobs"));
    expect(await importHub(app.hub, args)).toMatchObject({ dryRun: true, entries: 1, imported: 0, files: 2 });
    expect(app.hub.counts()).toEqual(counts);
    expect(readdirSync(join(app.hub.home, "blobs"))).toEqual(blobs);
    expect(readFileSync(join(source.root, "entries/entry-example/entry.json"))).toEqual(before);
    expect(await importHub(app.hub, { ...args, apply: true })).toMatchObject({ dryRun: false, imported: 1 });
    const imported = await app.store.read("entry-example");
    expect(imported.entry).toMatchObject({ author: "새 계정 이름", authorId: u.account.id, latestRevision: 2 });
    expect(imported.entry.revisions[0].registeredAt).toBe(record().entry.revisions[0].registeredAt);
    expect(imported.installs).toHaveLength(1);
    expect(await app.store.comments("entry-example")).toMatchObject([{ body: "이전 댓글", author: "이전 사용자 · 계정 없는 동료" }]);
    expect(Object.keys(await app.store.stars("entry-example"))).toHaveLength(2);
    expect(await app.store.stars("entry-example")).toHaveProperty(u.account.id, true);
    const after = app.hub.counts();
    expect(await importHub(app.hub, { ...args, apply: true })).toMatchObject({ imported: 0, skipped: 1 });
    expect(app.hub.counts()).toEqual(after);
    expect(readFileSync(join(source.root, "entries/entry-example/entry.json"))).toEqual(before);
  });
  it("keeps a Workflow removed in the local hub removed after import", async () => {
    const u = await user("mapped@example.org", "member", "새 계정 이름"); const source = await legacy();
    await source.remove("entry-example", { id: "이전 작성자", name: "이전 작성자" }, "중복");
    expect(await importHub(app.hub, { from: source.root, authors: { "이전 작성자": u.account.email }, apply: true })).toMatchObject({ imported: 1 });
    expect(await app.store.list()).toEqual([]);
    expect(app.hub.all<{ account_id: string; reason: string }>("SELECT account_id,reason FROM hub_entry_removals")).toEqual([{ account_id: u.account.id, reason: "중복" }]);
  });
  it("refuses unmapped authors and changed imports; explicit fallback is required", async () => {
    const u = await user("mapped@example.org"); const source = await legacy();
    await expect(importHub(app.hub, { from: source.root, authors: {}, apply: true })).rejects.toThrow(/대응표/);
    expect(app.hub.counts().hub_entries).toBe(0);
    await importHub(app.hub, { from: source.root, authors: {}, unmappedTo: u.account.email, apply: true });
    await source.addComment("entry-example", { id: "새 댓글", name: "새 댓글" }, "원본이 바뀌었습니다");
    await expect(importHub(app.hub, { from: source.root, authors: {}, unmappedTo: u.account.email, apply: true })).rejects.toThrow(/원본이 달라/);
  });
  it("rolls back all imported records on invalid source history", async () => {
    const u = await user("mapped@example.org"); const source = await legacy();
    const r = await source.read("entry-example"); r.entry.revisions[1].revision = 3;
    await source.write(r);
    await expect(importHub(app.hub, { from: source.root, authors: { "이전 작성자": u.account.email }, apply: true })).rejects.toThrow(/등록 판/); // hub server operator message (CLI), not researcher copy
    expect(app.hub.counts().hub_entries).toBe(0);
    expect(app.hub.counts().hub_files).toBe(0);
  });
  it("serves the real standalone CLI and stops cleanly on SIGTERM", async () => {
    const probe = createServer();
    await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
    const port = (probe.address() as { port: number }).port;
    await new Promise<void>((done) => probe.close(() => done()));
    const launcher = resolve("../geo/hub-server.mjs");
    const child = spawn(process.execPath, [launcher, "serve", "--host", "127.0.0.1", "--port", String(port), "--home", join(root, "serve-home")],
      { env: { ...process.env, NODE_NO_WARNINGS: "1" }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const exit = new Promise<number | null>((done) => child.once("exit", done));
    try {
      await new Promise<void>((done, reject) => {
        const timeout = setTimeout(() => reject(new Error(output || "Hub did not start")), 10000);
        child.stdout.on("data", (data) => {
          output += data.toString();
          if (output.includes("GAID Settings")) { clearTimeout(timeout); done(); }
        });
        child.stderr.on("data", (data) => { output += data.toString(); });
        child.once("error", (e) => { clearTimeout(timeout); reject(e); });
        child.once("exit", () => { clearTimeout(timeout); reject(new Error(output)); });
      });
      const url = `http://127.0.0.1:${port}`;
      expect((await (await fetch(`${url}/hub/v1/health`)).json()).name).toBe("gaid-hub-server");
      expect((await fetch(`${url}/hub/v1/health`, { headers: { origin: "http://browser" } })).status).toBe(403);
      expect((await fetch(`${url}/projects`)).status).toBe(404);
      child.kill("SIGTERM");
      expect(await exit).toBe(0);
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      await exit;
    }
  }, 15000);
  it("runs launcher invite/users/backup/check-backup commands against an isolated home", () => {
    const launcher = resolve("../geo/hub-server.mjs");
    const home = join(root, "cli-home");
    const cli = (...args: string[]) => execFileSync(process.execPath, [launcher, ...args, "--home", home], { encoding: "utf8", env: { ...process.env, NODE_NO_WARNINGS: "1" } });
    const invite = JSON.parse(cli("invite", "--email", "operator@example.org", "--role", "admin"));
    expect(invite).toMatchObject({ email: "operator@example.org", role: "admin" }); expect(invite.code).toHaveLength(43);
    expect(JSON.parse(cli("users"))).toEqual({ users: [] });
    const target = join(root, "cli-backup");
    expect(JSON.parse(cli("backup", "--to", target)).files).toBe(2);
    expect(JSON.parse(cli("check-backup", target)).rows.invites).toBe(1);
    expect(cli("--help")).toContain("import-hub");
  });
});
