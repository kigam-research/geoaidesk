import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject, deleteProject, resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { registerGeoLibraryRoutes } from "../src/geo/routes/library.ts";
import { LibraryStore, cslYear, samePaper } from "../src/geo/library/store.ts";
import { makeNoteCitationExtension } from "../src/geo/library/tools.ts";
import { readStoredPdf } from "../src/geo/library/reader.ts";
import { writeProjectLiterature } from "../src/geo/library/uses.ts";
import { ZoteroService, reconcileFolders } from "../src/geo/library/zotero-service.ts";
import { fakeZotero, type FakeZotero } from "./fixtures/geo-zotero-server.ts";
import { mapZoteroItem, zoteroCollectionId } from "../src/geo/library/zotero/index.ts";
import type { LibraryCollection, LibraryItem } from "../../web/src/geo/contracts/library.ts";

/** A minimal one-font text PDF for pdftotext. */
function makePdf(pages: string[]): Buffer {
  const objs: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  pages.forEach((text, i) => {
    const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = "%PDF-1.4\n"; const off: number[] = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

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
    // A Zotero mirror synced with string date parts still exports.
    await store.mutate(b.id, (next) => { next.csl.issued = { "date-parts": [["2024" as unknown as number]] }; });
    const all = await server.inject({ url: "/geo/library/export?format=bibtex" });
    expect(all.statusCode).toBe(200);
    expect(all.body).toContain("year = {2024}");

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
    expect(refs[1].pdf).toBeUndefined(); // no PDF stored in GAID: the citation cannot open one

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
    // Zotero 10's CSL export writes years as strings.
    const ref = { connection: "local" as const, serverId: "s", libraryType: "user" as const, libraryId: "0", itemKey: "AAAA1111", version: 1 };
    const mapped = mapZoteroItem({ key: "AAAA1111", version: 1, data: { title: "T" }, csljson: JSON.stringify([{ type: "article-journal", title: "T", issued: { "date-parts": [["2023", "05"]] } }]) }, { ref, owner: "local", id: "li-eeeeeeeeeeee", now: "2026-10-21T00:00:00Z" });
    expect(mapped.csl.issued).toEqual({ "date-parts": [[2023, 5]] });
    expect(cslYear({ type: "book", title: "x", issued: { "date-parts": [["2021" as unknown as number]] } })).toBe(2021);
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

describe("sending folders to Zotero (fake Local API)", () => {
  let fake: FakeZotero, service: ZoteroService;
  beforeEach(async () => {
    fake = await fakeZotero("local");
    service = new ZoteroService(store, { localBaseUrl: fake.baseUrl });
  });
  afterEach(async () => { await fake.close(); });
  /** The fake exports one fixed CSL record; give created/seeded items their own metadata, as real Zotero does. */
  const realCsl = () => { for (const o of fake.items.values()) if (o.data.itemType !== "attachment") o.csljson = { type: "article-journal", title: String(o.data.title), ...(o.data.DOI ? { DOI: String(o.data.DOI) } : {}) }; };

  it("links the folder tree, creates new papers with PDFs, merges a duplicate and does not repeat on a second send", async () => {
    fake.addCollection("COLLECT1", "광상");
    fake.addItem("PAPER001", { title: "Already in Zotero", DOI: "10.5555/dup", collections: ["COLLECT1"] });
    realCsl();
    await service.connectLocal();
    const mirrored = (await store.all()).find((i) => i.zotero?.itemKey === "PAPER001")!;
    const ms = await store.addGaidCollection("원고 A");
    const method = await store.addGaidCollection("방법", ms.id);
    const pdf = await store.storePdf(makePdf(["Nickel prospectivity page text long enough for the reader to keep it"]));
    const fresh = await store.addGaidItem({ csl: { type: "article-journal", title: "New GAID paper", author: [{ family: "Kim" }], issued: { "date-parts": [[2025]] } }, metadataOrigin: "manual", pdfSha256: pdf.sha256, collectionIds: [method.id] });
    const read = await readStoredPdf(store, pdf.sha256); // as POST /geo/library/items does
    await store.mutate(fresh.id, (next) => { next.read = read; });
    // Added in GAID before the same paper arrived from Zotero (addGaidItem refuses a known DOI).
    const dup: LibraryItem = { ...(await store.get(fresh.id)), id: "li-dddddddddddd", csl: { type: "article-journal", title: "Already in Zotero", DOI: "10.5555/dup" }, citationKey: "dup2020", attachments: [], read: { coverage: "none" }, collectionIds: [ms.id] };
    await store.put(dup);
    await service.setMembership(ms.id, [mirrored.id], "add"); // unlinked folder: GAID's own membership
    expect(fake.requests.filter((r) => r.method !== "GET")).toHaveLength(0);

    const result = await service.sendFolderToZotero(ms.id);
    expect(result).toMatchObject({ folders: 2, created: 1, merged: 1, attachments: 1, skipped: [] });
    expect(result.stopped).toBeUndefined();
    const zc = [...fake.collections.values()];
    const msKey = zc.find((c) => c.data.name === "원고 A")!.key, methodKey = zc.find((c) => c.data.name === "방법")!.key;
    expect(zc.find((c) => c.key === methodKey)!.data.parentCollection).toBe(msKey);
    const created = [...fake.items.values()].find((o) => o.data.title === "New GAID paper")!;
    expect(created.data.collections).toEqual([methodKey]);
    expect([...fake.uploadedFiles.values()][0].equals(fs.readFileSync(store.filePath(pdf.sha256)))).toBe(true);
    expect([...fake.fullTexts.values()][0]).toMatchObject({ indexedPages: 1, totalPages: 1 });
    expect(fake.items.get("PAPER001")!.data.collections).toEqual(expect.arrayContaining(["COLLECT1", msKey]));

    // Ids and keys stay: the sent paper keeps its id, the merged one resolves to the Zotero copy.
    realCsl();
    await service.syncAll();
    const sent = await store.get(fresh.id);
    expect(sent).toMatchObject({ source: "zotero", citationKey: "kim2025", collectionIds: [method.id] });
    expect(sent.attachments.filter((a) => a.kind === "pdf")).toHaveLength(1);
    expect((await store.get(dup.id)).id).toBe(mirrored.id);
    expect((await store.byCitationKey("dup2020"))?.id).toBe(mirrored.id);
    expect((await store.get(mirrored.id)).collectionIds.sort()).toEqual([ms.id, zoteroCollectionId({ connection: "local", serverId: "server-A", libraryType: "user", libraryId: "0" }, "COLLECT1")].sort());
    expect((await store.collections()).filter((c) => c.id === ms.id || c.id === method.id).every((c) => c.source === "zotero" && c.zotero)).toBe(true);

    const items = fake.items.size, collections = fake.collections.size;
    const again = await service.sendFolderToZotero(ms.id);
    expect(again).toMatchObject({ folders: 0, created: 0, merged: 0, attachments: 0 });
    expect([fake.items.size, fake.collections.size]).toEqual([items, collections]);

    // Renamed in Zotero: the GAID folder keeps its id and follows the name.
    fake.collections.get(msKey)!.data.name = "원고 A (투고)";
    fake.collections.get(msKey)!.version = ++fake.version;
    await service.syncAll();
    expect((await store.collection(ms.id)).name).toBe("원고 A (투고)");
  });

  it("writes membership of a Zotero paper in a linked folder to Zotero and leaves removal to Zotero", async () => {
    fake.addCollection("COLLECT1", "광상");
    fake.addItem("PAPER001", { title: "Zotero paper" });
    realCsl();
    await service.connectLocal();
    const folder = (await store.collections())[0];
    const paper = (await store.all())[0];
    expect(await service.setMembership(folder.id, [paper.id], "add")).toEqual({ changed: 1, writtenToZotero: 1, removeInZotero: [] });
    expect(fake.items.get("PAPER001")!.data.collections).toEqual(["COLLECT1"]);
    expect(await service.setMembership(folder.id, [paper.id], "remove")).toEqual({ changed: 0, writtenToZotero: 0, removeInZotero: [paper.id] });
    await service.syncAll();
    expect((await store.get(paper.id)).collectionIds).toEqual([folder.id]);
  });
});
