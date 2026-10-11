/**
 * GeoAIDesk HTTP routes, mounted by `buildApp` (server/src/index.ts) through
 * this single seam. Every route is project-scoped by the upstream request
 * scope (X-Project-Id → ?project → cookie → default). Each area owns its own
 * file under routes/.
 */
import type { FastifyInstance } from "fastify";
import { registerGeoCatalogueRoutes } from "./routes/catalogue.ts";
import { registerGeoEnvironmentRoutes } from "./routes/environments.ts";
import { registerGeoInspectionRoutes } from "./routes/inspection.ts";
import { registerGeoLocalModelRoutes } from "./routes/local-model.ts";

import { registerGeoTableRoutes } from "./routes/tables.ts";
import { registerGeoDepthRoutes } from "./routes/depth.ts";

export async function registerGeoRoutes(app: FastifyInstance): Promise<void> {
  await registerGeoCatalogueRoutes(app);
  await registerGeoEnvironmentRoutes(app);
  await registerGeoInspectionRoutes(app);
  await registerGeoLocalModelRoutes(app);
  await registerGeoDepthRoutes(app);
  await registerGeoTableRoutes(app);
}
