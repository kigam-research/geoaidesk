/**
 * Hub skills pinned by an installed Workflow package (gaid-hub-skills, ADR docs/adr/2026-10-22-hub-managed-skills.md §6):
 * the install preview lists them and installing the Workflow installs the missing ones from the hub store, hash-checked,
 * never from GitHub. A pin that cannot be installed (suspended, foreign or edited same-name skill) is reported and left to
 * readiness; it never fails the Workflow install, which the researcher already acknowledged.
 */
import type { HubSkillInstallState, HubSkillRef } from "../../../../web/src/geo/contracts/hub-skills.ts";
import { projectSkillRoot } from "../../agent/skills.ts";
import type { ProjectPaths } from "../../projects.ts";
import { activeHubSkillStore, installHubSkillRevision, readHubSkillRevision, revisionState, type HubSkillRecordStore } from "../hub-skills/index.ts";
import { hubSkillInstallState } from "./hub-pins.ts";
import type { MethodFile } from "./method-file.ts";

export interface PinnedHubSkill {
  name: string;
  revision: number;
  /** State in the target project before (preview) or after (install) this action. */
  state: HubSkillInstallState;
  /** Install only: written now, already present, or left for readiness to explain. */
  outcome?: "installed" | "present" | "blocked";
}

/** Distinct hub pins of every gaid-workflow/v1 Workflow in the package. */
export function pinnedHubSkills(file: MethodFile | null): HubSkillRef[] {
  const pins = new Map<string, HubSkillRef>();
  for (const workflow of file?.workflows ?? [])
    for (const skill of (workflow.skills ?? []) as { name?: unknown; source?: unknown; hub?: Partial<HubSkillRef> }[]) {
      const hub = skill?.hub;
      if (skill?.source !== "hub" || typeof skill.name !== "string" || !hub || typeof hub.treeHash !== "string" || !Number.isSafeInteger(hub.revision)) continue;
      pins.set(`${skill.name}@${hub.revision}`, { skillId: skill.name, revision: hub.revision!, treeHash: hub.treeHash });
    }
  return [...pins.values()];
}

async function suspended(store: HubSkillRecordStore, pin: HubSkillRef): Promise<boolean> {
  try {
    const { revision } = await readHubSkillRevision(store, pin.skillId, pin.revision);
    return revisionState(revision) === "suspended" || revision.treeHash !== pin.treeHash;
  } catch {
    return true; // A pin the hub no longer has (or cannot verify) cannot be installed.
  }
}

export async function previewPinnedHubSkills(paths: ProjectPaths, file: MethodFile | null, options: { store?: HubSkillRecordStore; agentDir?: string } = {}): Promise<PinnedHubSkill[]> {
  const store = options.store ?? activeHubSkillStore();
  return Promise.all(pinnedHubSkills(file).map(async (pin) => ({
    name: pin.skillId,
    revision: pin.revision,
    state: hubSkillInstallState(projectSkillRoot(paths), pin, { agentDir: options.agentDir, suspended: await suspended(store, pin) }),
  })));
}

export async function installPinnedHubSkills(paths: ProjectPaths, file: MethodFile | null, options: { store?: HubSkillRecordStore; agentDir?: string } = {}): Promise<PinnedHubSkill[]> {
  const store = options.store ?? activeHubSkillStore();
  const out: PinnedHubSkill[] = [];
  for (const pin of pinnedHubSkills(file)) {
    const before = hubSkillInstallState(projectSkillRoot(paths), pin, { agentDir: options.agentDir, suspended: await suspended(store, pin) });
    if (before !== "missing") {
      out.push({ name: pin.skillId, revision: pin.revision, state: before, outcome: before === "installed" ? "present" : "blocked" });
      continue;
    }
    try {
      await installHubSkillRevision(store, { skillId: pin.skillId, revision: pin.revision, projectId: paths.id, acknowledged: true }, { agentDir: options.agentDir });
      out.push({ name: pin.skillId, revision: pin.revision, state: "installed", outcome: "installed" });
    } catch {
      out.push({ name: pin.skillId, revision: pin.revision, state: hubSkillInstallState(projectSkillRoot(paths), pin, { agentDir: options.agentDir }), outcome: "blocked" });
    }
  }
  return out;
}

/** Synchronous `suspended` lookup for readiness, from one read of every pinned revision. */
export async function hubSuspendedLookup(files: (MethodFile | null)[], store: HubSkillRecordStore = activeHubSkillStore()): Promise<(skillId: string, revision: number) => boolean> {
  const blocked = new Set<string>();
  const pins = new Map(files.flatMap((f) => pinnedHubSkills(f)).map((p) => [`${p.skillId}@${p.revision}`, p]));
  await Promise.all([...pins.values()].map(async (pin) => { if (await suspended(store, pin)) blocked.add(`${pin.skillId}@${pin.revision}`); }));
  return (skillId, revision) => blocked.has(`${skillId}@${revision}`);
}

/** Why a Workflow's hub pins cannot be registered for everyone (missing, changed, suspended or not shareable), in Korean. */
export async function hubPinProblems(skills: { name: string; source: string; hub?: HubSkillRef | null }[], store: HubSkillRecordStore = activeHubSkillStore()): Promise<string[]> {
  const problems: string[] = [];
  for (const skill of skills) {
    if (skill.source !== "hub") continue;
    const pin = skill.hub;
    if (!pin) { problems.push(`허브 스킬 ${skill.name}의 version 정보가 없습니다.`); continue; }
    try {
      const { revision } = await readHubSkillRevision(store, pin.skillId, pin.revision);
      if (revision.treeHash !== pin.treeHash) problems.push(`허브 스킬 ${skill.name} version ${pin.revision}의 내용이 초안에 기록한 것과 다릅니다.`);
      else if (revisionState(revision) === "suspended") problems.push(`허브 스킬 ${skill.name} version ${pin.revision}은 사용 중지되었습니다. 다른 version을 고르세요.`);
      else if (revision.licence.state !== "institute" && revision.licence.state !== "declared")
        problems.push(`허브 스킬 ${skill.name} version ${pin.revision}은 라이선스를 확인할 수 없어 다른 연구자에게 보이지 않습니다.`);
    } catch {
      problems.push(`허브 스킬 ${skill.name} version ${pin.revision}을 허브에서 찾을 수 없습니다.`);
    }
  }
  return problems;
}
