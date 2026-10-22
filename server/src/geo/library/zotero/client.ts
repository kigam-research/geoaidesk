import { open } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  ZoteroError, ZoteroServerChangedError, libraryPath, itemKey,
  type ApiResult, type ReadOptions, type ZoteroClient, type ZoteroLibrary,
  type ZoteroSecretStore, type NewZoteroObject,
  type ZoteroUploadAuthorization, type ZoteroUploadMetadata, type ZoteroFullTextInput, type ConnectionState,
} from "./types.ts";

export interface ClientOptions {
  secrets: ZoteroSecretStore;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  /** Injectable clock for deterministic rate-limit tests. */
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

class Gate {
  private active = 0;
  private queue: (() => void)[] = [];
  async enter() {
    if (this.active >= 4) await new Promise<void>((resolve) => this.queue.push(resolve));
    else this.active++;
  }
  leave() {
    const next = this.queue.shift();
    if (next) next();
    else this.active--;
  }
}

const JSON_LIMIT = 32 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 64 * 1024 * 1024;

async function boundedBody(response: Response, max: number): Promise<Buffer> {
  if (Number(response.headers.get("content-length")) > max) {
    await response.body?.cancel();
    throw new ZoteroError("failed", "response-too-large");
  }
  const parts: Uint8Array[] = [];
  let size = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > max) { await reader.cancel(); throw new ZoteroError("failed", "response-too-large"); }
        parts.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
  }
  return Buffer.concat(parts);
}

/** First bytes of an error body, only to classify it (Zotero answers "Invalid key" or "Forbidden"); never surfaced. */
async function errorText(response: Response): Promise<string> {
  try { return (await boundedBody(response, 1024)).toString("utf8"); } catch { return ""; }
}

/** Research-language state for a refused Zotero response (UI words it; the status stays in the technical detail). */
function refusedState(status: number): ConnectionState {
  if (status === 404) return "library-not-found";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server-error";
  return "failed";
}

abstract class HttpZoteroClient implements ZoteroClient {
  abstract readonly connection: "local" | "web";
  serverId: string | undefined;
  protected readonly base: URL;
  protected readonly secrets: ZoteroSecretStore;
  private readonly fetcher: typeof fetch;
  private readonly gate = new Gate();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private backoffUntil = 0;

  constructor(options: ClientOptions, defaultBase: string) {
    this.base = new URL(options.baseUrl ?? defaultBase);
    if (!this.base.pathname.endsWith("/")) this.base.pathname += "/";
    if (this.base.username || this.base.password || this.base.search || this.base.hash) throw new Error("Invalid Zotero base URL");
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(this.base.hostname);
    if (this.base.protocol !== "https:" && !(loopback && this.base.protocol === "http:")) throw new Error("Zotero requires HTTPS or loopback HTTP");
    this.secrets = options.secrets;
    this.fetcher = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.retries = options.maxRetries ?? 2;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }
  protected secretSlot(): string { return `zotero:${this.connection}:${this.base.href}:${this.connection === "local" ? this.serverId ?? "" : "key"}`; }

  private url(path: string) {
    const url = new URL(path, this.base);
    if (url.origin !== this.base.origin || !url.pathname.startsWith(this.base.pathname)) throw new Error("Invalid Zotero API path");
    return url;
  }

  protected async request(path: string, method: string, options: ReadOptions & { ifNoneMatch?: "*" } = {}, body?: unknown, authorize = false, maxBytes = JSON_LIMIT): Promise<ApiResult<Buffer>> {
    const url = this.url(path);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, String(value));
    const write = method !== "GET";
    const expectedServer = options.discover ? undefined : this.serverId;
    if (this.connection === "local" && write && !expectedServer) throw new ZoteroError("failed", "server-id-required");
    await this.gate.enter();
    try {
      for (let attempt = 0;; attempt++) {
        while (this.backoffUntil > this.now()) await this.sleep(this.backoffUntil - this.now());
        const headers = new Headers({ "Zotero-API-Version": "3" });
        if (expectedServer && this.connection === "local") headers.set("Zotero-Server-ID", expectedServer);
        if (options.ifModifiedSince !== undefined) headers.set(write ? "If-Unmodified-Since-Version" : "If-Modified-Since-Version", String(options.ifModifiedSince));
        if (options.ifNoneMatch) headers.set("If-None-Match", options.ifNoneMatch);
        if ((this.connection === "web" || write) && !authorize) {
          const key = await this.secrets.get(this.secretSlot());
          // A missing web key needs a new one (key-invalid); a missing local key asks Zotero for approval (key-rejected).
          if (!key) throw new ZoteroError(this.connection === "web" ? "key-invalid" : "key-rejected", "key-required");
          headers.set("Zotero-API-Key", key);
        }
        if (body !== undefined) headers.set("Content-Type", body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json");
        let response: Response;
        try {
          response = await this.fetcher(url, { method, headers, ...(body === undefined ? {} : { body: body instanceof URLSearchParams ? body.toString() : JSON.stringify(body) }), redirect: "manual", signal: AbortSignal.timeout(this.timeoutMs) });
        } catch (error) {
          const cause = (error as { cause?: { code?: string } })?.cause;
          const timedOut = (error as { name?: string })?.name === "TimeoutError";
          // A TLS-inspecting institute network (KIGAM SSL) whose CA Node does not trust: SELF_SIGNED_CERT_IN_CHAIN etc.
          if (cause?.code && /CERT|UNABLE_TO_(GET|VERIFY)/.test(cause.code)) throw new ZoteroError("certificate-untrusted", `certificate:${cause.code}`);
          throw new ZoteroError(this.connection === "local" && cause?.code === "ECONNREFUSED" ? "zotero-closed" : "unreachable", timedOut ? "timed-out" : cause?.code ? `connection-failed:${cause.code}` : "connection-failed");
        }
        const server = response.headers.get("Zotero-Server-ID") ?? undefined;
        const changed = this.connection === "local" && expectedServer && server && server !== expectedServer;
        if (this.connection === "local" && server) this.serverId = server;
        const rawVersion = response.headers.get("Last-Modified-Version");
        // Web 304s carry no Last-Modified-Version: unchanged means still at the version the caller sent.
        const version = rawVersion !== null && /^\d+$/.test(rawVersion) ? Number(rawVersion) : response.status === 304 && !write ? options.ifModifiedSince : undefined;
        const seconds = (value: string | null) => value === null ? 0 : /^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000 : Math.max(0, Date.parse(value) - this.now()) || 0;
        const wait = Math.max(seconds(response.headers.get("Backoff")), seconds(response.headers.get("Retry-After")));
        this.backoffUntil = Math.max(this.backoffUntil, this.now() + wait);
        if (changed) { await response.body?.cancel(); throw new ZoteroServerChangedError(); }
        if ((response.status === 429 || response.status === 503) && attempt < this.retries && (!write || response.status === 429)) {
          this.backoffUntil = Math.max(this.backoffUntil, this.now() + (wait || 1000 * 2 ** attempt));
          await response.body?.cancel();
          continue;
        }
        if (response.status === 401 || response.status === 403) {
          if (this.connection === "web") {
            // Web: "Invalid key" = the key does not exist (any more); otherwise the key lacks access to this library.
            const invalid = response.status === 401 || /invalid key/i.test(await errorText(response));
            throw new ZoteroError(invalid ? "key-invalid" : write ? "key-rejected" : "no-library-access", invalid ? "invalid-key" : "access-denied", response.status);
          }
          await response.body?.cancel();
          if (response.status === 401 && write) await this.secrets.delete(this.secretSlot());
          throw new ZoteroError(response.status === 403 && !authorize ? "local-api-off" : "key-rejected", "access-denied", response.status);
        }
        if (!(response.ok || response.status === 304 || response.status === 412 || response.status === 302 || response.status === 303 || response.status === 307)) {
          await response.body?.cancel();
          throw new ZoteroError(refusedState(response.status), "http-error", response.status);
        }
        // Download redirects are resolved separately, without forwarding credentials.
        const bytes = response.status >= 300 && response.status < 400 && response.status !== 304
          ? Buffer.from(response.headers.get("location") ?? "") : await boundedBody(response, maxBytes);
        if (response.status >= 300 && response.status < 400 && response.status !== 304) await response.body?.cancel();
        return { data: bytes, status: response.status, version, serverId: server };
      }
    } finally { this.gate.leave(); }
  }

  async read<T>(path: string, options: ReadOptions = {}): Promise<ApiResult<T>> {
    const result = await this.request(path, "GET", options);
    if (result.status === 412) throw new ZoteroServerChangedError();
    if (result.status !== 200 && result.status !== 304) throw new ZoteroError("failed", "unexpected-response", result.status);
    let data: unknown = null;
    if (result.data.length) {
      try { data = JSON.parse(result.data.toString("utf8")); }
      catch { throw new ZoteroError("failed", "invalid-json"); }
    }
    return { ...result, data: data as T };
  }

  async create(library: ZoteroLibrary, kind: "items" | "collections", objects: NewZoteroObject[], version: number): Promise<ApiResult<string[]>> {
    if (objects.length === 0 || objects.length > 50) throw new Error("Zotero writes require 1–50 objects");
    if (objects.some((o) => o.key !== undefined || o.version !== undefined || o.data !== undefined || o.itemType === "annotation")) throw new Error("Only new non-annotation objects may be created");
    const result = await this.request(`${libraryPath(library)}/${kind}`, "POST", { ifModifiedSince: version }, objects);
    if (result.status === 412) throw new ZoteroError("ok", "version-conflict", 412);
    let data: { success?: Record<string, string>; successful?: Record<string, { key: string }>; failed?: Record<string, unknown>; unchanged?: Record<string, string> };
    try { data = JSON.parse(result.data.toString()); } catch { throw new ZoteroError("failed", "invalid-write-response"); }
    if (Object.keys(data.failed ?? {}).length) throw new ZoteroError("ok", "object-write-failed", 200);
    const keys = objects.map((_, i) => data.success?.[i] ?? data.successful?.[i]?.key ?? data.unchanged?.[i]);
    if (keys.some((key) => !key)) throw new ZoteroError("failed", "incomplete-write-response");
    return { ...result, data: keys as string[] };
  }

  async patchLinks(library: ZoteroLibrary, key: string, patch: { collections?: string[]; tags?: { tag: string; type?: number }[] }, version: number): Promise<ApiResult<null>> {
    if (Object.keys(patch).some((field) => field !== "collections" && field !== "tags")) throw new Error("Only collections and tags may be patched");
    const result = await this.request(`${libraryPath(library)}/items/${itemKey(key)}`, "PATCH", { ifModifiedSince: version }, patch);
    if (result.status === 412) throw new ZoteroError("ok", "version-conflict", 412);
    return { ...result, data: null };
  }

  async authorizeUpload(library: ZoteroLibrary, key: string, metadata: ZoteroUploadMetadata): Promise<ZoteroUploadAuthorization> {
    const result = await this.request(`${libraryPath(library)}/items/${itemKey(key)}/file`, "POST", { ifNoneMatch: "*" }, new URLSearchParams({ ...metadata }));
    if (result.status === 412) throw new ZoteroError("ok", "version-conflict", 412);
    if (result.status !== 200) throw new ZoteroError("failed", "upload-authorization-failed", result.status);
    let data: ZoteroUploadAuthorization;
    try { data = JSON.parse(result.data.toString()); } catch { throw new ZoteroError("failed", "invalid-upload-response"); }
    if (!data || typeof data !== "object" || ("exists" in data ? data.exists !== 1 :
      !["url", "contentType", "prefix", "suffix", "uploadKey"].every((field) => typeof (data as unknown as Record<string, unknown>)[field] === "string"))) {
      throw new ZoteroError("failed", "invalid-upload-response");
    }
    return data;
  }

  /** Storage is deliberately separate: never forwards API credentials or follows a POST redirect. */
  async uploadFile(location: string, contentType: string, bytes: Buffer): Promise<void> {
    let url: URL;
    try { url = new URL(location); } catch { throw new ZoteroError("failed", "invalid-upload-url"); }
    if (url.username || url.password || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && url.origin === this.base.origin))) throw new ZoteroError("failed", "invalid-upload-url");
    // Multipart framing is bounded separately from the 64 MiB file itself.
    if (bytes.length > MAX_ATTACHMENT_BYTES + 1024 * 1024) throw new ZoteroError("failed", "upload-too-large");
    await this.gate.enter();
    try {
      for (let attempt = 0;; attempt++) {
        while (this.backoffUntil > this.now()) await this.sleep(this.backoffUntil - this.now());
        let response: Response;
        try {
          response = await this.fetcher(url, { method: "POST", headers: { "Content-Type": contentType }, body: new Uint8Array(bytes), redirect: "manual", signal: AbortSignal.timeout(this.timeoutMs) });
        } catch { throw new ZoteroError("unreachable", "file-upload-failed"); }
        const seconds = (value: string | null) => value === null ? 0 : /^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000 : Math.max(0, Date.parse(value) - this.now()) || 0;
        const wait = Math.max(seconds(response.headers.get("Backoff")), seconds(response.headers.get("Retry-After")));
        this.backoffUntil = Math.max(this.backoffUntil, this.now() + wait);
        await response.body?.cancel();
        if (response.status === 429 && attempt < this.retries) {
          this.backoffUntil = Math.max(this.backoffUntil, this.now() + (wait || 1000 * 2 ** attempt));
          continue;
        }
        if (![200, 201, 204].includes(response.status)) throw new ZoteroError("failed", "file-upload-failed", response.status);
        return;
      }
    } finally { this.gate.leave(); }
  }

  async registerUpload(library: ZoteroLibrary, key: string, uploadKey: string): Promise<void> {
    const result = await this.request(`${libraryPath(library)}/items/${itemKey(key)}/file`, "POST", { ifNoneMatch: "*" }, new URLSearchParams({ upload: uploadKey }));
    if (result.status === 412) throw new ZoteroError("ok", "version-conflict", 412);
    if (result.status !== 204) throw new ZoteroError("failed", "upload-registration-failed", result.status);
  }

  async putFullText(library: ZoteroLibrary, key: string, fullText: ZoteroFullTextInput): Promise<void> {
    const result = await this.request(`${libraryPath(library)}/items/${itemKey(key)}/fulltext`, "PUT", {}, fullText);
    if (result.status === 412) throw new ZoteroError("ok", "version-conflict", 412);
    if (result.status !== 204) throw new ZoteroError("failed", "fulltext-write-failed", result.status);
  }

  async download(path: string, maxBytes: number): Promise<Buffer> {
    if (!(maxBytes > 0 && maxBytes <= MAX_ATTACHMENT_BYTES)) throw new Error("Invalid Zotero file size bound");
    // Local file URL is read separately; Web /file redirects to storage (no API key follows).
    if (this.connection === "local") {
      const result = await this.request(`${path}/view/url`, "GET");
      if (result.status !== 200) throw new ZoteroError("failed", "file-url-unavailable", result.status);
      let url: URL;
      try { url = new URL(result.data.toString().trim()); } catch { throw new ZoteroError("failed", "invalid-file-url"); }
      if (url.protocol !== "file:" || (url.hostname && url.hostname !== "localhost")) throw new ZoteroError("failed", "invalid-file-url");
      const handle = await open(fileURLToPath(url), "r");
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > maxBytes) throw new ZoteroError("failed", "response-too-large");
        // Read at most max+1 even if a file grows after stat.
        const bytes = Buffer.alloc(Math.min(stat.size + 1, maxBytes + 1));
        let size = 0;
        while (size < bytes.length) {
          const part = await handle.read(bytes, size, bytes.length - size, null);
          if (!part.bytesRead) break;
          size += part.bytesRead;
        }
        if (size > maxBytes) throw new ZoteroError("failed", "response-too-large");
        return bytes.subarray(0, size);
      } finally { await handle.close(); }
    }
    // Separate streaming download to avoid the smaller JSON bound and keep the gate for the entire body.
    return this.webFile(path, maxBytes);
  }

  private async webFile(path: string, max: number): Promise<Buffer> {
    // First /file request uses the normal rate limiter and authentication. Zotero returns a storage redirect.
    const result = await this.request(path, "GET", {}, undefined, false, max);
    if (result.status === 200) {
      if (result.data.length > max) throw new ZoteroError("failed", "response-too-large");
      return result.data;
    }
    let url = new URL(result.data.toString(), this.base);
    await this.gate.enter();
    try {
      for (let redirects = 0; redirects < 5; redirects++) {
        if (url.protocol !== "https:" && !(url.origin === this.base.origin && url.protocol === "http:")) throw new ZoteroError("failed", "invalid-file-redirect");
        const response = await this.fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(this.timeoutMs) });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location) break;
          url = new URL(location, url);
          continue;
        }
        if (!response.ok) { await response.body?.cancel(); throw new ZoteroError("failed", "file-download-failed", response.status); }
        return boundedBody(response, max);
      }
      throw new ZoteroError("failed", "too-many-redirects");
    } finally { this.gate.leave(); }
  }
}

export class LocalZoteroClient extends HttpZoteroClient {
  readonly connection = "local";
  constructor(options: ClientOptions) { super(options, "http://127.0.0.1:23119/api/"); }
  /** May show Zotero's confirmation dialog; parent calls only on an explicit researcher action. */
  async authorize(appName = "GAID"): Promise<{ remember: boolean }> {
    await this.read("users/0/items", { discover: true, query: { limit: 1 } });
    const result = await this.request("local/authorize", "POST", {}, { appName }, true);
    if (result.status === 412) throw new ZoteroServerChangedError();
    let data: { key?: string; remember?: boolean };
    try { data = JSON.parse(result.data.toString()); } catch { throw new ZoteroError("key-rejected", "invalid-authorization-response"); }
    if (!data.key) throw new ZoteroError("key-rejected", "authorization-denied");
    await this.secrets.set(this.secretSlot(), data.key);
    return { remember: data.remember === true };
  }
}

export interface ZoteroKeyAccess {
  userID: number;
  username?: string;
  access: { user?: { library?: boolean; write?: boolean }; groups?: Record<string, { library?: boolean; write?: boolean }> };
}
export interface ZoteroAccessibleLibrary extends ZoteroLibrary { name: string; canWrite: boolean }
export class WebZoteroClient extends HttpZoteroClient {
  readonly connection = "web";
  constructor(options: ClientOptions) { super(options, "https://api.zotero.org/"); }
  async setKey(key: string): Promise<void> { await this.secrets.set(this.secretSlot(), key); }
  async clearKey(): Promise<void> { await this.secrets.delete(this.secretSlot()); }
  async discoverAccess(): Promise<ZoteroKeyAccess> {
    const { data } = await this.read<ZoteroKeyAccess>("keys/current");
    // /keys/current includes the key itself; return only the non-secret fields.
    return { userID: data.userID, username: data.username, access: data.access };
  }
  /** Resolve `groups.all` permissions to concrete group IDs/names for the parent's library picker. */
  async discoverLibraries(): Promise<ZoteroAccessibleLibrary[]> {
    const access = await this.discoverAccess();
    const libraries: ZoteroAccessibleLibrary[] = [];
    if (access.access.user?.library) libraries.push({ libraryType: "user", libraryId: String(access.userID), name: access.username ?? String(access.userID), canWrite: access.access.user.write === true });
    for (let start = 0; ; start += 100) {
      const { data } = await this.read<{ id: number; data: { name: string } }[]>(`users/${access.userID}/groups`, { query: { limit: 100, start } });
      for (const group of data) {
        const permission = access.access.groups?.[String(group.id)] ?? access.access.groups?.all;
        if (permission?.library) libraries.push({ libraryType: "group", libraryId: String(group.id), name: group.data.name, canWrite: permission.write === true });
      }
      if (data.length < 100) break;
    }
    return libraries;
  }
}
