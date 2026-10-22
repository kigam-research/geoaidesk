/**
 * End to end (gaid-hub-feeds): research feeds through a real hub server over HTTP. Without a login a GAID shows no items;
 * an administrator's GAID approves a shipped proposal and collects it; a member's GAID then reads only approved sources'
 * items and is refused the administrator routes. The hub server's outside reads are injected (no network).
 */
import Fastify, { type FastifyInstance } from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { FeedSourceDefinition } from "../../web/src/geo/contracts/hub-feeds.ts";
import { setRemoteHubProvider } from "../src/geo/hub-shared/active.ts";
import { setRemoteHubSkillProvider } from "../src/geo/hub-skills/active.ts";
import { registerGeoHubServerRoutes } from "../src/geo/routes/hub-server.ts";
import { HubClient } from "../src/geo/hub-client/client.ts";
import { ConnectionStore } from "../src/geo/hub-client/connection.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { buildHubServer, type HubServerApp } from "../src/geo/hub-server/index.ts";

const proposals: FeedSourceDefinition[] = [
  { id: "hess", kind: "feed", title: "HESS", publisher: "EGU", homepage: "https://hess.example/", url: "https://hess.example/rss",
    category: "papers", field: "hydrology", reason: "수문 학술지입니다." },
  { id: "eos", kind: "feed", title: "Eos", publisher: "AGU", homepage: "https://eos.example/", url: "https://eos.example/feed",
    category: "news", field: "general", reason: "AGU 소식지입니다." },
];
const rss = (host: string) => `<rss><channel><item><title>${host} item</title><link>https://${host}/1</link>
  <description>&lt;p&gt;Short summary from ${host}.&lt;/p&gt;</description><content:encoded>FULL TEXT</content:encoded>
  <pubDate>Wed, 21 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>`;
const outside = vi.fn(async (input: string | URL | Request) => new Response(rss(new URL(String(input)).hostname))) as unknown as typeof fetch;

let root: string;
let hub: HubServerApp;
let url: string;
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "gaid-hub-feeds-e2e-"));
  hub = buildHubServer({ home: join(root, "hub-home"), feedFetch: outside, feedProposals: proposals });
  await hub.listen({ host: "127.0.0.1", port: 0 });
  const address = hub.server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  setRemoteHubProvider(null);
  setRemoteHubSkillProvider(null);
  for (const app of apps) await app.close();
  await hub.close();
  await rm(root, { recursive: true, force: true });
});

async function gaid(name: string) {
  const dir = join(root, name);
  const client = new HubClient(new ConnectionStore(join(dir, "agent"), () => undefined));
  const app = Fastify();
  apps.push(app);
  await registerGeoHubServerRoutes(app, { client, library: new LibraryStore(join(dir, "library")), backgroundSync: false });
  await app.ready();
  return async (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, payload?: unknown) => {
    const res = await app.inject({ method, url: path, ...(payload === undefined ? {} : { payload: payload as object }) });
    return { status: res.statusCode, body: res.body ? res.json() : null };
  };
}

it("collects approved sources only and serves them to members", async () => {
  const admin = await gaid("admin");
  const offline = await admin("GET", "/geo/hub/feeds");
  expect(offline).toMatchObject({ status: 200, body: { connected: false, items: [], sources: [] } });

  expect((await admin("PUT", "/geo/hub-server/config", { url })).status).toBe(200);
  const inviteA = hub.accounts.invite({ email: "kim@example.org", role: "admin" });
  expect((await admin("POST", "/geo/hub-server/accept-invite", { code: inviteA.code, displayName: "김관리", password: "correct horse 1" })).status).toBe(200);

  const listed = await admin("GET", "/geo/hub-server/admin/feeds/sources");
  expect(listed.body.sources.map((s: { id: string; state: string }) => `${s.id}:${s.state}`)).toEqual(["hess:proposed", "eos:proposed"]);
  // Nothing proposed is collected.
  expect((await admin("POST", "/geo/hub-server/admin/feeds/fetch", {})).body).toEqual({ results: [] });
  expect(outside).not.toHaveBeenCalled();

  const approved = await admin("PATCH", "/geo/hub-server/admin/feeds/sources/hess", { state: "approved" });
  expect(approved.body).toMatchObject({ id: "hess", state: "approved", decidedBy: "김관리" });
  const fetched = await admin("POST", "/geo/hub-server/admin/feeds/fetch", {});
  expect(fetched.body.results).toEqual([expect.objectContaining({ sourceId: "hess", ok: true, items: 1 })]);
  expect(vi.mocked(outside).mock.calls.map(([u]) => String(u))).toEqual(["https://hess.example/rss"]);
  expect((await admin("PATCH", "/geo/hub-server/admin/feeds/sources/bad%20id", { state: "approved" })).status).toBe(400);

  const member = await gaid("member");
  expect((await member("PUT", "/geo/hub-server/config", { url })).status).toBe(200);
  const inviteB = hub.accounts.invite({ email: "lee@example.org", role: "member" });
  expect((await member("POST", "/geo/hub-server/accept-invite", { code: inviteB.code, displayName: "이연구", password: "battery staple 2" })).status).toBe(200);
  const feeds = await member("GET", "/geo/hub/feeds");
  expect(feeds.status).toBe(200);
  expect(feeds.body).toMatchObject({ connected: true, sources: [{ id: "hess", title: "HESS" }] });
  expect(feeds.body.items).toEqual([expect.objectContaining({ sourceId: "hess", title: "hess.example item", summary: "Short summary from hess.example.", link: "https://hess.example/1" })]);
  expect(JSON.stringify(feeds.body)).not.toContain("FULL TEXT");
  expect((await member("GET", "/geo/hub/feeds?category=news")).body.items).toEqual([]);
  expect((await member("GET", "/geo/hub/feeds?category=nonsense")).status).toBe(400);
  expect((await member("GET", "/geo/hub-server/admin/feeds/sources")).status).toBe(403);
  expect((await member("POST", "/geo/hub-server/admin/feeds/fetch", {})).status).toBe(403);

  // A stopped source disappears from researchers' lists; its rows stay on the server.
  expect((await admin("PATCH", "/geo/hub-server/admin/feeds/sources/hess", { state: "stopped" })).status).toBe(200);
  expect((await member("GET", "/geo/hub/feeds")).body).toMatchObject({ connected: true, items: [], sources: [] });
});
