/**
 * Authenticated ORCID iD on hub accounts (gaid-orcid phase 2, ADR docs/adr/2026-10-23-orcid-authenticated-link.md).
 *
 * The operator stores the ORCID public API client in `<home>/orcid-client.json` (mode 600; `orcid-client set`). An account
 * starts sign-in (`start`: single-use state + nonce, 10 minutes), the researcher's GAID forwards ORCID's `code` + `state`
 * (`finish`), the hub exchanges the code with the secret and verifies the OpenID Connect ID token before it records the iD.
 * The secret never leaves this file: not in responses, audit rows, logs or backups.
 */
import { createPublicKey, verify as verifySignature, type JsonWebKey } from "node:crypto";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HubOrcidLink, OrcidEnvironment } from "../../../../web/src/geo/contracts/hub-server.ts";
import { HubDatabase, HubServerError, object, sha256, text, type AuditActor } from "./core.ts";

export interface OrcidClientConfig {
  schema: "gaid-hub-orcid-client/v1";
  environment: OrcidEnvironment;
  clientId: string;
  clientSecret: string;
  /** Registered redirect URI on the researcher's GAID (`http://127.0.0.1:8000/geo/orcid/callback`). */
  redirectUri: string;
  updatedAt: string;
}
export type OrcidClientView = Omit<OrcidClientConfig, "clientSecret" | "schema">;

export const ORCID_STATE_MINUTES = 10;
export const DEFAULT_REDIRECT_URI = "http://127.0.0.1:8000/geo/orcid/callback";
const CLIENT_ID = /^APP-[0-9A-Z]{16}$/;
const ORCID_ID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
export const orcidBase = (environment: OrcidEnvironment) => environment === "sandbox" ? "https://sandbox.orcid.org" : "https://orcid.org";

export interface OrcidRow { account_id: string; orcid: string; environment: OrcidEnvironment; name: string | null; authenticated_at: string }
export const linkView = (r: OrcidRow): HubOrcidLink => ({ id: r.orcid, environment: r.environment, ...(r.name ? { name: r.name } : {}), authenticatedAt: r.authenticated_at });

function redirectValue(value: unknown): string {
  const raw = text(value, "되돌아올 주소", 300);
  let url: URL;
  try { url = new URL(raw); } catch { throw new HubServerError("되돌아올 주소를 확인해 주세요."); }
  const loopback = url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !loopback) || url.search || url.hash || url.username || url.password)
    throw new HubServerError("되돌아올 주소는 https 주소이거나 이 PC의 http 주소(127.0.0.1)여야 합니다.");
  return url.href;
}

/** Operator CLI: validates and writes the client file atomically with mode 600. */
export function writeOrcidClient(home: string, input: { environment: unknown; clientId: unknown; clientSecret: unknown; redirectUri?: unknown }, now = new Date()): OrcidClientView {
  const environment = input.environment === "sandbox" ? "sandbox" : input.environment === "production" ? "production" : null;
  if (!environment) throw new HubServerError("ORCID 환경은 production 또는 sandbox입니다.");
  const clientId = typeof input.clientId === "string" ? input.clientId.trim().toUpperCase().replace(/^(?!APP-)/, "APP-") : "";
  if (!CLIENT_ID.test(clientId)) throw new HubServerError("ORCID Client ID 형식(APP-로 시작하는 20자)을 확인해 주세요.");
  const clientSecret = typeof input.clientSecret === "string" ? input.clientSecret.trim() : "";
  if (!/^[0-9a-f-]{20,80}$/i.test(clientSecret)) throw new HubServerError("ORCID Client secret 형식을 확인해 주세요.");
  const config: OrcidClientConfig = { schema: "gaid-hub-orcid-client/v1", environment, clientId, clientSecret,
    redirectUri: redirectValue(input.redirectUri ?? DEFAULT_REDIRECT_URI), updatedAt: now.toISOString() };
  const file = join(home, "orcid-client.json");
  const tmp = `${file}.${process.pid}.tmp`;
  try { writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", { mode: 0o600, flag: "wx" }); renameSync(tmp, file); }
  finally { rmSync(tmp, { force: true }); }
  const { clientSecret: _secret, schema: _schema, ...view } = config;
  return view;
}
export function removeOrcidClient(home: string): boolean {
  const file = join(home, "orcid-client.json");
  const had = existsSync(file);
  rmSync(file, { force: true });
  return had;
}
export function readOrcidClient(home: string): OrcidClientConfig | null {
  const file = join(home, "orcid-client.json");
  if (!existsSync(file)) return null;
  try {
    const c = JSON.parse(readFileSync(file, "utf8")) as OrcidClientConfig;
    if (c?.schema !== "gaid-hub-orcid-client/v1" || !CLIENT_ID.test(c.clientId) || typeof c.clientSecret !== "string" || !c.clientSecret ||
        (c.environment !== "production" && c.environment !== "sandbox") || typeof c.redirectUri !== "string") throw new Error("bad");
    return c;
  } catch { throw new HubServerError("허브 서버의 ORCID 설정 파일을 읽지 못했습니다. 운영자가 orcid-client set으로 다시 저장해야 합니다.", 500); }
}

const b64json = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;

/** Verifies an ORCID ID token (RS256, JWKS key by `kid`) and returns its claims. */
export function verifyIdToken(token: unknown, keys: unknown, expect: { issuer: string; audience: string; nonce: string; now: Date }): Record<string, unknown> {
  if (typeof token !== "string" || token.split(".").length !== 3) throw new HubServerError("ORCID 확인 응답에 ID 토큰이 없습니다.", 502);
  const [h, p, s] = token.split(".");
  let header: Record<string, unknown>, claims: Record<string, unknown>;
  try { header = b64json(h); claims = b64json(p); } catch { throw new HubServerError("ORCID ID 토큰을 읽지 못했습니다.", 502); }
  if (header.alg !== "RS256") throw new HubServerError("ORCID ID 토큰 서명 방식이 맞지 않습니다.", 502);
  const list = object(keys) && Array.isArray(keys.keys) ? keys.keys as JsonWebKey[] : [];
  const jwk = list.find((k) => k && k.kty === "RSA" && (header.kid === undefined || k.kid === header.kid));
  if (!jwk) throw new HubServerError("ORCID 서명 키를 찾지 못했습니다.", 502);
  const ok = verifySignature("RSA-SHA256", Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(s, "base64url"));
  if (!ok) throw new HubServerError("ORCID ID 토큰 서명이 맞지 않습니다.", 502);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const nowSec = Math.floor(expect.now.getTime() / 1000);
  if (claims.iss !== expect.issuer || !aud.includes(expect.audience) || claims.nonce !== expect.nonce ||
      typeof claims.exp !== "number" || claims.exp + 60 < nowSec || (typeof claims.iat === "number" && claims.iat - 300 > nowSec))
    throw new HubServerError("ORCID ID 토큰의 발급자, 대상, 일회용 값 또는 유효 시간이 맞지 않습니다.", 502);
  if (typeof claims.sub !== "string" || !ORCID_ID.test(claims.sub)) throw new HubServerError("ORCID ID 토큰에 iD가 없습니다.", 502);
  return claims;
}

export interface HubOrcidOptions {
  fetch?: typeof fetch;
}

export class HubOrcid {
  private readonly fetcher: typeof fetch;
  constructor(readonly hub: HubDatabase, options: HubOrcidOptions = {}) { this.fetcher = options.fetch ?? globalThis.fetch; }

  client(): OrcidClientConfig | null { return readOrcidClient(this.hub.home); }
  link(accountId: string): HubOrcidLink | null {
    const row = this.hub.get<OrcidRow>("SELECT * FROM account_orcid WHERE account_id=?", accountId);
    return row ? linkView(row) : null;
  }
  /** Authenticated iDs of several accounts (hub entry authors). */
  links(accountIds: string[]): Map<string, HubOrcidLink> {
    const out = new Map<string, HubOrcidLink>();
    for (const row of this.hub.all<OrcidRow>("SELECT * FROM account_orcid")) if (accountIds.includes(row.account_id)) out.set(row.account_id, linkView(row));
    return out;
  }
  status(accountId: string) {
    const c = this.client();
    return { configured: Boolean(c), ...(c ? { environment: c.environment } : {}), link: this.link(accountId) };
  }

  start(actor: AuditActor) {
    const c = this.client();
    if (!c) throw new HubServerError("이 허브 서버에는 ORCID 연결이 설정되어 있지 않습니다.", 409);
    const state = this.hub.random(24).toString("base64url");
    const nonce = this.hub.random(24).toString("base64url");
    const at = this.hub.now();
    const expiresAt = new Date(Date.parse(at) + ORCID_STATE_MINUTES * 60_000).toISOString();
    this.hub.tx(() => {
      this.hub.run("DELETE FROM orcid_states WHERE expires_at<=? OR account_id=?", at, actor.id);
      this.hub.run("INSERT INTO orcid_states VALUES (?,?,?,?,?,?)", sha256(state), actor.id, nonce, c.redirectUri, at, expiresAt);
      this.hub.audit(actor, "orcid.start", actor.id, { environment: c.environment });
    });
    const url = new URL(`${orcidBase(c.environment)}/oauth/authorize`);
    url.search = new URLSearchParams({ client_id: c.clientId, response_type: "code", scope: "openid", redirect_uri: c.redirectUri, state, nonce }).toString();
    return { authorizeUrl: url.href, expiresAt };
  }

  async finish(actor: AuditActor, body: unknown): Promise<HubOrcidLink> {
    if (!object(body)) throw new HubServerError("ORCID 확인 정보를 확인해 주세요.");
    const code = text(body.code, "ORCID 확인 코드", 200);
    const state = text(body.state, "ORCID 확인 상태값", 200);
    const c = this.client();
    if (!c) throw new HubServerError("이 허브 서버에는 ORCID 연결이 설정되어 있지 않습니다.", 409);
    // Single use: the state row is removed before any network call.
    const row = this.hub.tx(() => {
      const r = this.hub.get<{ account_id: string; nonce: string; redirect_uri: string; expires_at: string }>("SELECT * FROM orcid_states WHERE state_sha256=?", sha256(state));
      if (r) this.hub.run("DELETE FROM orcid_states WHERE state_sha256=?", sha256(state));
      return r;
    });
    if (!row || row.account_id !== actor.id) throw new HubServerError("ORCID 확인 요청을 찾지 못했습니다. GAID에서 다시 시작하세요.", 400);
    if (row.expires_at <= this.hub.now()) throw new HubServerError("ORCID 확인 시간이 지났습니다. GAID에서 다시 시작하세요.", 410);
    const base = orcidBase(c.environment);
    const tokenBody = await this.json(`${base}/oauth/token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: "authorization_code", code, redirect_uri: row.redirect_uri }).toString(),
    }, "ORCID가 확인 코드를 받아 주지 않았습니다. GAID에서 다시 시작하세요.");
    const keys = await this.json(`${base}/oauth/jwks`, { headers: { Accept: "application/json" } }, "ORCID 서명 키를 읽지 못했습니다.");
    const claims = verifyIdToken(tokenBody.id_token, keys, { issuer: base, audience: c.clientId, nonce: row.nonce, now: new Date(this.hub.now()) });
    const orcid = claims.sub as string;
    if (typeof tokenBody.orcid === "string" && tokenBody.orcid !== orcid) throw new HubServerError("ORCID 응답의 iD가 서로 맞지 않습니다.", 502);
    const name = [claims.given_name, claims.family_name].filter((v): v is string => typeof v === "string" && v.trim() !== "").join(" ") ||
      (typeof tokenBody.name === "string" ? tokenBody.name : "");
    return this.hub.tx(() => {
      const other = this.hub.get<{ account_id: string }>("SELECT account_id FROM account_orcid WHERE orcid=? AND environment=? AND account_id<>?", orcid, c.environment, actor.id);
      if (other) throw new HubServerError("이 ORCID iD는 다른 허브 계정에 이미 연결되어 있습니다. 관리자에게 문의하세요.", 409);
      const at = this.hub.now();
      this.hub.run(`INSERT INTO account_orcid VALUES (?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET
        orcid=excluded.orcid, environment=excluded.environment, name=excluded.name, authenticated_at=excluded.authenticated_at`,
        actor.id, orcid, c.environment, name.slice(0, 200) || null, at);
      this.hub.audit(actor, "orcid.link", actor.id, { orcid, environment: c.environment });
      return this.link(actor.id)!;
    });
  }

  unlink(actor: AuditActor) {
    this.hub.tx(() => {
      const before = this.link(actor.id);
      this.hub.run("DELETE FROM account_orcid WHERE account_id=?", actor.id);
      if (before) this.hub.audit(actor, "orcid.unlink", actor.id, { orcid: before.id });
    });
  }

  private async json(url: string, init: RequestInit, failure: string): Promise<Record<string, unknown>> {
    let response: Response;
    try { response = await this.fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(20_000) }); }
    catch { throw new HubServerError("허브 서버가 ORCID에 연결하지 못했습니다.", 502); }
    const raw = await response.text().catch(() => "");
    if (!response.ok) throw new HubServerError(failure, 502);
    try { const v = JSON.parse(raw.slice(0, 256 * 1024)); if (object(v)) return v; } catch { /* below */ }
    throw new HubServerError("ORCID 응답을 읽지 못했습니다.", 502);
  }
}
