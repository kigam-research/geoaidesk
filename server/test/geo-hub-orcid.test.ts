/** Authenticated ORCID iD on hub accounts (gaid-orcid phase 2) against a fake ORCID that signs real RS256 ID tokens. */
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildHubServer, type HubServerApp } from "../src/geo/hub-server/index.ts";
import { readOrcidClient, writeOrcidClient } from "../src/geo/hub-server/orcid.ts";
import { backupHub } from "../src/geo/hub-server/backup.ts";
import { sha256 } from "../src/geo/hub-server/core.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { OrcidService } from "../src/geo/orcid/service.ts";
import type { OrcidHubPort } from "../src/geo/orcid/hub.ts";
import { registerGeoOrcidRoutes } from "../src/geo/routes/orcid.ts";
import { AuthoringError } from "../src/geo/authoring/store.ts";

const API = "/hub/v1";
const CLIENT = "APP-NMSX0X5YG2CKUCUQ";
const SECRET = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const ID = "0000-0002-1825-0097";
const work = join(homedir(), "data/geoaidesk/work/gaid-orcid/tests");
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", use: "sig", alg: "RS256" };
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
function idToken(claims: Record<string, unknown>, key = privateKey) {
  const head = b64({ alg: "RS256", kid: "test-key" }), body = b64(claims);
  return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url")}`;
}

let root: string, app: HubServerApp, time: number;
let tokenCalls: URLSearchParams[];
let claimsFor: (nonce: string) => Record<string, unknown>;
let lastNonce: string;

const fakeOrcid = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  if (url === "https://sandbox.orcid.org/oauth/jwks") return Response.json({ keys: [jwk] });
  if (url === "https://sandbox.orcid.org/oauth/token") {
    const body = new URLSearchParams(String(init?.body));
    tokenCalls.push(body);
    if (body.get("code") !== "good-code") return Response.json({ error: "invalid_grant" }, { status: 400 });
    return Response.json({ access_token: "t", token_type: "bearer", orcid: ID, name: "Josiah Carberry", id_token: idToken(claimsFor(lastNonce)) });
  }
  return new Response("not found", { status: 404 });
}) as typeof fetch;

beforeEach(() => {
  mkdirSync(work, { recursive: true });
  root = mkdtempSync(join(work, "case-"));
  time = Date.parse("2026-10-23T01:00:00.000Z");
  tokenCalls = [];
  claimsFor = (nonce) => ({ iss: "https://sandbox.orcid.org", aud: CLIENT, sub: ID, nonce, exp: time / 1000 + 600, iat: time / 1000, given_name: "Josiah", family_name: "Carberry" });
  app = buildHubServer({ home: join(root, "hub"), now: () => time, orcidFetch: fakeOrcid });
});
afterEach(async () => { await app.close(); rmSync(root, { recursive: true, force: true }); });

async function user(email: string) {
  const invite = app.accounts.invite({ email, role: "member" });
  const res = await app.inject({ method: "POST", url: `${API}/auth/invites/accept`, payload: { code: invite.code, displayName: email.split("@")[0], password: "a correct password 123" } });
  return { headers: { authorization: `Bearer ${res.json().token}` }, id: res.json().account.id as string };
}
async function start(headers: Record<string, string>) {
  const res = await app.inject({ method: "POST", url: `${API}/orcid/start`, headers, payload: {} });
  expect(res.statusCode, res.body).toBe(200);
  const url = new URL(res.json().authorizeUrl);
  lastNonce = url.searchParams.get("nonce")!;
  return url;
}
const configure = () => writeOrcidClient(app.hub.home, { environment: "sandbox", clientId: "NMSX0X5YG2CKUCUQ", clientSecret: SECRET });

describe("hub ORCID client file", () => {
  it("stores the client with mode 600, normalizes the id and never shows the secret", async () => {
    const view = configure();
    expect(view).toEqual({ environment: "sandbox", clientId: CLIENT, redirectUri: "http://127.0.0.1:8000/geo/orcid/callback", updatedAt: expect.any(String) });
    const file = join(app.hub.home, "orcid-client.json");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(readOrcidClient(app.hub.home)!.clientSecret).toBe(SECRET);
    expect(() => writeOrcidClient(app.hub.home, { environment: "sandbox", clientId: CLIENT, clientSecret: SECRET, redirectUri: "http://10.0.0.5:8000/cb" })).toThrow(/https/);
    const a = await user("a@example.org");
    expect((await app.inject({ method: "GET", url: `${API}/orcid`, headers: a.headers })).json()).toEqual({ configured: true, environment: "sandbox", link: null });
    // Backups hold the database and blobs only.
    const backup = join(root, "backup");
    backupHub(app.hub, backup);
    expect(readFileSync(join(backup, "manifest.json"), "utf8")).not.toContain("orcid-client");
  });
});

describe("hub ORCID sign-in", () => {
  it("refuses to start without a configured client", async () => {
    const a = await user("a@example.org");
    expect((await app.inject({ method: "POST", url: `${API}/orcid/start`, headers: a.headers, payload: {} })).statusCode).toBe(409);
  });

  it("links a verified iD to the account, shows it on the account and on the author's entries", async () => {
    configure();
    const a = await user("a@example.org");
    const url = await start(a.headers);
    expect(url.origin + url.pathname).toBe("https://sandbox.orcid.org/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ client_id: CLIENT, response_type: "code", scope: "openid", redirect_uri: "http://127.0.0.1:8000/geo/orcid/callback" });
    expect(url.href).not.toContain(SECRET);
    const state = url.searchParams.get("state")!;

    const done = await app.inject({ method: "POST", url: `${API}/orcid/finish`, headers: a.headers, payload: { code: "good-code", state } });
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json().link).toEqual({ id: ID, environment: "sandbox", name: "Josiah Carberry", authenticatedAt: "2026-10-23T01:00:00.000Z" });
    expect(tokenCalls[0].get("client_secret")).toBe(SECRET);
    expect(tokenCalls[0].get("redirect_uri")).toBe("http://127.0.0.1:8000/geo/orcid/callback");
    expect((await app.inject({ method: "GET", url: `${API}/auth/me`, headers: a.headers })).json().account.orcid).toMatchObject({ id: ID });
    const audit = JSON.stringify(app.hub.all("SELECT * FROM audit_events"));
    expect(audit).toContain("orcid.link");
    expect(audit).not.toContain(SECRET);

    // The state is single use.
    expect((await app.inject({ method: "POST", url: `${API}/orcid/finish`, headers: a.headers, payload: { code: "good-code", state } })).statusCode).toBe(400);

    // Entries show the author's current iD, never one stored by a client.
    const bytes = Buffer.from("pkg");
    await app.inject({ method: "PUT", url: `${API}/entries/entry-orcid1/files/packages/1.tar.gz`, headers: { ...a.headers, "content-type": "application/octet-stream", "x-content-sha256": sha256(bytes) }, payload: bytes });
    const at = new Date(time).toISOString();
    const entry = { schemaVersion: "gaid-hub-entry/v1", authoringProjectId: "ap", installs: [], snapshots: { "1": { draft: { revision: 1 }, visuals: {},
      package: { revision: 1, draftRevision: 1, methodId: "m", slug: "s", sha256: sha256(bytes), size: bytes.length, packageDigest: "ab".repeat(32), createdAt: at, manifest: {}, archive: "packages/1.tar.gz" } } },
      entry: { id: "entry-orcid1", methodId: "m", slug: "s", title: "T", summary: "S", kind: "workflow", tags: [], author: "x", folderId: "general", cover: null, latestRevision: 1, updatedAt: at,
        authorOrcid: { id: "0000-0001-5109-3700", environment: "production" },
        revisions: [{ revision: 1, authoringProjectId: "ap", draftRevision: 1, packageRevision: 1, packageSha256: sha256(bytes), packageDigest: "ab".repeat(32), registeredAt: at, registeredBy: "x", note: "" }] } };
    const put = await app.inject({ method: "PUT", url: `${API}/entries/entry-orcid1`, headers: a.headers, payload: entry });
    expect(put.statusCode, put.body).toBe(200);
    expect(put.json().entry.authorOrcid).toEqual({ id: ID, environment: "sandbox" });
    expect(JSON.parse(app.hub.get<{ record: string }>("SELECT record FROM hub_entries WHERE id='entry-orcid1'")!.record).entry.authorOrcid).toBeUndefined();

    // Unlinking removes it from the account and the entries.
    expect((await app.inject({ method: "DELETE", url: `${API}/orcid`, headers: a.headers })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `${API}/entries/entry-orcid1`, headers: a.headers })).json().entry.authorOrcid).toBeUndefined();
  });

  it("refuses another account's state, expired states, bad tokens and an iD already on another account", async () => {
    configure();
    const a = await user("a@example.org"), b = await user("b@example.org");
    const state = (await start(a.headers)).searchParams.get("state")!;
    expect((await app.inject({ method: "POST", url: `${API}/orcid/finish`, headers: b.headers, payload: { code: "good-code", state } })).statusCode).toBe(400);
    expect(tokenCalls).toHaveLength(0);

    const late = (await start(a.headers)).searchParams.get("state")!;
    time += 11 * 60_000;
    expect((await app.inject({ method: "POST", url: `${API}/orcid/finish`, headers: a.headers, payload: { code: "good-code", state: late } })).statusCode).toBe(410);

    const refused = (await start(a.headers)).searchParams.get("state")!;
    expect((await app.inject({ method: "POST", url: `${API}/orcid/finish`, headers: a.headers, payload: { code: "bad-code", state: refused } })).statusCode).toBe(502);

    for (const bad of [
      (n: string) => ({ ...claimsFor(n), nonce: "other" }),
      (n: string) => ({ ...claimsFor(n), aud: "APP-0000000000000000" }),
      (n: string) => ({ ...claimsFor(n), iss: "https://orcid.org" }),
      (n: string) => ({ ...claimsFor(n), exp: time / 1000 - 3600 }),
    ]) {
      claimsFor = bad;
      const s = (await start(a.headers)).searchParams.get("state")!;
      const res = await app.inject({ method: "POST", url: `${API}/orcid/finish`, headers: a.headers, payload: { code: "good-code", state: s } });
      expect(res.statusCode).toBe(502);
    }
    expect((await app.inject({ method: "GET", url: `${API}/orcid`, headers: a.headers })).json().link).toBeNull();

    claimsFor = (n) => ({ iss: "https://sandbox.orcid.org", aud: CLIENT, sub: ID, nonce: n, exp: time / 1000 + 600 });
    const ok = (await start(a.headers)).searchParams.get("state")!;
    expect((await app.inject({ method: "POST", url: `${API}/orcid/finish`, headers: a.headers, payload: { code: "good-code", state: ok } })).statusCode).toBe(200);
    const taken = (await start(b.headers)).searchParams.get("state")!;
    expect((await app.inject({ method: "POST", url: `${API}/orcid/finish`, headers: b.headers, payload: { code: "good-code", state: taken } })).statusCode).toBe(409);
  });

  it("rejects an ID token signed by another key", async () => {
    configure();
    const a = await user("a@example.org");
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    const forged = (async (input: string | URL | Request, init?: RequestInit) => String(input).endsWith("/oauth/token")
      ? Response.json({ orcid: ID, id_token: idToken(claimsFor(lastNonce), other) }) : fakeOrcid(input, init)) as typeof fetch;
    await app.close();
    app = buildHubServer({ home: join(root, "hub"), now: () => time, orcidFetch: forged });
    const s = (await start(a.headers)).searchParams.get("state")!;
    expect((await app.inject({ method: "POST", url: `${API}/orcid/finish`, headers: a.headers, payload: { code: "good-code", state: s } })).json().error).toMatch(/서명/);
  });
});

describe("researcher GAID callback", () => {
  it("forwards ORCID's redirect to the hub and marks the local iD authenticated", async () => {
    configure();
    const a = await user("a@example.org");
    const hubCall = async <T>(method: string, url: string, payload?: unknown): Promise<T> => {
      const res = await app.inject({ method: method as "GET", url: `${API}${url}`, headers: a.headers, ...(payload ? { payload } : {}) });
      if (res.statusCode >= 400) throw new AuthoringError(res.body, res.statusCode);
      return (res.statusCode === 204 ? undefined : res.json()) as T;
    };
    const port: OrcidHubPort = {
      status: () => hubCall("GET", "/orcid"), start: () => hubCall("POST", "/orcid/start", {}),
      finish: (body) => hubCall("POST", "/orcid/finish", body), unlink: () => hubCall("DELETE", "/orcid"),
    };
    const store = new LibraryStore(join(root, "library"));
    const service = new OrcidService(store, { hub: () => port, lookupDoi: async () => { throw new Error("unused"); } });
    const gaid = Fastify();
    await registerGeoOrcidRoutes(gaid, { store: () => store, service: () => service });

    expect((await gaid.inject({ method: "GET", url: "/geo/orcid" })).json().hub).toEqual({ state: "ready", environment: "sandbox" });
    const started = (await gaid.inject({ method: "POST", url: "/geo/orcid/auth/start" })).json();
    const url = new URL(started.authorizeUrl);
    lastNonce = url.searchParams.get("nonce")!;
    const page = await gaid.inject({ method: "GET", url: `/geo/orcid/callback?code=good-code&state=${encodeURIComponent(url.searchParams.get("state")!)}` });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain("ORCID 본인 확인을 마쳤습니다");
    expect(page.body).toContain(`https://sandbox.orcid.org/${ID}`);
    const status = (await gaid.inject({ method: "GET", url: "/geo/orcid" })).json();
    expect(status.profile).toMatchObject({ orcid: ID, authenticated: true, environment: "sandbox" });
    expect(status.hub).toMatchObject({ state: "linked", link: { id: ID } });

    expect((await gaid.inject({ method: "GET", url: "/geo/orcid/callback?error=access_denied" })).body).toContain("취소했습니다");
    // Removing the hub link turns the local iD back into an unauthenticated one.
    const after = (await gaid.inject({ method: "DELETE", url: "/geo/orcid/auth" })).json();
    expect(after.profile).toMatchObject({ orcid: ID, authenticated: false });
    expect(after.hub).toEqual({ state: "ready", environment: "sandbox" });
  });
});
