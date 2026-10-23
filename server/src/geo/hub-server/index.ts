/** Institute-only API: deliberately does not build/import the GAID workspace server. */
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { readFileSync } from "node:fs";
import type { HubInviteBody, HubUpdateMeBody, HubUpdateUserBody } from "../../../../web/src/geo/contracts/hub-server.ts";
import { HubAccounts, type Authenticated } from "./accounts.ts";
import { HubDatabase, HubServerError, hashValue, sha256, type HubServerOptions } from "./core.ts";
import { HubFeeds } from "./feeds/store.ts";
import type { FeedFetchOptions } from "./feeds/fetch.ts";
import { intervalHours, scheduleFeeds } from "./feeds/schedule.ts";
import type { FeedSourceDefinition } from "../../../../web/src/geo/contracts/hub-feeds.ts";
import { HubLibrary } from "./library.ts";
import { HubOrcid } from "./orcid.ts";
import { SQLiteHubStore } from "./records.ts";
import { SQLiteHubSkillStore } from "./skills.ts";
import { HUB_API as API, HUB_FILE_LIMIT, HUB_SERVER_SCHEMA, LIBRARY_FILE_LIMIT, type AcceptInviteRequest,
  type InstallRequest, type LibraryPushRequest, type LoginRequest, type ReviewInput, type StoredHubSkill, type StoredEntry } from "./protocol.ts";

export type HubServerApp = FastifyInstance & { hub: HubDatabase; accounts: HubAccounts; store: SQLiteHubStore; library: HubLibrary; feeds: HubFeeds; orcid: HubOrcid };
export interface HubServeOptions extends HubServerOptions, FeedFetchOptions {
  /** Set only by serve; tests/builders do not start collection implicitly. */
  feedsIntervalHours?: number;
  feedProposals?: FeedSourceDefinition[];
  /** Serve HTTPS only (docs/geo/hub-server-https.md way A). PEM key and certificate chain. */
  https?: { key: Buffer; cert: Buffer };
  /** Behind a reverse proxy on this PC: take the client address from X-Forwarded-For set by a loopback proxy. */
  trustProxy?: boolean;
  /** ORCID token/JWKS requests (tests pass a fake). */
  orcidFetch?: typeof fetch;
}
export function buildHubServer(options: HubServeOptions): HubServerApp {
  const hours = options.feedsIntervalHours === undefined ? 0 : intervalHours(options.feedsIntervalHours);
  const hub = new HubDatabase(options);
  const accounts = new HubAccounts(hub);
  const store = new SQLiteHubStore(hub);
  const library = new HubLibrary(hub);
  const orcid = new HubOrcid(hub, { fetch: options.orcidFetch });
  const feeds = new HubFeeds(hub, { feedFetch: options.feedFetch, githubToken: options.githubToken, proposals: options.feedProposals });
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, exposeHeadRoutes: false, requestTimeout: 120_000,
    // Login failure limits count per client address; only a proxy on this PC may set it.
    trustProxy: options.trustProxy ? ["127.0.0.1", "::1"] : false,
    ...(options.https ? { https: options.https } : {}) }) as unknown as HubServerApp;
  app.decorate("hub", hub); app.decorate("accounts", accounts); app.decorate("store", store); app.decorate("library", library);
  app.decorate("feeds", feeds); app.decorate("orcid", orcid);
  const stopFeeds = scheduleFeeds(feeds, hours);
  app.addHook("onClose", async () => { stopFeeds(); await feeds.close(); hub.close(); });
  const authentication = new WeakMap<FastifyRequest, Authenticated>();
  const auth = (req: FastifyRequest) => authentication.get(req)!;
  const records = (req: FastifyRequest) => new SQLiteHubStore(hub, auth(req).device);
  const actor = (req: FastifyRequest) => ({ id: auth(req).id, name: auth(req).account.displayName });
  const skills = (req: FastifyRequest) => new SQLiteHubSkillStore(hub, actor(req), auth(req).device);
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
  app.get(`${API}/orcid`, async (req) => orcid.status(auth(req).id));
  app.post(`${API}/orcid/start`, async (req) => orcid.start(auth(req)));
  app.post(`${API}/orcid/finish`, { bodyLimit: 4 * 1024 }, async (req) => ({ link: await orcid.finish(auth(req), req.body) }));
  app.delete(`${API}/orcid`, async (req, reply) => { orcid.unlink(auth(req)); return reply.code(204).send(); });
  const feedActor = (req: FastifyRequest) => {
    const a = admin(req); return { id: a.id, name: a.account.displayName, device: a.device };
  };
  app.get<{ Querystring: Record<string, unknown> }>(`${API}/feeds`, async (req) => feeds.list(req.query));
  app.get(`${API}/admin/feeds/sources`, async (req) => { admin(req); return { sources: feeds.sources() }; });
  app.post(`${API}/admin/feeds/sources`, async (req, reply) => reply.code(201).send({ source: feeds.add(req.body, feedActor(req)) }));
  app.patch<{ Params: { id: string } }>(`${API}/admin/feeds/sources/:id`, async (req) => ({ source: feeds.decide(req.params.id, req.body, feedActor(req)) }));
  app.delete<{ Params: { id: string } }>(`${API}/admin/feeds/sources/:id`, async (req, reply) => {
    feeds.delete(req.params.id, feedActor(req)); return reply.code(204).send();
  });
  app.post(`${API}/admin/feeds/fetch`, async (req) => { admin(req); return feeds.fetch(req.body ?? {}); });
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

  app.get(`${API}/skills`, async (req) => ({ skills: await skills(req).list() }));
  app.get<{ Params: { id: string } }>(`${API}/skills/:id`, (req) => skills(req).read(req.params.id));
  app.put<{ Params: { id: string }; Body: StoredHubSkill }>(`${API}/skills/:id`, { bodyLimit: 4 * 1024 * 1024 }, async (req) => {
    if (req.body?.id !== req.params.id) throw new HubServerError("스킬 식별자가 경로와 맞지 않습니다.");
    const db = skills(req);
    await db.write(req.body, actor(req));
    return db.read(req.params.id);
  });
  app.get<{ Params: { id: string; rev: string } }>(`${API}/skills/:id/revisions/:rev/archive`, async (req, reply) =>
    reply.type("application/gzip").send(await skills(req).archive(req.params.id, Number(req.params.rev))));
  app.put<{ Params: { id: string; rev: string }; Body: Buffer }>(`${API}/skills/:id/revisions/:rev/archive`, { bodyLimit: HUB_FILE_LIMIT }, async (req, reply) => {
    const expected = req.headers["x-content-sha256"];
    hashValue(expected);
    if (!Buffer.isBuffer(req.body) || sha256(req.body) !== expected) throw new HubServerError("파일 내용과 해시가 맞지 않습니다.");
    await skills(req).publish(req.params.id, Number(req.params.rev), req.body, actor(req));
    return reply.code(204).send();
  });
  app.post<{ Params: { id: string; rev: string }; Body: ReviewInput }>(`${API}/skills/:id/revisions/:rev/reviews`, (req) =>
    skills(req).review(req.params.id, Number(req.params.rev), req.body, actor(req)));
  app.get<{ Params: { id: string } }>(`${API}/skills/:id/comments`, async (req) => ({ comments: await skills(req).comments(req.params.id) }));
  app.post<{ Params: { id: string }; Body: { body: string } }>(`${API}/skills/:id/comments`, async (req, reply) =>
    reply.code(201).send(await skills(req).addComment(req.params.id, actor(req), req.body?.body)));
  app.get<{ Params: { id: string } }>(`${API}/skills/:id/stars`, async (req) => ({ stars: await skills(req).stars(req.params.id) }));
  app.post<{ Params: { id: string }; Body: { on: boolean } }>(`${API}/skills/:id/star`, (req) => skills(req).star(req.params.id, actor(req), req.body?.on));

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
export { SQLiteHubSkillStore } from "./skills.ts";
