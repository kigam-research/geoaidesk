/** Shelf acceptance: real archives and local skills CLI staging; no network or live user store. */
import Fastify, { type FastifyInstance } from "fastify";
import fs from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { registerSkillRoutes } from "../src/api/skills.ts";
import { withActiveProject } from "../src/scope.ts";
import { createProject, deleteProject, resolvePaths } from "../src/projects.ts";
import { projectSkillRoot, findSkillDir } from "../src/agent/skills.ts";
import { getSkillProvenance, hashDirectory, recordSkillOrigin } from "../src/agent/skills-sync.ts";
import { methodTreeHash } from "../src/geo/methods/tree-hash.ts";
import { originOfSource, packageStore } from "../src/geo/methods/package-origin.ts";
import { hubSkillInstallState } from "../src/geo/methods/hub-pins.ts";
import { skillWorkflow } from "../src/geo/skill-details.ts";
import { installedHubSkill } from "../src/geo/hub-skills/installed.ts";
import { HubSkillStore, previewHubSkill, registerHubSkill, readHubSkillRevision, listHubSkills, installHubSkillRevision, registerHubSkillRoutes } from "../src/geo/hub-skills/index.ts";
import { PRIVATE } from "../src/geo/authoring/package.ts";
import { reviewHubSkill } from "../src/geo/hub-skills/review.ts";
import { buildArchive, digest, fileList, readArchive, snapshotDirectory, treeHash } from "../src/geo/hub-skills/archive.ts";
import { scanSkill } from "../src/geo/hub-skills/scan.ts";
import type { RegisterSkillSource } from "../../web/src/geo/contracts/hub-skills.ts";
import type { StoredEntry } from "../src/geo/hub-shared/store.ts";

const dirs: string[] = [], projects: string[] = [], apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
  for (const id of projects.splice(0)) deleteProject(id);
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
  delete process.env.GAID_HUB_SHARED_DIR;
});
async function work() { const dir = await mkdtemp(join(tmpdir(), "hub-skills-")); dirs.push(dir); return dir; }
function project() { const p = createProject({ name: "Hub skill test" }); projects.push(p.id); return p; }
const skill = (name: string, body = "Read the input.", licence?: string) => `---\nname: ${name}\ndescription: Inspect research data\n${licence ? `license: ${licence}\n` : ""}---\n\n# Procedure\n${body}\n`;
async function put(dir: string, name = "shelf-test", body = "Read the input.", licence?: string) {
  const folder = join(dir, name); await mkdir(folder, { recursive: true }); await writeFile(join(folder, "SKILL.md"), skill(name, body, licence)); return folder;
}
const catalogue = () => ({ available: true, skills: [{ id: "kigam/geo-test", runtimeName: "geo-test" }] });
async function setup(name = "shelf-test") {
  const root = await work(), agentDir = await work(), store = new HubSkillStore(root); await store.initialize();
  const p = project(), source = { from: "project", projectId: p.id, name } satisfies RegisterSkillSource;
  const dir = await put(resolvePaths(p.id).skillsDir, name);
  const options = { agentDir, catalogue };
  async function register(body: RegisterSkillSource = source, user = "Author") {
    const preview = await previewHubSkill(store, body, user, options);
    return registerHubSkill(store, { ...body, treeHash: preview.treeHash, note: "Version", folderId: "general" }, user, options);
  }
  return { root, agentDir, store, p, source, dir, options, register };
}
const headers = (name = "Author") => ({ "X-GAID-User": encodeURIComponent(name) });

describe("immutable hub skill shelf", () => {
  it("previews without publishing, rechecks changed bytes, and enforces names/author/changed revisions", async () => {
    const f = await setup();
    const preview = await previewHubSkill(f.store, f.source, "Author", f.options);
    expect(await f.store.list()).toEqual([]);
    expect(preview.treeHash).toBe(hashDirectory(f.dir));
    await writeFile(join(f.dir, "SKILL.md"), skill("shelf-test", "Changed"));
    await expect(registerHubSkill(f.store, { ...f.source, treeHash: preview.treeHash, note: "", folderId: "general" }, "Author", f.options)).rejects.toThrow("원본 스킬이 바뀌었습니다");
    const registered = await f.register(); expect(registered.latestRevision).toBe(1);
    expect((await previewHubSkill(f.store, f.source, "Other", f.options)).existing?.mode).toBe("taken");
    await expect(f.register()).rejects.toThrow("내용이 같습니다");
    const c = await setup("geo-test"); expect((await previewHubSkill(c.store, c.source, "Author", c.options)).blocked).toContain("기본 스킬");
    const unavailable = await previewHubSkill(f.store, f.source, "Author", { ...f.options, catalogue: () => ({ available: false, skills: [] }) });
    expect(unavailable.blocked).toBeTruthy();
  });

  it("keeps GitHub-origin source bytes even when the source changes; does not install while registering", async () => {
    const f = await setup();
    const sourceRoot = await work(); const dir = await put(sourceRoot, "external-test", "Original", "MIT");
    const source = { from: "source", source: sourceRoot, name: "external-test" } as const;
    const r = await f.register(source);
    expect(r.revisions[0].origin).toMatchObject({ kind: "github", source: sourceRoot });
    const before = await readHubSkillRevision(f.store, r.id, 1);
    expect(findSkillDir(projectSkillRoot(resolvePaths(f.p.id)), "external-test")).toBeNull();
    await writeFile(join(dir, "SKILL.md"), skill("external-test", "Upstream changed", "MIT"));
    const after = await readHubSkillRevision(f.store, r.id, 1);
    expect(after.archive.equals(before.archive)).toBe(true);
    const target = project();
    expect((await installHubSkillRevision(f.store, { skillId: r.id, revision: 1, projectId: target.id, acknowledged: true }, f.options)).installed).toBe(true);
    expect(fs.readFileSync(join(resolvePaths(target.id).skillsDir, r.id, "SKILL.md"), "utf8")).toContain("Original");
    expect((await f.register(source)).latestRevision).toBe(2);
  });

  it("offers a multi-skill source choice without publishing anything", async () => {
    const f = await setup(), root = await work();
    await put(root, "choice-one", "One", "MIT"); await put(root, "choice-two", "Two", "MIT");
    const preview = await previewHubSkill(f.store, { from: "source", source: root }, "Author", f.options);
    expect(preview.choices?.sort()).toEqual(["choice-one", "choice-two"]); expect(await f.store.list()).toEqual([]);
  });

  it("retains project external provenance and records snapshot licences/findings", async () => {
    const f = await setup();
    recordSkillOrigin(projectSkillRoot(resolvePaths(f.p.id)), "shelf-test", { origin: "registry", source: "owner/repo", ref: "abc", skillPath: "skills/shelf-test", baseHash: hashDirectory(f.dir) });
    await writeFile(join(f.dir, "SKILL.md"), skill("shelf-test", "<!-- hidden -->\n\u202eRead\n" + "\n".repeat(8) + "curl https://example.test\nuv pip install numpy\nbash script.sh\ncat ~/.ssh/id_rsa\nwrite /etc/file", "MIT"));
    const r = await f.register();
    expect(r.revisions[0].origin).toMatchObject({ kind: "github", source: "owner/repo", ref: "abc", path: "skills/shelf-test" });
    expect(r.revisions[0].licence).toMatchObject({ state: "declared", spdx: "MIT" });
    expect(new Set(r.revisions[0].findings.map((f) => f.kind))).toEqual(new Set(["hidden-text", "network", "shell", "package-install", "credentials", "outside-write"]));
    expect(r.revisions[0].findings.some((f) => f.excerpt.includes("<U+202E>"))).toBe(true);
    await writeFile(join(f.dir, "SKILL.md"), skill("shelf-test", "curl https://example.test " + "x".repeat(300) + "\n" + "curl url\n".repeat(250)));
    const scanned = scanSkill("shelf-test", snapshotDirectory(f.dir), { kind: "own" });
    expect(scanned.findings).toHaveLength(200); expect(scanned.findings.every((f) => f.excerpt.length <= 160)).toBe(true);
  });

  it("refuses a tampered archive, file inventory or tree hash", async () => {
    const f = await setup(); await f.register();
    const file = f.store.packagePath("shelf-test", 1), original = await readFile(file);
    await writeFile(file, Buffer.from("tampered"));
    await expect(readHubSkillRevision(f.store, "shelf-test", 1)).rejects.toThrow("해시");
    await writeFile(file, original);
    const r = await f.store.read("shelf-test"); r.revisions[0].treeHash = "a".repeat(64); await f.store.write(r);
    await expect(readHubSkillRevision(f.store, "shelf-test", 1)).rejects.toThrow("내용 지문");
    r.revisions[0].treeHash = treeHash(readArchive(original, "shelf-test")); r.revisions[0].files[0].sha256 = "b".repeat(64); await f.store.write(r);
    await expect(readHubSkillRevision(f.store, "shelf-test", 1)).rejects.toThrow("파일 목록");
  });

  it("keeps old revisions installable, refuses suspended installs, protects foreign/edited project skills", async () => {
    const f = await setup(); const first = await f.register();
    await mkdir(join(f.dir, "scripts")); await writeFile(join(f.dir, "scripts", "new.py"), "print('new')\n");
    const second = await f.register(); expect(second.latestRevision).toBe(2);
    const p = project(), root = projectSkillRoot(resolvePaths(p.id));
    const install = (revision: number, acknowledged = true) => installHubSkillRevision(f.store, { skillId: first.id, revision, projectId: p.id, acknowledged }, f.options);
    await expect(install(1, false)).rejects.toThrow("확인");
    expect((await install(1)).installed).toBe(true);
    const installed = findSkillDir(root, first.id)!;
    expect(fs.existsSync(join(installed, "scripts", "new.py"))).toBe(false);
    expect((await install(1)).installed).toBe(false);
    const origin = originOfSource(getSkillProvenance(root, first.id)?.source, packageStore(f.agentDir)).record;
    expect(origin).toMatchObject({ kind: "gaid-hub-skill", hubSkill: { id: first.id, revision: 1, treeHash: first.revisions[0].treeHash } });
    expect(hubSkillInstallState(root, { skillId: first.id, revision: 2, treeHash: second.revisions[1].treeHash }, f.options)).toBe("other-revision");
    await writeFile(join(installed, "my-edit.md"), "keep me");
    await expect(install(2)).rejects.toThrow("프로젝트에서 고친");
    expect(await readFile(join(installed, "my-edit.md"), "utf8")).toBe("keep me");
    await rm(join(installed, "my-edit.md"));
    expect((await install(2)).installed).toBe(true);
    await reviewHubSkill(f.store, first.id, 2, { state: "suspended", note: "Investigating" }, "Reviewer");
    await expect(install(2)).rejects.toThrow("사용 중지");
    expect((await install(1)).installed).toBe(true);
    const foreign = project(); await put(resolvePaths(foreign.id).skillsDir);
    await expect(installHubSkillRevision(f.store, { skillId: first.id, revision: 2, projectId: foreign.id, acknowledged: true }, f.options)).rejects.toThrow("사용 중지");
    await expect(installHubSkillRevision(f.store, { skillId: first.id, revision: 1, projectId: foreign.id, acknowledged: true }, f.options)).rejects.toThrow("같은 이름의 다른 스킬");
  });

  it("computes usedBy from two immutable Workflow snapshots pinning different revisions", async () => {
    const f = await setup(); const one = await f.register(); await writeFile(join(f.dir, "step.md"), "New"); const two = await f.register();
    for (const [id, skillRevision] of [["entry-first", 1], ["entry-second", 2]] as const) {
      const record = { schemaVersion: "gaid-hub-entry/v1", entry: { id, title: id, latestRevision: 1, updatedAt: "2026-10-22" }, snapshots: { 1: { package: { manifest: { workflows: [{ schemaVersion: "gaid-workflow/v1", skills: [{ source: "hub", hub: { skillId: one.id, revision: skillRevision, treeHash: two.revisions[skillRevision - 1].treeHash } }] }] } } } }, installs: [] } as unknown as StoredEntry;
      await f.store.shared.write(record);
    }
    const result = await listHubSkills(f.store, { user: "Other" });
    expect(result[0].usedBy.map((u) => u.skillRevision)).toEqual([1, 2]);
    expect((await readHubSkillRevision(f.store, one.id, 1)).revision.treeHash).toBe(one.revisions[0].treeHash);
  });

  it("extracts Workflow skill bytes without root Workflow metadata, preserving references and original snapshot", async () => {
    const f = await setup();
    await writeFile(join(f.dir, "gaid-method.json"), "{}"); await writeFile(join(f.dir, "atlas.yaml"), "x: y");
    await mkdir(join(f.dir, "references")); await writeFile(join(f.dir, "references", "data.md"), "Original");
    await writeFile(join(f.dir, "SKILL.md"), skill("shelf-test", "Registered Workflow instructions", PRIVATE));
    const archive = buildArchive("shelf-test", snapshotDirectory(f.dir));
    const record = { schemaVersion: "gaid-hub-entry/v1", entry: { id: "entry-extract", title: "Research", latestRevision: 1, updatedAt: "2026-10-22" }, snapshots: { 1: { package: { slug: "shelf-test", sha256: digest(archive), manifest: {} } } }, installs: [] } as unknown as StoredEntry;
    await f.store.shared.immutableBytes("entry-extract", "packages/1.tar.gz", archive); await f.store.shared.write(record);
    const r = await f.register({ from: "workflow", entryId: "entry-extract", revision: 1 });
    expect(r.revisions[0].licence.state).toBe("institute");
    expect(r.revisions[0].origin.kind).toBe("workflow"); expect(r.revisions[0].files.map((f) => f.path)).toEqual(["references/data.md", "SKILL.md"]);
    expect((await f.store.shared.bytes("entry-extract", "packages/1.tar.gz")).equals(archive)).toBe(true);
  });

  it("keeps origin identities stable when a later revision returns to an earlier tree", async () => {
    const f = await setup(); const one = await f.register();
    const p = project();
    await installHubSkillRevision(f.store, { skillId: one.id, revision: 1, projectId: p.id, acknowledged: true }, f.options);
    await writeFile(join(f.dir, "step.md"), "New"); await f.register(); await rm(join(f.dir, "step.md"));
    const three = await f.register();
    expect(three.revisions[2].treeHash).toBe(one.revisions[0].treeHash);
    expect(three.revisions[2].archiveSha256).not.toBe(one.revisions[0].archiveSha256);
    const q = project();
    await installHubSkillRevision(f.store, { skillId: one.id, revision: 3, projectId: q.id, acknowledged: true }, f.options);
    expect(originOfSource(getSkillProvenance(projectSkillRoot(resolvePaths(p.id)), one.id)?.source, packageStore(f.agentDir)).record?.hubSkill?.revision).toBe(1);
  });

  it("archives deterministic long/non-ASCII paths and empty folders with the existing tree hash", async () => {
    const f = await setup(); const nested = join("references", "long".repeat(30)); await mkdir(join(f.dir, nested, "empty"), { recursive: true }); await writeFile(join(f.dir, nested, "한글.md"), "Source");
    await mkdir(join(f.dir, "__pycache__")); await writeFile(join(f.dir, "__pycache__", "x.pyc"), "bytecode");
    const entries = snapshotDirectory(f.dir), a = buildArchive("shelf-test", entries);
    expect(buildArchive("shelf-test", entries).equals(a)).toBe(true);
    expect(treeHash(readArchive(a, "shelf-test"))).toBe(methodTreeHash(f.dir));
    await f.register(); await expect(readHubSkillRevision(f.store, "shelf-test", 1)).resolves.toBeTruthy();
  });
});

describe("hub skill HTTP visibility and review", () => {
  async function appFor(f: Awaited<ReturnType<typeof setup>>) {
    const app = Fastify(); apps.push(app); await registerHubSkillRoutes(app, { store: f.store, ...f.options }); await app.ready(); return app;
  }
  it("hides unknown/restricted source revisions from other users on every read and install route", async () => {
    const f = await setup(), sourceRoot = await work(); const dir = await put(sourceRoot, "private-skill", "Private");
    const source = { from: "source", source: sourceRoot, name: "private-skill" } as const;
    expect((await f.register(source)).visibility).toBe("author"); const app = await appFor(f);
    const get = (url: string, user = "Other") => app.inject({ method: "GET", url, headers: headers(user) });
    expect((await get("/geo/hub/skills")).json().skills).toEqual([]);
    for (const suffix of ["", "/file?path=SKILL.md", "/package.tar.gz", "/comments"]) expect((await get(`/geo/hub/skills/private-skill${suffix}`)).statusCode).toBe(404);
    expect((await get("/geo/hub/skills/private-skill", "Author")).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/geo/hub/skills/private-skill/install", payload: { projectId: f.p.id, revision: 1, acknowledged: true } })).statusCode).toBe(404);
    await writeFile(join(dir, "SKILL.md"), skill("private-skill", "Restricted", "proprietary")); await f.register(source);
    expect((await get("/geo/hub/skills/private-skill", "Other")).statusCode).toBe(404);
    for (const action of ["install-preview", "install"]) expect((await app.inject({ method: "POST", url: `/geo/hub/skills/private-skill/${action}`, headers: headers("Other"), payload: { projectId: f.p.id, revision: 1, acknowledged: true } })).statusCode).toBe(404);
    await writeFile(join(dir, "SKILL.md"), skill("private-skill", "Released", "MIT")); await f.register(source);
    expect((await get("/geo/hub/skills/private-skill")).json().skill.revisions.map((r: { revision: number }) => r.revision)).toEqual([3]);
    expect((await get("/geo/hub/skills/private-skill?revision=1")).statusCode).toBe(404);
  });

  it("requires identity, refuses self-check, records unverified reviews, validates replacement, stars/comments and text files", async () => {
    const f = await setup(); await writeFile(join(f.dir, "binary.bin"), Buffer.from([0, 1, 2])); await writeFile(join(f.dir, "large.txt"), "x".repeat(256 * 1024 + 1)); await f.register(); const app = await appFor(f);
    const post = (suffix: string, payload: unknown, user = "Author") => app.inject({ method: "POST", url: `/geo/hub/skills/shelf-test/${suffix}`, headers: headers(user), payload });
    expect((await app.inject({ method: "POST", url: "/geo/hub/skills/preview", payload: f.source })).statusCode).toBe(401);
    expect((await post("revisions/1/review", { state: "checked", note: "Read" })).statusCode).toBe(403);
    const checked = await post("revisions/1/review", { state: "checked", note: "Read scripts and instructions" }, "Reviewer"); expect(checked.statusCode).toBe(200); expect(checked.json().reviews[0]).toMatchObject({ verified: false, by: "Reviewer" });
    expect((await post("revisions/1/review", { state: "deprecated", note: "Old", replacement: "missing" })).statusCode).toBe(400);
    expect((await post("star", { on: true })).json()).toEqual({ stars: 1, starredByMe: true });
    expect((await post("comments", { body: "Useful" })).statusCode).toBe(201);
    const detail = await app.inject({ method: "GET", url: "/geo/hub/skills/shelf-test", headers: headers() }); expect(detail.json().comments[0].body).toBe("Useful");
    for (const [path, status] of [["../x", 400], ["/etc/passwd", 400], ["binary.bin", 415], ["large.txt", 413], ["SKILL.md", 200]] as const)
      expect((await app.inject({ method: "GET", url: `/geo/hub/skills/shelf-test/file?path=${encodeURIComponent(path)}` })).statusCode).toBe(status);
    const target = project(); expect((await post("install-preview", { projectId: target.id, revision: 1 })).json().project).toBe("missing");
    expect((await app.inject({ method: "POST", url: "/geo/hub/skills/shelf-test/install-preview", payload: { projectId: target.id, revision: 1 } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/geo/hub/skills/shelf-test/install", payload: { projectId: target.id, revision: 1, acknowledged: true } })).statusCode).toBe(201);
  });

  it("annotates installed hub skills without mistaking them for Workflows", async () => {
    const f = await setup(); await f.register(); const p = project();
    // Default agentDir is needed for GET /skills provenance projection, as in the live routes.
    await installHubSkillRevision(f.store, { skillId: "shelf-test", revision: 1, projectId: p.id, acknowledged: true });
    process.env.GAID_HUB_SHARED_DIR = f.root;
    const root = projectSkillRoot(resolvePaths(p.id)), source = getSkillProvenance(root, "shelf-test")?.source;
    expect(installedHubSkill(root, "shelf-test", source)).toMatchObject({ revision: 1, latestRevision: 1, edited: false });
    expect(skillWorkflow(root, "shelf-test", source)).toBeUndefined();
    const app = Fastify(); apps.push(app);
    app.addHook("onRequest", (_req, _reply, done) => withActiveProject(p.id, done));
    await registerSkillRoutes(app); await app.ready();
    const rows = await withActiveProject(p.id, () => app.inject({ method: "GET", url: "/skills/all?scope=project" }));
    expect(rows.json().enabled.find((s: { name: string }) => s.name === "shelf-test").hubSkill).toMatchObject({ revision: 1, latestRevision: 1, edited: false });
    await writeFile(join(findSkillDir(root, "shelf-test")!, "edit.md"), "Edit");
    expect(installedHubSkill(root, "shelf-test", source)?.edited).toBe(true);
  });
});
