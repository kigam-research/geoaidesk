/**
 * LocalMethod routes (gaid-hub-integration; contract web/src/geo/contracts/methods.ts):
 *   GET  /geo/methods                         installed method packages with workflow readiness
 *   GET  /geo/methods/trials?skill=<name>     trials (chats started from a method workflow), newest first
 *   GET  /geo/methods/trials/:sessionId       one trial with observations from its provenance log
 *   PUT  /geo/methods/trials/:sessionId/assessment  { outcome, note } the researcher's assessment
 * Installation stays in the existing skill preview/acknowledgement/install gate;
 * none of these routes installs, prepares an environment or sends a prompt.
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { activePaths, type ProjectPaths } from "../../projects.ts";
import type { LocalMethodsResponse, MethodTrialsResponse } from "../../../../web/src/geo/contracts/methods.ts";
import { geoCatalogueStatus, loadGeoCatalogue, type GeoCatalogue } from "../catalogue.ts";
import { geoEnvironmentService, type GeoEnvironmentService } from "../environments.ts";
import { listLocalMethods } from "../methods/local-methods.ts";
import { assessMethodTrial, getMethodTrial, listMethodTrials, MethodTrialError } from "../methods/trials.ts";

export interface GeoMethodRouteOptions {
  service?: Pick<GeoEnvironmentService, "readiness">;
  catalogue?: () => GeoCatalogue | null;
  paths?: () => ProjectPaths;
}

function defaultCatalogue(): GeoCatalogue | null {
  if (geoCatalogueStatus().state !== "ready") return null;
  try {
    return loadGeoCatalogue();
  } catch {
    return null;
  }
}

export async function registerGeoMethodRoutes(app: FastifyInstance, options: GeoMethodRouteOptions = {}): Promise<void> {
  const service = options.service ?? geoEnvironmentService();
  const catalogueOf = options.catalogue ?? defaultCatalogue;
  const pathsOf = options.paths ?? activePaths;
  const failure = (reply: FastifyReply, err: unknown) => {
    if (err instanceof MethodTrialError) return reply.code(err.statusCode).send({ detail: err.message });
    throw err;
  };

  app.get("/geo/methods", async (): Promise<LocalMethodsResponse> => ({
    methods: await listLocalMethods(pathsOf(), catalogueOf(), service),
  }));

  app.get<{ Querystring: { skill?: string } }>("/geo/methods/trials", async (req): Promise<MethodTrialsResponse> => ({
    trials: listMethodTrials(pathsOf(), req.query.skill ? { runtimeName: req.query.skill } : {}),
  }));

  app.get<{ Params: { sessionId: string } }>("/geo/methods/trials/:sessionId", async (req, reply) => {
    try {
      return getMethodTrial(pathsOf(), req.params.sessionId);
    } catch (err) {
      return failure(reply, err);
    }
  });

  app.put<{ Params: { sessionId: string } }>("/geo/methods/trials/:sessionId/assessment", { bodyLimit: 16 * 1024 }, async (req, reply) => {
    const body = (req.body ?? {}) as { outcome?: unknown; note?: unknown };
    try {
      return assessMethodTrial(pathsOf(), req.params.sessionId, body);
    } catch (err) {
      return failure(reply, err);
    }
  });
}
