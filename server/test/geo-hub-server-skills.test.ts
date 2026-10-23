/** Skill shelf through the institute-only API, with isolated SQLite/blob homes. No running service is used. */
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { HubSkillRevision } from "../../web/src/geo/contracts/hub-skills.ts";
import type { StoredHubSkill } from "../src/geo/hub-skills/records.ts";
import { backupHub, checkBackup } from "../src/geo/hub-server/backup.ts";
import { sha256 } from "../src/geo/hub-server/core.ts";
import { importHub } from "../src/geo/hub-server/import.ts";
import { buildHubServer, type HubServerApp } from "../src/geo/hub-server/index.ts";
import { HUB_FILE_LIMIT } from "../src/geo/hub-server/protocol.ts";

const API = "/hub/v1/skills";
const password = "correct test password 123";
let root: string;
let app: HubServerApp;
let time: number;
type Headers = Record<string, string>;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gaid-hub-skills-"));
  time = Date.parse("2026-10-22T12:00:00Z");
  app = buildHubServer({ home: join(root, "hub"), now: () => time });
});
afterEach(async () => { await app.close(); rmSync(root, { recursive: true, force: true }); });
async function user(email = "author@example.org", displayName = "연구자") {
  const invite = app.accounts.invite({ email, role: "member" });
  const session = await app.accounts.accept({ code: invite.code!, displayName, password, device: "skill-test-PC" });
  return { ...session, headers: { authorization: `Bearer ${session.token}` } };
}
function revision(n = 1, bytes = Buffer.from(`archive-${n}`), licence: HubSkillRevision["licence"]["state"] = "institute"): HubSkillRevision {
  return { revision: n, archiveSha256: sha256(bytes), size: bytes.length, treeHash: sha256(`tree-${n}`),
    files: [{ path: "SKILL.md", sha256: sha256("skill"), size: 5 }], description: `설명 ${n}`, note: `변경 ${n}`,
    registeredBy: "위조한 이름", registeredById: "forged", registeredAt: "2000-01-01T00:00:00Z",
    origin: { kind: "own" }, licence: { state: licence }, findings: [],
    reviews: [{ state: "checked", by: "위조한 검토자", verified: true, note: "거짓 검토", at: "2000-01-01T00:00:00Z" }] };
}
function record(id = "test-skill", licence: HubSkillRevision["licence"]["state"] = "institute"): StoredHubSkill {
  return { id, name: id, author: "위조한 이름", authorId: "forged", latestRevision: 1, description: "임의의 설명",
    state: "checked", visibility: "hub", tags: ["시험"], formats: [], folderId: "general", updatedAt: "2000-01-01T00:00:00Z",
    revisions: [revision(1, undefined, licence)] };
}
function upload(headers: Headers, id = "test-skill", n = 1, bytes = Buffer.from(`archive-${n}`), hash = sha256(bytes)) {
  return app.inject({ method: "PUT", url: `${API}/${id}/revisions/${n}/archive`, headers: { ...headers, "content-type": "application/gzip", "x-content-sha256": hash }, payload: bytes });
}
const put = (headers: Headers, skill: StoredHubSkill) => app.inject({ method: "PUT", url: `${API}/${skill.id}`, headers, payload: skill });
const get = (headers: Headers, path = "/test-skill") => app.inject({ url: `${API}${path}`, headers });
async function publish(headers: Headers, skill = record()) {
  expect((await upload(headers, skill.id)).statusCode).toBe(204);
  const result = await put(headers, skill);
  expect(result.statusCode, result.body).toBe(200);
  return result.json<StoredHubSkill>();
}
async function append(headers: Headers, skill: StoredHubSkill, licence: HubSkillRevision["licence"]["state"] = "institute") {
  const next = structuredClone(skill);
  next.latestRevision++;
  next.revisions.push(revision(next.latestRevision, undefined, licence));
  expect((await upload(headers, skill.id, next.latestRevision)).statusCode).toBe(204);
  const result = await put(headers, next);
  expect(result.statusCode, result.body).toBe(200);
  return result.json<StoredHubSkill>();
}
function review(headers: Headers, state = "checked", note = "읽고 확인했습니다", replacement?: string, n = 1) {
  return app.inject({ method: "POST", url: `${API}/test-skill/revisions/${n}/reviews`, headers,
    payload: { state, note, ...(replacement !== undefined ? { replacement } : {}), by: "forged", byId: "forged", at: "forged", verified: false } });
}

describe("skill storage and account visibility", () => {
  it("upgrades a version-1 home in place and keeps accounts, sessions and folders", async () => {
    const u = await user();
    const folder = await app.store.addFolder("이전 주제", { id: u.account.id, name: u.account.displayName });
    const serverId = app.hub.server.serverId;
    app.hub.db.exec("DROP TABLE hub_entry_removals; DROP TABLE orcid_states; DROP TABLE account_orcid; DROP TABLE feed_items; DROP TABLE feed_sources; DROP TABLE hub_skill_comments; DROP TABLE hub_skill_stars; DROP TABLE hub_skill_archives; DROP TABLE hub_skill_imports; DROP TABLE hub_skills; DELETE FROM schema_migrations WHERE version>=2");
    await app.close();
    app = buildHubServer({ home: join(root, "hub"), now: () => time });
    expect(app.hub.server.serverId).toBe(serverId);
    expect(app.hub.counts()).toMatchObject({ accounts: 1, schema_migrations: 5, hub_entry_removals: 0, hub_skills: 0, hub_skill_archives: 0 });
    expect((await app.inject({ url: "/hub/v1/auth/me", headers: u.headers })).json().account.id).toBe(u.account.id);
    expect(await app.store.folders()).toContainEqual(folder);
    await publish(u.headers);
    await app.close();
    app = buildHubServer({ home: join(root, "hub"), now: () => time });
    expect((await get(u.headers)).json().id).toBe("test-skill");
    expect(app.hub.counts().schema_migrations).toBe(5);
  });
  it("sets account identity, times and derived fields; preserves old revisions and reviews on append", async () => {
    const author = await user();
    const reader = await user("reader@example.org", "동료");
    const first = await publish(author.headers);
    expect(first).toMatchObject({ authorId: author.account.id, author: author.account.displayName, description: "설명 1", state: "unreviewed", visibility: "hub", updatedAt: new Date(time).toISOString() });
    expect(first.revisions[0]).toMatchObject({ registeredById: author.account.id, registeredBy: author.account.displayName, registeredAt: new Date(time).toISOString(), reviews: [] });
    expect((await review(reader.headers)).statusCode).toBe(200);
    const original = (await get(author.headers)).json<StoredHubSkill>();
    const next = structuredClone(original);
    next.revisions[0].description = "덮어쓰기 시도";
    next.revisions[0].reviews = [];
    time += 1000;
    const second = await append(author.headers, next);
    expect(second.revisions[0]).toEqual(original.revisions[0]);
    expect(second.revisions[1].reviews).toEqual([]);
    expect(second).toMatchObject({ state: "unreviewed", latestRevision: 2, description: "설명 2" });
    expect((await get(reader.headers)).json().revisions).toHaveLength(2);
    expect((await put(reader.headers, second)).statusCode).toBe(403);
    expect((await put(author.headers, second)).statusCode).toBe(409);
    const changed = structuredClone(second); changed.tags = ["metadata-only"];
    expect((await put(author.headers, changed)).statusCode).toBe(409);
    const audits = app.hub.all<{ action: string; device: string }>("SELECT action,device FROM audit_events WHERE target='test-skill'");
    expect(audits.filter((a) => a.action === "skill.write")).toHaveLength(2);
    expect(audits.every((a) => a.device === "skill-test-PC")).toBe(true);
  });
  it("requires matching readable archive, next revision and an existing folder", async () => {
    const u = await user(); const skill = record();
    expect((await put(u.headers, skill)).statusCode).toBe(409);
    await upload(u.headers);
    skill.folderId = "absent";
    expect((await put(u.headers, skill)).statusCode).toBe(404);
    skill.folderId = "general";
    skill.revisions[0].size++;
    expect((await put(u.headers, skill)).statusCode).toBe(409);
    skill.revisions[0].size--;
    skill.revisions[0].archiveSha256 = sha256("other");
    expect((await put(u.headers, skill)).statusCode).toBe(409);
    skill.revisions[0].archiveSha256 = sha256("archive-1");
    writeFileSync(app.hub.blobPath(sha256("archive-1")), "corrupt");
    expect((await put(u.headers, skill)).statusCode).toBe(409);
    rmSync(app.hub.blobPath(sha256("archive-1")));
    expect((await put(u.headers, skill)).statusCode).toBe(409);
  });
  it("keeps archives write-once, reserves the whole id and rejects oversized/bad-hash uploads", async () => {
    const a = await user(); const b = await user("b@example.org");
    expect((await upload(a.headers)).statusCode).toBe(204);
    expect((await upload(a.headers)).statusCode).toBe(204);
    expect((await get(a.headers, "/test-skill/revisions/1/archive")).statusCode).toBe(404);
    expect((await upload(a.headers, "test-skill", 1, Buffer.from("other"))).statusCode).toBe(409);
    expect((await upload(b.headers)).statusCode).toBe(403);
    expect((await upload(b.headers, "test-skill", 2)).statusCode).toBe(403);
    expect((await put(b.headers, record())).statusCode).toBe(403);
    expect((await upload(a.headers, "test-skill", 2, undefined, "bad")).statusCode).toBe(400);
    expect((await upload(a.headers, "test-skill", 2, undefined, sha256("wrong"))).statusCode).toBe(400);
    expect((await upload(a.headers, "test-skill", 2, Buffer.alloc(HUB_FILE_LIMIT + 1))).statusCode).toBe(413);
    await put(a.headers, record());
    expect((await upload(b.headers, "test-skill", 3)).statusCode).toBe(403);
    const archive = await get(b.headers, "/test-skill/revisions/1/archive");
    expect(archive.statusCode).toBe(200); expect(archive.rawPayload).toEqual(Buffer.from("archive-1"));
    expect(archive.headers["content-type"]).toContain("application/gzip");
  });
  it("filters revisions, archives and comments by licence and hides a restricted latest skill", async () => {
    const a = await user(); const b = await user("b@example.org");
    const first = await publish(a.headers, record("test-skill", "restricted"));
    await app.inject({ method: "POST", url: `${API}/test-skill/comments`, headers: a.headers, payload: { body: "비공개 판 댓글" } });
    expect((await get(b.headers)).statusCode).toBe(404);
    expect((await get(b.headers, "")).json().skills).toEqual([]);
    expect((await review(b.headers)).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: `${API}/test-skill/comments`, headers: b.headers, payload: { body: "거절" } })).statusCode).toBe(403);
    const second = await append(a.headers, first, "declared");
    expect((await get(b.headers)).json().revisions.map((r: HubSkillRevision) => r.revision)).toEqual([2]);
    expect((await get(b.headers, "/test-skill/revisions/1/archive")).statusCode).toBe(404);
    expect((await get(b.headers, "/test-skill/revisions/2/archive")).statusCode).toBe(200);
    expect((await get(b.headers, "/test-skill/comments")).json().comments).toEqual([]);
    await append(a.headers, second, "unknown");
    expect((await get(b.headers)).statusCode).toBe(404);
    expect((await get(b.headers, "/test-skill/revisions/2/archive")).statusCode).toBe(404);
    expect((await get(b.headers, "/test-skill/stars")).statusCode).toBe(404);
    expect((await get(a.headers)).json().revisions).toHaveLength(3);
  });
  it("sorts the visible list by updated time and id", async () => {
    const a = await user();
    await publish(a.headers, record("b-skill")); await publish(a.headers, record("a-skill"));
    time += 1000; await publish(a.headers, record("z-skill"));
    expect((await get(a.headers, "")).json().skills.map((s: StoredHubSkill) => s.id)).toEqual(["z-skill", "a-skill", "b-skill"]);
  });
});

describe("authenticated reviews and social records", () => {
  it("uses account ids for reviews even with equal display names, and updates only the reviewed revision", async () => {
    const a = await user(); const b = await user("b@example.org", a.account.displayName);
    let skill = await publish(a.headers);
    expect((await review(a.headers)).statusCode).toBe(403);
    const checked = await review(b.headers);
    expect(checked.statusCode).toBe(200);
    expect(checked.json().reviews).toEqual([{ state: "checked", by: b.account.displayName, byId: b.account.id, verified: true, at: new Date(time).toISOString(), note: "읽고 확인했습니다" }]);
    skill = (await get(a.headers)).json();
    await append(a.headers, skill);
    time += 1000;
    expect((await review(b.headers, "suspended")).statusCode).toBe(200);
    const current = (await get(a.headers)).json<StoredHubSkill>();
    expect(current.state).toBe("unreviewed"); expect(current.revisions[0].reviews.at(-1)?.state).toBe("suspended");
    expect(current.updatedAt).toBe(new Date(time).toISOString());
    expect((await review(b.headers, "suspended", "다음 판도 보류", undefined, 2)).statusCode).toBe(200);
    expect((await get(a.headers)).json().state).toBe("suspended");
  });
  it("validates state, note and deprecated replacements", async () => {
    const a = await user(); const b = await user("b@example.org");
    await publish(a.headers); await publish(a.headers, record("replacement-skill"));
    for (const args of [["unreviewed", "메모"], ["checked", ""], ["checked", "  "], ["checked", "x".repeat(4001)],
      ["checked", "메모", "replacement-skill"], ["deprecated", "메모", "test-skill"], ["deprecated", "메모", "missing-skill"], ["deprecated", "메모", "Bad name"]]) {
      expect((await review(b.headers, args[0], args[1], args[2])).statusCode).toBe(400);
    }
    expect((await review(b.headers, "deprecated", "대체할 절차를 확인했습니다", "replacement-skill")).statusCode).toBe(200);
    expect((await review(a.headers, "suspended")).statusCode).toBe(200);
    expect((await review(b.headers, "checked", "없음", undefined, 99)).statusCode).toBe(404);
    expect(app.hub.counts().hub_skills).toBe(2);
  });
  it("binds comments to the current revision and stars to accounts across devices/name changes", async () => {
    const a = await user(); const b = await user("b@example.org", "동료");
    const first = await publish(a.headers); await append(a.headers, first);
    const comment = await app.inject({ method: "POST", url: `${API}/test-skill/comments`, headers: b.headers, payload: { body: "  두 번째 판 의견  ", author: "위조자", revision: 1 } });
    expect(comment.statusCode).toBe(201);
    expect(comment.json()).toMatchObject({ entryId: "test-skill", author: "동료", authorId: b.account.id, revision: 2, body: "두 번째 판 의견" });
    expect((await get(a.headers, "/test-skill/comments")).json().comments).toHaveLength(1);
    const star = (headers: Headers, on: unknown) => app.inject({ method: "POST", url: `${API}/test-skill/star`, headers, payload: { on } });
    expect((await star(b.headers, "true")).statusCode).toBe(400);
    expect((await star(b.headers, true)).json()).toEqual({ stars: 1, starredByMe: true });
    const login = await app.accounts.login({ email: b.account.email, password, device: "another-PC" }, "127.0.0.1");
    if (login instanceof Error) throw login;
    const headers = { authorization: `Bearer ${login.token}` };
    expect((await star(headers, true)).json()).toEqual({ stars: 1, starredByMe: true });
    expect((await get(headers, "/test-skill/stars")).json().stars).toEqual({ [b.account.id]: true });
    expect((await star(headers, false)).json()).toEqual({ stars: 0, starredByMe: false });
    expect(app.hub.all("SELECT id FROM audit_events WHERE action IN ('skill.comment','skill.star')")).toHaveLength(4);
  });
});

describe("skill backup and local-store import", () => {
  function legacy() {
    const source = join(root, "legacy");
    mkdirSync(join(source, "entries"), { recursive: true });
    writeFileSync(join(source, "folders.json"), JSON.stringify([{ id: "general", name: "일반", createdBy: "GAID", createdAt: "2020-01-01T00:00:00Z" }]));
    const skill = record(); skill.author = "이전 작성자"; delete skill.authorId;
    skill.latestRevision = 2; skill.revisions.push(revision(2)); skill.updatedAt = "2021-02-03T00:00:00Z";
    for (const r of skill.revisions) {
      r.registeredBy = r.revision === 1 ? "이전 작성자" : "이전 등록자"; delete r.registeredById;
      r.reviews = [{ state: "checked", by: "대응된 검토자", byId: "forged", verified: true, note: "이전 검토", at: "2020-02-01T00:00:00Z" },
        { state: "suspended", by: "계정 없는 동료", verified: false, note: "이전 보류", at: "2020-03-01T00:00:00Z" }];
    }
    const dir = join(source, "skills", skill.id);
    mkdirSync(join(dir, "packages"), { recursive: true });
    writeFileSync(join(dir, "skill.json"), JSON.stringify({ schemaVersion: "gaid-hub-skill/v1", skill }));
    for (const r of skill.revisions) writeFileSync(join(dir, `packages/${r.revision}.tar.gz`), `archive-${r.revision}`);
    writeFileSync(join(dir, "comments.jsonl"), JSON.stringify({ id: "comment-old", entryId: skill.id, author: "계정 없는 동료", body: "이전 댓글", revision: 1, at: "2020-04-01T00:00:00Z" }) + "\n");
    writeFileSync(join(dir, "stars.json"), JSON.stringify({ "이전 작성자": true, "계정 없는 동료": true }));
    return { source, skill, dir };
  }
  it("still checks a version-1 backup without changing its original files", async () => {
    await user();
    const target = join(root, "v1-backup");
    const manifest = backupHub(app.hub, target);
    const database = join(target, "hub.sqlite");
    const db = new DatabaseSync(database);
    db.exec("DROP TABLE hub_entry_removals; DROP TABLE orcid_states; DROP TABLE account_orcid; DROP TABLE feed_items; DROP TABLE feed_sources; DROP TABLE hub_skill_comments; DROP TABLE hub_skill_stars; DROP TABLE hub_skill_archives; DROP TABLE hub_skill_imports; DROP TABLE hub_skills; DELETE FROM schema_migrations WHERE version>=2");
    db.close();
    for (const table of ["hub_skill_comments", "hub_skill_stars", "hub_skill_archives", "hub_skill_imports", "hub_skills"]) delete manifest.rows[table];
    delete manifest.rows.feed_items; delete manifest.rows.feed_sources; delete manifest.rows.account_orcid; delete manifest.rows.orcid_states; delete manifest.rows.hub_entry_removals;
    manifest.rows.schema_migrations = 1;
    const bytes = readFileSync(database);
    const file = manifest.files.find((f) => f.path === "hub.sqlite")!; file.sha256 = sha256(bytes); file.size = bytes.length;
    writeFileSync(join(target, "manifest.json"), JSON.stringify(manifest));
    expect(checkBackup(target)).toMatchObject({ rows: manifest.rows });
    expect(readFileSync(database)).toEqual(bytes);
  });
  it("backs up and verifies every skill archive, including staged uploads; restores sessions and skill records", async () => {
    const a = await user(); const skill = await publish(a.headers); await append(a.headers, skill);
    await upload(a.headers, "unpublished-skill", 1, Buffer.from("staged"));
    const target = join(root, "backup"); const manifest = backupHub(app.hub, target);
    expect(manifest.files).toHaveLength(5);
    expect(manifest.rows.hub_skills).toBe(1); expect(manifest.rows.hub_skill_archives).toBe(3);
    expect(checkBackup(target)).toMatchObject({ files: 5, rows: manifest.rows });
    const restoreHome = join(root, "restore"); cpSync(target, restoreHome, { recursive: true });
    const restored = buildHubServer({ home: restoreHome });
    try { expect((await restored.inject({ url: `${API}/test-skill/revisions/2/archive`, headers: a.headers })).rawPayload).toEqual(Buffer.from("archive-2")); }
    finally { await restored.close(); }
    const file = manifest.files.find((f) => f.path === `blobs/${sha256("archive-1")}`)!;
    const reduced = structuredClone(manifest); reduced.files = reduced.files.filter((f) => f.path !== file.path);
    writeFileSync(join(target, "manifest.json"), JSON.stringify(reduced));
    expect(() => checkBackup(target)).toThrow(/빠졌/);
    writeFileSync(join(target, "manifest.json"), JSON.stringify(manifest));
    writeFileSync(join(target, file.path), "tampered");
    expect(() => checkBackup(target)).toThrow(/해시/);
  });
  it("dry-runs without writes, imports history and mapped/legacy identities, then skips unchanged imports", async () => {
    const a = await user(); const b = await user("b@example.org", "동료");
    const { source, skill, dir } = legacy();
    const args = { from: source, authors: { "이전 작성자": a.account.email, "이전 등록자": b.account.email, "대응된 검토자": b.account.email } };
    const counts = app.hub.counts(); const blobs = readdirSync(join(app.hub.home, "blobs"));
    const original = readFileSync(join(dir, "skill.json"));
    expect(await importHub(app.hub, args)).toMatchObject({ dryRun: true, skills: 1, skillsImported: 0, skillsSkipped: 0, skillArchives: 2, skillComments: 1, skillStars: 2 });
    expect(app.hub.counts()).toEqual(counts); expect(readdirSync(join(app.hub.home, "blobs"))).toEqual(blobs);
    expect(await importHub(app.hub, { ...args, apply: true })).toMatchObject({ skillsImported: 1, skillsSkipped: 0 });
    const imported = (await get(a.headers)).json<StoredHubSkill>();
    expect(imported).toMatchObject({ authorId: a.account.id, author: a.account.displayName, updatedAt: skill.updatedAt, state: "suspended" });
    expect(imported.revisions[0]).toMatchObject({ registeredById: a.account.id, registeredAt: skill.revisions[0].registeredAt });
    expect(imported.revisions[1]).toMatchObject({ registeredById: b.account.id, registeredAt: skill.revisions[1].registeredAt });
    expect(imported.revisions[0].reviews[0]).toMatchObject({ byId: b.account.id, by: "동료", verified: false, at: "2020-02-01T00:00:00Z" });
    expect(imported.revisions[0].reviews[1]).toMatchObject({ byId: `legacy-${sha256("계정 없는 동료")}`, by: "이전 사용자 · 계정 없는 동료", verified: false });
    expect((await get(a.headers, "/test-skill/comments")).json().comments[0]).toMatchObject({ authorId: `legacy-${sha256("계정 없는 동료")}`, at: "2020-04-01T00:00:00Z" });
    expect((await get(a.headers, "/test-skill/stars")).json().stars).toEqual({ [a.account.id]: true, [`legacy-${sha256("계정 없는 동료")}`]: true });
    expect(readFileSync(join(dir, "skill.json"))).toEqual(original);
    const after = app.hub.counts();
    expect(await importHub(app.hub, { ...args, apply: true })).toMatchObject({ skillsImported: 0, skillsSkipped: 1 });
    expect(app.hub.counts()).toEqual(after);
    expect((await review(b.headers, "checked", "자신이 등록한 둘째 판", undefined, 2)).statusCode).toBe(403);
    expect((await review(a.headers, "checked", "다른 등록자의 둘째 판", undefined, 2)).statusCode).toBe(200);
  });
  it("requires every author/registrant mapping, permits explicit fallback and refuses changed imports", async () => {
    const a = await user(); const { source, dir } = legacy();
    await expect(importHub(app.hub, { from: source, authors: { "이전 작성자": a.account.email } })).rejects.toThrow(/대응표/);
    expect(app.hub.counts().hub_skills).toBe(0);
    await importHub(app.hub, { from: source, authors: {}, unmappedTo: a.account.email, apply: true });
    writeFileSync(join(dir, "stars.json"), JSON.stringify({ "바뀐 동료": true }));
    await expect(importHub(app.hub, { from: source, authors: {}, unmappedTo: a.account.email, apply: true })).rejects.toThrow(/원본이 달라/);
  });
  it("refuses collisions, corrupted archives and invalid history without committing records", async () => {
    const a = await user(); const { source, skill, dir } = legacy();
    const args = { from: source, authors: {}, unmappedTo: a.account.email, apply: true };
    writeFileSync(join(dir, "packages/2.tar.gz"), "corrupt");
    await expect(importHub(app.hub, args)).rejects.toThrow(/해시/);
    writeFileSync(join(dir, "packages/2.tar.gz"), "archive-2");
    skill.folderId = "missing";
    writeFileSync(join(dir, "skill.json"), JSON.stringify({ schemaVersion: "gaid-hub-skill/v1", skill }));
    const counts = app.hub.counts();
    await expect(importHub(app.hub, args)).rejects.toThrow(/폴더/);
    expect(app.hub.counts()).toEqual(counts);
    await publish(a.headers);
    await expect(importHub(app.hub, args)).rejects.toThrow(/같은 식별자/);
  });
});
