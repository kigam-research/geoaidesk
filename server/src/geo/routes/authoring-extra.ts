import type { FastifyInstance } from "fastify";
import type { AddUrlSourceBody, GenerateVisualsBody } from "../../../../web/src/geo/contracts/authoring.ts";
import { getAuthoringStore } from "../authoring/routes.ts";
import { AuthoringError, type AuthoringStore } from "../authoring/store.ts";
import { addUrlSource, type UrlSourceOptions } from "../authoring/url-sources.ts";
import { startVisuals, type PrepareImageGenerator } from "../authoring/visuals.ts";

export interface AuthoringExtraOptions {
  store?: AuthoringStore;
  prepareImageGenerator?: PrepareImageGenerator;
  url?: UrlSourceOptions;
}
export async function registerGeoAuthoringExtraRoutes(
  app: FastifyInstance,
  options: AuthoringExtraOptions = {},
): Promise<void> {
  const store = options.store ?? getAuthoringStore(app);
  const pending = new Set<Promise<void>>();
  app.addHook("onClose", async () => {
    await Promise.allSettled([...pending]);
  });
  await app.register(async (scope) => {
    scope.setErrorHandler((error, _req, reply) => {
      if (error instanceof AuthoringError) return reply.code(error.status).send({ error: error.message });
      if ((error as { statusCode?: number }).statusCode === 400)
        return reply.code(400).send({ error: "요청 형식을 확인해 주세요." });
      scope.log.error(error);
      return reply.code(500).send({ error: "처리하지 못했습니다. 서버 기록을 확인해 주세요." });
    });
    scope.addHook("onSend", async (_req, reply, payload) => {
      reply.header("Cache-Control", "no-store");
      return payload;
    });
    scope.post<{ Params: { id: string }; Body: AddUrlSourceBody }>(
      "/geo/authoring/projects/:id/sources/url",
      async (req) => addUrlSource(store, req.params.id, req.body, options.url),
    );
    scope.post<{
      Params: { id: string; rev: string };
      Body: GenerateVisualsBody;
    }>("/geo/authoring/projects/:id/drafts/:rev/visuals", async (req, reply) => {
      const revision = Number(req.params.rev);
      if (!Number.isSafeInteger(revision) || revision < 1)
        throw new AuthoringError("초안 번호를 확인해 주세요.");
      const { operation, completion } = await startVisuals(
        store,
        req.params.id,
        revision,
        req.body,
        options.prepareImageGenerator,
      );
      pending.add(completion);
      void completion.finally(() => pending.delete(completion));
      return reply.code(202).send(operation);
    });
    scope.get<{ Params: { id: string; key: string } }>(
      "/geo/authoring/projects/:id/visuals/:key",
      async (req, reply) => {
        const project = await store.read(req.params.id);
        const visual = Object.hasOwn(project.visuals ?? {}, req.params.key)
          ? project.visuals![req.params.key]
          : undefined;
        if (!visual) throw new AuthoringError("개념 그림을 찾을 수 없습니다.", 404);
        reply.header("Content-Type", visual.file.endsWith(".webp") ? "image/webp" : "image/png");
        reply.header("X-Content-Type-Options", "nosniff");
        return reply.send(await store.readFile(project.id, visual.file));
      },
    );
  });
}
