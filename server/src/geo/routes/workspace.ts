/**
 * Workspace routes (WP07 gaid-korean-workspace; contract
 * web/src/geo/contracts/workspace.ts):
 *   GET  /geo/workflows          catalogue workflows with project readiness
 *   POST /geo/suggestions        { path } → at most three task suggestions for a sandbox file
 *   POST /geo/recipes/check      { recipe } → `.geo-start.json` issues or an editable task setup
 *   GET  /geo/recipes            saved recipes with categories, re-checked (gaid-workflow-catalog)
 *   POST /geo/recipes            { recipe, title, category | newCategory } → save a checked recipe
 *   DELETE /geo/recipes/:id      remove a saved recipe
 * None of them starts a task, prepares an environment or sends a prompt.
 */
import { hubSuspendedLookup } from "../methods/hub-pin-install.ts";
import { installedMethods } from "../methods/local-methods.ts";
import type { FastifyInstance, FastifyReply } from "fastify";
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
import { deleteSavedRecipe, listSavedRecipes, saveRecipe, SavedRecipeError } from "../workspace/saved-recipes.ts";
import { suggestWorkflows } from "../workspace/suggestions.ts";
import { listLocalMethods } from "../methods/local-methods.ts";
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
    let inspection: GeoInspection | null = null;
    try {
      inspection = await inspect(rel);
    } catch {
      // Unreadable or unsupported: fall back to the extension.
    }
    const format = taxonomyFormat(rel, inspection?.asset.format);
    if (!format) return { path: rel, format: null, suggestions: [] };
    const [workflows, methods] = await Promise.all([
      catalogue ? listWorkflows(pathsOf(), catalogue, service) : [],
      listLocalMethods(pathsOf(), catalogue, service, { hubSuspended: await hubSuspendedLookup(installedMethods(pathsOf()).map((m) => m.file.method)) }),
    ]);
    // Pi resolves project methods before global methods of the same name.
    const seen = new Set<string>();
    const enabled = methods.filter((method) => {
      if (seen.has(method.runtimeName)) return false;
      seen.add(method.runtimeName);
      return method.enabled;
    });
    const local = enabled.flatMap((method) => method.workflows);
    // A method Workflow with a single 레시피 starts from it, as in the Workflow panel (gaid-hub-followups).
    const setups = new Map(enabled.flatMap((method) => method.workflows.flatMap((workflow) => {
      const own = method.recipes.filter((recipe) => recipe.workflowId === workflow.id);
      if (own.length !== 1) return [];
      const choices = Object.fromEntries(Object.entries(own[0].choices).map(([id, value]) => [id, String(value)]));
      return [[workflow.exposure, { workflowId: workflow.id, choices, unresolvedChoices: own[0].unresolvedChoices, skillIds: workflow.skillIds, exampleId: null }] as const];
    })));
    const suggestions = suggestWorkflows(format, inspection, [...local, ...workflows]).map((suggestion) => {
      const setup = suggestion.exposure ? setups.get(suggestion.exposure) : undefined;
      return setup ? { ...suggestion, setup } : suggestion;
    });
    return { path: rel, format, suggestions };
  });

  app.post("/geo/recipes/check", { bodyLimit: 64 * 1024 }, async (req, reply) => {
    const body = req.body as { recipe?: unknown } | null;
    if (!body || typeof body !== "object" || !("recipe" in body)) return reply.code(400).send({ detail: "Expected { recipe }" });
    return checkRecipe(body.recipe, catalogueOf());
  });

  const savedRecipeFailure = (reply: FastifyReply, err: unknown) => {
    if (err instanceof SavedRecipeError) return reply.code(err.statusCode).send({ detail: err.message, ...(err.issues ? { issues: err.issues } : {}) });
    throw err;
  };

  app.get("/geo/recipes", async (_req, reply) => {
    try {
      return listSavedRecipes(pathsOf(), catalogueOf());
    } catch (err) {
      return savedRecipeFailure(reply, err);
    }
  });

  app.post("/geo/recipes", { bodyLimit: 64 * 1024 }, async (req, reply) => {
    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || !("recipe" in body)) return reply.code(400).send({ detail: "Expected { recipe, title }" });
    try {
      return saveRecipe(pathsOf(), catalogueOf(), body);
    } catch (err) {
      return savedRecipeFailure(reply, err);
    }
  });

  app.delete<{ Params: { id: string } }>("/geo/recipes/:id", async (req, reply) => {
    try {
      return deleteSavedRecipe(pathsOf(), catalogueOf(), req.params.id);
    } catch (err) {
      return savedRecipeFailure(reply, err);
    }
  });
}
