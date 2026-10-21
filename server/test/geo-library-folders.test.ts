import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject, deleteProject, resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { registerGeoLibraryRoutes } from "../src/geo/routes/library.ts";
import { LibraryStore, samePaper } from "../src/geo/library/store.ts";
import { makeNoteCitationExtension } from "../src/geo/library/tools.ts";
import { writeProjectLiterature } from "../src/geo/library/uses.ts";
import { reconcileFolders } from "../src/geo/library/zotero-service.ts";
import { zoteroCollectionId } from "../src/geo/library/zotero/index.ts";
import type { LibraryCollection, LibraryItem } from "../../web/src/geo/contracts/library.ts";

const csl = (title: string, family: string, year: number, doi?: string) => ({ type: "article-journal", title, author: [{ family, given: "A" }], issued: { "date-parts": [[year]] }, ...(doi ? { DOI: doi } : {}) });

let dir: string, store: LibraryStore, paths: ProjectPaths, projectId: string;
async function app() {
  const server = Fastify();
  server.addHook("onRequest", (request, _reply, done) => withActiveProject(String(request.headers["x-project-id"] ?? projectId), done));
  await registerGeoLibraryRoutes(server, { store: () => store, paths: () => paths });
  return server;
}
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-library-folders-"));
  store = new LibraryStore(path.join(dir, "library"));
  const project = createProject({ name: "폴더 시험" });
  projectId = project.id;
  paths = resolvePaths(project.id);
});
afterEach(() => {
  deleteProject(projectId);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("library folders", () => {
  it("nests folders, refuses cycles and linked edits, and deletes a subtree without losing papers", async () => {
    const paper = await store.addGaidCollection("원고 A");
    const intro = await store.addGaidCollection("서론", paper.id);
    const deep = await store.addGaidCollection("배경", intro.id);
    await expect(store.editGaidCollection(paper.id, { parentId: deep.id })).rejects.toMatchObject({ status: 409 });
    expect(await store.editGaidCollection(intro.id, { name: "1장 서론" })).toMatchObject({ name: "1장 서론", parentId: paper.id });
    const item = await store.addGaidItem({ csl: csl("PU", "Hong", 2026), metadataOrigin: "manual", collectionIds: [deep.id, paper.id] });
    expect(item.collectionIds).toEqual([deep.id, paper.id]);
    const linked = { ...(await store.collection(intro.id)), source: "zotero" as const, zotero: { connection: "local" as const, libraryType: "user" as const, libraryId: "0", collectionKey: "AAAA1111" } };
    await store.saveCollections((await store.collections()).map((c) => (c.id === intro.id ? linked : c)));
    await expect(store.editGaidCollection(intro.id, { name: "x" })).rejects.toMatchObject({ status: 409 });
    await expect(store.removeGaidCollection(paper.id)).rejects.toMatchObject({ status: 409 });
    await store.saveCollections((await store.collections()).map((c) => (c.id === intro.id ? { ...c, source: "gaid" as const, zotero: undefined } : c)));
    expect(await store.removeGaidCollection(intro.id)).toEqual({ folders: 2 });
    expect((await store.get(item.id)).collectionIds).toEqual([paper.id]);
    expect((await store.collections()).map((c) => c.id)).toEqual([paper.id]);
  });

  it("lists a folder with its subfolders, counts per folder, exports a folder as a reference list", async () => {
    const server = await app();
    const top = (await server.inject({ method: "POST", url: "/geo/library/collections", payload: { name: "원고 A" } })).json();
    const sub = (await server.inject({ method: "POST", url: "/geo/library/collections", payload: { name: "방법", parentId: top.id } })).json();
    const a = await store.addGaidItem({ csl: csl("Nickel targets", "Hong", 2026, "10.1/a"), metadataOrigin: "manual" });
    const b = await store.addGaidItem({ csl: csl("Block validation", "Kim", 2024), metadataOrigin: "manual" });
    await store.addGaidItem({ csl: csl("Outside", "Lee", 2020), metadataOrigin: "manual" });
    const add = (folder: string, ids: string[]) => server.inject({ method: "POST", url: `/geo/library/collections/${folder}/items`, payload: { itemIds: ids, action: "add" } });
    expect((await add(top.id, [a.id])).json()).toEqual({ changed: 1, writtenToZotero: 0, removeInZotero: [] });
    await add(sub.id, [b.id]);
    expect((await add(sub.id, [b.id])).json().changed).toBe(0);
    const list = (await server.inject({ url: `/geo/library?collectionId=${top.id}` })).json();
    expect(list.items.map((i: { title: string }) => i.title).sort()).toEqual(["Block validation", "Nickel targets"]);
    expect(list.folderCounts).toEqual({ [top.id]: 2, [sub.id]: 1 });
    expect((await server.inject({ url: `/geo/library?collectionId=${top.id}&q=block` })).json().total).toBe(1);
    expect((await server.inject({ url: "/geo/library?q=outside" })).json().total).toBe(1);

    const text = await server.inject({ url: `/geo/library/export?format=text&collectionId=${top.id}` });
    expect(text.body.trim().split("\n")).toEqual(["Hong, A. (2026). Nickel targets. https://doi.org/10.1/a", "Kim, A. (2024). Block validation."]);
    expect(text.headers["content-disposition"]).toContain(encodeURIComponent("원고 A.txt"));
    const bib = await server.inject({ url: `/geo/library/export?format=bibtex&collectionId=${sub.id}` });
    expect(bib.body).toContain("@article{kim2024,");
    expect(bib.body).not.toContain("hong2026");

    const removed = (await server.inject({ method: "POST", url: `/geo/library/collections/${sub.id}/items`, payload: { itemIds: [b.id], action: "remove" } })).json();
    expect(removed.changed).toBe(1);
    expect((await server.inject({ method: "DELETE", url: `/geo/library/collections/${top.id}` })).json()).toEqual({ folders: 2 });
    await server.close();
  });

  it("uses a project's attached folders as its citation scope: check, references and the note hook", async () => {
    const server = await app();
    const folder = await store.addGaidCollection("원고 A");
    const sub = await store.addGaidCollection("결과", folder.id);
    const inside = await store.addGaidItem({ csl: csl("Inside", "Hong", 2026, "10.1234/in"), metadataOrigin: "manual", collectionIds: [sub.id] });
    const twin = await store.addGaidItem({ csl: csl("Inside", "Hong", 2026), metadataOrigin: "import", collectionIds: [folder.id] });
    const outside = await store.addGaidItem({ csl: csl("Outside", "Kim", 2020), metadataOrigin: "manual" });
    await store.mutate(twin.id, (next) => { next.metadataConfirmed = false; });
    writeProjectLiterature(paths, { collectionIds: [folder.id], itemIds: [] });
    const notes = path.join(paths.sandbox, "연구노트", "2026-10-21-a");
    fs.mkdirSync(notes, { recursive: true });
    fs.writeFileSync(path.join(notes, "index.md"), `---\ntitle: 결과 정리\n---\n[@${inside.citationKey}, p. 2; @${outside.citationKey}; @ghost1999]\n`);

    const check = (await server.inject({ url: `/geo/library/collections/${folder.id}/check` })).json();
    expect(check.items).toBe(2);
    expect(check.projects).toEqual([{ id: projectId, name: "폴더 시험" }]);
    const kinds = check.issues.map((i: { kind: string }) => i.kind);
    expect(kinds).toContain("duplicate");
    expect(kinds).toContain("unconfirmed");
    expect(check.issues.filter((i: { kind: string }) => i.kind === "cited-outside").map((i: { key: string; itemId?: string }) => [i.key, i.itemId])).toEqual([[outside.citationKey, outside.id], ["ghost1999", undefined]]);
    expect(check.issues.find((i: { kind: string }) => i.kind === "no-doi").itemId).toBe(twin.id);

    const refs = (await server.inject({ url: `/geo/library/citations?keys=${inside.citationKey},${outside.citationKey}` })).json();
    expect(refs[0].outsideScope).toBeUndefined();
    expect(refs[1]).toMatchObject({ itemId: outside.id, outsideScope: true });

    let handler: ((e: unknown) => Promise<unknown>) | undefined;
    makeNoteCitationExtension(paths, () => store)({ on: (name: string, h: never) => { if (name === "tool_result") handler = h; } } as never);
    const result = (await handler!({ toolName: "edit", input: { path: "연구노트/2026-10-21-a/index.md" }, isError: false, content: [{ type: "text", text: "ok" }] })) as { content: { text: string }[] };
    expect(result.content[1].text).toContain("@ghost1999 not in the researcher's library");
    expect(result.content[1].text).toContain(`@${outside.citationKey} in the library but outside this project's citation folders`);
    await server.close();
  });

  it("resolves merged ids and earlier citation keys through aliases", async () => {
    const item = await store.addGaidItem({ csl: csl("Merged", "Hong", 2026), metadataOrigin: "manual" });
    await store.mutate(item.id, (next) => { next.aliases = { ids: ["li-aaaaaaaaaaaa"], citationKeys: ["old2026"] }; });
    expect((await store.get("li-aaaaaaaaaaaa")).id).toBe(item.id);
    expect((await store.byCitationKey("old2026"))?.id).toBe(item.id);
    expect(samePaper(csl("A title!", "Hong", 2026), csl("a  TITLE", "hong", 2026))).toBe(true);
    expect(samePaper(csl("A", "Hong", 2026, "10.1234/x"), csl("B", "Kim", 2020, "https://doi.org/10.1234/X"))).toBe(true);
    expect(samePaper(csl("A", "Hong", 2026, "10.1234/x"), csl("A", "Hong", 2026, "10.1234/y"))).toBe(false);
  });
});

describe("folder reconciliation after a Zotero sync", () => {
  const partition = { connection: "local" as const, serverId: "server-A", libraryType: "user" as const, libraryId: "0" };
  const mirrored = (key: string, name: string, parentKey?: string): LibraryCollection => ({
    id: zoteroCollectionId(partition, key), owner: "local", name, source: "zotero",
    ...(parentKey ? { parentId: zoteroCollectionId(partition, parentKey) } : {}),
    zotero: { connection: "local", libraryType: "user", libraryId: "0", collectionKey: key },
  });
  const empty = { collections: [] as LibraryCollection[], removedCollectionKeys: [] as string[], reset: false };

  it("keeps a sent folder's GAID id, follows Zotero renames and translates memberships", () => {
    const sent: LibraryCollection = { id: "lc-aaaaaaaaaaaa", owner: "local", name: "원고 A", source: "zotero", zotero: { ...partition, collectionKey: "SENT0001" } };
    const result = reconcileFolders([sent], { ...empty, collections: [mirrored("SENT0001", "원고 A (2026)"), mirrored("CHILD001", "방법", "SENT0001")] }, partition, []);
    expect(result.collections.map((c) => [c.id, c.name, c.parentId])).toEqual([["lc-aaaaaaaaaaaa", "원고 A (2026)", undefined], [zoteroCollectionId(partition, "CHILD001"), "방법", "lc-aaaaaaaaaaaa"]]);
    expect(result.translate.get(zoteroCollectionId(partition, "SENT0001"))).toBe("lc-aaaaaaaaaaaa");
    expect([...result.linked].sort()).toEqual([zoteroCollectionId(partition, "CHILD001"), "lc-aaaaaaaaaaaa"].sort());
  });

  it("drops an empty deleted collection, keeps one that holds GAID papers, and unlinks a sent folder", () => {
    const gone = mirrored("GONE0001", "지운 컬렉션");
    const held = mirrored("HELD0001", "GAID 논문이 있는 컬렉션");
    const sent: LibraryCollection = { id: "lc-bbbbbbbbbbbb", owner: "local", name: "보낸 폴더", source: "zotero", zotero: { ...partition, collectionKey: "SENT0002" } };
    const gaidPaper = { id: "li-cccccccccccc", source: "gaid", collectionIds: [held.id] } as LibraryItem;
    const result = reconcileFolders([gone, held, sent], { ...empty, removedCollectionKeys: ["GONE0001", "HELD0001", "SENT0002"] }, partition, [gaidPaper]);
    expect(result.collections.map((c) => [c.id, c.source, Boolean(c.zotero)])).toEqual([[held.id, "gaid", false], ["lc-bbbbbbbbbbbb", "gaid", false]]);
    expect(result.linked.size).toBe(0);
  });
});
