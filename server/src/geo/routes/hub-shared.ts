import { HubSkillStore } from "../hub-skills/store.ts";
import { registerHubSkillRoutes } from "../hub-skills/routes.ts";
import type { FastifyInstance } from "fastify";
import { registerSharedHubRoutes } from "../hub-shared/routes.ts";

/** Institute-shared GAID hub, mounted after authoring so both use its live store. */
export async function registerGeoHubSharedRoutes(app: FastifyInstance): Promise<void> {
  const shared = await registerSharedHubRoutes(app);
  await registerHubSkillRoutes(app, { store: new HubSkillStore(shared.root) });
}
