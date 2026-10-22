import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { HubClient } from "../hub-client/client.ts";
import { RemoteHubStore } from "../hub-client/remote-store.ts";
import { setRemoteHubProvider } from "../hub-shared/active.ts";
import { LibrarySync } from "../library/sync/index.ts";
import { libraryStore, type LibraryStore } from "../library/store.ts";
import { AuthoringError } from "../authoring/store.ts";
import type { HubAccount, HubInvite } from "../../../../web/src/geo/contracts/hub-server.ts";

export interface HubServerRouteOptions {
  client?: HubClient;
  library?: LibraryStore;
  /** Tests control sync explicitly; production runs it after login and once at startup. */
  backgroundSync?: boolean;
}
export async function registerGeoHubServerRoutes(app: FastifyInstance, options: HubServerRouteOptions = {}) {
  const client = options.client ?? new HubClient();
  await client.connection.load();
  const remote = new RemoteHubStore(client);
  const sync = new LibrarySync(client, options.library ?? libraryStore());
  setRemoteHubProvider(() => {
    const c = client.connection.current;
    const identity = client.identity;
    return identity && c.account ? { store: remote.forIdentity(identity), actor: { id: c.account.id, name: c.account.displayName } } : null;
  });
  const background = () => {
    if (options.backgroundSync === false) return;
    void sync.sync().catch(() => { /* Status keeps a researcher-readable failure; no tokens or request bodies logged. */ });
  };
  const safe = (action: (body: unknown, params: Record<string, string>) => Promise<unknown>) => async (req: FastifyRequest, reply: FastifyReply) => {
    try { return await action(req.body ?? {}, (req.params ?? {}) as Record<string, string>); }
    catch (e) { return reply.code(e instanceof AuthoringError ? e.status : 500).send({ error: e instanceof AuthoringError ? e.message : "허브 서버 요청을 처리하지 못했습니다." }); }
  };
  const object = (body: unknown): Record<string, unknown> => {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AuthoringError("입력 내용을 확인해 주세요.");
    return body as Record<string, unknown>;
  };
  const admin = async <T>(path: string, method = "GET", body?: unknown): Promise<T> => {
    if (!client.identity) throw new AuthoringError("허브 서버에 로그인해 주세요.", 401);
    if (client.connection.current.account?.role !== "admin") throw new AuthoringError("관리자만 이 작업을 할 수 있습니다.", 403);
    return client.request<T>(path, { method, ...(body ? { body } : {}) });
  };
  app.get("/geo/hub-server/status", safe(() => client.status()));
  app.put("/geo/hub-server/config", safe((body) => client.configure(object(body).url)));
  app.post("/geo/hub-server/login", safe(async (body) => { const result = await client.login("/auth/login", object(body)); background(); return result; }));
  app.post("/geo/hub-server/accept-invite", safe(async (body) => { const result = await client.login("/auth/invites/accept", object(body)); background(); return result; }));
  app.post("/geo/hub-server/logout", safe(() => client.logout()));
  app.patch("/geo/hub-server/me", safe(async (body) => {
    const { account } = await client.request<{ account: HubAccount }>("/auth/me", { method: "PATCH", body: object(body) });
    await client.connection.save({ ...client.connection.current, account });
    return client.status(false);
  }));
  app.get("/geo/hub-server/admin/users", safe(() => admin("/admin/users")));
  app.patch("/geo/hub-server/admin/users/:id", safe(async (body, p) => (await admin<{ account: HubAccount }>(`/admin/users/${encodeURIComponent(p.id)}`, "PATCH", object(body))).account));
  app.get("/geo/hub-server/admin/invites", safe(() => admin("/admin/invites")));
  app.post("/geo/hub-server/admin/invites", safe(async (body) => (await admin<{ invite: HubInvite }>("/admin/invites", "POST", object(body))).invite));
  app.delete("/geo/hub-server/admin/invites/:id", async (req, reply) => {
    try { await admin(`/admin/invites/${encodeURIComponent((req.params as { id: string }).id)}`, "DELETE"); return reply.code(204).send(); }
    catch (e) { return reply.code(e instanceof AuthoringError ? e.status : 500).send({ error: e instanceof AuthoringError ? e.message : "초대를 취소하지 못했습니다." }); }
  });
  app.get("/geo/library/sync", safe(() => sync.status()));
  app.post("/geo/library/sync", safe(() => sync.sync()));
  // Run after registration without delaying startup on a network timeout.
  if (client.identity && options.backgroundSync !== false) void client.status().then(() => { if (client.identity) background(); }).catch(() => undefined);
  return { client, remote, sync };
}
