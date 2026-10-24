import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProject, deleteProject, resolvePaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { registerGeoNotebookLinkRoutes } from "../src/geo/routes/notebook-link.ts";
import { notebookLinkFile } from "../src/geo/workspace/notebook-link.ts";
import { registerGeoLibraryRoutes } from "../src/geo/routes/library.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { reconcileFolders } from "../src/geo/library/zotero-service.ts";
import { zoteroCollectionId } from "../src/geo/library/zotero/index.ts";
import { LibrarySync } from "../src/geo/library/sync/index.ts";
import type { LibraryCollection } from "../../web/src/geo/contracts/library.ts";
import { fakeHub } from "./geo-hub-client-fake.ts";

const url = "https://notebooklm.google.com/notebook/study";
const cleanup: (() => Promise<unknown> | void)[] = [];
let root: string, a: string, b: string, store: LibraryStore;
let app: ReturnType<typeof Fastify>;
beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-notebook-link-"));
  a = createProject({ name: "Alpha" }).id;
  b = createProject({ name: "Beta" }).id;
  store = new LibraryStore(path.join(root, "library"));
  app = Fastify();
  app.addHook("onRequest", (request, _reply, done) => withActiveProject(String(request.headers["x-project-id"] ?? a), done));
  await registerGeoNotebookLinkRoutes(app);
  await registerGeoLibraryRoutes(app, { store: () => store });
});
afterEach(async () => {
  await app.close();
  for (const fn of cleanup.splice(0)) await fn();
  deleteProject(a); deleteProject(b);
  fs.rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});
const put = (endpoint: string, payload: unknown, project = a) => app.inject({ method: "PUT", url: endpoint, headers: { "x-project-id": project, "content-type": "application/json" }, payload: JSON.stringify(payload) });

describe("project notebook link routes", () => {
  it("stores, reopens and removes a link separately per project without fetching it", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No external request allowed"));
    expect((await app.inject("/geo/notebook-link")).json()).toEqual({ url: null, updatedAt: null });
    const saved = await put("/geo/notebook-link", { url: `  ${url}  ` });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({ url, updatedAt: expect.any(String) });
    const read = (pid: string) => app.inject({ url: "/geo/notebook-link", headers: { "x-project-id": pid } });
    expect((await read(a)).json().url).toBe(url);
    expect((await read(b)).json().url).toBeNull();
    expect((await put("/geo/notebook-link", { url: null })).json().url).toBeNull();
    expect((await read(a)).json().url).toBeNull();
    expect(network).not.toHaveBeenCalled();
    expect(fs.readdirSync(path.dirname(notebookLinkFile(resolvePaths(a))))).toEqual(["notebook-link.json"]);
  });
  it.each([{}, { url: "http://example.org" }, { url: "javascript:alert(1)" }, { url: 3 }, { url: "https://user:pass@example.org" }])("returns 400 for %j", async (body) => {
    expect((await put("/geo/notebook-link", body)).statusCode).toBe(400);
    expect(fs.existsSync(notebookLinkFile(resolvePaths(a)))).toBe(false);
  });
  it.each(["{not json", '{"schema":"wrong","url":null}', JSON.stringify({ schema: "gaid-notebook-link/v1", url: "javascript:alert(1)", updatedAt: "2026-10-24" })])("preserves malformed files on read, save and remove", async (raw) => {
    const file = notebookLinkFile(resolvePaths(a));
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw);
    expect((await app.inject("/geo/notebook-link")).statusCode).toBe(409);
    expect((await put("/geo/notebook-link", { url })).statusCode).toBe(409);
    expect((await put("/geo/notebook-link", { url: null })).statusCode).toBe(409);
    expect(fs.readFileSync(file, "utf8")).toBe(raw);
  });
});

describe("library folder notebook links", () => {
  it("saves and removes GAID-owned links on ordinary and Zotero-linked folders without Zotero calls", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No Zotero request allowed"));
    const plain = await store.addGaidCollection("Study");
    const linked = { ...plain, id: "lc-bbbbbbbbbbbb", source: "zotero" as const, zotero: { connection: "local" as const, libraryType: "user" as const, libraryId: "0", collectionKey: "COLLKEY1" } };
    await store.saveCollections([plain, linked]);
    for (const folder of [plain, linked]) {
      const endpoint = `/geo/library/collections/${folder.id}/notebook`;
      expect((await put(endpoint, { url: ` ${url} ` })).json()).toMatchObject({ ...folder, notebookUrl: url });
      expect((await store.collection(folder.id)).notebookUrl).toBe(url);
      for (const value of ["http://example.org", "javascript:alert(1)", "https://user:pass@example.org", 1, ""]) expect((await put(endpoint, { url: value })).statusCode).toBe(400);
      expect((await put(endpoint, {})).statusCode).toBe(400);
      expect((await store.collection(folder.id)).notebookUrl).toBe(url);
      expect((await put(endpoint, { url: null })).statusCode).toBe(200);
      expect((await store.collection(folder.id)).notebookUrl).toBeUndefined();
    }
    expect((await put("/geo/library/collections/missing/notebook", { url })).statusCode).toBe(404);
    expect(network).not.toHaveBeenCalled();
  });
  it.each(["{not json", "{}", "[null]"])("returns 409 and never rewrites malformed collections", async (raw) => {
    const folder = await store.addGaidCollection("Study");
    const file = path.join(store.root, "collections.json"); fs.writeFileSync(file, raw);
    for (const value of [url, null]) expect((await put(`/geo/library/collections/${folder.id}/notebook`, { url: value })).statusCode).toBe(409);
    expect(fs.readFileSync(file, "utf8")).toBe(raw);
  });
  it("keeps notebook links when Zotero refreshes linked and mirrored folder metadata", () => {
    const partition = { connection: "local" as const, serverId: "host", libraryType: "user" as const, libraryId: "0" };
    const mirrored: LibraryCollection = { id: zoteroCollectionId(partition, "COLLKEY1"), owner: "local", source: "zotero", name: "Old", notebookUrl: url, zotero: { ...partition, collectionKey: "COLLKEY1" } };
    const linked: LibraryCollection = { ...mirrored, id: "lc-bbbbbbbbbbbb", zotero: { ...partition, collectionKey: "COLLKEY2" } };
    const fresh = [mirrored, linked].map((folder) => ({ ...folder, id: zoteroCollectionId(partition, folder.zotero!.collectionKey), name: "Renamed", notebookUrl: undefined }));
    const result = reconcileFolders([mirrored, linked], { collections: fresh, removedCollectionKeys: [], sourceCollectionKeys: ["COLLKEY1", "COLLKEY2"], reset: true }, partition, []);
    expect(result.collections).toHaveLength(2);
    expect(result.collections.every((folder) => folder.notebookUrl === url && folder.name === "Renamed")).toBe(true);
  });
  it("pushes, pulls, changes and removes notebook links through hub sync across two libraries", async () => {
    const hub = await fakeHub(); cleanup.push(hub.clean); await hub.login();
    const sync = new LibrarySync(hub.client, store);
    const folder = await store.addGaidCollection("Study");
    await store.setCollectionNotebook(folder.id, url);
    await sync.sync();
    expect((hub.objects.get(`folder:${folder.id}`)!.data as LibraryCollection).notebookUrl).toBe(url);
    const second = new LibraryStore(path.join(root, "library-two"));
    const sync2 = new LibrarySync(hub.client, second);
    await sync2.sync(); expect((await second.collection(folder.id)).notebookUrl).toBe(url);
    await second.setCollectionNotebook(folder.id, "https://example.org/changed"); await sync2.sync(); await sync.sync();
    expect((await store.collection(folder.id)).notebookUrl).toBe("https://example.org/changed");
    await store.setCollectionNotebook(folder.id, null); await sync.sync(); await sync2.sync();
    expect((await second.collection(folder.id)).notebookUrl).toBeUndefined();
  });
});
