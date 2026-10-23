import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject, deleteProject, resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { registerGeoLibraryRoutes } from "../src/geo/routes/library.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { libraryInstance, snapshot } from "../src/geo/library/notes.ts";
import { ZoteroService } from "../src/geo/library/zotero-service.ts";
import { LibrarySync, pushBatches } from "../src/geo/library/sync/index.ts";
import type { LibraryItem, LibraryItemResponse, LibraryListResponse } from "../../web/src/geo/contracts/library.ts";
import { fakeHub } from "./geo-hub-client-fake.ts";

let dir: string, store: LibraryStore, paths: ProjectPaths, projectId: string;

function note(title: string, extra = "", status = "pending"): string {
  return `---\ntitle: ${title}\ndate: 2026-10-23\nstatus: ${status}\nheadline: 자력 이상과 시추 대자율이 맞습니다.\n---\n# ${title}\n\n## 한눈에\n\n결론 [@hong2026, p. 4]\n\n## 결과\n\n![그림](figures/a.png)\n\n## 한 일\n\n1. 역산 [@missing2020]\n\n## 한계\n\n없음\n\n## 결정할 일\n\n없음\n\n## 근거\n\n- [표](../../derived/t.csv)\n${extra}`;
}
function writeNote(id: string, text: string) {
  const d = path.join(paths.sandbox, "연구노트", id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "index.md"), text);
  return path.join(d, "index.md");
}
async function app() {
  const server = Fastify();
  server.addHook("onRequest", (request, _reply, done) => withActiveProject(String(request.headers["x-project-id"] ?? projectId), done));
  await registerGeoLibraryRoutes(server, { store: () => store, paths: () => paths });
  return server;
}
const paper = { type: "article-journal", title: "Magnetite inversion", author: [{ family: "Hong", given: "A" }], issued: { "date-parts": [[2026]] }, DOI: "10.1234/mag" };

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-library-notes-"));
  store = new LibraryStore(path.join(dir, "library"));
  const project = createProject({ name: "포천 자철석" });
  projectId = project.id;
  paths = resolvePaths(project.id);
});
afterEach(() => {
  deleteProject(projectId);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("research notes in the library", () => {
  it("brings a note in once, lists it as its own category and links the cited paper both ways", async () => {
    const server = await app();
    const p = await store.addGaidItem({ csl: paper, metadataOrigin: "crossref" });
    expect(p.citationKey).toBe("hong2026");
    writeNote("2026-10-23-pocheon", note("포천 자력 역산"));

    const add = await server.inject({ method: "POST", url: "/geo/library/notes", payload: { noteId: "2026-10-23-pocheon" } });
    expect(add.statusCode).toBe(201);
    const item = add.json().item as LibraryItem;
    expect(item).toMatchObject({ kind: "note", source: "gaid", metadataOrigin: "note", csl: { type: "document", title: "포천 자력 역산", issued: { "date-parts": [[2026, 10, 23]] } }, attachments: [] });
    expect(item.citationKey).toBeUndefined();
    expect(item.note).toMatchObject({ projectId, projectName: "포천 자철석", noteId: "2026-10-23-pocheon", status: "pending", headline: "자력 이상과 시추 대자율이 맞습니다." });
    expect(item.note!.citations).toEqual([{ key: "hong2026", itemId: p.id, locators: ["p. 4"] }, { key: "missing2020", locators: [] }]);

    const again = await server.inject({ method: "POST", url: "/geo/library/notes", payload: { noteId: "2026-10-23-pocheon" } });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ created: false, item: { id: item.id } });

    const notes = (await server.inject({ url: "/geo/library?kind=note" })).json() as LibraryListResponse;
    expect(notes.items.map((i) => i.id)).toEqual([item.id]);
    expect(notes.items[0]).toMatchObject({ kind: "note", note: { projectId, noteId: "2026-10-23-pocheon", local: true, cites: 1, status: "pending" } });
    expect(notes.counts).toMatchObject({ all: 1, notes: 1, notesPending: 1, notesConfirmed: 0 });
    const papers = (await server.inject({ url: "/geo/library?kind=paper" })).json() as LibraryListResponse;
    expect(papers.items.map((i) => i.id)).toEqual([p.id]);
    expect(papers.items[0].kind).toBe("paper");

    const detail = (await server.inject({ url: `/geo/library/items/${p.id}` })).json() as LibraryItemResponse;
    expect(detail.uses).toContainEqual(expect.objectContaining({ kind: "note", noteId: "2026-10-23-pocheon", libraryItemId: item.id }));
    expect((await server.inject({ url: `/geo/library/items/${item.id}` })).json()).toMatchObject({ noteLocal: true });

    const candidates = (await server.inject({ url: "/geo/library/notes/candidates" })).json();
    expect(candidates.notes).toContainEqual(expect.objectContaining({ projectId, noteId: "2026-10-23-pocheon", itemId: item.id }));

    // Not a reference: never exported, never in a folder's paper check, not cited by key.
    const bib = await server.inject({ url: "/geo/library/export?format=csl-json" });
    expect(JSON.parse(bib.body).map((c: { title: string }) => c.title)).toEqual(["Magnetite inversion"]);
    const folder = await store.addGaidCollection("포천");
    const membership = await new ZoteroService(store).setMembership(folder.id, [item.id, p.id], "add");
    expect(membership).toMatchObject({ changed: 2, writtenToZotero: 0 });
    const check = (await server.inject({ url: `/geo/library/collections/${folder.id}/check` })).json();
    expect(check.items).toBe(1);
    expect(check.issues.some((i: { itemId?: string }) => i.itemId === item.id)).toBe(false);
    expect((await server.inject({ url: `/geo/library?kind=note&collectionId=${folder.id}` })).json().folderCounts[folder.id]).toBe(1);
  });

  it("follows the note file: edits, status, a missing file and its return", async () => {
    const server = await app();
    const file = writeNote("2026-10-23-pocheon", note("첫 제목"));
    const { item } = (await server.inject({ method: "POST", url: "/geo/library/notes", payload: { noteId: "2026-10-23-pocheon" } })).json();
    fs.writeFileSync(file, note("고친 제목", "\n추가 근거\n", "confirmed"));
    fs.utimesSync(file, new Date(), new Date(Date.now() + 5000));
    const listed = (await server.inject({ url: "/geo/library?kind=note" })).json() as LibraryListResponse;
    expect(listed.items[0]).toMatchObject({ title: "고친 제목", note: { status: "confirmed" } });
    expect((await store.get(item.id)).note!.markdown).toContain("추가 근거");

    fs.rmSync(path.dirname(file), { recursive: true });
    const gone = (await server.inject({ url: "/geo/library?kind=note" })).json() as LibraryListResponse;
    expect(gone.items[0]).toMatchObject({ title: "고친 제목", note: { local: false, missing: true } });
    expect((await server.inject({ url: `/geo/library/items/${item.id}` })).json()).toMatchObject({ noteLocal: false });

    writeNote("2026-10-23-pocheon", note("돌아온 노트"));
    const back = (await server.inject({ url: "/geo/library?kind=note" })).json() as LibraryListResponse;
    expect(back.items[0]).toMatchObject({ title: "돌아온 노트", note: { local: true } });
    expect(back.items[0].note!.missing).toBeUndefined();

    // Removing the library item leaves the note file alone.
    expect((await server.inject({ method: "DELETE", url: `/geo/library/items/${item.id}` })).statusCode).toBe(204);
    expect(fs.existsSync(path.join(paths.sandbox, "연구노트", "2026-10-23-pocheon", "index.md"))).toBe(true);
  });

  it("refuses unknown notes and title edits; never sends a note to Zotero", async () => {
    const server = await app();
    expect((await server.inject({ method: "POST", url: "/geo/library/notes", payload: { noteId: "2026-01-01-none" } })).statusCode).toBe(404);
    expect((await server.inject({ method: "POST", url: "/geo/library/notes", payload: { noteId: "../x" } })).statusCode).toBe(400);
    writeNote("2026-10-23-pocheon", note("노트"));
    const { item } = (await server.inject({ method: "POST", url: "/geo/library/notes", payload: { noteId: "2026-10-23-pocheon" } })).json();
    expect((await server.inject({ method: "PATCH", url: `/geo/library/items/${item.id}`, payload: { csl: { type: "document", title: "x" } } })).statusCode).toBe(409);
    expect((await server.inject({ method: "PATCH", url: `/geo/library/items/${item.id}`, payload: { tags: ["포천"] } })).json().tags).toEqual(["포천"]);
    await expect(new ZoteroService(store).sendToZotero(item.id)).rejects.toMatchObject({ status: 409 });
  });

  it("shows a note from another PC from its snapshot and keeps its paper link", async () => {
    const server = await app();
    const p = await store.addGaidItem({ csl: paper, metadataOrigin: "crossref" });
    const at = "2026-10-22T00:00:00.000Z";
    await store.put({
      id: "li-remotenote01", owner: "local", source: "gaid", kind: "note", csl: { type: "document", title: "다른 PC 노트" }, metadataOrigin: "note", metadataConfirmed: true,
      collectionIds: [], tags: [], attachments: [], read: { coverage: "full" }, addedAt: at, updatedAt: at,
      note: { origin: "gi-0000000000000000", originLabel: "pc71", projectId, projectName: "다른 프로젝트", noteId: "2026-10-22-x", path: "연구노트/2026-10-22-x/index.md", date: "2026-10-22", status: "confirmed", markdown: "# 다른 PC 노트", contentSha256: "0".repeat(64), fileUpdatedAt: at, refreshedAt: at, citations: [{ key: "hong2026", itemId: p.id, locators: [] }] },
    });
    const listed = (await server.inject({ url: "/geo/library?kind=note" })).json() as LibraryListResponse;
    expect(listed.items[0]).toMatchObject({ note: { local: false, originLabel: "pc71", status: "confirmed" } });
    expect((await store.get("li-remotenote01")).updatedAt).toBe(at); // not refreshed here
    const detail = (await server.inject({ url: `/geo/library/items/${p.id}` })).json() as LibraryItemResponse;
    expect(detail.uses).toContainEqual(expect.objectContaining({ kind: "note", libraryItemId: "li-remotenote01", remote: true }));
    expect(libraryInstance(store).id).not.toBe("gi-0000000000000000");
  });

  it("keeps a bounded snapshot on a character boundary", () => {
    const text = "가".repeat(30_000); // 90,000 bytes
    const s = snapshot(text, 64 * 1024);
    expect(s.truncated).toBe(true);
    expect(Buffer.byteLength(s.markdown)).toBeLessThanOrEqual(64 * 1024);
    expect(s.markdown).toBe("가".repeat(Math.floor(64 * 1024 / 3)));
    expect(snapshot("짧은 노트")).toEqual({ markdown: "짧은 노트", truncated: false });
  });
});

describe("research notes in hub library sync", () => {
  it("splits large pushes and syncs a note item with its snapshot", async () => {
    const big = (i: number) => ({ kind: "item" as const, id: `li-${String(i).padStart(12, "0")}`, baseVersion: 0, deleted: false, data: { pad: "x".repeat(60 * 1024) } });
    const batches = pushBatches(Array.from({ length: 120 }, (_, i) => big(i)));
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) expect(Buffer.byteLength(JSON.stringify(b))).toBeLessThanOrEqual(3 * 1024 * 1024 + 1024);
    expect(batches.flat()).toHaveLength(120);
    expect(pushBatches(Array.from({ length: 1200 }, (_, i) => ({ kind: "folder" as const, id: `lc-${i}`, baseVersion: 0, deleted: true }))).map((b) => b.length)).toEqual([500, 500, 200]);

    const f = await fakeHub();
    try {
      await f.login();
      const library = new LibraryStore(path.join(f.root, "library"));
      store = library;
      writeNote("2026-10-23-pocheon", note("동기화 노트"));
      const server = await app();
      const { item } = (await server.inject({ method: "POST", url: "/geo/library/notes", payload: { noteId: "2026-10-23-pocheon" } })).json();
      const result = await new LibrarySync(f.client, library).sync();
      expect(result.pushed.items).toBe(1);
      const pushed = f.objects.get(`item:${item.id}`)!.data as LibraryItem;
      expect(pushed).toMatchObject({ kind: "note", note: { noteId: "2026-10-23-pocheon" } });
      expect(pushed.note!.markdown).toContain("동기화 노트");
    } finally { await f.clean(); }
  });
});
