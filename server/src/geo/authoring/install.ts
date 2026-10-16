/**
 * Install an authored package into a GAID project through the same gate as hub and uploaded packages:
 * stage the archive under the hub package store, check gaid-method.json against the tree, record the origin
 * (`gaid-hub`, lifecycle draft), preview it, then install the reviewed bytes with the researcher's
 * acknowledgement. A project skill of the same name is replaced only when it came from the GAID hub too.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  AuthoringInstall,
  AuthoringProject,
  InstallBody,
  InstallResult,
  MethodPackageRecord,
} from "../../../../web/src/geo/contracts/authoring.ts";
import { installStagedSkills, previewSkillSource } from "../../agent/skills-install.ts";
import { projectSkillRoot } from "../../agent/skills.ts";
import { getSkillBaseHash, getSkillProvenance, hashDirectory } from "../../agent/skills-sync.ts";
import { getProject, resolvePaths } from "../../projects.ts";
import { readMethodFile, verifyMethodTree } from "../methods/method-file.ts";
import { originOfSource, packageStore, writePackageOrigin } from "../methods/package-origin.ts";
import { stageSkillHubPackage } from "../skill-hub.ts";
import { AuthoringError, now, type AuthoringStore } from "./store.ts";

export interface InstallDeps {
  agentDir?: string;
}

export async function installPackage(
  store: AuthoringStore,
  project: AuthoringProject,
  pkg: MethodPackageRecord,
  body: InstallBody,
  deps: InstallDeps = {},
): Promise<InstallResult> {
  if (body?.acknowledged !== true)
    throw new AuthoringError("초안 스킬이 프로젝트에서 코드를 실행할 수 있음을 확인해 주세요.", 400);
  if (typeof body.projectId !== "string" || !getProject(body.projectId))
    throw new AuthoringError("시험할 프로젝트를 찾을 수 없습니다.", 404);
  const paths = resolvePaths(body.projectId);
  const archive = await store.readFile(project.id, pkg.archive);

  let staged: { source: string; sha256: string };
  try {
    staged = stageSkillHubPackage(archive, { agentDir: deps.agentDir, expectedSlug: pkg.slug });
  } catch (e) {
    throw new AuthoringError(`패키지를 풀지 못했습니다: ${(e as Error).message}`, 422);
  }
  const skillDir = path.join(staged.source, pkg.slug);
  const file = fs.existsSync(skillDir) ? readMethodFile(skillDir, pkg.slug) : null;
  if (!file?.method || verifyMethodTree(skillDir, file.method).length)
    throw new AuthoringError("패키지 파일이 gaid-method.json 목록과 맞지 않습니다.", 422);

  const storeDir = packageStore(deps.agentDir);
  writePackageOrigin(storeDir, {
    sha256: staged.sha256,
    kind: "gaid-hub",
    hub: { methodId: pkg.methodId, revision: pkg.revision, lifecycle: "draft" },
    fetchedAt: now(),
  });

  // Never overwrite a project skill of the same name that did not come from the GAID hub.
  const root = projectSkillRoot(paths);
  const existing = getSkillProvenance(root, pkg.slug);
  const installedHere = fs.existsSync(path.join(root.skillsDir, pkg.slug));
  if (installedHere) {
    const origin = originOfSource(existing?.source, storeDir).origin;
    if (origin.kind !== "gaid-hub")
      throw new AuthoringError(
        `프로젝트에 같은 이름의 다른 스킬이 있습니다: ${pkg.slug}. 그 스킬을 지운 뒤 다시 설치하세요.`,
        409,
      );
    // A researcher's edits to the installed copy are never overwritten by a reinstall.
    const base = getSkillBaseHash(root, pkg.slug);
    if (base && hashDirectory(path.join(root.skillsDir, pkg.slug)) !== base)
      throw new AuthoringError(
        `프로젝트에서 고친 ${pkg.slug} 스킬이 있어 덮어쓰지 않았습니다. 고친 내용을 옮겨 두거나 그 스킬을 지운 뒤 다시 설치하세요.`,
        409,
      );
  }

  const preview = await previewSkillSource(paths, { source: staged.source, scope: "project" });
  const names = preview.skills.map((s) => s.name);
  if (!names.includes(pkg.slug)) throw new AuthoringError("패키지에서 스킬을 찾지 못했습니다.", 422);
  const result = await installStagedSkills(paths, {
    source: staged.source,
    names: [pkg.slug],
    scope: "project",
    stagingToken: preview.stagingToken,
    replace: installedHere,
    acknowledged: true,
  });
  if (!result.installed.includes(pkg.slug)) throw new AuthoringError("스킬을 설치하지 못했습니다.", 409);

  const install: AuthoringInstall = {
    packageRevision: pkg.revision,
    projectId: body.projectId,
    methodKey: `project:${pkg.slug}`,
    installedAt: now(),
  };
  await store.mutate(project.id, (p) => {
    p.installs.push(install);
  });
  const manifest = pkg.manifest as { workflows?: { id: string }[]; recipes?: { id: string }[] };
  return { install, workflowId: manifest.workflows?.[0]?.id ?? null, recipeId: manifest.recipes?.[0]?.id ?? null };
}
