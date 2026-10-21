import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { fakeZotero, type FakeZotero } from "./fixtures/geo-zotero-server.ts";
import {
  LocalZoteroClient, WebZoteroClient, ZoteroConflictError, ZoteroError,
  addItemToInbox, addResearchNoteLink, addTags, ensureInboxCollection,
  getAttachmentFile, getAttachmentFullText, mapZoteroItem, openPdfLink, probeZoteroLibrary,
  selectItemLink, syncZoteroLibrary, zoteroRefKey, type ZoteroLibraryState, type ZoteroSecretStore,
} from "../src/geo/library/zotero/index.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
function secrets(): ZoteroSecretStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, async get(key) { return values.get(key); }, async set(key, value) { values.set(key, value); }, async delete(key) { values.delete(key); } };
}
async function setup(connection: "local" | "web" = "local") {
  const fake = await fakeZotero(connection);
  cleanups.push(() => fake.close());
  const store = secrets();
  const client = connection === "local" ? new LocalZoteroClient({ baseUrl: fake.baseUrl, secrets: store }) : new WebZoteroClient({ baseUrl: fake.baseUrl, secrets: store });
  if (client instanceof WebZoteroClient) await client.setKey("web-synthetic-secret");
  return { fake, store, client };
}
const library = { libraryType: "user" as const, libraryId: "0" };
const state = (connection: "local" | "web" = "local"): ZoteroLibraryState => ({ ...library, connection, name: "Test library", follow: "all", libraryVersion: 0, state: "ok" });
const options = { owner: "researcher", now: "2026-10-21T12:00:00Z", idForItem: (ref: Parameters<typeof zoteroRefKey>[0]) => `li-${ref.itemKey}` };
function ref(fake: FakeZotero, key: string) { return { ...library, connection: fake.connection, ...(fake.connection === "local" ? { serverId: fake.serverId } : {}), itemKey: key, version: fake.items.get(key)!.version }; }

describe("Zotero clients and connection states", () => {
  it("discovers local server ID, reads without a key, authorizes through the injected store only", async () => {
    const { fake, client, store } = await setup();
    expect((await probeZoteroLibrary(client, state())).state).toBe("ok");
    expect(fake.requests[0].headers["zotero-api-key"]).toBeUndefined();
    expect(await (client as LocalZoteroClient).authorize()).toEqual({ remember: true });
    const authorization = fake.requests.find((r) => r.url.pathname.endsWith("authorize"))!;
    expect(authorization.headers["zotero-server-id"]).toBe(fake.serverId);
    expect(authorization.body).toEqual({ appName: "GAID" });
    expect([...store.values.values()]).toEqual(["local-synthetic-secret"]);
    expect([...store.values.keys()][0]).toContain("server-A");
  });

  it("maps API-off, rejected key, refused connection, and other reachability failures", async () => {
    const { fake, client } = await setup();
    fake.apiOff = true;
    expect((await probeZoteroLibrary(client, state())).state).toBe("local-api-off");
    fake.apiOff = false;
    const web = await setup("web");
    web.fake.keyRejected = true;
    expect((await probeZoteroLibrary(web.client, state("web"))).state).toBe("key-rejected");
    const refused = await fakeZotero();
    await refused.close();
    const closed = new LocalZoteroClient({ baseUrl: refused.baseUrl, secrets: secrets() });
    expect((await probeZoteroLibrary(closed, state())).state).toBe("zotero-closed");
    const broken = new LocalZoteroClient({ secrets: secrets(), fetch: async () => { throw new Error("network"); } });
    expect((await probeZoteroLibrary(broken, state())).state).toBe("unreachable");
  });

  it("never reuses a local write key after server ID changes; rejected one-use keys do not reopen dialogs", async () => {
    const { fake, client, store } = await setup();
    await (client as LocalZoteroClient).authorize();
    fake.addItem("PAPER001");
    fake.keyRejected = true;
    await expect(addTags(client, ref(fake, "PAPER001"), ["tag"])).rejects.toMatchObject({ state: "key-rejected" });
    expect(store.values.size).toBe(0);
    expect(fake.requests.filter((r) => r.url.pathname.endsWith("authorize"))).toHaveLength(1);
    fake.keyRejected = false;
    await (client as LocalZoteroClient).authorize();
    fake.serverId = "server-B";
    const next = await probeZoteroLibrary(client, { ...state(), serverId: "server-A", libraryVersion: 100, lastSyncAt: options.now });
    expect(next).toMatchObject({ serverId: "server-B", libraryVersion: 0, lastSyncAt: undefined });
    await expect(addTags(client, ref(fake, "PAPER001"), ["tag"])).rejects.toMatchObject({ code: "key-required" });
  });

  it("learns Web user/group access without returning the key", async () => {
    const { fake, client } = await setup("web");
    const access = await (client as WebZoteroClient).discoverAccess();
    expect(access).toMatchObject({ userID: 123, access: { groups: { "456": { library: true, write: false } } } });
    expect(JSON.stringify(access)).not.toContain("web-synthetic-secret");
    expect(fake.requests[0].headers["zotero-api-version"]).toBe("3");
    expect(await (client as WebZoteroClient).discoverLibraries()).toEqual([
      { libraryType: "user", libraryId: "123", name: "synthetic", canWrite: true },
      { libraryType: "group", libraryId: "456", name: "Synthetic group", canWrite: false },
    ]);
  });

  it("respects Retry-After and Backoff across requests, and caps concurrency at four", async () => {
    const fake = await fakeZotero("web"); cleanups.push(() => fake.close());
    let now = 0; const sleeps: number[] = [];
    const client = new WebZoteroClient({ baseUrl: fake.baseUrl, secrets: secrets(), now: () => now, sleep: async (ms) => { sleeps.push(ms); now += ms; } });
    await client.setKey("web-synthetic-secret");
    let first = true;
    fake.before = (_r, response) => {
      if (first) { first = false; response.statusCode = 429; response.setHeader("Retry-After", "2"); response.end(); return true; }
      response.setHeader("Backoff", "3"); return false;
    };
    await client.discoverAccess(); await client.discoverAccess();
    expect(sleeps).toEqual([2000, 3000]);
    let running = 0, max = 0;
    fake.before = async () => { running++; max = Math.max(max, running); await new Promise((r) => setTimeout(r, 10)); running--; return false; };
    await Promise.all(Array.from({ length: 12 }, () => client.discoverAccess()));
    expect(max).toBe(4);
  });

  it("does not expose response bodies or key values in errors", async () => {
    const { fake, client } = await setup("web");
    fake.before = (_r, response) => { response.statusCode = 500; response.end("web-synthetic-secret"); return true; };
    await expect(client.discoverAccess()).rejects.toThrow("Zotero http-error");
  });
});

describe("incremental mirror", () => {
  it("pages through >100 objects, maps CSL/key/tags/attachments, and preserves GAID identity/read state", async () => {
    const { fake, client } = await setup();
    fake.addCollection("COLLECT1", "Papers");
    for (let i = 0; i < 105; i++) fake.addItem(`P${String(i).padStart(7, "0")}`, { citationKey: `paper${i}`, collections: ["COLLECT1"], tags: [{ tag: "geology" }] });
    fake.addItem("ATTACH01", { itemType: "attachment", parentItem: "P0000000", contentType: "application/pdf", title: "PDF" });
    const first = await syncZoteroLibrary(client, state(), { ...options, idForItem: (ref) => ref.itemKey === "P0000000" ? "li-sent-original" : options.idForItem(ref) });
    expect(first.upserts).toHaveLength(105);
    expect(first.reset).toBe(true);
    const item = first.upserts.find((item) => item.id === "li-sent-original")!;
    expect(item).toMatchObject({ citationKey: "paper0", tags: ["geology"], metadataOrigin: "zotero", csl: { DOI: "10.1234/example" }, attachments: [{ kind: "pdf", zoteroAttachmentKey: "ATTACH01" }] });
    expect(first.collections[0].name).toBe("Papers");
    expect(fake.requests.some((r) => r.url.searchParams.get("start") === "100")).toBe(true);
    item.read = { coverage: "partial", pagesRead: 2 };
    const object = fake.items.get("P0000000")!; object.version = ++fake.version; object.data.title = "Updated";
    const next = await syncZoteroLibrary(client, first.state, { ...options, existingItems: first.upserts });
    expect(next.reset).toBe(false);
    expect(next.upserts).toHaveLength(1);
    expect(next.upserts[0]).toMatchObject({ id: "li-sent-original", read: { coverage: "partial", pagesRead: 2 } });
    expect(fake.requests.some((r) => r.url.searchParams.get("since") === String(first.state.libraryVersion) && r.headers["if-modified-since-version"] === String(first.state.libraryVersion))).toBe(true);
    const unchanged = await syncZoteroLibrary(client, next.state, { ...options, existingItems: first.upserts });
    expect(unchanged.upserts).toEqual([]);
    expect(unchanged.state.libraryVersion).toBe(fake.version);
  });

  it("filters followed collections and returns moved-out items/deletions without dropping citations", async () => {
    const { fake, client } = await setup();
    fake.addItem("PAPER001", { collections: ["COLLECT1"] }); fake.addItem("PAPER002", { collections: ["COLLECT2"] });
    const first = await syncZoteroLibrary(client, { ...state(), follow: ["COLLECT1"] }, options);
    expect(first.upserts.map((item) => item.zotero!.itemKey)).toEqual(["PAPER001"]);
    const object = fake.items.get("PAPER001")!; object.data.collections = ["COLLECT2"]; object.version = ++fake.version;
    fake.removeItem("PAPER002"); fake.deletedCollections.set("COLLECT1", ++fake.version);
    const next = await syncZoteroLibrary(client, first.state, { ...options, existingItems: first.upserts });
    expect(next.removals.map((ref) => ref.itemKey).sort()).toEqual(["PAPER001", "PAPER002"]);
    expect(next.removedCollectionKeys).toEqual(["COLLECT1"]);
  });

  it("rebuilds a parent's attachments when only a child changes or is deleted", async () => {
    const { fake, client } = await setup();
    fake.addItem("PAPER001"); fake.addItem("ATTACH01", { itemType: "attachment", parentItem: "PAPER001", contentType: "application/pdf" });
    const first = await syncZoteroLibrary(client, state(), options);
    fake.removeItem("ATTACH01");
    const next = await syncZoteroLibrary(client, first.state, { ...options, existingItems: first.upserts });
    expect(next.upserts[0].attachments).toEqual([]);
    fake.addItem("ATTACH02", { itemType: "attachment", parentItem: "PAPER001", contentType: "application/pdf" });
    const third = await syncZoteroLibrary(client, next.state, { ...options, existingItems: next.upserts });
    expect(third.upserts[0].attachments[0].zoteroAttachmentKey).toBe("ATTACH02");
  });

  it("handles Zotero 10.0.6 Local /deleted 404 using full key manifests and incremental bodies", async () => {
    const { fake, client } = await setup();
    fake.addCollection("COLLECT1", "Papers"); fake.addItem("PAPER001"); fake.addItem("PAPER002");
    fake.addItem("ATTACH01", { itemType: "attachment", parentItem: "PAPER001" });
    fake.before = (request, response) => { if (request.url.pathname.endsWith("deleted")) { response.statusCode = 404; response.end(); return true; } return false; };
    const first = await syncZoteroLibrary(client, state(), options);
    expect(first.sourceItemKeys).toContain("ATTACH01");
    fake.removeItem("PAPER002"); fake.removeItem("ATTACH01"); fake.collections.clear(); ++fake.version;
    const next = await syncZoteroLibrary(client, first.state, { ...options, existingItems: first.upserts });
    expect(next.reset).toBe(false);
    expect(next.sourceItemKeys).toEqual(["PAPER001"]); expect(next.sourceCollectionKeys).toEqual([]);
    expect(next.removals.map((r) => r.itemKey).sort()).toEqual(["ATTACH01", "PAPER002"]);
    expect(next.upserts[0].attachments).toEqual([]);
    expect(fake.requests.filter((r) => r.url.pathname.endsWith("deleted"))).toHaveLength(1);
    expect(fake.requests.some((r) => r.url.searchParams.get("since") === String(first.state.libraryVersion))).toBe(true);
  });

  it("returns newly trashed parents as removals even though the default items endpoint omits trash", async () => {
    const { fake, client } = await setup(); const object = fake.addItem("PAPER001");
    const first = await syncZoteroLibrary(client, state(), options);
    object.data.deleted = 1; object.version = ++fake.version;
    const next = await syncZoteroLibrary(client, first.state, { ...options, existingItems: first.upserts });
    expect(next.upserts).toEqual([]); expect(next.removals[0].itemKey).toBe("PAPER001");
  });

  it("resets on local server ID or connection changes without comparing Local and Web cursors", async () => {
    const { fake, client } = await setup(); fake.addItem("PAPER001");
    const prior = { ...state(), serverId: "old-server", libraryVersion: 99999, lastSyncAt: options.now };
    const result = await syncZoteroLibrary(client, prior, options);
    expect(result.reset).toBe(true); expect(result.upserts).toHaveLength(1);
    expect(result.state.libraryVersion).toBeLessThan(prior.libraryVersion);
    const web = await setup("web"); web.fake.addItem("PAPER002");
    const changed = await syncZoteroLibrary(web.client, result.state, options);
    expect(changed.reset).toBe(true); expect(changed.state.serverId).toBeUndefined();
    expect(changed.upserts[0].zotero!.connection).toBe("web");
  });

  it("restarts if server ID changes mid-sync and never publishes a mixed snapshot", async () => {
    const { fake, client } = await setup(); fake.addItem("PAPER001");
    let once = true;
    fake.before = (request, response) => {
      if (once && request.url.pathname.endsWith("collections")) { once = false; fake.serverId = "server-B"; fake.items.clear(); fake.addItem("PAPER002"); response.setHeader("Zotero-Server-ID", fake.serverId); response.setHeader("Last-Modified-Version", fake.version); }
      return false;
    };
    const result = await syncZoteroLibrary(client, state(), options);
    expect(result.state.serverId).toBe("server-B"); expect(result.upserts.map((i) => i.zotero!.itemKey)).toEqual(["PAPER002"]);
  });

  it("retries a changing paged snapshot and fails boundedly without updating the caller cursor", async () => {
    const { fake, client } = await setup(); fake.addItem("PAPER001");
    fake.before = (request, response) => { if (request.url.pathname.endsWith("collections")) response.setHeader("Last-Modified-Version", ++fake.version); return false; };
    const prior = state();
    await expect(syncZoteroLibrary(client, prior, options)).rejects.toMatchObject({ code: "library-kept-changing" });
    expect(prior.libraryVersion).toBe(0);
  });

  it("maps deterministically and does not mutate source JSON", async () => {
    const { fake } = await setup(); const object = fake.addItem("PAPER001");
    const context = { ref: ref(fake, object.key), owner: "owner", id: "li-original", now: options.now };
    expect(mapZoteroItem(object, context)).toEqual(mapZoteroItem(object, context));
    const mapped = mapZoteroItem(object, context); mapped.csl.title = "Changed";
    expect(object.csljson!.title).not.toBe("Changed");
    expect(mapZoteroItem({ ...object, csljson: '{"type":"article-journal"}', data: { ...object.data, title: "" } }, context).csl.title).toBe("");
  });
});

describe("confirmed narrow write-back", () => {
  it("creates one inbox, adds an existing item preserving collections, and creates new CSL items with returned refs", async () => {
    const { fake, client } = await setup(); await (client as LocalZoteroClient).authorize();
    fake.addItem("PAPER001", { collections: ["COLLECT1"] });
    const inbox = await ensureInboxCollection(client, library);
    expect((await ensureInboxCollection(client, library)).key).toBe(inbox.key);
    const updated = await addItemToInbox(client, library, { existing: ref(fake, "PAPER001") });
    expect(fake.items.get("PAPER001")!.data.collections).toEqual(["COLLECT1", inbox.key]);
    expect(updated.version).toBe(fake.items.get("PAPER001")!.version);
    const created = await addItemToInbox(client, library, { csl: { type: "article-journal", title: "Created paper", DOI: "10.1234/new", author: [{ family: "Kim", given: "A" }] } });
    expect(created).toMatchObject({ connection: "local", serverId: "server-A", libraryType: "user", libraryId: "0" });
    expect(created.version).toBeGreaterThan(updated.version);
    expect(fake.items.get(created.itemKey)!.data).toMatchObject({ title: "Created paper", DOI: "10.1234/new", collections: [inbox.key] });
    expect([...fake.collections.values()].filter((c) => c.data.name === "GAID 수집함")).toHaveLength(1);
    const patches = fake.requests.filter((r) => r.method === "PATCH");
    expect(Object.keys(patches[0].body as object)).toEqual(["collections"]);
  });

  it("adds tags without metadata writes, preserving automatic tags and avoiding duplicate additions", async () => {
    const { fake, client } = await setup("web"); fake.addItem("PAPER001", { tags: [{ tag: "old", type: 1 }] });
    const result = await addTags(client, ref(fake, "PAPER001"), ["new", "old", "new"]);
    expect(fake.items.get("PAPER001")!.data.tags).toEqual([{ tag: "old", type: 1 }, { tag: "new" }]);
    expect(fake.requests.find((r) => r.method === "PATCH")!.body).toEqual({ tags: [{ tag: "old", type: 1 }, { tag: "new" }] });
    await addTags(client, result, ["new"]);
    expect(fake.requests.filter((r) => r.method === "PATCH")).toHaveLength(1);
  });

  it("creates an escaped child note with a GAID link, and rejects active-content URLs", async () => {
    const { fake, client } = await setup("web"); fake.addItem("PAPER001");
    const result = await addResearchNoteLink(client, ref(fake, "PAPER001"), { url: "https://gaid.example/note?a=1&b=2", title: '<note "title">' });
    const note = fake.items.get(result.itemKey)!;
    expect(note.data.parentItem).toBe("PAPER001");
    expect(note.data.note).toContain("&lt;note &quot;title&quot;&gt;"); expect(note.data.note).toContain("&amp;b=2");
    await expect(addResearchNoteLink(client, ref(fake, "PAPER001"), { url: "javascript:alert(1)", title: "note" })).rejects.toThrow("Invalid research note URL");
  });

  it("re-reads and reports a 412 without retrying or overwriting newer data", async () => {
    const { fake, client } = await setup("web"); const object = fake.addItem("PAPER001");
    fake.before = (request, response) => {
      if (request.method === "PATCH") { object.data.tags = [{ tag: "concurrent" }]; object.version = ++fake.version; response.statusCode = 412; response.end(); return true; }
      return false;
    };
    try { await addTags(client, ref(fake, object.key), ["ours"]); throw new Error("Expected conflict"); }
    catch (error) { expect(error).toBeInstanceOf(ZoteroConflictError); expect((error as ZoteroConflictError).current).toMatchObject({ data: { tags: [{ tag: "concurrent" }] } }); }
    expect(fake.requests.filter((r) => r.method === "PATCH")).toHaveLength(1);
    expect(fake.requests.at(-1)!.method).toBe("GET");
  });

  it("rejects stale input versions, oversized batches, annotation writes and metadata patches", async () => {
    const { fake, client } = await setup("web"); fake.addItem("PAPER001");
    await expect(addTags(client, { ...ref(fake, "PAPER001"), version: 0 }, ["tag"])).rejects.toBeInstanceOf(ZoteroConflictError);
    await expect(client.create(library, "items", Array.from({ length: 51 }, () => ({ itemType: "book" })), fake.version)).rejects.toThrow("1–50");
    await expect(client.create(library, "items", [{ itemType: "annotation" }], fake.version)).rejects.toThrow("non-annotation");
    await expect(client.patchLinks(library, "PAPER001", { title: "bad" } as never, fake.version)).rejects.toThrow("collections and tags");
    fake.addItem("ANNOT001", { itemType: "annotation" });
    await expect(addTags(client, ref(fake, "ANNOT001"), ["tag"])).rejects.toThrow("Annotation writes");
    await expect(addResearchNoteLink(client, ref(fake, "ANNOT001"), { url: "https://gaid.example/note", title: "note" })).rejects.toThrow("Annotation writes");
    expect(fake.requests.some((r) => r.method === "DELETE")).toBe(false);
  });

  it("re-reads collection state after a create precondition conflict instead of creating a duplicate", async () => {
    const { fake, client } = await setup("web");
    fake.before = (request, response) => {
      if (request.method === "POST" && request.url.pathname.endsWith("collections")) { fake.addCollection("INBOX001", "GAID 수집함"); response.statusCode = 412; response.end(); return true; }
      return false;
    };
    await expect(ensureInboxCollection(client, library)).rejects.toBeInstanceOf(ZoteroConflictError);
    expect(fake.requests.at(-1)!.method).toBe("GET");
    expect((await ensureInboxCollection(client, library)).key).toBe("INBOX001");
    expect(fake.requests.filter((r) => r.method === "POST")).toHaveLength(1);
  });
});

describe("attachment reads and deep links", () => {
  it("reads local file-view URL and fulltext with indexed coverage, within the byte bound", async () => {
    const { fake, client } = await setup(); fake.addItem("ATTACH01", { itemType: "attachment" });
    const folder = await mkdtemp(path.join(os.tmpdir(), "gaid-zotero-")); cleanups.push(() => rm(folder, { recursive: true, force: true }));
    const file = path.join(folder, "paper.pdf"); await writeFile(file, fake.file); fake.attachmentUrl = pathToFileURL(file).href;
    expect(await getAttachmentFile(client, ref(fake, "ATTACH01"))).toEqual(fake.file);
    expect(await getAttachmentFullText(client, ref(fake, "ATTACH01"))).toMatchObject({ content: "Synthetic full text", indexedPages: 2, totalPages: 3 });
    await expect(getAttachmentFile(client, ref(fake, "ATTACH01"), 2)).rejects.toMatchObject({ code: "response-too-large" });
    await expect(getAttachmentFile(client, ref(fake, "ATTACH01"), 65 * 1024 * 1024)).rejects.toThrow("size bound");
  });

  it("follows Web storage redirects without leaking the API key and bounds streamed bytes", async () => {
    const { fake, client } = await setup("web"); fake.addItem("ATTACH01", { itemType: "attachment" });
    // Storage has no Zotero credentials and therefore bypasses API authentication in this fixture.
    fake.before = (request, response) => { if (!request.url.pathname.startsWith("/storage/")) return false; response.setHeader("Content-Type", "application/pdf"); response.end(fake.file); return true; };
    expect(await getAttachmentFile(client, ref(fake, "ATTACH01"))).toEqual(fake.file);
    expect(fake.requests.find((r) => r.url.pathname.startsWith("/storage/"))!.headers["zotero-api-key"]).toBeUndefined();
    await expect(getAttachmentFile(client, ref(fake, "ATTACH01"), 2)).rejects.toMatchObject({ code: "response-too-large" });
  });

  it("bounds chunked downloads without Content-Length and accepts a direct PDF above the JSON limit", async () => {
    const { fake, client } = await setup("web"); fake.addItem("ATTACH01", { itemType: "attachment" });
    fake.before = (request, response) => {
      if (!request.url.pathname.endsWith("/file")) return false;
      response.setHeader("Content-Type", "application/pdf"); response.write(Buffer.alloc(8)); response.end(Buffer.alloc(8)); return true;
    };
    await expect(getAttachmentFile(client, ref(fake, "ATTACH01"), 10)).rejects.toMatchObject({ code: "response-too-large" });
    fake.before = (request, response) => {
      if (!request.url.pathname.endsWith("/file")) return false;
      response.setHeader("Content-Type", "application/pdf"); response.end(Buffer.alloc(33 * 1024 * 1024)); return true;
    };
    expect((await getAttachmentFile(client, ref(fake, "ATTACH01"))).length).toBe(33 * 1024 * 1024);
  });

  it("opens user/group items and exact PDF pages with validated identifiers", () => {
    expect(selectItemLink({ ...library, itemKey: "PAPER001" })).toBe("zotero://select/library/items/PAPER001");
    expect(selectItemLink({ libraryType: "group", libraryId: "456", itemKey: "PAPER001" })).toBe("zotero://select/groups/456/items/PAPER001");
    expect(openPdfLink(library, "ATTACH01", 12)).toBe("zotero://open-pdf/library/items/ATTACH01?page=12");
    expect(openPdfLink({ libraryType: "group", libraryId: "456" }, "ATTACH01", 2)).toContain("groups/456/items/ATTACH01?page=2");
    expect(() => openPdfLink(library, "ATTACH01", 0)).toThrow();
    expect(() => selectItemLink({ ...library, itemKey: "../../bad" })).toThrow();
  });
});
