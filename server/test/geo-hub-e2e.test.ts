/**
 * End to end (gaid-backend): a real hub server over HTTP and researchers' GAID backends (P1 + P2 + the shared hub routes).
 * Researcher A registers a Workflow; researcher B sees, stars, comments, copies and installs it; A's library syncs to A's
 * second PC and back, with a conflict; B never sees A's library. Each GAID registers the remote provider when it is built,
 * so the researchers act one after another.
 */
import Fastify, { type FastifyInstance } from "fastify";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { AuthoringStore } from "../src/geo/authoring/store.ts";
import { addSource } from "../src/geo/authoring/sources.ts";
import { runOperation } from "../src/geo/authoring/agent.ts";
import { registerSharedHubRoutes } from "../src/geo/hub-shared/routes.ts";
import { setRemoteHubProvider } from "../src/geo/hub-shared/active.ts";
import { registerGeoHubServerRoutes } from "../src/geo/routes/hub-server.ts";
import { HubClient } from "../src/geo/hub-client/client.ts";
import { ConnectionStore } from "../src/geo/hub-client/connection.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { buildHubServer, type HubServerApp } from "../src/geo/hub-server/index.ts";
import { createProject, deleteProject } from "../src/projects.ts";
import { analysis, config, draftReply, pdf, PAPER, reply, testVocabulary } from "./helpers/geo-authoring.ts";

let root: string;
let hub: HubServerApp;
let url: string;
const apps: FastifyInstance[] = [];
const projects: string[] = [];
const oldShared = process.env.GAID_HUB_SHARED_DIR;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "gaid-hub-e2e-"));
  process.env.GAID_HUB_SHARED_DIR = join(root, "local-shared-unused");
  hub = buildHubServer({ home: join(root, "hub-home") });
  await hub.listen({ host: "127.0.0.1", port: 0 });
  const address = hub.server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  url = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  setRemoteHubProvider(null);
  for (const app of apps) await app.close();
  for (const id of projects) deleteProject(id);
  await hub.close();
  if (oldShared === undefined) delete process.env.GAID_HUB_SHARED_DIR;
  else process.env.GAID_HUB_SHARED_DIR = oldShared;
  await rm(root, { recursive: true, force: true });
});

/** One researcher's GAID backend: its own agent dir, authoring store and library. */
async function gaid(name: string) {
  const dir = join(root, name);
  const authoring = new AuthoringStore(join(dir, "authoring"));
  await authoring.initialize();
  const library = new LibraryStore(join(dir, "library"));
  const client = new HubClient(new ConnectionStore(join(dir, "agent"), () => undefined));
  const app = Fastify();
  apps.push(app);
  await registerGeoHubServerRoutes(app, { client, library, backgroundSync: false });
  await registerSharedHubRoutes(app, { authoringStore: authoring, agentDir: join(dir, "install-agent"), vocabulary: testVocabulary() });
  await app.ready();
  const call = async (method: "GET" | "POST" | "PUT" | "PATCH", path: string, payload?: unknown) => {
    const res = await app.inject({ method, url: path, ...(payload === undefined ? {} : { payload: payload as object }) });
    return { status: res.statusCode, body: res.body ? res.json() : null };
  };
  expect((await call("PUT", "/geo/hub-server/config", { url })).status).toBe(200);
  return { dir, authoring, library, client, app, call };
}

async function registrableDraft(authoring: AuthoringStore, author: string) {
  const project = await authoring.create({ title: "Research workflow", author, goal: "reuse" });
  await addSource(authoring, project.id, { name: "paper.pdf", mediaType: "application/pdf", contentBase64: pdf(PAPER).toString("base64") });
  const deps = (content: unknown) => ({ chat: reply(content), config, vocabulary: testVocabulary() });
  await runOperation(authoring, project.id, "analyze", "e2e-analyze", deps(analysis));
  const drafted = await runOperation(authoring, project.id, "draft", "e2e-draft", deps(draftReply));
  expect(drafted.outcome).toMatch(/accepted|repaired/);
  return project.id;
}

it("shares a Workflow between two accounts and syncs one account's library across two PCs", async () => {
  const inviteA = hub.accounts.invite({ email: "kim@example.org", role: "admin" });
  const inviteB = hub.accounts.invite({ email: "lee@example.org", role: "member" });

  // Researcher A joins, registers a Workflow, stars and comments it.
  const a = await gaid("pc-a");
  const joinedA = await a.call("POST", "/geo/hub-server/accept-invite", { code: inviteA.code, displayName: "김연구", password: "correct horse 1" });
  expect(joinedA.status, JSON.stringify(joinedA.body)).toBe(200);
  expect(joinedA.body.account).toMatchObject({ email: "kim@example.org", role: "admin", displayName: "김연구" });
  expect(JSON.stringify(joinedA.body)).not.toContain("token");
  expect((await a.call("GET", "/geo/hub/me")).body).toEqual({ name: "김연구", account: true, admin: true });
  const draftId = await registrableDraft(a.authoring, "김연구");
  const registered = await a.call("POST", "/geo/hub/entries", { authoringProjectId: draftId, folderId: "general", note: "first" });
  expect(registered.status, JSON.stringify(registered.body)).toBe(201);
  const entry = registered.body;
  expect(entry).toMatchObject({ author: "김연구", mine: true, latestRevision: 1 });
  expect(entry.authorId).toMatch(/^acc-/);
  expect((await a.call("POST", `/geo/hub/entries/${entry.id}/star`, { on: true })).body).toEqual({ stars: 1, starredByMe: true });
  expect((await a.call("POST", `/geo/hub/entries/${entry.id}/comments`, { body: "써 보세요" })).status).toBe(201);
  const cover = await a.app.inject(`/geo/hub/entries/${entry.id}/package.tar.gz`);
  expect(cover.statusCode).toBe(200);

  // A's library: one GAID-managed paper with a PDF in a folder, pushed to the server.
  const folder = await a.library.addGaidCollection("단층 해석");
  const stored = await a.library.storePdf(pdf(PAPER));
  const paper = await a.library.addGaidItem({
    csl: { type: "article-journal", title: "Fault seal analysis", DOI: "10.1234/fault.1", author: [{ family: "Kim", given: "A" }], issued: { "date-parts": [[2024]] } },
    metadataOrigin: "manual" as never,
    collectionIds: [folder.id],
    pdfSha256: stored.sha256,
  });
  const pushed = await a.call("POST", "/geo/library/sync", {});
  expect(pushed.status, JSON.stringify(pushed.body)).toBe(200);
  expect(pushed.body.pushed).toMatchObject({ items: 1, folders: 1, files: 1 });

  // Researcher B (another account) sees A's entry as not theirs, stars, comments, copies and installs it.
  const b = await gaid("pc-b");
  const joinedB = await b.call("POST", "/geo/hub-server/accept-invite", { code: inviteB.code, displayName: "이연구", password: "battery staple 2" });
  expect(joinedB.status, JSON.stringify(joinedB.body)).toBe(200);
  const listed = await b.call("GET", "/geo/hub/entries");
  expect(listed.body.entries).toHaveLength(1);
  expect(listed.body.entries[0]).toMatchObject({ id: entry.id, author: "김연구", mine: false, stars: 1, starredByMe: false, comments: 1 });
  expect((await b.call("POST", `/geo/hub/entries/${entry.id}/star`, { on: true })).body).toEqual({ stars: 2, starredByMe: true });
  const commented = await b.call("POST", `/geo/hub/entries/${entry.id}/comments`, { body: "잘 쓰겠습니다" });
  expect(commented.body).toMatchObject({ author: "이연구", body: "잘 쓰겠습니다" });
  const copy = await b.call("POST", `/geo/hub/entries/${entry.id}/edit`, {});
  expect(copy.status, JSON.stringify(copy.body)).toBe(201);
  expect(copy.body.mode).toBe("copy");
  const target = createProject({ name: "E2E install" });
  projects.push(target.id);
  const installed = await b.call("POST", `/geo/hub/entries/${entry.id}/install`, { projectId: target.id, acknowledged: true, revision: 1 });
  expect(installed.status, JSON.stringify(installed.body)).toBe(201);
  expect((await hub.store.read(entry.id)).installs).toHaveLength(1);
  // B is not an admin and has no access to A's library.
  expect((await b.call("GET", "/geo/hub-server/admin/users")).status).toBe(403);
  const pulledB = await b.call("POST", "/geo/library/sync", {});
  expect(pulledB.status).toBe(200);
  expect(await b.library.all()).toHaveLength(0);

  // A's second PC logs in with email and password and pulls the library, PDF included.
  const a2 = await gaid("pc-a2");
  // A wrong password is refused; email case does not matter. (A new login attempt first forgets any earlier session.)
  expect((await a2.call("POST", "/geo/hub-server/login", { email: "kim@example.org", password: "wrong password" })).status).toBe(401);
  expect((await a2.call("POST", "/geo/hub-server/login", { email: "KIM@example.org", password: "correct horse 1" })).status).toBe(200);
  const pulled = await a2.call("POST", "/geo/library/sync", {});
  expect(pulled.status, JSON.stringify(pulled.body)).toBe(200);
  const copied = await a2.library.get(paper.id);
  expect(copied.collectionIds).toEqual([folder.id]);
  expect((await a2.library.collections()).map((c) => c.name)).toEqual(["단층 해석"]);
  expect(await readdir(join(a2.dir, "library", "files"))).toContain(stored.sha256);
  // The entry list on the second PC still marks A's own entry.
  expect((await a2.call("GET", "/geo/hub/entries")).body.entries[0].mine).toBe(true);

  // Both PCs change the same paper; the later change wins and the replaced copy is kept.
  await a2.library.editGaidItem(paper.id, { tags: ["from-pc-a2"] });
  await new Promise((r) => setTimeout(r, 15));
  await a.library.editGaidItem(paper.id, { tags: ["from-pc-a"] });
  expect((await a2.call("POST", "/geo/library/sync", {})).status).toBe(200);
  const second = await a.call("POST", "/geo/library/sync", {});
  expect(second.status, JSON.stringify(second.body)).toBe(200);
  expect(second.body.conflicts).toBeGreaterThanOrEqual(1);
  expect((await a.library.get(paper.id)).tags).toEqual(["from-pc-a"]);
  expect((await a2.call("POST", "/geo/library/sync", {})).status).toBe(200);
  expect((await a2.library.get(paper.id)).tags).toEqual(["from-pc-a"]);

  // Logging out keeps the address and falls back to asking for a login (no remote provider).
  const out = await a.call("POST", "/geo/hub-server/logout", {});
  expect(out.body).toMatchObject({ url, account: null });
});
