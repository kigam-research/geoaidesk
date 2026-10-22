import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { ConnectionStore, hubUrl } from "../src/geo/hub-client/connection.ts";
import { HubClient } from "../src/geo/hub-client/client.ts";
import { RemoteHubStore } from "../src/geo/hub-client/remote-store.ts";
import { registerGeoHubServerRoutes } from "../src/geo/routes/hub-server.ts";
import { resolveHub, setRemoteHubProvider } from "../src/geo/hub-shared/active.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { account, fakeHub } from "./geo-hub-client-fake.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { setRemoteHubProvider(null); for (const clean of cleanup.splice(0)) await clean(); });
async function setup() {
  const f = await fakeHub(); cleanup.push(f.clean);
  const local = Fastify(); cleanup.push(() => local.close());
  await registerGeoHubServerRoutes(local, { client: f.client, library: new LibraryStore(join(f.root, "library")), backgroundSync: false });
  await local.ready();
  return { ...f, local };
}
const request = async (app: FastifyInstance, path: string, payload: unknown = {}) => app.inject({ method: "POST", url: `/geo/hub-server/${path}`, payload });
describe("institute hub client", () => {
  it("normalizes addresses and rejects paths, credentials, query strings and other protocols", () => {
    expect(hubUrl("http://institute:8181/")).toBe("http://institute:8181"); expect(hubUrl("https://server.example")).toBe("https://server.example"); expect(hubUrl(null)).toBeNull();
    for (const invalid of ["", "file:///etc/passwd", "ftp://host", "host:8080", "http:host", "http://@host", "https://user:pass@host", "http://host/path", "http://host?", "http://host/#fragment", "http://host?x=1"]) expect(() => hubUrl(invalid)).toThrow();
  });
  it("keeps tokens backend-only, persists with restricted permissions, uses account identity, logs out retaining URL", async () => {
    const f = await setup(); const result = await request(f.local, "login", { email: account.email, password: "test-password" });
    expect(result.statusCode).toBe(200); expect(result.json().account.id).toBe(account.id); expect(result.body).not.toContain(f.state.token); expect(result.body).not.toContain('"token"');
    expect(resolveHub(null).actor).toEqual({ id: account.id, name: account.displayName }); expect(resolveHub(null).store.kind).toBe("remote");
    const file = join(f.client.connection.root, "connection.json"); expect(JSON.parse(await readFile(file, "utf8")).token).toBe(f.state.token);
    expect((await stat(file)).mode & 0o777).toBe(0o600); expect((await stat(f.client.connection.root)).mode & 0o777).toBe(0o700);
    const result2 = await request(f.local, "logout"); expect(result2.json().account).toBeNull(); expect(result2.json().url).toBe("http://institute:8181"); expect(resolveHub(null).store.kind).toBe("local");
    expect(await readFile(file, "utf8")).not.toContain(f.state.token);
  });
  it("supports invites, profile edits, admin passthrough and rejects non-admin requests", async () => {
    const f = await setup(); expect((await request(f.local, "accept-invite", { code: "invite", displayName: account.displayName, password: "test-password" })).statusCode).toBe(200);
    const patched = await f.local.inject({ method: "PATCH", url: "/geo/hub-server/me", payload: { displayName: "다른 이름" } }); expect(patched.json().account.displayName).toBe("다른 이름");
    expect((await f.local.inject("/geo/hub-server/admin/users")).statusCode).toBe(403);
    await f.client.connection.save({ ...f.client.connection.current, account: { ...account, role: "admin" } });
    expect((await f.local.inject("/geo/hub-server/admin/users")).json().users).toHaveLength(1);
    expect((await request(f.local, "admin/invites", { email: "other@example.org", role: "member" })).json().code).toBe("one-time");
    expect((await f.local.inject({ method: "DELETE", url: "/geo/hub-server/admin/invites/inv-test" })).statusCode).toBe(204);
  });
  it("respects env override and never reuses a token for a different address", async () => {
    const f = await setup(); await f.login();
    const connection = new ConnectionStore(join(f.root, "agent"), () => "http://other-server:9000"); await connection.load();
    expect(connection.current.url).toBe("http://other-server:9000"); expect(connection.current.token).toBeUndefined(); expect(connection.fromEnv).toBe(true);
    await expect(connection.configure(null)).rejects.toMatchObject({ status: 409 });
  });
  it("clears the token on authenticated 401 and detects a different server before sending credentials", async () => {
    const f = await setup(); await f.login(); f.state.unauthorized = true;
    const status = await f.local.inject("/geo/hub-server/status"); expect(status.json().account).toBeNull(); expect(f.client.connection.current.token).toBeUndefined();
    f.state.unauthorized = false; await f.login(); f.seen.length = 0; f.state.serverId = "srv-replaced";
    await expect(new RemoteHubStore(f.client).folders()).rejects.toMatchObject({ status: 401 });
    expect(f.seen.every((r) => r.path === "/hub/v1/health" && !r.headers.authorization)).toBe(true); expect(f.client.connection.current.token).toBeUndefined();
    expect((await f.login()).account?.id).toBe(account.id);
  });
  it("returns Korean bounded errors without leaking remote error text and allows local logout offline", async () => {
    const f = await setup(); const wrong = await request(f.local, "login", { password: "wrong" }); expect(wrong.statusCode).toBe(401); expect(wrong.body).not.toContain(f.state.token);
    await f.login(); f.state.unreachable = true;
    const error = await f.local.inject({ method: "PATCH", url: "/geo/hub-server/me", payload: { displayName: "Name" } });
    expect(error.statusCode).toBe(502); expect(error.json().error).toMatch(/[가-힣]/); expect(error.body).not.toContain(f.state.token);
    expect((await f.local.inject("/geo/hub-server/status")).json().reachable).toBe(false);
    expect((await request(f.local, "logout")).json().account).toBeNull();
  });
  it("bounds response and upload bytes, refuses redirects, and sends no browser-origin headers", async () => {
    const f = await setup(); await f.login(); await new RemoteHubStore(f.client).folders();
    expect(f.seen.every((r) => !r.headers.origin && !r.headers["sec-fetch-site"])).toBe(true);
    await expect(f.client.request("/entries", { limit: 1 })).rejects.toMatchObject({ status: 413 });
    await expect(f.client.request("/entries", { method: "PUT", bytes: Buffer.alloc(5), limit: 4 })).rejects.toMatchObject({ status: 413 });
    const redirect = new HubClient(f.client.connection, async (_url, init) => { expect(init?.redirect).toBe("error"); throw new TypeError("redirect"); });
    await expect(redirect.health()).rejects.toMatchObject({ status: 502 });
  });
  it("maps a timed-out HTTP request to 502 and retains the configured address", async () => {
    const f = await setup();
    const transport: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new Error("timeout")), { once: true }); });
    const client = new HubClient(f.client.connection, transport, { json: 10, file: 10 });
    await expect(client.health()).rejects.toMatchObject({ status: 502 }); expect(client.connection.current.url).toBe("http://institute:8181");
  });
  it("remote store serial queue survives failures and sends files, stars/comments/installs with bearer identity", async () => {
    const f = await setup(); await f.login(); const remote = new RemoteHubStore(f.client); const actor = { id: "spoofed", name: "Spoofed" };
    await expect(remote.serial("x", async () => { throw new Error("fail"); })).rejects.toThrow("fail"); expect(await remote.serial("x", async () => 1)).toBe(1);
    expect(await remote.find("entry-missing")).toBeNull();
    await remote.immutableBytes("entry-test", "packages/1.tar.gz", Buffer.from("package"), actor);
    expect((await remote.bytes("entry-test", "packages/1.tar.gz")).toString()).toBe("package");
    await expect(remote.immutableBytes("entry-test", "../bad", Buffer.from("x"), actor)).rejects.toThrow();
    const folder = await remote.addFolder("Remote topic", actor); expect(folder.createdBy).toBe(account.displayName);
  });
  it("does not save an in-flight login token to a newly configured server", async () => {
    const f = await setup(); let release!: () => void, started!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; }), began = new Promise<void>((resolve) => { started = resolve; });
    const client = new HubClient(f.client.connection, async (url, init) => {
      if (String(url).endsWith("/auth/login")) { started(); await waiting; }
      return f.transport(url, init);
    });
    const login = client.login("/auth/login", { email: account.email, password: "test-password" });
    await began; await client.configure("http://other-server:9000"); release();
    await expect(login).rejects.toMatchObject({ status: 409 }); expect(client.connection.current.token).toBeUndefined(); expect(client.connection.current.url).toBe("http://other-server:9000");
  });
  it("pins resolved remote operations to their starting account when the local login changes", async () => {
    const f = await setup(); await f.login(); const remote = resolveHub(null).store;
    await f.client.connection.save({ ...f.client.connection.current, account: { ...account, id: "acc-other" } });
    f.seen.length = 0; await expect(remote.folders()).rejects.toMatchObject({ status: 401 }); expect(f.seen).toHaveLength(0);
  });
  it("syncs the library once in the background after login and after a logged-in restart", async () => {
    const f = await fakeHub(); cleanup.push(f.clean);
    const library = new LibraryStore(join(f.root, "library")); await library.addGaidItem({ csl: { type: "article-journal", title: "Background" }, metadataOrigin: "manual" });
    const app = Fastify(); cleanup.unshift(() => app.close());
    const first = await registerGeoHubServerRoutes(app, { client: f.client, library });
    expect((await request(app, "login", { email: account.email, password: "test-password" })).statusCode).toBe(200);
    await expect.poll(async () => (await first.sync.status()).lastSyncedAt).toBeTruthy(); expect(f.objects.size).toBe(1);
    await library.addGaidItem({ csl: { type: "article-journal", title: "Added before restart" }, metadataOrigin: "manual" });
    const restarted = Fastify(); cleanup.unshift(() => restarted.close());
    const second = await registerGeoHubServerRoutes(restarted, { client: f.client, library });
    await expect.poll(() => f.objects.size).toBe(2);
    await expect.poll(async () => (await second.sync.status()).running).toBe(false);
  });
  it("exposes manual sync status and rejects sync without a hub account", async () => {
    const f = await setup(); expect((await f.local.inject("/geo/library/sync")).json().available).toBe(false);
    expect((await f.local.inject({ method: "POST", url: "/geo/library/sync", payload: {} })).statusCode).toBe(401);
    await f.login(); expect((await f.local.inject("/geo/library/sync")).json().available).toBe(true);
    const result = await f.local.inject({ method: "POST", url: "/geo/library/sync", payload: {} });
    expect(result.statusCode).toBe(200); expect(result.json().status.lastSyncedAt).toBeTruthy();
  });
});
