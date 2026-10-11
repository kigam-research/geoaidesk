/** Project-scoped environment readiness; installation requires an explicit POST. */
import type { FastifyInstance } from "fastify";
import { activePaths } from "../../projects.ts";
import { geoCatalogueActive } from "../catalogue.ts";
import { EnvironmentPreparationError, GeoEnvironmentService, loadGeoEnvironments, type EnvironmentTarget } from "../environments.ts";
import type { GeoEnvironments } from "../catalogue-types.ts";

export async function registerGeoEnvironmentRoutes(app: FastifyInstance, options: {
  service?: GeoEnvironmentService;
  load?: () => GeoEnvironments;
  active?: () => boolean;
  sandbox?: () => string;
} = {}): Promise<void> {
  const service = options.service ?? new GeoEnvironmentService();
  const load = options.load ?? loadGeoEnvironments;
  const active = options.active ?? geoCatalogueActive;
  const sandbox = options.sandbox ?? (() => activePaths().sandbox);

  app.get("/geo/environments", async (_req, reply) => {
    if (!active()) return { state: "off", environments: [] };
    let data: GeoEnvironments;
    try { data = load(); } catch (error) {
      return reply.code(503).send({ detail: (error as Error).message });
    }
    const dir = sandbox();
    const environments = [];
    for (const env of data.environments) {
      const targets = [];
      for (const target of env.targets) targets.push(await service.readiness(data, env.id, target, dir));
      environments.push({ id: env.id, title: env.title, optional: !!env.optional, targets });
    }
    return { state: "ready", python: data.python, environments };
  });

  app.post<{ Params: { id: string }; Body: { target?: EnvironmentTarget } }>("/geo/environments/:id/prepare", {
    preValidation: async (req) => { if (req.body === undefined) req.body = {}; },
    schema: { body: { type: "object", additionalProperties: false, properties: { target: { type: "string", enum: ["helper", "project"] } } } },
  }, async (req, reply) => {
    if (!active()) return reply.code(404).send({ detail: "Geo catalogue mode is off" });
    let data: GeoEnvironments;
    try { data = load(); } catch (error) {
      return reply.code(503).send({ detail: (error as Error).message });
    }
    const target = req.body?.target ?? "project";
    const env = data.environments.find((entry) => entry.id === req.params.id);
    if (!env || !env.targets.includes(target)) return reply.code(404).send({ detail: "Unknown environment or target" });
    try { return await service.prepare(data, env.id, target, sandbox()); }
    catch (error) {
      return reply.code(503).send({ detail: (error as Error).message,
        ...(error instanceof EnvironmentPreparationError ? { output: error.output } : {}) });
    }
  });
}
