import { HubSkillStore } from "../hub-skills/store.ts";
import { registerHubSkillRoutes } from "../hub-skills/routes.ts";
import type { FastifyInstance } from "fastify";
import { registerSharedHubRoutes } from "../hub-shared/routes.ts";
import { localHubStore } from "../hub-shared/active.ts";

/** Institute-shared GAID hub, mounted after authoring so both use its live store. */
export async function registerGeoHubSharedRoutes(app: FastifyInstance): Promise<void> {
  await registerSharedHubRoutes(app);
  // Hub-managed skills (gaid-hub-skills) stay in the local hub store; they do not reach the institute hub server yet.
  await registerHubSkillRoutes(app, { store: new HubSkillStore(localHubStore().root) });
}
