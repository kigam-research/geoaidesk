/** HTTP contract: web/src/geo/contracts/hub-skills.ts. Names are unverified display names, not accounts. */
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { InstallSkillBody, RegisterSkillBody, RegisterSkillSource, ReviewBody } from "../../../../web/src/geo/contracts/hub-skills.ts";
import { AuthoringError } from "../authoring/store.ts";
import { SkillOperationFailure } from "../../agent/skills-install.ts";
import { hubUser } from "../hub-shared/routes.ts";
import { readArchive } from "./archive.ts";
import { installHubSkillRevision, previewHubSkillInstall } from "./install.ts";
import { previewHubSkill, registerHubSkill, type RegistrationDeps } from "./register.ts";
import { reviewHubSkill } from "./review.ts";
import { textOf } from "./scan.ts";
import { HubSkillStore } from "./store.ts";
import { listHubSkills, readHubSkillRevision, requireVisible, revisionOf, skillView } from "./view.ts";

const userRequired = (req: FastifyRequest) => {
  const user = hubUser(req);
  if (!user) throw new AuthoringError("허브에서 사용할 이름을 1–40자로 입력해 주세요.", 401);
  return user;
};
const revisionNumber = (raw: unknown): number | undefined => {
  if (raw === undefined) return undefined;
  const n = typeof raw === "string" && /^[1-9]\d*$/.test(raw) ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 1) throw new AuthoringError("스킬 판 번호를 확인해 주세요.");
  return n;
};
export interface HubSkillRoutesOptions extends RegistrationDeps { store?: HubSkillStore }
export async function registerHubSkillRoutes(app: FastifyInstance, options: HubSkillRoutesOptions = {}) {
  const store = options.store ?? new HubSkillStore();
  await store.initialize();
  app.register(async (scope) => {
    scope.setErrorHandler((error, _req, reply) => {
      if (error instanceof AuthoringError) return reply.code(error.status).send({ error: error.message });
      if (error instanceof SkillOperationFailure) return reply.code(error.status).send({ error: error.detail });
      if ((error as { statusCode?: number }).statusCode === 400) return reply.code(400).send({ error: "JSON 형식을 확인해 주세요." });
      scope.log.error(error); return reply.code(500).send({ error: "처리하지 못했습니다. 서버 기록을 확인해 주세요." });
    });
    scope.addHook("onRequest", async (req) => { if (req.method !== "GET" && req.method !== "HEAD") userRequired(req); });
    scope.addHook("onSend", async (_req, reply, payload) => { reply.header("Cache-Control", "no-store"); return payload; });
    scope.get<{ Querystring: { q?: string; folder?: string } }>("/geo/hub/skills", async (req) => ({ skills: (await listHubSkills(store, { q: req.query.q, user: hubUser(req) })).filter((s) => !req.query.folder || s.folderId === req.query.folder) }));
    scope.post<{ Body: RegisterSkillSource }>("/geo/hub/skills/preview", (req) => previewHubSkill(store, req.body, userRequired(req), options));
    scope.post<{ Body: RegisterSkillBody }>("/geo/hub/skills", async (req, reply) => reply.code(201).send(await registerHubSkill(store, req.body, userRequired(req), options)));
    type Params = { id: string };
    type Query = { revision?: string };
    const visible = async (req: FastifyRequest<{ Params: Params; Querystring: Query }>) => {
      const skill = await requireVisible(store, req.params.id, hubUser(req), revisionNumber(req.query.revision));
      return { skill, revision: revisionNumber(req.query.revision) ?? skill.latestRevision };
    };
    scope.get<{ Params: Params; Querystring: Query }>("/geo/hub/skills/:id", async (req) => {
      const { skill, revision } = await visible(req);
      const r = await readHubSkillRevision(store, skill.id, revision);
      const entries = readArchive(r.archive, skill.name);
      const content = entries.find((e) => e.path === "SKILL.md")!.data;
      if (content.length > 256 * 1024) throw new AuthoringError("지침은 256 KiB 이내의 텍스트 파일만 볼 수 있습니다.", 413);
      const allowed = new Set(skill.revisions.map((r) => r.revision));
      return { skill: await skillView(store, skill, hubUser(req)), revision, content: textOf(content) ?? "", files: r.revision.files.map((f) => f.path), comments: (await store.comments(skill.id)).filter((c) => allowed.has(c.revision)) };
    });
    scope.get<{ Params: Params; Querystring: Query & { path?: string } }>("/geo/hub/skills/:id/file", async (req, reply) => {
      const { skill, revision } = await visible(req);
      const p = req.query.path;
      if (typeof p !== "string" || p.includes("\\") || p.split("/").some((s) => !s || s === "." || s === "..")) throw new AuthoringError("스킬 파일 경로를 확인해 주세요.");
      const r = await readHubSkillRevision(store, skill.id, revision);
      const entry = readArchive(r.archive, skill.name).find((e) => e.type === "file" && e.path === p);
      if (!entry) throw new AuthoringError("스킬 파일을 찾을 수 없습니다.", 404);
      if (entry.data.length > 256 * 1024) throw new AuthoringError("256 KiB 이내의 텍스트 파일만 볼 수 있습니다.", 413);
      const text = textOf(entry.data);
      if (text === null) throw new AuthoringError("텍스트 파일만 볼 수 있습니다.", 415);
      return reply.type("text/plain; charset=utf-8").send(text);
    });
    scope.get<{ Params: Params; Querystring: Query }>("/geo/hub/skills/:id/package.tar.gz", async (req, reply) => {
      const { skill, revision } = await visible(req);
      const r = await readHubSkillRevision(store, skill.id, revision);
      return reply.type("application/gzip").header("Content-Disposition", `attachment; filename="${skill.name}-${revision}.tar.gz"`).send(r.archive);
    });
    scope.post<{ Params: Params & { rev: string }; Body: ReviewBody }>("/geo/hub/skills/:id/revisions/:rev/review", async (req) => {
      const revision = revisionNumber(req.params.rev)!;
      await requireVisible(store, req.params.id, userRequired(req), revision);
      return reviewHubSkill(store, req.params.id, revision, req.body, userRequired(req));
    });
    scope.post<{ Params: Params; Body: { on: boolean } }>("/geo/hub/skills/:id/star", async (req) => {
      await requireVisible(store, req.params.id, userRequired(req));
      if (typeof req.body?.on !== "boolean") throw new AuthoringError("별표 상태를 선택해 주세요.");
      return store.star(req.params.id, userRequired(req), req.body.on);
    });
    scope.get<{ Params: Params }>("/geo/hub/skills/:id/comments", async (req) => {
      const skill = await requireVisible(store, req.params.id, hubUser(req));
      const allowed = new Set(skill.revisions.map((r) => r.revision));
      return { comments: (await store.comments(skill.id)).filter((c) => allowed.has(c.revision)) };
    });
    scope.post<{ Params: Params; Body: { body: string } }>("/geo/hub/skills/:id/comments", async (req, reply) => {
      const skill = await requireVisible(store, req.params.id, userRequired(req));
      // A comment must not bind to a latest revision hidden from this researcher.
      if (skill.latestRevision !== (await store.read(skill.id)).latestRevision) throw new AuthoringError("최신 판의 라이선스를 확인할 수 없어 댓글을 달 수 없습니다.", 403);
      if (typeof req.body?.body !== "string" || !req.body.body.trim() || req.body.body.length > 4000) throw new AuthoringError("댓글은 1–4000자로 입력해 주세요.");
      return reply.code(201).send(await store.addComment(skill.id, userRequired(req), req.body.body.trim()));
    });
    scope.post<{ Params: Params; Body: { projectId: string; revision: number } }>("/geo/hub/skills/:id/install-preview", async (req) => {
      const revision = revisionNumber(req.body?.revision);
      const skill = await requireVisible(store, req.params.id, userRequired(req), revision);
      return previewHubSkillInstall(store, skill.id, revision ?? skill.latestRevision, req.body?.projectId, options);
    });
    scope.post<{ Params: Params; Body: InstallSkillBody }>("/geo/hub/skills/:id/install", async (req, reply) => {
      const revision = revisionNumber(req.body?.revision);
      const skill = await requireVisible(store, req.params.id, userRequired(req), revision);
      return reply.code(201).send(await installHubSkillRevision(store, { skillId: skill.id, revision: revision ?? skill.latestRevision, projectId: req.body?.projectId, acknowledged: req.body?.acknowledged }, options));
    });
  });
  return store;
}
