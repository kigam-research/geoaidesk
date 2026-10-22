/**
 * Stable server API for the shelf, Workflow pins and authoring suggestions:
 * HubSkillRecordStore (records.ts; local HubSkillStore(root = sharedDir()), remote hub-client/remote-skills.ts, hub server
 * hub-server/skills.ts); activeHubSkillStore() picks the hub server shelf when logged in; readHubSkillRevision(store,id,revision) -> {skill, revision, archive}
 * (hash-checked internal read); installHubSkillRevision(store,{skillId,revision,projectId,acknowledged},{agentDir?});
 * listHubSkills(store,{q?,user?}) (licence/visibility filtered). HTTP reads enforce per-revision visibility separately.
 */
export { HubSkillStore } from "./store.ts";
export { revisionState, type HubSkillRecordStore } from "./records.ts";
export { activeHubSkillStore } from "./active.ts";
export { readHubSkillRevision, listHubSkills } from "./view.ts";
export { installHubSkillRevision, previewHubSkillInstall } from "./install.ts";
export { previewHubSkill, registerHubSkill } from "./register.ts";
export { registerHubSkillRoutes } from "./routes.ts";
