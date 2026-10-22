import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFile, readdir, writeFile } from "node:fs/promises";
import type { LibraryItem, LibraryCollection } from "../../web/src/geo/contracts/library.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { LibrarySync } from "../src/geo/library/sync/index.ts";
import { fakeHub } from "./geo-hub-client-fake.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const clean of cleanup.splice(0)) await clean(); });
async function setup() {
  const f = await fakeHub(); cleanup.push(f.clean); await f.login();
  const library = new LibraryStore(join(f.root, "library"));
  const sync = new LibrarySync(f.client, library);
  return { ...f, library, sync };
}
function item(id = "li-aaaaaaaaaaaa", title = "Local", updatedAt = "2026-10-01T00:00:00Z"): LibraryItem {
  return { id, owner: "local", source: "gaid", csl: { type: "article-journal", title }, metadataOrigin: "manual", metadataConfirmed: true, collectionIds: [], tags: [], attachments: [], read: { coverage: "none" }, addedAt: updatedAt, updatedAt };
}
const folder: LibraryCollection = { id: "lc-aaaaaaaaaaaa", owner: "local", source: "gaid", name: "Topic" };
describe("personal library hub sync", () => {
  it("pulls/pushes both directions, preserves owner and nested folders, then is idempotent", async () => {
    const f = await setup();
    await f.library.put(item()); await f.library.saveCollections([folder]);
    f.putObject({ kind: "item", id: "li-bbbbbbbbbbbb", deleted: false, data: item("li-bbbbbbbbbbbb", "Remote") });
    const result = await f.sync.sync();
    expect(result.pulled.items).toBe(1); expect(result.pushed.items).toBe(1); expect(result.pushed.folders).toBe(1);
    expect((await f.library.all()).map((i) => i.csl.title).sort()).toEqual(["Local", "Remote"]);
    expect((f.objects.get("item:li-aaaaaaaaaaaa")!.data as LibraryItem).owner).toBe("local");
    expect((await f.sync.status()).pending).toEqual({ items: 0, folders: 0, files: 0 });
    const next = await f.sync.sync(); expect(next.pushed.items + next.pulled.items).toBe(0);
    const reopened = new LibrarySync(f.client, new LibraryStore(f.library.root));
    expect((await reopened.status()).pending.items).toBe(0);
  });
  it("syncs local and remote deletions with tombstones without resurrecting them", async () => {
    const f = await setup(); await f.library.put(item()); await f.library.saveCollections([folder]); await f.sync.sync();
    await f.library.drop("li-aaaaaaaaaaaa");
    f.putObject({ kind: "folder", id: folder.id, deleted: true });
    const result = await f.sync.sync();
    expect(result.pushed.deleted).toBe(1); expect(result.pulled.deleted).toBe(1);
    expect(f.objects.get("item:li-aaaaaaaaaaaa")!.deleted).toBe(true);
    expect(await f.library.collections()).toEqual([]);
    expect((await f.sync.sync()).pushed.deleted).toBe(0);
  });
  it("newer remote item wins and the replaced local copy is preserved", async () => {
    const f = await setup(); await f.library.put(item()); await f.sync.sync();
    await f.library.put(item(undefined, "Local edit", "2026-10-02T00:00:00Z"));
    f.putObject({ kind: "item", id: "li-aaaaaaaaaaaa", deleted: false, data: item(undefined, "Remote edit", "2026-10-03T00:00:00Z") });
    const result = await f.sync.sync(); expect(result.conflicts).toBe(1);
    expect((await f.library.get("li-aaaaaaaaaaaa")).csl.title).toBe("Remote edit");
    const names = await readdir(join(f.library.root, "sync/conflicts"));
    expect(JSON.parse(await readFile(join(f.library.root, "sync/conflicts", names[0]), "utf8")).csl.title).toBe("Local edit");
    expect((await f.sync.status()).conflicts).toBe(1);
  });
  it("newer local item wins and pushes with the pulled base version; folders use remote", async () => {
    const f = await setup(); await f.library.put(item()); await f.library.saveCollections([folder]); await f.sync.sync();
    await f.library.put(item(undefined, "Local new", "2026-10-04T00:00:00Z")); await f.library.saveCollections([{ ...folder, name: "Local folder" }]);
    f.putObject({ kind: "item", id: "li-aaaaaaaaaaaa", deleted: false, data: item(undefined, "Remote older", "2026-10-03T00:00:00Z") });
    f.putObject({ kind: "folder", id: folder.id, deleted: false, data: { ...folder, name: "Remote folder" } });
    const result = await f.sync.sync(); expect(result.conflicts).toBe(2);
    expect((f.objects.get("item:li-aaaaaaaaaaaa")!.data as LibraryItem).csl.title).toBe("Local new");
    expect((await f.library.collections())[0].name).toBe("Remote folder");
    expect((await f.sync.status()).pending.items).toBe(0);
  });
  it("uploads missing PDFs before metadata and downloads verified PDFs before publishing items", async () => {
    const f = await setup(); const bytes = Buffer.from("%PDF-local"); const stored = await f.library.storePdf(bytes);
    const paper = item(); paper.attachments.push({ id: "la-local", kind: "pdf", stored: { ...stored, mediaType: "application/pdf" } });
    await f.library.put(paper); const result = await f.sync.sync(); expect(result.pushed.files).toBe(1);
    expect(f.files.get(stored.sha256)).toEqual(bytes);
    const library2 = new LibraryStore(join(f.root, "second-library")); const sync2 = new LibrarySync(f.client, library2);
    expect((await sync2.sync()).pulled.files).toBe(1); expect(await readFile(library2.filePath(stored.sha256))).toEqual(bytes);
    expect((await library2.get(paper.id)).attachments[0].stored?.sha256).toBe(stored.sha256);
  });
  it("deduplicates Zotero identities across connections, keeps pulled id and citation aliases, never syncs zotero.json", async () => {
    const f = await setup(); const local = item(); local.source = "zotero"; local.citationKey = "OldKey";
    local.zotero = { connection: "local", serverId: "old-host", libraryType: "user", libraryId: "123", itemKey: "ABCD1234", version: 1 };
    await f.library.put(local); await writeFile(join(f.library.root, "zotero.json"), "LOCAL-ONLY-SECRET");
    const remote = { ...item("li-bbbbbbbbbbbb"), source: "zotero" as const, citationKey: "NewKey", zotero: { ...local.zotero, connection: "web" as const } };
    f.putObject({ kind: "item", id: remote.id, deleted: false, data: remote });
    const linked = { ...folder, id: `zc-${encodeURIComponent(JSON.stringify(["local", "host", "user", "123", "COLLKEY"]))}`, source: "zotero" as const };
    f.putObject({ kind: "folder", id: linked.id, deleted: false, data: linked });
    await f.sync.sync();
    expect((await f.library.all()).map((i) => i.id)).toEqual([remote.id]);
    expect((await f.library.get(local.id)).id).toBe(remote.id); expect((await f.library.byCitationKey("OldKey"))?.id).toBe(remote.id);
    expect((await f.library.collections())[0].id).toBe(linked.id);
    expect(await readFile(join(f.library.root, "zotero.json"), "utf8")).toBe("LOCAL-ONLY-SECRET");
    expect(JSON.stringify([...f.objects.values()])).not.toContain("LOCAL-ONLY-SECRET");
  });
  it("retries a stale push once, then reports a continuing conflict", async () => {
    const f = await setup(); await f.library.put(item()); f.state.stale = 1;
    expect((await f.sync.sync()).pushed.items).toBe(1); expect(f.state.pushCalls).toBe(2);
    await f.library.put(item(undefined, "change")); f.state.stale = 2;
    await expect(f.sync.sync()).rejects.toMatchObject({ status: 409 }); expect(f.state.pushCalls).toBe(4);
    expect((await f.sync.status()).lastError).toBeTruthy();
  });
  it("allows only one sync at a time and logs out on 401 without modifying local items", async () => {
    const f = await setup(); await f.library.put(item());
    const first = f.sync.sync(); await expect(f.sync.sync()).rejects.toMatchObject({ status: 409 }); await first;
    f.state.unauthorized = true; await expect(f.sync.sync()).rejects.toMatchObject({ status: 401 });
    expect((await f.sync.status()).available).toBe(false); expect(await f.library.all()).toHaveLength(1);
  });
  it("does not advance past unseen changes when push response version includes another device", async () => {
    const f = await setup(); await f.library.put(item());
    const original = f.client.request.bind(f.client); let injected = false;
    f.client.request = async (path, options) => {
      if (path === "/library/changes" && options?.method === "POST" && !injected) {
        injected = true; f.putObject({ kind: "item", id: "li-bbbbbbbbbbbb", deleted: false, data: item("li-bbbbbbbbbbbb", "Other device") });
      }
      return original(path, options);
    };
    await f.sync.sync(); expect((await f.library.get("li-bbbbbbbbbbbb")).csl.title).toBe("Other device");
  });
  it("rejects corrupt downloaded PDFs before publishing metadata and preserves dirty objects after failure", async () => {
    const f = await setup(); const sha = "a".repeat(64); f.files.set(sha, Buffer.from("%PDF-wrong-hash"));
    const paper = item(); paper.attachments = [{ id: "la-test", kind: "pdf", stored: { sha256: sha, size: 10, mediaType: "application/pdf" } }];
    f.putObject({ kind: "item", id: paper.id, deleted: false, data: paper });
    await expect(f.sync.sync()).rejects.toMatchObject({ status: 502 }); expect(await f.library.all()).toEqual([]);
  });
});
