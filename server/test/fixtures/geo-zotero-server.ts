import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { ZoteroObject } from "../../src/geo/library/zotero/types.ts";

export interface RecordedRequest { method: string; url: URL; headers: IncomingMessage["headers"]; body: unknown }
export interface FakeZotero {
  baseUrl: string;
  connection: "local" | "web";
  serverId: string;
  version: number;
  apiOff: boolean;
  keyRejected: boolean;
  /** Web: the key exists but may not read this library (403 "Forbidden"). */
  libraryForbidden: boolean;
  /** Web: `access.user.library` of /keys/current. */
  personalLibraryAccess: boolean;
  webKey: string;
  requests: RecordedRequest[];
  items: Map<string, ZoteroObject>;
  collections: Map<string, ZoteroObject>;
  deletedItems: Map<string, number>;
  deletedCollections: Map<string, number>;
  before?: (request: RecordedRequest, response: ServerResponse) => boolean | Promise<boolean>;
  attachmentUrl: string;
  file: Buffer;
  fileExists: boolean;
  uploadUrl?: string;
  uploadedFiles: Map<string, Buffer>;
  fullTexts: Map<string, unknown>;
  addItem: (key: string, data?: Record<string, unknown>) => ZoteroObject;
  addCollection: (key: string, name: string, parent?: string | false) => ZoteroObject;
  removeItem: (key: string) => void;
  close: () => Promise<void>;
}

export async function fakeZotero(connection: "local" | "web" = "local"): Promise<FakeZotero> {
  let sequence = 0;
  const fake: FakeZotero = {
    baseUrl: "", connection, serverId: "server-A", version: 1, apiOff: false, keyRejected: false, libraryForbidden: false, personalLibraryAccess: true, webKey: "web-synthetic-secret", requests: [],
    items: new Map(), collections: new Map(), deletedItems: new Map(), deletedCollections: new Map(), attachmentUrl: "", file: Buffer.from("%PDF-1.7\nsynthetic\n"),
    fileExists: false, uploadedFiles: new Map(), fullTexts: new Map(),
    addItem(key, data = {}) {
      const object = { key, version: ++fake.version, data: { itemType: "journalArticle", title: `Paper ${key}`, collections: [], tags: [], dateAdded: "2026-01-01T00:00:00Z", ...data }, csljson: { type: "article-journal", title: `Paper ${key}`, DOI: "10.1234/example" } };
      fake.items.set(key, object);
      return object;
    },
    addCollection(key, name, parent = false) {
      const object = { key, version: ++fake.version, data: { name, parentCollection: parent } };
      fake.collections.set(key, object);
      return object;
    },
    removeItem(key) { fake.items.delete(key); fake.deletedItems.set(key, ++fake.version); },
    async close() { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); },
  };
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk);
      const raw = Buffer.concat(chunks);
      const text = raw.toString();
      const contentType = request.headers["content-type"] ?? "";
      const body = !raw.length ? undefined : contentType.startsWith("application/json") ? JSON.parse(text) : contentType.startsWith("application/x-www-form-urlencoded") ? Object.fromEntries(new URLSearchParams(text)) : raw;
      const rec = { method: request.method ?? "GET", url: new URL(request.url!, fake.baseUrl), headers: request.headers, body };
      fake.requests.push(rec);
      const path = rec.url.pathname.replace(/^\/api/, "").replace(/\/$/, "");
      const query = rec.url.searchParams;
      if (connection === "local") response.setHeader("Zotero-Server-ID", fake.serverId);
      response.setHeader("Last-Modified-Version", fake.version);
      response.setHeader("Content-Type", "application/json");
      const reply = (status: number, body?: unknown) => { response.statusCode = status; response.end(body === undefined ? undefined : JSON.stringify(body)); };
      // Real Web API text bodies: a revoked/unknown key is "Invalid key", a key without access "Forbidden".
      const refuse = (text: string) => { response.statusCode = 403; response.setHeader("Content-Type", "text/plain"); response.end(text); };
      const exported = (object: ZoteroObject) => query.get("include")?.includes("csljson") ? { ...object, csljson: JSON.stringify([object.csljson]) } : object;
      if (fake.before && await fake.before(rec, response)) return;
      if (path.startsWith("/storage/upload/")) {
        if (rec.headers["zotero-api-key"] || rec.headers["zotero-server-id"]) return reply(403);
        const storageKey = path.split("/").at(-1)!;
        const prefix = Buffer.from("synthetic-prefix\r\n"), suffix = Buffer.from("\r\nsynthetic-suffix");
        if (!raw.subarray(0, prefix.length).equals(prefix) || !raw.subarray(-suffix.length).equals(suffix)) return reply(400);
        fake.uploadedFiles.set(storageKey, raw.subarray(prefix.length, raw.length - suffix.length));
        return reply(201);
      }
      if (fake.apiOff) return reply(403);
      if (fake.keyRejected && connection === "web") return refuse("Invalid key");
      if (fake.keyRejected && rec.method !== "GET") return reply(401);
      if (connection === "local" && rec.headers["zotero-server-id"] && rec.headers["zotero-server-id"] !== fake.serverId) return reply(412);
      if (connection === "local" && rec.method !== "GET" && rec.headers["zotero-server-id"] !== fake.serverId) return reply(428);
      if (path === "/local/authorize") return reply(200, { key: "local-synthetic-secret", remember: true });
      if (connection === "web" && rec.headers["zotero-api-key"] !== fake.webKey) return refuse("Invalid key");
      if (path === "/keys/current") return reply(200, { key: fake.webKey, userID: 123, username: "synthetic", access: { user: { library: fake.personalLibraryAccess, write: true }, groups: { "456": { library: true, write: false } } } });
      if (connection === "web" && fake.libraryForbidden && /^\/(users|groups)\/\d+\/(items|collections|deleted)/.test(path)) return refuse("Forbidden");
      if (path === "/users/123/groups") return reply(200, [{ id: 456, data: { name: "Synthetic group" } }]);
      if (path === "/storage/paper.pdf") { response.setHeader("Content-Type", "application/pdf"); response.end(fake.file); return; }
      const match = path.match(/^\/(?:users|groups)\/\d+\/(items|collections|deleted)(?:\/([A-Z0-9]{8}))?(.*)$/);
      if (!match) return reply(404);
      const [, kind, key, suffix] = match;
      if (kind === "deleted") {
        const since = Number(query.get("since") ?? 0);
        return reply(200, { items: [...fake.deletedItems].filter(([, version]) => version > since).map(([key]) => key), collections: [...fake.deletedCollections].filter(([, version]) => version > since).map(([key]) => key) });
      }
      const objects = kind === "items" ? fake.items : fake.collections;
      const object = key ? objects.get(key) : undefined;
      if (key && !object) return reply(404);
      if (rec.method === "GET") {
        if (suffix === "/fulltext") return reply(200, fake.fullTexts.get(key) ?? { content: "Synthetic full text", indexedPages: 2, totalPages: 3 });
        if (suffix === "/file/view/url") { response.setHeader("Content-Type", "text/plain"); response.end(fake.attachmentUrl); return; }
        if (suffix === "/file") { response.statusCode = 302; response.setHeader("Location", `${fake.baseUrl}storage/paper.pdf`); response.end(); return; }
        if (object && !suffix) { response.setHeader("Last-Modified-Version", object.version); return reply(200, exported(object)); }
        if (Number(rec.headers["if-modified-since-version"]) >= fake.version) {
          // The real Web API sends no Last-Modified-Version with a 304 (checked on api.zotero.org, 2026-10-22).
          if (connection === "web") response.removeHeader("Last-Modified-Version");
          return reply(304);
        }
        let list = suffix === "/children" ? [...fake.items.values()].filter((o) => o.data.parentItem === key) : [...objects.values()];
        if (query.get("includeTrashed") !== "1") list = list.filter((object) => !object.data.deleted);
        if (query.has("since")) list = list.filter((object) => object.version > Number(query.get("since")));
        list.sort((a, b) => a.version - b.version);
        const start = Number(query.get("start") ?? 0), limit = Number(query.get("limit") ?? 25);
        response.setHeader("Total-Results", list.length);
        const page = list.slice(start, start + limit);
        return reply(200, query.get("format") === "versions" ? Object.fromEntries(page.map((object) => [object.key, object.version])) : page.map(exported));
      }
      if (connection === "local" && rec.headers["zotero-api-key"] !== "local-synthetic-secret") return reply(401);
      if (object && suffix === "/file" && rec.method === "POST") {
        if (rec.headers["if-none-match"] !== "*") return reply(428);
        const form = rec.body as Record<string, string>;
        if (form.upload) {
          if (form.upload !== `upload-${key}` || !fake.uploadedFiles.has(key)) return reply(400);
          object.version = ++fake.version;
          return reply(204);
        }
        if (!form.md5 || !form.filename || !form.filesize || !form.mtime) return reply(400);
        if (fake.fileExists) return reply(200, { exists: 1 });
        return reply(200, { url: fake.uploadUrl ?? `${fake.baseUrl}storage/upload/${key}`, contentType: "multipart/form-data; boundary=synthetic", prefix: "synthetic-prefix\r\n", suffix: "\r\nsynthetic-suffix", uploadKey: `upload-${key}` });
      }
      if (object && suffix === "/fulltext" && rec.method === "PUT") { fake.fullTexts.set(key, rec.body); return reply(204); }
      const expected = Number(rec.headers["if-unmodified-since-version"]);
      if (expected !== (rec.method === "PATCH" ? object?.version : fake.version)) return reply(412);
      if (rec.method === "PATCH" && object) {
        object.data = { ...object.data, ...rec.body as Record<string, unknown> };
        object.version = ++fake.version;
        response.setHeader("Last-Modified-Version", fake.version);
        return reply(204);
      }
      if (rec.method === "POST") {
        const list = rec.body as Record<string, unknown>[];
        if (list.length > 50) return reply(413);
        const success: Record<string, string> = {};
        for (const [index, data] of list.entries()) {
          const newKey = `NEW${String(++sequence).padStart(5, "0")}`;
          const created = kind === "items" ? fake.addItem(newKey, data) : fake.addCollection(newKey, String(data.name), data.parentCollection as string | false);
          success[index] = created.key;
        }
        response.setHeader("Last-Modified-Version", fake.version);
        return reply(200, { success, failed: {}, unchanged: {} });
      }
      return reply(405);
    } catch {
      response.statusCode = 500;
      response.end("fixture failure");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  fake.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/${connection === "local" ? "api/" : ""}`;
  return fake;
}
