import type { FastifyInstance } from "fastify";
import { registerAuthoringRoutes } from "../authoring/routes.ts";

/** GAID hub authoring (`/geo/authoring/*`): user-level, see server/src/geo/authoring/routes.ts. */
export async function registerGeoAuthoringRoutes(app: FastifyInstance): Promise<void> {
  await registerAuthoringRoutes(app);
}
