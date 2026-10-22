/**
 * State of a pinned hub skill in a project (gaid-hub-skills, ADR docs/adr/2026-10-22-hub-managed-skills.md). Pure
 * read: compares the project copy with the pinned revision's tree hash and the install's origin record. Python bytecode
 * caches are ignored, like method trial checks. `suspended` is decided by the caller from the hub record.
 */
import type { HubSkillInstallState, HubSkillRef } from "../../../../web/src/geo/contracts/hub-skills.ts";
import { findSkillDir, type SkillScopeRef } from "../../agent/skills.ts";
import { getSkillBaseHash, getSkillProvenance } from "../../agent/skills-sync.ts";
import { originOfSource, packageStore } from "./package-origin.ts";
import { methodTreeHash } from "./tree-hash.ts";

export function hubSkillInstallState(
  root: SkillScopeRef,
  pin: HubSkillRef,
  options: { agentDir?: string; suspended?: boolean } = {},
): HubSkillInstallState {
  if (options.suspended) return "suspended";
  const dir = findSkillDir(root, pin.skillId);
  if (!dir) return "missing";
  const current = methodTreeHash(dir);
  const origin = originOfSource(getSkillProvenance(root, pin.skillId)?.source, packageStore(options.agentDir)).origin;
  if (origin.kind !== "gaid-hub-skill" || origin.hubSkill?.id !== pin.skillId) return current === pin.treeHash ? "installed" : "conflict";
  const base = getSkillBaseHash(root, pin.skillId);
  if (base && current !== base) return "edited";
  return current === pin.treeHash ? "installed" : "other-revision";
}
