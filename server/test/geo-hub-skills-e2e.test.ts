/**
 * End to end (gaid-hub-server-trial): the hub skill shelf through a real hub server over HTTP. Researcher A registers a
 * project skill and a restricted one; researcher B (another account) sees only the shareable one, stars, comments, reviews
 * it as an authenticated account and installs it; A cannot mark A's own revision checked; B cannot take A's skill name.
 * Each GAID registers the remote providers when it is built, so `as()` rebuilds a researcher's GAID (the saved login is
 * reused) before that researcher acts.
 */
import Fastify, { type FastifyInstance } from "fastify";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { setRemoteHubProvider } from "../src/geo/hub-shared/active.ts";
import { setRemoteHubSkillProvider } from "../src/geo/hub-skills/active.ts";
import { installedHubSkill } from "../src/geo/hub-skills/installed.ts";
import { registerHubSkillRoutes } from "../src/geo/hub-skills/routes.ts";
import { registerGeoHubServerRoutes } from "../src/geo/routes/hub-server.ts";
import { HubClient } from "../src/geo/hub-client/client.ts";
import { ConnectionStore } from "../src/geo/hub-client/connection.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { buildHubServer, type HubServerApp } from "../src/geo/hub-server/index.ts";
import { projectSkillRoot } from "../src/agent/skills.ts";
import { getSkillProvenance } from "../src/agent/skills-sync.ts";
import { createProject, deleteProject, resolvePaths } from "../src/projects.ts";

let root: string;
let hub: HubServerApp;
let url: string;
const apps: FastifyInstance[] = [];
const projects: string[] = [];
const oldShared = process.env.GAID_HUB_SHARED_DIR;
const catalogue = () => ({ available: true, skills: [{ id: "kigam/geo-test", runtimeName: "geo-test" }] });

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "gaid-hub-skills-e2e-"));
  // A local shelf must never be used while logged in; point it somewhere that stays empty.
  process.env.GAID_HUB_SHARED_DIR = join(root, "local-shared-unused");
  hub = buildHubServer({ home: join(root, "hub-home") });
  await hub.listen({ host: "127.0.0.1", port: 0 });
  const address = hub.server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  url = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  setRemoteHubProvider(null);
  setRemoteHubSkillProvider(null);
  for (const app of apps) await app.close();
  for (const id of projects) deleteProject(id);
  await hub.close();
  if (oldShared === undefined) delete process.env.GAID_HUB_SHARED_DIR;
  else process.env.GAID_HUB_SHARED_DIR = oldShared;
  await rm(root, { recursive: true, force: true });
});

/** One researcher's GAID backend; building it again reuses the saved hub login and makes it the active one. */
async function as(name: string) {
  const dir = join(root, name);
  const client = new HubClient(new ConnectionStore(join(dir, "agent"), () => undefined));
  const app = Fastify();
  apps.push(app);
  await registerGeoHubServerRoutes(app, { client, library: new LibraryStore(join(dir, "library")), backgroundSync: false });
  // Default agentDir: the Settings → Skills annotation reads package origins from it, as in the live routes.
  await registerHubSkillRoutes(app, { catalogue });
  await app.ready();
  const call = async (method: "GET" | "POST" | "PUT", path: string, payload?: unknown) => {
    const res = await app.inject({ method, url: path, ...(payload === undefined ? {} : { payload: payload as object }) });
    return { status: res.statusCode, body: res.body && res.headers["content-type"]?.toString().includes("json") ? res.json() : res.body };
  };
  return { dir, app, call };
}

function project(name: string) {
  const p = createProject({ name });
  projects.push(p.id);
  return p;
}
async function projectSkill(projectId: string, name: string, body: string, licence?: string) {
  const dir = join(resolvePaths(projectId).skillsDir, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: Check table units\n${licence ? `license: ${licence}\n` : ""}---\n\n# Procedure\n${body}\n`);
}
async function register(r: Awaited<ReturnType<typeof as>>, projectId: string, name: string) {
  const source = { from: "project", projectId, name };
  const preview = await r.call("POST", "/geo/hub/skills/preview", source);
  expect(preview.status, JSON.stringify(preview.body)).toBe(200);
  return r.call("POST", "/geo/hub/skills", { ...source, treeHash: preview.body.treeHash, note: "first", folderId: "general" });
}

it("shares hub skills between two accounts through the hub server", async () => {
  const inviteA = hub.accounts.invite({ email: "kim@example.org", role: "admin" });
  const inviteB = hub.accounts.invite({ email: "lee@example.org", role: "member" });

  // A joins and registers a shareable and a restricted skill from a project.
  let a = await as("pc-a");
  expect((await a.call("PUT", "/geo/hub-server/config", { url })).status).toBe(200);
  expect((await a.call("POST", "/geo/hub-server/accept-invite", { code: inviteA.code, displayName: "김연구", password: "correct horse 1" })).status).toBe(200);
  const pa = project("A skills");
  await projectSkill(pa.id, "unit-check", "Compare units.", "MIT");
  await projectSkill(pa.id, "private-check", "Internal only.", "proprietary");
  const first = await register(a, pa.id, "unit-check");
  expect(first.status, JSON.stringify(first.body)).toBe(201);
  expect(first.body).toMatchObject({ id: "unit-check", author: "김연구", mine: true, latestRevision: 1, visibility: "hub" });
  expect(first.body.authorId).toMatch(/^acc-/);
  expect(first.body.revisions[0]).toMatchObject({ registeredBy: "김연구", registeredById: first.body.authorId });
  expect((await register(a, pa.id, "private-check")).body.visibility).toBe("author");
  // The skill lives on the hub server, not in this PC's local shelf.
  expect((await hub.store.hub.all<{ id: string }>("SELECT id FROM hub_skills ORDER BY id")).map((r) => r.id)).toEqual(["private-check", "unit-check"]);
  // A cannot mark A's own revision checked.
  expect((await a.call("POST", "/geo/hub/skills/unit-check/revisions/1/review", { state: "checked", note: "Read it" })).status).toBe(403);

  // B joins: sees only the shareable skill, not as theirs.
  const b = await as("pc-b");
  expect((await b.call("PUT", "/geo/hub-server/config", { url })).status).toBe(200);
  expect((await b.call("POST", "/geo/hub-server/accept-invite", { code: inviteB.code, displayName: "이연구", password: "battery staple 2" })).status).toBe(200);
  const listed = await b.call("GET", "/geo/hub/skills");
  expect(listed.body.skills.map((s: { id: string }) => s.id)).toEqual(["unit-check"]);
  expect(listed.body.skills[0]).toMatchObject({ author: "김연구", mine: false, stars: 0 });
  expect((await b.call("GET", "/geo/hub/skills/private-check")).status).toBe(404);
  expect((await b.call("GET", "/geo/hub/skills/unit-check/package.tar.gz?revision=1")).status).toBe(200);

  // B stars, comments and reviews as an authenticated account.
  expect((await b.call("POST", "/geo/hub/skills/unit-check/star", { on: true })).body).toEqual({ stars: 1, starredByMe: true });
  expect((await b.call("POST", "/geo/hub/skills/unit-check/comments", { body: "단위 표가 유용합니다" })).body).toMatchObject({ author: "이연구", revision: 1 });
  const reviewed = await b.call("POST", "/geo/hub/skills/unit-check/revisions/1/review", { state: "checked", note: "Read the procedure" });
  expect(reviewed.status, JSON.stringify(reviewed.body)).toBe(200);
  expect(reviewed.body.reviews.at(-1)).toMatchObject({ state: "checked", by: "이연구", verified: true });
  // B cannot take A's skill name.
  const pb = project("B skills");
  await projectSkill(pb.id, "unit-check", "Another procedure.", "MIT");
  expect((await b.call("POST", "/geo/hub/skills/preview", { from: "project", projectId: pb.id, name: "unit-check" })).body.existing).toMatchObject({ mode: "taken" });

  // B installs revision 1 into a project; the Settings → Skills annotation reads the server's record.
  const target = project("B install");
  const installed = await b.call("POST", "/geo/hub/skills/unit-check/install", { projectId: target.id, revision: 1, acknowledged: true });
  expect(installed.status, JSON.stringify(installed.body)).toBe(201);
  expect(await readFile(join(resolvePaths(target.id).skillsDir, "unit-check", "SKILL.md"), "utf8")).toContain("Compare units.");
  const skills = projectSkillRoot(resolvePaths(target.id));
  expect(installedHubSkill(skills, "unit-check", getSkillProvenance(skills, "unit-check")?.source)).toMatchObject({ revision: 1, latestRevision: 1, state: "checked", edited: false });

  // A adds revision 2; B's view shows it with A's review state reset for the new revision.
  a = await as("pc-a");
  await projectSkill(pa.id, "unit-check", "Compare units and note conversions.", "MIT");
  const second = await register(a, pa.id, "unit-check");
  expect(second.status, JSON.stringify(second.body)).toBe(201);
  expect(second.body).toMatchObject({ latestRevision: 2, state: "unreviewed", stars: 1 });
  expect(second.body.revisions[0].reviews).toHaveLength(1);
});
