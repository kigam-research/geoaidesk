import { registerHubSkillRoutes } from "../hub-skills/routes.ts";
import type { FastifyInstance } from "fastify";
import { registerSharedHubRoutes } from "../hub-shared/routes.ts";

/** Institute-shared GAID hub, mounted after authoring so both use its live store. */
export async function registerGeoHubSharedRoutes(app: FastifyInstance): Promise<void> {
  await registerSharedHubRoutes(app);
  // Hub-managed skills (gaid-hub-skills) follow the same store choice: the hub server shelf when logged in, else local.
  await registerHubSkillRoutes(app);
}
