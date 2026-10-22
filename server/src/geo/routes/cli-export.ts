import type { FastifyInstance } from "fastify";
import { activePaths, type ProjectPaths } from "../../projects.ts";
import type { GeoCatalogue } from "../catalogue.ts";
import { activeHubStore } from "../hub-shared/active.ts";
import type { HubRecordStore } from "../hub-shared/records.ts";
import { AuthoringError } from "../authoring/store.ts";
import { buildCliZip, cliCatalogue, CLI_TARGETS, CliExportError, hubCliSource, projectCliSource, type CliTarget } from "../cli-export.ts";

export async function registerGeoCliExportRoutes(app: FastifyInstance, options: {
  paths?: () => ProjectPaths; catalogue?: () => GeoCatalogue | null; store?: HubRecordStore;
} = {}) {
  const paths = options.paths ?? activePaths;
  const catalogue = options.catalogue ?? cliCatalogue;
  for (const kind of ["project", "hub"] as const) {
    app.get<{ Params: { id: string }; Querystring: { target?: string; locale?: string; method?: string } }>(
      kind === "project" ? "/geo/workflows/:id/cli-export" : "/geo/hub/entries/:id/cli-export", async (req, reply) => {
        if (!CLI_TARGETS.includes(req.query.target as CliTarget) || (req.query.locale && !["ko", "en"].includes(req.query.locale)))
          return reply.code(400).send({ detail: "Choose a verified CLI target and ko or en locale" });
        try {
          const source = kind === "project" ? projectCliSource(paths(), catalogue(), req.params.id, req.query.method)
            : await hubCliSource(paths(), catalogue(), activeHubStore(options.store), req.params.id);
          return reply.type("application/zip").header("Content-Disposition", `attachment; filename="${source.doc.id}-${req.query.target}.zip"`)
            .send(buildCliZip(source, req.query.target as CliTarget, req.query.locale === "en" ? "en" : "ko"));
        } catch (error) {
          if (error instanceof CliExportError || error instanceof AuthoringError) return reply.code(error.status).send({ detail: error.message });
          throw error;
        }
      });
  }
}
