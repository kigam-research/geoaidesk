/**
 * Workspace state routes (gaid-project-resume; contract
 * web/src/geo/contracts/workspace-state.ts):
 *   GET /geo/workspace-state   the project's last saved workspace state, or null
 *   PUT /geo/workspace-state   { state, clientId } → replace it (the last save wins)
 * Scoped by X-Project-Id through the app's project hook; the reply names the
 * project it read, so a GET that fell back to the default project is visible.
 */
import type { FastifyInstance } from "fastify";
import { activePaths, type ProjectPaths } from "../../projects.ts";
import {
  WORKSPACE_STATE_MAX_BYTES,
  type GeoWorkspaceStateResponse,
  type GeoWorkspaceStateSaved,
} from "../../../../web/src/geo/contracts/workspace-state.ts";
import {
  parseWorkspaceStateBody,
  readWorkspaceState,
  WorkspaceStateError,
  writeWorkspaceState,
} from "../workspace/workspace-state.ts";

export interface GeoWorkspaceStateRouteOptions {
  paths?: () => ProjectPaths;
}

export async function registerGeoWorkspaceStateRoutes(
  app: FastifyInstance,
  options: GeoWorkspaceStateRouteOptions = {},
): Promise<void> {
  const pathsOf = options.paths ?? activePaths;

  app.get("/geo/workspace-state", async (_req, reply) => {
    const paths = pathsOf();
    try {
      const response: GeoWorkspaceStateResponse = { projectId: paths.id, record: readWorkspaceState(paths) };
      return response;
    } catch (err) {
      if (err instanceof WorkspaceStateError) return reply.code(err.statusCode).send({ detail: err.message });
      throw err;
    }
  });

  app.put(
    "/geo/workspace-state",
    { bodyLimit: WORKSPACE_STATE_MAX_BYTES + 64 * 1024 },
    async (req, reply) => {
      const paths = pathsOf();
      try {
        const { state, clientId } = parseWorkspaceStateBody(req.body);
        const record = writeWorkspaceState(paths, state, clientId);
        const response: GeoWorkspaceStateSaved = {
          projectId: paths.id,
          revision: record.revision,
          savedAt: record.savedAt,
        };
        return response;
      } catch (err) {
        if (err instanceof WorkspaceStateError) return reply.code(err.statusCode).send({ detail: err.message });
        throw err;
      }
    },
  );
}
