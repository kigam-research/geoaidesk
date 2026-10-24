import type { FastifyInstance } from "fastify";
import { workspaceHome, type WorkspaceHomeOptions } from "../workspace/home.ts";

/** Global, read-only summary. Deliberately does not call activePaths() or resolve a project header. */
export async function registerGeoWorkspaceHomeRoutes(app: FastifyInstance, options: WorkspaceHomeOptions = {}): Promise<void> {
  app.get("/geo/workspace/home", async () => workspaceHome(options));
}
