/** Institute-only API: deliberately does not build/import the GAID workspace server. */
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { readFileSync } from "node:fs";
import type { HubInviteBody, HubUpdateMeBody, HubUpdateUserBody } from "../../../../web/src/geo/contracts/hub-server.ts";
import { HubAccounts, type Authenticated } from "./accounts.ts";
import { HubDatabase, HubServerError, hashValue, sha256, type HubServerOptions } from "./core.ts";
import { HubLibrary } from "./library.ts";
import { SQLiteHubStore } from "./records.ts";
import { HUB_API as API, HUB_FILE_LIMIT, HUB_SERVER_SCHEMA, LIBRARY_FILE_LIMIT, type AcceptInviteRequest,
  type InstallRequest, type LibraryPushRequest, type LoginRequest, type StoredEntry } from "./protocol.ts";

export type HubServerApp = FastifyInstance & { hub: HubDatabase; accounts: HubAccounts; store: SQLiteHubStore; library: HubLibrary };
export function buildHubServer(options: HubServerOptions): HubServerApp {
  const hub = new HubDatabase(options);
  const accounts = new HubAccounts(hub);
  const store = new SQLiteHubStore(hub);
  const library = new HubLibrary(hub);
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, exposeHeadRoutes: false, requestTimeout: 120_000 }) as unknown as HubServerApp;
  app.decorate("hub", hub); app.decorate("accounts", accounts); app.decorate("store", store); app.decorate("library", library);
  app.addHook("onClose", async () => hub.close());
  const authentication = new WeakMap<FastifyRequest, Authenticated>();
  const auth = (req: FastifyRequest) => authentication.get(req)!;
  const records = (req: FastifyRequest) => new SQLiteHubStore(hub, auth(req).device);
  const actor = (req: FastifyRequest) => ({ id: auth(req).id, name: auth(req).account.displayName });
  const admin = (req: FastifyRequest) => {
    if (auth(req).account.role !== "admin") throw new HubServerError("관리자만 사용할 수 있습니다.", 403);
    return auth(req);
  };
  app.addHook("onRequest", async (req, reply) => {
    if (Object.hasOwn(req.headers, "origin") || Object.hasOwn(req.headers, "sec-fetch-site"))
      return reply.code(403).send({ error: "허브 서버는 GAID 시스템에서만 연결할 수 있습니다." });
    const route = req.routeOptions.url;
    if (route && ![`${API}/health`, `${API}/auth/login`, `${API}/auth/invites/accept`].includes(route))
      authentication.set(req, accounts.authenticate(req.headers.authorization));
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof HubServerError) {
      if (error.status === 429) reply.header("Retry-After", "900");
      return reply.code(error.status).send({ error: error.message });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 413) return reply.code(413).send({ error: "파일 또는 요청 크기가 허용 범위를 넘었습니다." });
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: "요청 형식과 내용을 확인해 주세요." });
    return reply.code(500).send({ error: "허브 서버가 요청을 처리하지 못했습니다. 서버 기록을 확인해 주세요." });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "허브 서버 경로를 찾을 수 없습니다." }));
  app.addContentTypeParser(["application/octet-stream", "application/pdf", "application/gzip", "image/png", "image/jpeg", "image/webp", "image/gif"],
    { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  const distribution = JSON.parse(readFileSync(new URL("../../../../geo/distribution.json", import.meta.url), "utf8")) as { version: string };
  app.get(`${API}/health`, async () => ({ schema: HUB_SERVER_SCHEMA, name: "gaid-hub-server", version: distribution.version, serverId: hub.server.serverId }));
  app.post<{ Body: LoginRequest }>(`${API}/auth/login`, { bodyLimit: 16 * 1024 }, async (req) => {
    const result = await accounts.login(req.body, req.ip);
    if (result instanceof HubServerError) throw result;
    return result;
  });
  app.post<{ Body: AcceptInviteRequest }>(`${API}/auth/invites/accept`, { bodyLimit: 16 * 1024 }, (req) => accounts.accept(req.body));
  app.post(`${API}/auth/logout`, async (req, reply) => { accounts.logout(auth(req)); return reply.code(204).send(); });
  app.get(`${API}/auth/me`, async (req) => ({ account: auth(req).account }));
  app.patch<{ Body: HubUpdateMeBody }>(`${API}/auth/me`, async (req) => ({ account: await accounts.updateMe(auth(req), req.body) }));
  app.get(`${API}/admin/users`, async (req) => { admin(req); return { users: accounts.users() }; });
  app.patch<{ Params: { id: string }; Body: HubUpdateUserBody }>(`${API}/admin/users/:id`, async (req) => ({ account: accounts.updateUser(req.params.id, req.body, admin(req)) }));
  app.get(`${API}/admin/invites`, async (req) => { admin(req); return { invites: accounts.invites() }; });
  app.post<{ Body: HubInviteBody }>(`${API}/admin/invites`, async (req, reply) => reply.code(201).send({ invite: accounts.invite(req.body, admin(req)) }));
  app.delete<{ Params: { id: string } }>(`${API}/admin/invites/:id`, async (req, reply) => {
    accounts.revokeInvite(req.params.id, admin(req)); return reply.code(204).send();
  });
  app.get(`${API}/folders`, async () => ({ folders: await store.folders() }));
  app.post<{ Body: { name: string } }>(`${API}/folders`, async (req, reply) => reply.code(201).send(await records(req).addFolder(req.body?.name, actor(req))));
  app.get(`${API}/entries`, async () => ({ entries: await store.list() }));
  app.get<{ Params: { id: string } }>(`${API}/entries/:id`, (req) => store.read(req.params.id));
  app.put<{ Params: { id: string }; Body: StoredEntry }>(`${API}/entries/:id`, { bodyLimit: 4 * 1024 * 1024 }, async (req) => {
    if (req.body?.entry?.id !== req.params.id) throw new HubServerError("등록 식별자가 경로와 맞지 않습니다.");
    const db = records(req);
    await db.write(req.body, actor(req));
    return db.read(req.params.id);
  });
  app.post<{ Params: { id: string }; Body: InstallRequest }>(`${API}/entries/:id/installs`, async (req, reply) => {
    await records(req).recordInstall(req.params.id, req.body?.install, actor(req)); return reply.code(204).send();
  });
  app.get<{ Params: { id: string; "*": string } }>(`${API}/entries/:id/files/*`, async (req, reply) =>
    reply.type("application/octet-stream").send(await store.bytes(req.params.id, req.params["*"])));
  app.put<{ Params: { id: string; "*": string }; Body: Buffer }>(`${API}/entries/:id/files/*`, { bodyLimit: HUB_FILE_LIMIT }, async (req, reply) => {
    const expected = req.headers["x-content-sha256"];
    hashValue(expected);
    if (!Buffer.isBuffer(req.body) || sha256(req.body) !== expected) throw new HubServerError("파일 내용과 해시가 맞지 않습니다.");
    await records(req).immutableBytes(req.params.id, req.params["*"], req.body, actor(req)); return reply.code(204).send();
  });
  app.get<{ Params: { id: string } }>(`${API}/entries/:id/comments`, async (req) => ({ comments: await store.comments(req.params.id) }));
  app.post<{ Params: { id: string }; Body: { body: string } }>(`${API}/entries/:id/comments`, async (req, reply) =>
    reply.code(201).send(await records(req).addComment(req.params.id, actor(req), req.body?.body)));
  app.get<{ Params: { id: string } }>(`${API}/entries/:id/stars`, async (req) => ({ stars: await store.stars(req.params.id) }));
  app.post<{ Params: { id: string }; Body: { on: boolean } }>(`${API}/entries/:id/star`, (req) => records(req).star(req.params.id, actor(req), req.body?.on));

  app.get<{ Querystring: { since?: string } }>(`${API}/library/changes`, async (req) => {
    const since = req.query.since ?? "0";
    if (!/^\d+$/.test(since)) throw new HubServerError("서재 동기화 판 번호를 확인해 주세요.");
    return library.changes(auth(req).id, Number(since));
  });
  app.post<{ Body: LibraryPushRequest }>(`${API}/library/changes`, { bodyLimit: 4 * 1024 * 1024 }, async (req) => library.push(auth(req), req.body));
  app.head<{ Params: { sha256: string } }>(`${API}/library/files/:sha256`, async (req, reply) => {
    if (!library.hasFile(auth(req).id, req.params.sha256)) throw new HubServerError("서재 파일을 찾을 수 없습니다.", 404);
    return reply.code(200).send();
  });
  app.get<{ Params: { sha256: string } }>(`${API}/library/files/:sha256`, async (req, reply) => reply.type("application/pdf").send(library.file(auth(req).id, req.params.sha256)));
  app.put<{ Params: { sha256: string }; Body: Buffer }>(`${API}/library/files/:sha256`, { bodyLimit: LIBRARY_FILE_LIMIT }, async (req, reply) => {
    if (!Buffer.isBuffer(req.body)) throw new HubServerError("PDF 파일을 보내세요.");
    library.putFile(auth(req), req.params.sha256, req.body); return reply.code(204).send();
  });
  return app;
}
export { HubAccounts } from "./accounts.ts";
export { HubDatabase, HubServerError } from "./core.ts";
export { SQLiteHubStore } from "./records.ts";
