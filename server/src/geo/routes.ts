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
import { registerGeoMapRoutes } from "./routes/maps.ts";
import { registerGeoBasemapRoutes } from "./basemaps/routes.ts";

import { registerGeoTableRoutes } from "./routes/tables.ts";
import { registerGeoDepthRoutes } from "./routes/depth.ts";
import { registerGeoWorkspaceRoutes } from "./routes/workspace.ts";
import { registerGeoSkillHubRoutes } from "./routes/skill-hub.ts";
import { registerGeoHubHandoffRoutes } from "./routes/hub-handoff.ts";
import { registerGeoMethodRoutes } from "./routes/methods.ts";
import { registerGeoAuthoringRoutes } from "./routes/authoring.ts";
import { registerGeoAuthoringExtraRoutes } from "./routes/authoring-extra.ts";
import { registerGeoHubSharedRoutes } from "./routes/hub-shared.ts";
import { registerGeoWorkflowViewRoutes } from "./routes/workflow-view.ts";
import { registerGeoNoteRoutes } from "./routes/notes.ts";
import { registerGeoCliExportRoutes } from "./routes/cli-export.ts";
import { registerGeoLibraryRoutes } from "./routes/library.ts";
import { registerGeoFigureRoutes } from "./routes/figures.ts";

export async function registerGeoRoutes(app: FastifyInstance): Promise<void> {
  await registerGeoCatalogueRoutes(app);
  await registerGeoEnvironmentRoutes(app);
  await registerGeoInspectionRoutes(app);
  await registerGeoLocalModelRoutes(app);
  await registerGeoMapRoutes(app);
  await registerGeoBasemapRoutes(app);
  await registerGeoDepthRoutes(app);
  await registerGeoTableRoutes(app);
  await registerGeoWorkspaceRoutes(app);
  await registerGeoSkillHubRoutes(app);
  await registerGeoHubHandoffRoutes(app);
  await registerGeoMethodRoutes(app);
  await registerGeoAuthoringRoutes(app);
  await registerGeoAuthoringExtraRoutes(app);
  await registerGeoWorkflowViewRoutes(app);
  await registerGeoHubSharedRoutes(app);
  await registerGeoNoteRoutes(app);
  await registerGeoCliExportRoutes(app);
  await registerGeoLibraryRoutes(app);
  await registerGeoFigureRoutes(app);
}
