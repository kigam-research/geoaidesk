import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/agent/session-registry.ts", () => ({
  getModelRuntime: vi.fn(() => ({ checkAuth: vi.fn(async () => ({ type: "api_key", source: "test" })) })),
  getModelRegistry: vi.fn(() => ({ find: () => null })),
  createSession: vi.fn(), getSession: vi.fn(async () => null), listSessions: vi.fn(async () => []),
  disposeSession: vi.fn(), pinSession: vi.fn(), unpinSession: vi.fn(), setSessionObserver: vi.fn(),
  abortProjectSessions: vi.fn(async () => {}), disposeProjectSessions: vi.fn(),
}));

import { buildApp } from "../src/index.ts";
import { PROJECTS_ROOT } from "../src/config.ts";
import { resolvePaths, type ProjectMeta, type ProjectPaths } from "../src/projects.ts";
import { runBroker } from "../src/agent/run-broker.ts";
import { recordSkillOrigin } from "../src/agent/skills-sync.ts";
import { projectSkillRoot } from "../src/agent/skills.ts";
import { packageStore, writePackageOrigin } from "../src/geo/methods/package-origin.ts";
import { parseMethodFile } from "../src/geo/methods/method-file.ts";
import { recordMethodTrial } from "../src/geo/methods/trials.ts";
import { methodTreeHash } from "../src/geo/methods/tree-hash.ts";
import * as hubSkills from "../src/geo/hub-skills/active.ts";
import type { StoredHubSkill } from "../src/geo/hub-skills/records.ts";
import { GeoEnvironmentService } from "../src/geo/environments.ts";
import { loadGeoCatalogue, resetGeoCatalogueCache, type GeoCatalogue } from "../src/geo/catalogue.ts";
import { buildFixtureCatalogue } from "./helpers/geo-catalogue-fixture.ts";
import { workspaceHome } from "../src/geo/workspace/home.ts";
import { HOME_SESSION_LIMIT, homeSessions } from "../src/geo/workspace/home-sessions.ts";
import { WORKSPACE_HOME_RECENT_LIMIT, WORKSPACE_HOME_SCHEMA } from "../../web/src/geo/contracts/workspace-home.ts";

const app = await buildApp();
const day = (n: number) => new Date(Date.UTC(2026, 9, n)).toISOString();
const write = (file: string, value: string | object) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
};
let registry: Record<string, ProjectMeta>;
const project = (id: string, archived = false, indexed = true): ProjectPaths => {
  const meta = { id, name: `${id} 연구`, description: "", tags: [], archived, createdAt: day(1), updatedAt: day(20), spendLimitUsd: null };
  const paths = resolvePaths(id);
  fs.mkdirSync(paths.sandbox, { recursive: true });
  write(paths.projectJson, meta);
  if (indexed) registry[id] = meta;
  write(path.join(PROJECTS_ROOT, "index.json"), { projects: registry });
  return paths;
};
function chat(paths: ProjectPaths, id: string, date: string, mode?: string, name: string | null = id) {
  const file = path.join(paths.sessionsDir, `${id}.jsonl`);
  const records = [
    { type: "session", version: 3, id, timestamp: day(1), cwd: paths.sandbox },
    { type: "message", id: "a", timestamp: date, message: { role: "user", content: [{ type: "text", text: `질문 ${id}` }], timestamp: Date.parse(date) } },
    ...(name ? [{ type: "session_info", name }] : []),
  ];
  write(file, records.map(r => JSON.stringify(r)).join("\n") + "\n");
  fs.utimesSync(file, new Date(date), new Date(date));
  if (mode) write(path.join(paths.kadyDir, "geo/exposure", `${id}.json`), { schemaVersion: "gaid-exposure/v1", mode, recordedAt: day(1) });
  return file;
}
const workflow = {
  id: "analyse", title: { ko: "격자 분석" }, description: { ko: "격자에서 값을 분석합니다." },
  inputRoles: [{ id: "grid", label: { ko: "격자" }, formats: ["csv"], required: true }],
  requiredScientificChoices: [], prompt: { ko: "격자를 분석하세요." },
  skillIds: ["local:grid-method"], environmentProfile: "core", expectedArtifacts: [], boundary: { ko: "탐색 분석입니다." },
};
function method(paths: ProjectPaths, shared = true) {
  const dir = path.join(paths.skillsDir, "grid-method");
  const file = {
    schemaVersion: "gaid-method/v1", methodId: "local/grid-method", revision: 1, version: "99.0.0", lifecycle: "draft", implementation: "implemented",
    title: { ko: "격자 Workflow" }, summary: { ko: "격자에서\n값을 비교합니다." }, sources: [], workflows: [workflow], recipes: [],
  };
  expect(parseMethodFile(file, "grid-method").issues).toEqual([]);
  write(path.join(dir, "SKILL.md"), "---\nname: grid-method\ndescription: Grid analysis\n---\n");
  write(path.join(dir, "gaid-method.json"), file);
  const sha = (shared ? "a" : "b").repeat(64);
  writePackageOrigin(packageStore(), { sha256: sha, kind: "gaid-hub", fetchedAt: day(1), ...(shared ? { hubEntry: { id: "entry", revision: 7, version: "2.3.1" } } : {}) });
  recordSkillOrigin(projectSkillRoot(paths), "grid-method", { origin: "registry", source: path.join(packageStore(), sha) });
}
function note(paths: ProjectPaths, id: string, status: string, decisions: number, at: string, sessions: string[] = []) {
  const file = path.join(paths.sandbox, "연구노트", id, "index.md");
  write(file, `---\ntitle: ${id} 결과\ndate: 2026-10-24\nstatus: ${status}\n---\n# 결과\n## 결정할 일\n${Array.from({ length: decisions }, (_, i) => `${i + 1}. 분석을 계속할지\n- 가) 계속 (권장: 확인 필요)\n- 나) 마침`).join("\n")}\n`);
  fs.utimesSync(file, new Date(at), new Date(at));
  if (sessions.length) write(path.join(paths.kadyDir, "geo/notes.json"), { [id]: sessions });
}
const catalogue = {
  workflows: [{ ...workflow, id: "built-in", title: { ko: "기본 분석" }, skillIds: [] }, { ...workflow, id: "unused", skillIds: [] }],
  index: { skills: [] },
  environments: { schemaVersion: "geo-environments/v1", environments: [{ id: "core", title: { ko: "기본 환경" }, targets: ["project"], packages: [], tools: [] }] },
} as unknown as GeoCatalogue;

/** Capture both content and mtime, so implicit adoption/seeding is observable. */
function snapshot(dir: string): unknown {
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map(e => {
    const file = path.join(dir, e.name);
    return [e.name, fs.statSync(file).mtimeMs, e.isDirectory() ? snapshot(file) : fs.readFileSync(file).toString("base64")];
  });
}

beforeEach(() => { fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true }); registry = {}; runBroker.clear(); });
afterEach(() => { vi.restoreAllMocks(); runBroker.clear(); resetGeoCatalogueCache(); });
afterAll(async () => { await app.close(); fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true }); });

describe("Workspace home", () => {
  it("returns an empty home without creating the projects root or honoring a stale project header", async () => {
    const reply = await app.inject({ url: "/geo/workspace/home?view=recent", headers: { "x-project-id": "missing" } });
    expect(reply.statusCode).toBe(200);
    expect(reply.json()).toEqual({ schemaVersion: WORKSPACE_HOME_SCHEMA, recent: [], workflows: [], projectCount: 0, unreadableProjects: 0 });
    expect(fs.existsSync(PROJECTS_ROOT)).toBe(false);
    expect(reply.headers["x-project-fallback"]).toBeUndefined();
  });

  it("merges chats and notes by last activity, hides archived/scheduler/system sessions and never writes", async () => {
    const a = project("alpha"), b = project("beta"), archived = project("archived", true);
    // This orphan is included without persisting adoption into the index.
    project("orphan", false, false);
    chat(a, "active", day(24), undefined, "실행 중인 분석");
    chat(a, "idle", day(19), undefined, null);
    chat(b, "resident", day(28));
    write(path.join(b.kadyDir, "scheduler.json"), { sessionId: "resident", heldByBudget: [] });
    write(path.join(b.sessionsDir, "system.jsonl"), [{ type: "session", id: "system", timestamp: day(28) }, { type: "message", message: { role: "custom", content: "system only" } }].map(JSON.stringify).join("\n"));
    chat(archived, "archived-chat", day(30));
    note(a, "2026-10-24-open", "pending", 2, day(23));
    note(b, "2026-10-24-checked", "confirmed", 1, day(22));
    note(b, "2026-10-24-pending", "pending", 0, day(21));
    note(b, "2026-10-24-old", "superseded", 3, day(29));
    runBroker.start(a.id, "active", { runId: "r", prompt: "run", images: [], baseline: { messages: [], contextUsage: null } });
    const before = snapshot(PROJECTS_ROOT);
    const first = await app.inject({ url: "/geo/workspace/home", headers: { "x-project-id": a.id } });
    const second = await app.inject({ url: "/geo/workspace/home", headers: { "x-project-id": archived.id } });
    expect(second.json()).toEqual(first.json());
    expect(first.json()).toMatchObject({ projectCount: 3, unreadableProjects: 0, recent: [
      { id: "active", title: "실행 중인 분석", state: "running", decisions: 0 },
      { id: "2026-10-24-open", state: "decisions", decisions: 2 },
      { id: "2026-10-24-checked", state: "checked", decisions: 0 },
      { id: "2026-10-24-pending", state: "unreviewed", decisions: 0 },
      { id: "idle", title: "질문 idle", state: "idle" },
    ] });
    expect(snapshot(PROJECTS_ROOT)).toEqual(before);
  });

  it("reports an unreadable active project and keeps the readable project result", async () => {
    const a = project("alpha"), broken = project("broken");
    chat(a, "ok", day(23));
    fs.rmSync(broken.sandbox, { recursive: true });
    write(broken.sandbox, "not a directory");
    expect(await workspaceHome()).toMatchObject({ projectCount: 2, unreadableProjects: 1, recent: [{ id: "ok" }] });
  });

  it("groups installed slugs across projects, resolves chat/note Workflow versions and lists only used catalogue Workflows", async () => {
    const a = project("alpha"), b = project("beta"), c = project("gamma");
    method(a); method(b); method(c, false);
    chat(a, "earlier", day(20), "method:grid-method:analyse");
    chat(b, "later", day(23), "method:grid-method:analyse");
    chat(c, "basic", day(24), "workflow:built-in");
    note(b, "2026-10-24-workflow", "pending", 0, day(22), ["later"]);
    recordMethodTrial(a, "trial-only", "method:grid-method:analyse");
    note(a, "2026-10-24-older", "pending", 0, day(21), ["trial-only"]);
    const result = await workspaceHome({ catalogue: () => catalogue });
    expect(result.unreadableProjects).toBe(0);
    expect(result.workflows).toEqual([
      { id: "grid-method", title: "격자 Workflow", line: "격자에서 값을 비교합니다.", source: "shared", version: "2.3.1", ready: false, projects: [{ id: "beta", name: "beta 연구" }, { id: "alpha", name: "alpha 연구" }, { id: "gamma", name: "gamma 연구" }] },
      { id: "built-in", title: "기본 분석", line: "격자에서 값을 분석합니다.", source: "catalogue", version: null, ready: false, projects: [{ id: "gamma", name: "gamma 연구" }] },
    ]);
    expect(result.recent.find(r => r.id === "later")?.workflow).toEqual({ id: "grid-method", title: "격자 분석", version: "2.3.1" });
    expect(result.recent.find(r => r.kind === "note")?.workflow?.version).toBe("2.3.1");
    expect(result.recent.find(r => r.id === "2026-10-24-older")?.workflow).toEqual({ id: "grid-method", title: "격자 분석", version: "2.3.1" });
    const draft = await workspaceHome();
    expect(draft.recent.find(r => r.id === "basic")?.workflow).toBeNull();
  });

  it("reuses only current readiness probes and requires input data without launching another subprocess", async () => {
    const a = project("alpha"); method(a);
    const runner = vi.fn(async () => ({ code: 0, stdout: JSON.stringify({ imports: [], distributions: [] }), stderr: "" }));
    const environments = new GeoEnvironmentService({ runner });
    const options = { catalogue: () => catalogue, environments };
    expect((await workspaceHome(options)).workflows[0].ready).toBe(false);
    expect(runner).not.toHaveBeenCalled();
    await environments.readiness(catalogue.environments!, "core", "project", a.sandbox);
    expect((await workspaceHome(options)).workflows[0].ready).toBe(false);
    write(path.join(a.uploadDir, "grid.csv"), "x,y\n1,2\n");
    expect((await workspaceHome(options)).workflows[0].ready).toBe(true);
    expect(runner).toHaveBeenCalledTimes(1);
    write(path.join(a.sandbox, "uv.lock"), "changed environment");
    expect((await workspaceHome(options)).workflows[0].ready).toBe(false);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("limits recent rows and session reads per project, using message activity rather than rename time", async () => {
    const a = project("alpha");
    for (let i = 0; i < HOME_SESSION_LIMIT + 2; i++) chat(a, `s-${i}`, new Date(Date.parse(day(1)) + i * 1000).toISOString());
    expect(await homeSessions(a)).toHaveLength(HOME_SESSION_LIMIT);
    const result = await workspaceHome();
    expect(result.recent).toHaveLength(WORKSPACE_HOME_RECENT_LIMIT);
    expect(result.recent[0].id).toBe(`s-${HOME_SESSION_LIMIT + 1}`);
    const old = chat(a, "renamed", day(1), undefined, "최근 이름 변경");
    fs.utimesSync(old, new Date(day(29)), new Date(day(29)));
    expect((await workspaceHome()).recent.map(r => r.id)).not.toContain("renamed");
  });

  it("uses compact chat labels instead of expanded instructions and excludes named system-only sessions", async () => {
    const a = project("alpha");
    const file = chat(a, "workflow-chat", day(24), undefined, null);
    const records = fs.readFileSync(file, "utf8").trim().split("\n").map(s => JSON.parse(s));
    records[1].message.content[0].text = '<workflow id="internal-slug" version="2.3.1" title="격자 비교">\nInternal instructions with private paths\n</workflow>';
    write(file, records.map(r => JSON.stringify(r)).join("\n") + "\nnull\n");
    write(path.join(a.sessionsDir, "system.jsonl"), [
      { type: "session", id: "system", timestamp: day(28) }, { type: "session_info", name: "Named scheduler" },
      { type: "message", message: { role: "custom", content: "system only" } },
    ].map(r => JSON.stringify(r)).join("\n"));
    expect((await workspaceHome()).recent).toMatchObject([{ id: "workflow-chat", title: "Workflow · 격자 비교" }]);
  });

  it("does not stage or repair a catalogue from a read-only request", () => {
    const fixture = buildFixtureCatalogue();
    const archive = path.join(PROJECTS_ROOT, "catalogue.tar.gz");
    fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
    fs.writeFileSync(archive, fixture.archive);
    const options = { env: { GAID_CATALOGUE_ARCHIVE: archive }, cacheDir: path.join(PROJECTS_ROOT, "cache"), pin: { version: fixture.version, archive: "catalogue.tar.gz", sha256: fixture.sha256 } };
    const before = snapshot(PROJECTS_ROOT);
    expect(() => loadGeoCatalogue({ ...options, readOnly: true })).toThrow("No verified staged catalogue");
    expect(snapshot(PROJECTS_ROOT)).toEqual(before);
    const loaded = loadGeoCatalogue(options);
    resetGeoCatalogueCache();
    const staged = snapshot(PROJECTS_ROOT);
    expect(loadGeoCatalogue({ ...options, readOnly: true }).label).toBe(loaded.label);
    expect(snapshot(PROJECTS_ROOT)).toEqual(staged);
    resetGeoCatalogueCache();
    write(path.join(loaded.root, "manifest.json"), {});
    const damaged = snapshot(PROJECTS_ROOT);
    expect(() => loadGeoCatalogue({ ...options, readOnly: true })).toThrow();
    expect(snapshot(PROJECTS_ROOT)).toEqual(damaged);
  });

  it("does not wait for an environment probe that is still running", async () => {
    const a = project("alpha"); method(a);
    write(path.join(a.uploadDir, "grid.csv"), "x\n1\n");
    let settle!: (value: { code: number; stdout: string; stderr: string }) => void;
    const environments = new GeoEnvironmentService({ runner: () => new Promise(resolve => { settle = resolve; }) });
    const pending = environments.readiness(catalogue.environments!, "core", "project", a.sandbox);
    expect((await workspaceHome({ catalogue: () => catalogue, environments })).workflows[0].ready).toBe(false);
    settle({ code: 0, stdout: JSON.stringify({ imports: [], distributions: [] }), stderr: "" });
    await pending;
    expect((await workspaceHome({ catalogue: () => catalogue, environments })).workflows[0].ready).toBe(true);
  });

  it("does not mark suspended or unknown hub pins ready and uses cached hub records without downloading", async () => {
    const a = project("alpha"); method(a);
    write(path.join(a.uploadDir, "grid.csv"), "x\n1\n");
    const helper = path.join(a.skillsDir, "helper-skill");
    write(path.join(helper, "SKILL.md"), "---\nname: helper-skill\ndescription: Helper\n---\n");
    const treeHash = methodTreeHash(helper);
    const file = path.join(a.skillsDir, "grid-method/gaid-method.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    Object.assign(raw.workflows[0], {
      schemaVersion: "gaid-workflow/v1",
      skills: [{ name: "helper-skill", role: "supporting", source: "hub", hub: { skillId: "helper-skill", revision: 1, treeHash } }],
      steps: ["prepare", "analyse", "check"].map(id => ({ id, title: { ko: id }, does: { ko: id }, skill: "helper-skill" })),
    });
    expect(parseMethodFile(raw, "grid-method").issues).toEqual([]);
    write(file, raw);
    const record = { revisions: [{ revision: 1, treeHash, reviews: [{ state: "suspended" }] }] } as StoredHubSkill;
    const lookup = vi.spyOn(hubSkills, "remoteSkillRecord").mockReturnValue(record);
    const environments = new GeoEnvironmentService({ runner: async () => ({ code: 0, stdout: '{"imports":[],"distributions":[]}', stderr: "" }) });
    await environments.readiness(catalogue.environments!, "core", "project", a.sandbox);
    const options = { catalogue: () => catalogue, environments };
    expect((await workspaceHome(options)).workflows[0].ready).toBe(false);
    record.revisions[0].reviews = [];
    expect((await workspaceHome(options)).workflows[0].ready).toBe(true);
    lookup.mockReturnValue(null);
    expect((await workspaceHome(options)).workflows[0].ready).toBe(false);
  });
});
