/** In-process protocol peer, isolated under the task data directory. No credentials or external services. */
import Fastify, { type FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import type { HubAccount } from "../../web/src/geo/contracts/hub-server.ts";
import type { LibraryObject, LibraryPushRequest } from "../src/geo/hub-server/protocol.ts";
import { SharedHubStore, type StoredEntry } from "../src/geo/hub-shared/store.ts";
import { ConnectionStore } from "../src/geo/hub-client/connection.ts";
import { HubClient } from "../src/geo/hub-client/client.ts";

const base = "/home/seongin3/data/geoaidesk/work/gaid-backend--hub-client/tests";
export async function directory() { await mkdir(base, { recursive: true }); return mkdtemp(join(base, "case-")); }
export const account: HubAccount = { id: "acc-test", email: "test@example.org", displayName: "연구원", role: "member", createdAt: "2026-10-01T00:00:00Z" };
export const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function fakeHub() {
  const root = await directory();
  const app = Fastify();
  const records = new SharedHubStore(join(root, "shared")); await records.initialize();
  const state = { serverId: "srv-test", token: "backend-only-secret-token", unauthorized: false, unreachable: false, stale: 0, pushCalls: 0 };
  const objects = new Map<string, LibraryObject>();
  const files = new Map<string, Buffer>();
  const seen: { path: string; headers: Record<string, unknown> }[] = [];
  let version = 0;
  const putObject = (object: Omit<LibraryObject, "version">) => {
    const next = { ...structuredClone(object), version: ++version }; objects.set(`${object.kind}:${object.id}`, next); return next;
  };
  const actor = () => ({ id: account.id, name: account.displayName });
  app.addHook("preHandler", async (req, reply) => {
    seen.push({ path: req.url, headers: req.headers });
    if (!req.url.endsWith("/health") && !req.url.includes("/auth/login") && !req.url.includes("/auth/invites/accept") &&
      (state.unauthorized || req.headers.authorization !== `Bearer ${state.token}`)) return reply.code(401).send({ error: "expired" });
  });
  app.get("/hub/v1/health", async () => ({ schema: "gaid-hub-server/v1", name: "gaid-hub-server", serverId: state.serverId, version: "0.1" }));
  for (const route of ["login", "invites/accept"]) app.post(`/hub/v1/auth/${route}`, async (req, reply) => {
    if ((req.body as { password: string }).password === "wrong") return reply.code(401).send({ error: state.token });
    return { token: state.token, expiresAt: "2027-01-01", account };
  });
  app.post("/hub/v1/auth/logout", async (_req, reply) => reply.code(204).send());
  app.get("/hub/v1/auth/me", async () => ({ account }));
  app.patch("/hub/v1/auth/me", async (req) => ({ account: { ...account, displayName: (req.body as { displayName?: string }).displayName ?? account.displayName } }));
  app.get("/hub/v1/admin/users", async () => ({ users: [account] }));
  app.patch("/hub/v1/admin/users/:id", async () => ({ account }));
  app.get("/hub/v1/admin/invites", async () => ({ invites: [] }));
  app.post("/hub/v1/admin/invites", async () => ({ invite: { id: "inv-test", email: account.email, role: "member", code: "one-time" } }));
  app.delete("/hub/v1/admin/invites/:id", async (_req, reply) => reply.code(204).send());
  app.get("/hub/v1/folders", async () => ({ folders: await records.folders() }));
  app.post("/hub/v1/folders", async (req) => records.addFolder((req.body as { name: string }).name, actor()));
  app.get("/hub/v1/entries", async () => ({ entries: await records.list() }));
  app.get<{ Params: { id: string } }>("/hub/v1/entries/:id", async (req, reply) => { const r = await records.find(req.params.id); return r ?? reply.code(404).send({ error: "missing" }); });
  app.put("/hub/v1/entries/:id", async (req, reply) => {
    const r = req.body as StoredEntry, old = await records.find(r.entry.id);
    if (old && old.entry.authorId !== account.id) return reply.code(403).send({ error: "not author" });
    r.entry.authorId = account.id; r.entry.author = account.displayName;
    for (const rev of r.entry.revisions) { rev.registeredById = account.id; rev.registeredBy = account.displayName; }
    await records.write(r, actor()); return r;
  });
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: 65 * 1024 * 1024 }, (_req, body, done) => done(null, body));
  app.put<{ Params: { id: string; "*": string } }>("/hub/v1/entries/:id/files/*", { bodyLimit: 21 * 1024 * 1024 }, async (req, reply) => {
    await records.immutableBytes(req.params.id, req.params["*"], req.body as Buffer, actor()); return reply.code(204).send();
  });
  app.get<{ Params: { id: string; "*": string } }>("/hub/v1/entries/:id/files/*", async (req, reply) => reply.type("application/octet-stream").send(await records.bytes(req.params.id, req.params["*"])));
  app.get<{ Params: { id: string } }>("/hub/v1/entries/:id/comments", async (req) => ({ comments: await records.comments(req.params.id) }));
  app.post<{ Params: { id: string } }>("/hub/v1/entries/:id/comments", async (req) => records.addComment(req.params.id, actor(), (req.body as { body: string }).body));
  app.get<{ Params: { id: string } }>("/hub/v1/entries/:id/stars", async (req) => ({ stars: await records.stars(req.params.id) }));
  app.post<{ Params: { id: string } }>("/hub/v1/entries/:id/star", async (req) => records.star(req.params.id, actor(), (req.body as { on: boolean }).on));
  app.post<{ Params: { id: string } }>("/hub/v1/entries/:id/installs", async (req, reply) => { await records.recordInstall(req.params.id, (req.body as any).install, actor()); return reply.code(204).send(); });
  app.get("/hub/v1/library/changes", async (req) => ({ version, changes: [...objects.values()].filter((o) => o.version > Number((req.query as { since: string }).since)) }));
  app.post("/hub/v1/library/changes", async (req) => {
    state.pushCalls++;
    const applied: { kind: "item" | "folder"; id: string; version: number }[] = [], conflicts: { kind: "item" | "folder"; id: string; version: number; reason: string }[] = [];
    for (const change of (req.body as LibraryPushRequest).changes) {
      const old = objects.get(`${change.kind}:${change.id}`);
      if (state.stale > 0) { state.stale--; conflicts.push({ ...change, version: old?.version ?? 0, reason: "stale" }); continue; }
      if ((old?.version ?? 0) !== change.baseVersion) { conflicts.push({ ...change, version: old?.version ?? 0, reason: "stale" }); continue; }
      const next = putObject({ kind: change.kind, id: change.id, deleted: change.deleted, ...(change.data ? { data: change.data } : {}) });
      applied.push({ kind: change.kind, id: change.id, version: next.version });
    }
    return { version, applied, conflicts };
  });
  app.get<{ Params: { sha: string } }>("/hub/v1/library/files/:sha", async (req, reply) => {
    const bytes = files.get(req.params.sha); return bytes ? reply.type("application/pdf").send(bytes) : reply.code(404).send({ error: "missing" });
  });
  app.put<{ Params: { sha: string } }>("/hub/v1/library/files/:sha", { bodyLimit: 65 * 1024 * 1024 }, async (req, reply) => {
    const bytes = req.body as Buffer;
    if (digest(bytes) !== req.params.sha) return reply.code(400).send({ error: "hash" });
    files.set(req.params.sha, bytes); return reply.code(204).send();
  });
  app.setErrorHandler((e: any, _req, reply) => reply.code(e.status ?? e.statusCode ?? 500).send({ error: e.message }));
  await app.ready();
  const transport: typeof fetch = async (url, init) => {
    if (state.unreachable) throw new Error(`network error ${state.token}`);
    const u = new URL(String(url));
    const result = await app.inject({ method: (init?.method ?? "GET") as any, url: u.pathname + u.search,
      headers: init?.headers as Record<string, string>, ...(init?.body ? { payload: init.body as any } : {}) });
    return new Response(result.statusCode === 204 || init?.method === "HEAD" ? null : result.rawPayload, { status: result.statusCode, headers: result.headers as Record<string, string> });
  };
  const client = new HubClient(new ConnectionStore(join(root, "agent"), () => undefined), transport);
  await client.connection.load(); await client.configure("http://institute:8181");
  const login = () => client.login("/auth/login", { email: account.email, password: "a-test-password" });
  const clean = async () => { await app.close(); await rm(root, { recursive: true, force: true }); };
  return { app, root, state, records, objects, files, seen, putObject, client, transport, login, clean };
}
