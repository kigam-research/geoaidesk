/** Synchronous row annotation, matching skillWorkflow's read-only projection. Missing shelf keeps the pin visible. */
import fs from "node:fs";
import { join } from "node:path";
import type { InstalledHubSkill } from "../../../../web/src/geo/contracts/hub-skills.ts";
import { findSkillDir, type SkillRoot } from "../../agent/skills.ts";
import { originOfSource } from "../methods/package-origin.ts";
import { methodTreeHash } from "../methods/tree-hash.ts";
import { sharedDir } from "../hub-shared/store.ts";
import { remoteSkillRecord } from "./active.ts";
import { revisionState, validName, type StoredHubSkill } from "./records.ts";
export function installedHubSkill(root: SkillRoot, name: string, source?: string): InstalledHubSkill | undefined {
  const origin = originOfSource(source).record;
  if (origin?.kind !== "gaid-hub-skill" || !origin.hubSkill || !validName(origin.hubSkill.id)) return undefined;
  const pin = origin.hubSkill;
  const dir = findSkillDir(root, name);
  let latestRevision: number | null = null;
  let state: InstalledHubSkill["state"] = "unreviewed";
  const shown = (skill: StoredHubSkill) => {
    latestRevision = skill.latestRevision;
    const revision = skill.revisions.find((r) => r.revision === pin.revision);
    if (revision) state = revisionState(revision);
  };
  // With a hub server, the last record the shelf saw (none yet: latest unknown); otherwise the local shelf file.
  const remote = remoteSkillRecord(pin.id);
  if (remote) shown(remote);
  else if (remote === undefined) try {
    const record = JSON.parse(fs.readFileSync(join(sharedDir(), "skills", pin.id, "skill.json"), "utf8")) as { schemaVersion: string; skill: StoredHubSkill };
    if (record.schemaVersion === "gaid-hub-skill/v1" && record.skill.id === pin.id) shown(record.skill);
  } catch { /* Removed/unavailable shelf: still display the immutable installed pin. */ }
  return { id: pin.id, revision: pin.revision, latestRevision, state, edited: !dir || methodTreeHash(dir) !== pin.treeHash };
}
