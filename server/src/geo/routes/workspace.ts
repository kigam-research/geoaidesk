/**
 * Workspace routes (WP07 gaid-korean-workspace; contract
 * web/src/geo/contracts/workspace.ts):
 *   GET  /geo/workflows          catalogue workflows with project readiness
 *   POST /geo/suggestions        { path } → at most three task suggestions for a sandbox file
 *   POST /geo/recipes/check      { recipe } → `.geo-start.json` issues or an editable task setup
 * None of them starts a task, prepares an environment or sends a prompt.
 */
import type { FastifyInstance } from "fastify";
import { activePaths, type ProjectPaths } from "../../projects.ts";
import { currentProjectId } from "../../scope.ts";
import { SandboxError } from "../../sandbox-fs.ts";
import type { GeoWorkflowsResponse } from "../../../../web/src/geo/contracts/workspace.ts";
import type { GeoInspection } from "../../../../web/src/geo/contracts/inspection.ts";
import { geoCatalogueStatus, loadGeoCatalogue, type GeoCatalogue } from "../catalogue.ts";
import { geoEnvironmentService, type GeoEnvironmentService } from "../environments.ts";
import { inspectGeoFile, resolveGeoPath } from "../inspection.ts";
import { taxonomyFormat } from "../workspace/formats.ts";
import { checkRecipe } from "../workspace/recipes.ts";
import { suggestWorkflows } from "../workspace/suggestions.ts";
import { listWorkflows } from "../workspace/workflows.ts";

export interface GeoWorkspaceRouteOptions {
  service?: Pick<GeoEnvironmentService, "readiness">;
  /** The active catalogue, or null when geo mode is off or the archive failed. */
  catalogue?: () => GeoCatalogue | null;
  status?: () => GeoWorkflowsResponse["catalogue"];
  paths?: () => ProjectPaths;
  inspect?: (relPath: string) => Promise<GeoInspection>;
}

function defaultStatus(): GeoWorkflowsResponse["catalogue"] {
  const status = geoCatalogueStatus();
  if (status.state === "ready") return { state: "ready", version: status.version };
  if (status.state === "off") return { state: "off", version: null };
  return { state: "error", version: status.version, detail: status.message };
}

function defaultCatalogue(): GeoCatalogue | null {
  if (geoCatalogueStatus().state !== "ready") return null;
  try {
    return loadGeoCatalogue();
  } catch {
    return null;
  }
}

export async function registerGeoWorkspaceRoutes(app: FastifyInstance, options: GeoWorkspaceRouteOptions = {}): Promise<void> {
  const service = options.service ?? geoEnvironmentService();
  const catalogueOf = options.catalogue ?? defaultCatalogue;
  const statusOf = options.status ?? defaultStatus;
  const pathsOf = options.paths ?? activePaths;
  const inspect = options.inspect ?? ((relPath: string) => inspectGeoFile(currentProjectId(), pathsOf(), relPath, { previewRows: 0 }));

  app.get("/geo/workflows", async (): Promise<GeoWorkflowsResponse> => {
    const catalogue = statusOf();
    const loaded = catalogue.state === "ready" ? catalogueOf() : null;
    if (!loaded) return { catalogue, workflows: [] };
    return { catalogue, workflows: await listWorkflows(pathsOf(), loaded, service) };
  });

  app.post("/geo/suggestions", { bodyLimit: 16 * 1024 }, async (req, reply) => {
    const body = req.body as { path?: unknown } | null;
    if (!body || typeof body.path !== "string" || !body.path.trim()) {
      return reply.code(400).send({ detail: "Expected { path }" });
    }
    const catalogue = catalogueOf();
    let rel = body.path;
    try {
      rel = (await resolveGeoPath(pathsOf(), body.path)).rel;
    } catch (err) {
      if (err instanceof SandboxError) return reply.code(err.statusCode).send({ detail: err.message });
      throw err;
    }
    if (!catalogue) return { path: rel, format: null, suggestions: [] };
    let inspection: GeoInspection | null = null;
    try {
      inspection = await inspect(rel);
    } catch {
      // Unreadable or unsupported: fall back to the extension.
    }
    const format = taxonomyFormat(rel, inspection?.asset.format);
    if (!format) return { path: rel, format: null, suggestions: [] };
    const workflows = await listWorkflows(pathsOf(), catalogue, service);
    return { path: rel, format, suggestions: suggestWorkflows(format, inspection, workflows) };
  });

  app.post("/geo/recipes/check", { bodyLimit: 64 * 1024 }, async (req, reply) => {
    const body = req.body as { recipe?: unknown } | null;
    if (!body || typeof body !== "object" || !("recipe" in body)) return reply.code(400).send({ detail: "Expected { recipe }" });
    return checkRecipe(body.recipe, catalogueOf());
  });
}
