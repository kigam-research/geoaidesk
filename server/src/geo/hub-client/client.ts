import { readFileSync } from "node:fs";
import { hostname } from "node:os";
import * as undici from "undici";
import type { HubServerStatus } from "../../../../web/src/geo/contracts/hub-server.ts";
import { AuthoringError } from "../authoring/store.ts";
import { HUB_API, HUB_FILE_LIMIT, type HealthResponse, type SessionResponse } from "../hub-server/protocol.ts";
import { ConnectionStore } from "./connection.ts";

export interface RequestOptions {
  method?: string;
  body?: unknown;
  bytes?: Buffer;
  headers?: Record<string, string>;
  limit?: number;
  file?: boolean;
  auth?: boolean;
  /** Pins a multi-request operation to the original login and server. */
  identity?: string;
}
const failure = (status: number) => new AuthoringError(
  status === 401 ? "허브 서버에 다시 로그인해 주세요." :
  status === 403 ? "이 작업을 할 권한이 없습니다." :
  status === 404 ? "허브 서버에서 요청한 항목을 찾지 못했습니다." :
  status === 409 ? "허브 서버의 최신 상태를 확인한 뒤 다시 시도해 주세요." :
  status === 410 ? "초대 코드가 만료되었거나 이미 사용되었습니다." :
  status === 413 ? "허브 서버로 보내는 파일 또는 데이터가 너무 큽니다." :
  status === 429 ? "요청이 많습니다. 잠시 뒤 다시 시도해 주세요." :
  status >= 500 ? "허브 서버에 연결하지 못했습니다. 서버 주소와 실행 상태를 확인해 주세요." :
  "입력한 내용을 확인해 주세요.", status >= 500 ? 502 : status);

/**
 * Transport for hub requests. `GAID_HUB_SERVER_CA` (a PEM file, usually set in `<GAID_HOME>/config.env`) makes hub requests
 * trust exactly that certificate authority, for a hub server whose HTTPS certificate comes from an institute-internal CA;
 * those requests then connect directly, without the HTTP(S)_PROXY dispatcher. Unset: Node's fetch and its built-in roots.
 */
export function hubTransport(env: NodeJS.ProcessEnv = process.env): typeof fetch {
  const file = env.GAID_HUB_SERVER_CA?.trim();
  if (!file) return fetch;
  let dispatcher: undici.Agent | null = null;
  return ((input: string, init?: RequestInit) => {
    if (!dispatcher) {
      let ca: string;
      try { ca = readFileSync(file, "utf8"); }
      catch { return Promise.reject(new AuthoringError("허브 서버 인증서 파일(GAID_HUB_SERVER_CA)을 읽지 못했습니다.", 502)); }
      dispatcher = new undici.Agent({ connect: { ca } });
    }
    return undici.fetch(input, { ...(init as undici.RequestInit), dispatcher });
  }) as unknown as typeof fetch;
}

export class HubClient {
  private healthInfo?: HealthResponse;
  private reachable: boolean | null = null;
  private lastError?: string;
  constructor(readonly connection = new ConnectionStore(), private transport: typeof fetch = hubTransport(),
    private timeouts = { json: 10_000, file: 120_000 }) {}
  get identity(): string | null {
    const c = this.connection.current;
    return c.token && c.account && c.serverId ? `${c.url}|${c.serverId}|${c.account.id}|${c.token}` : null;
  }
  assertIdentity(identity: string): void {
    if (this.identity !== identity) throw failure(401);
  }
  async health(): Promise<HealthResponse> {
    const c = this.connection.current;
    const h = await this.send<HealthResponse>("/health", { auth: false });
    if (h?.schema !== "gaid-hub-server/v1" || h.name !== "gaid-hub-server" || typeof h.serverId !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(h.serverId) || typeof h.version !== "string")
      throw failure(502);
    this.healthInfo = h;
    if (c.serverId && c.serverId !== h.serverId) {
      if (this.connection.current === c) await this.connection.clearSession();
      throw new AuthoringError("같은 주소의 허브 서버가 바뀌었습니다. 다시 로그인해 주세요.", 401);
    }
    return h;
  }
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (options.auth !== false) {
      if (!this.identity) throw failure(401);
      const identity = options.identity ?? this.identity;
      this.assertIdentity(identity);
      await this.health();
      this.assertIdentity(identity);
      return this.send<T>(path, { ...options, identity });
    }
    return this.send<T>(path, options);
  }
  private async send<T>(path: string, options: RequestOptions): Promise<T> {
    const c = this.connection.current;
    if (!c.url) throw new AuthoringError("허브 서버 주소를 먼저 설정해 주세요.", 400);
    const auth = options.auth !== false;
    const limit = options.limit ?? (options.file ? HUB_FILE_LIMIT : 16 * 1024 * 1024);
    const body = options.bytes ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
    if (body && Buffer.byteLength(body) > limit) throw failure(413);
    try {
      const headers: Record<string, string> = { ...(options.headers ?? {}),
        ...(body !== undefined ? { "Content-Type": options.bytes ? "application/octet-stream" : "application/json" } : {}),
        ...(auth && c.token ? { Authorization: `Bearer ${c.token}` } : {}) };
      const response = await this.transport(`${c.url}${HUB_API}${path}`, {
        method: options.method ?? "GET", headers, body, redirect: "error",
        signal: AbortSignal.timeout(options.file ? this.timeouts.file : this.timeouts.json),
      });
      if (options.identity) this.assertIdentity(options.identity);
      this.reachable = true;
      this.lastError = undefined;
      if (response.status === 401 && auth && this.connection.current === c) await this.connection.clearSession();
      if (!response.ok) { await response.body?.cancel(); throw failure(response.status); }
      if (response.status === 204 || options.method === "HEAD") { await response.body?.cancel(); return undefined as T; }
      const declared = Number(response.headers.get("content-length"));
      if (declared > limit) { await response.body?.cancel(); throw failure(413); }
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > limit) { await reader.cancel(); throw failure(413); }
        chunks.push(part.value);
      }
      const bytes = Buffer.concat(chunks);
      if (options.identity) this.assertIdentity(options.identity);
      return (options.file ? bytes : JSON.parse(bytes.toString("utf8"))) as T;
    } catch (e) {
      if (e instanceof AuthoringError) throw e;
      this.reachable = false;
      this.lastError = failure(502).message;
      throw failure(502);
    }
  }
  async status(contact = true): Promise<HubServerStatus> {
    if (contact && this.connection.current.url) {
      try {
        await this.health();
        if (this.identity) {
          const { account } = await this.request<{ account: NonNullable<HubServerStatus["account"]> }>("/auth/me");
          await this.connection.save({ ...this.connection.current, account });
        }
      } catch (e) { this.lastError = e instanceof AuthoringError ? e.message : failure(502).message; }
    }
    const c = this.connection.current;
    return { url: c.url, fromEnv: this.connection.fromEnv, account: c.token ? c.account ?? null : null,
      reachable: c.url ? this.reachable : null, ...(c.url && this.lastError ? { error: this.lastError } : {}),
      ...(c.url && this.healthInfo ? { server: { name: this.healthInfo.name, version: this.healthInfo.version, serverId: this.healthInfo.serverId } } : {}) };
  }
  async configure(url: unknown): Promise<HubServerStatus> {
    await this.connection.configure(url);
    this.healthInfo = undefined; this.reachable = null; this.lastError = undefined;
    return this.status();
  }
  async login(path: "/auth/login" | "/auth/invites/accept", body: Record<string, unknown>): Promise<HubServerStatus> {
    // Logging into a replaced server is explicit; forget the previous identity before checking health.
    await this.connection.save({ url: this.connection.current.url });
    const connection = this.connection.current;
    const h = await this.health();
    if (this.connection.current !== connection) throw failure(409);
    const session = await this.request<SessionResponse>(path, { auth: false, method: "POST", body: { ...body, device: hostname() } });
    if (this.connection.current !== connection) throw failure(409);
    if (!session?.token || !session.account?.id || !/^[a-zA-Z0-9-]{1,100}$/.test(session.account.id)) throw failure(502);
    await this.connection.save({ url: connection.url, token: session.token, account: session.account, serverId: h.serverId });
    return this.status(false);
  }
  async logout(): Promise<HubServerStatus> {
    const previous = this.connection.current;
    try { if (this.identity) await this.request("/auth/logout", { method: "POST", body: {} }); }
    catch { /* Local logout must still work while the server is unavailable. */ }
    if (this.connection.current.url === previous.url && this.connection.current.token === previous.token) await this.connection.clearSession();
    return this.status(false);
  }
}
