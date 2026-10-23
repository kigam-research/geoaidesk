/** Existing staged-source gate, with exact immutable hub revision and destination edit checks. */
import { join } from "node:path";
import type { InstallSkillPreview, InstallSkillResult } from "../../../../web/src/geo/contracts/hub-skills.ts";
import { installStagedSkills, previewSkillSource } from "../../agent/skills-install.ts";
import { findSkillDir, projectSkillRoot } from "../../agent/skills.ts";
import { getSkillBaseHash, getSkillProvenance, hashDirectory } from "../../agent/skills-sync.ts";
import { AuthoringError, now } from "../authoring/store.ts";
import { hubSkillInstallState } from "../methods/hub-pins.ts";
import { originOfSource, packageStore, writePackageOrigin } from "../methods/package-origin.ts";
import { methodTreeHash, removeRegenerableCaches } from "../methods/tree-hash.ts";
import { stageSkillHubPackage } from "../skill-hub.ts";
import { projectPaths } from "./register.ts";
import { revisionState, type HubSkillRecordStore } from "./records.ts";
import { readHubSkillRevision } from "./view.ts";

export interface HubSkillInstallDeps { agentDir?: string }
export async function previewHubSkillInstall(store: HubSkillRecordStore, skillId: string, revision: number, projectId: string, deps: HubSkillInstallDeps = {}): Promise<InstallSkillPreview> {
  const { skill, revision: r } = await readHubSkillRevision(store, skillId, revision);
  const root = projectSkillRoot(projectPaths(projectId));
  let project = hubSkillInstallState(root, { skillId, revision, treeHash: r.treeHash }, { ...deps, suspended: revisionState(r) === "suspended" });
  const existing = findSkillDir(root, skill.name);
  const origin = originOfSource(getSkillProvenance(root, skill.name)?.source, packageStore(deps.agentDir)).origin;
  if (project !== "suspended" && existing && (origin.kind !== "gaid-hub-skill" || origin.hubSkill?.id !== skillId)) project = "conflict";
  return { name: skill.name, revision, files: r.files.map((f) => f.path), hasCode: r.files.some((f) => /(?:^scripts\/|\.(?:py|sh|js|mjs|ts|ps1|r|bat|cmd)$)/i.test(f.path)), licence: r.licence, findings: r.findings, state: revisionState(r), project };
}
export async function installHubSkillRevision(
  store: HubSkillRecordStore,
  body: { skillId: string; revision: number; projectId: string; acknowledged: boolean },
  deps: HubSkillInstallDeps = {},
): Promise<InstallSkillResult> {
  if (body?.acknowledged !== true) throw new AuthoringError("스킬이 프로젝트에서 코드를 실행할 수 있음을 확인해 주세요.");
  const paths = projectPaths(body.projectId);
  return store.serial(body.skillId, () => store.serial(`project:${body.projectId}`, async () => {
    const { skill, revision: r, archive } = await readHubSkillRevision(store, body.skillId, body.revision);
    if (revisionState(r) === "suspended") throw new AuthoringError("사용 중지된 스킬 version은 설치할 수 없습니다.", 409);
    const root = projectSkillRoot(paths);
    const existingDir = findSkillDir(root, skill.name);
    let checkedHash: string | undefined;
    if (existingDir) {
      const existing = getSkillProvenance(root, skill.name);
      const origin = originOfSource(existing?.source, packageStore(deps.agentDir)).origin;
      if (origin.kind !== "gaid-hub-skill" || origin.hubSkill?.id !== skill.id)
        throw new AuthoringError(`프로젝트에 같은 이름의 다른 스킬이 있습니다: ${skill.name}. 그 스킬을 지운 뒤 다시 설치하세요.`, 409);
      const base = getSkillBaseHash(root, skill.name);
      if (!base || methodTreeHash(existingDir) !== base)
        throw new AuthoringError(`프로젝트에서 고친 ${skill.name} 스킬이 있어 덮어쓰지 않았습니다. 고친 내용을 옮겨 두거나 그 스킬을 지운 뒤 다시 설치하세요.`, 409);
      if (base === r.treeHash) return { name: skill.name, revision: r.revision, installed: false };
      removeRegenerableCaches(existingDir);
      checkedHash = hashDirectory(existingDir);
    }
    let staged: ReturnType<typeof stageSkillHubPackage>;
    try { staged = stageSkillHubPackage(archive, { agentDir: deps.agentDir, expectedSlug: skill.name }); }
    catch { throw new AuthoringError("저장된 스킬을 설치 준비하지 못했습니다. 파일을 확인해 주세요.", 422); }
    if (methodTreeHash(join(staged.source, skill.name)) !== r.treeHash) throw new AuthoringError("설치할 스킬의 내용 지문이 등록 기록과 맞지 않습니다.", 409);
    writePackageOrigin(packageStore(deps.agentDir), { sha256: staged.sha256, kind: "gaid-hub-skill", hubSkill: { id: skill.id, revision: r.revision, treeHash: r.treeHash }, fetchedAt: now() });
    const preview = await previewSkillSource(paths, { source: staged.source, scope: "project" });
    if (!preview.skills.some((s) => s.name === skill.name)) throw new AuthoringError("저장된 파일에서 스킬을 찾지 못했습니다.", 422);
    // The CLI stages a second copy: verify it too, rather than trusting only the package extraction.
    const { stagedSkillsDir, stagingDirFor } = await import("../../agent/skills-fetch.ts");
    if (methodTreeHash(join(stagedSkillsDir(stagingDirFor(preview.stagingKey)), skill.name)) !== r.treeHash)
      throw new AuthoringError("설치 준비 중 스킬 내용이 바뀌었습니다. 다시 확인해 주세요.", 409);
    const result = await installStagedSkills(paths, { source: staged.source, names: [skill.name], scope: "project", stagingToken: preview.stagingToken, replace: !!existingDir, acknowledged: true, ...(checkedHash ? { expectedDestinationHashes: { [skill.name]: checkedHash } } : {}) });
    if (!result.installed.includes(skill.name)) throw new AuthoringError(`설치하는 동안 프로젝트의 ${skill.name} 스킬이 바뀌어 덮어쓰지 않았습니다. 고친 내용을 확인한 뒤 다시 설치하세요.`, 409);
    return { name: skill.name, revision: r.revision, installed: true };
  }));
}
