/**
 * Stable server API for the shelf, Workflow pins and authoring suggestions:
 * HubSkillStore(root = sharedDir()); readHubSkillRevision(store,id,revision) -> {skill, revision, archive}
 * (hash-checked internal read); installHubSkillRevision(store,{skillId,revision,projectId,acknowledged},{agentDir?});
 * listHubSkills(store,{q?,user?}) (licence/visibility filtered). HTTP reads enforce per-revision visibility separately.
 */
export { HubSkillStore, revisionState } from "./store.ts";
export { readHubSkillRevision, listHubSkills } from "./view.ts";
export { installHubSkillRevision, previewHubSkillInstall } from "./install.ts";
export { previewHubSkill, registerHubSkill } from "./register.ts";
export { registerHubSkillRoutes } from "./routes.ts";
