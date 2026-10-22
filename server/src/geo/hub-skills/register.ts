/** Registration snapshots all source bytes before inspecting/publishing; previews never publish shelf records. */
import { join } from "node:path";
import type { HubSkillOrigin, RegisterSkillBody, RegisterSkillPreview, RegisterSkillSource } from "../../../../web/src/geo/contracts/hub-skills.ts";
import { previewSkillSource } from "../../agent/skills-install.ts";
import { readStagedLock, stagedSkillsDir, stagingDirFor } from "../../agent/skills-fetch.ts";
import { findSkillDir, projectSkillRoot } from "../../agent/skills.ts";
import { getSkillProvenance } from "../../agent/skills-sync.ts";
import { DEFAULT_PROJECT_ID } from "../../config.ts";
import { getProject, resolvePaths } from "../../projects.ts";
import { AuthoringError, now } from "../authoring/store.ts";
import { originOfSource, packageStore } from "../methods/package-origin.ts";
import { skillHubCatalogue } from "../skill-hub.ts";
import { buildArchive, digest, fileList, readArchive, snapshotDirectory, treeHash } from "./archive.ts";
import { scanSkill, shareable } from "./scan.ts";
import { HubSkillStore, validName, type StoredHubSkill } from "./store.ts";
import { revisionOf, skillView } from "./view.ts";

export interface RegistrationDeps {
  agentDir?: string;
  preview?: typeof previewSkillSource;
  catalogue?: typeof skillHubCatalogue;
}
export function projectPaths(id: string) {
  if (typeof id !== "string" || !getProject(id)) throw new AuthoringError("프로젝트를 찾을 수 없습니다.", 404);
  return resolvePaths(id);
}
function nameRequired(name: unknown): asserts name is string {
  if (!validName(name)) throw new AuthoringError("스킬 이름은 64자 이내의 영문 소문자, 숫자와 하이픈으로 입력해 주세요.");
}
const sourceText = (s: unknown) => {
  if (typeof s !== "string" || !s.trim() || s.length > 4000) throw new AuthoringError("스킬 원본 경로를 확인해 주세요.");
  return s.trim();
};
async function sourceSnapshot(store: HubSkillStore, body: RegisterSkillSource, deps: RegistrationDeps) {
  if (body?.from === "project") {
    nameRequired(body.name);
    const root = projectSkillRoot(projectPaths(body.projectId));
    const dir = findSkillDir(root, body.name);
    if (!dir) throw new AuthoringError("프로젝트에서 스킬을 찾을 수 없습니다.", 404);
    const p = getSkillProvenance(root, body.name);
    const staged = originOfSource(p?.source, packageStore(deps.agentDir));
    let origin: HubSkillOrigin = { kind: "own" };
    if (staged.record?.hubSkill) {
      const original = await store.find(staged.record.hubSkill.id);
      if (original) origin = revisionOf(original, staged.record.hubSkill.revision).origin;
    } else if (p?.source && (staged.origin.kind === "other" || staged.record?.kind === "skill-hub")) {
      origin = { kind: "github", source: staged.record?.pageUrl ?? p.source, ...(p.ref ? { ref: p.ref } : {}), ...(p.skillPath ? { path: p.skillPath } : {}), ...(staged.record?.fetchedAt ? { fetchedAt: staged.record.fetchedAt } : {}) };
    }
    return { name: body.name, entries: snapshotDirectory(dir), origin };
  }
  if (body?.from === "workflow") {
    const record = await store.shared.read(body.entryId);
    if (!Number.isSafeInteger(body.revision) || body.revision < 1 || !Object.hasOwn(record.snapshots, String(body.revision)))
      throw new AuthoringError("Workflow 판을 찾을 수 없습니다.", 404);
    const snapshot = record.snapshots[body.revision];
    const archive = await store.shared.bytes(body.entryId, `packages/${body.revision}.tar.gz`);
    if (digest(archive) !== snapshot.package.sha256) throw new AuthoringError("Workflow 압축 파일의 해시가 맞지 않습니다.", 409);
    const name = snapshot.package.slug;
    nameRequired(name);
    // These root files belong to the Workflow package, not to the extracted runtime skill.
    const entries = readArchive(archive, name).filter((e) => !["gaid-method.json", "atlas.yaml"].includes(e.path));
    return { name, entries, origin: { kind: "workflow", workflow: { entryId: body.entryId, revision: body.revision, title: record.entry.title } } satisfies HubSkillOrigin };
  }
  if (body?.from === "source") {
    const source = sourceText(body.source);
    const preview = await (deps.preview ?? previewSkillSource)(resolvePaths(DEFAULT_PROJECT_ID), { source, scope: "project" });
    const choices = preview.skills.map((s) => s.name);
    if (!body.name && choices.length > 1) return { choices };
    const name = body.name ?? choices[0];
    nameRequired(name);
    if (!choices.includes(name)) throw new AuthoringError("원본에서 선택한 스킬을 찾을 수 없습니다.", 404);
    const staging = stagingDirFor(preview.stagingKey);
    const lock = readStagedLock(staging)[name];
    const origin: HubSkillOrigin = { kind: "github", source, fetchedAt: now(), ...(preview.ref ?? lock?.ref ? { ref: preview.ref ?? lock?.ref } : {}), ...(lock?.skillPath ? { path: lock.skillPath } : {}) };
    return { name, entries: snapshotDirectory(join(stagedSkillsDir(staging), name)), origin };
  }
  throw new AuthoringError("등록할 스킬 원본을 선택해 주세요.");
}
async function prepare(store: HubSkillStore, body: RegisterSkillSource, user: string, deps: RegistrationDeps) {
  const snapshot = await sourceSnapshot(store, body, deps);
  if ("choices" in snapshot) {
    const preview: RegisterSkillPreview = { name: "", description: "", files: [], treeHash: "", origin: { kind: "github", source: body.from === "source" ? body.source : "" }, licence: { state: "unknown" }, findings: [], choices: snapshot.choices };
    return { preview, snapshot: null };
  }
  const scanned = scanSkill(snapshot.name, snapshot.entries, snapshot.origin);
  const hash = treeHash(snapshot.entries);
  const previous = await store.find(snapshot.name);
  const catalogue = (deps.catalogue ?? skillHubCatalogue)();
  // An unavailable catalogue must not let a user reserve one of its names accidentally.
  let blocked = !catalogue.available ? "기본 스킬 목록을 읽지 못했습니다. 목록을 준비한 뒤 다시 등록하세요." : undefined;
  if (catalogue.skills.some((s) => s.runtimeName === snapshot.name)) blocked = "기본 스킬과 같은 이름으로 등록할 수 없습니다. 프로젝트에서 이름을 바꾼 뒤 등록하세요.";
  if (scanned.findings.some((f) => f.kind === "format")) blocked = "SKILL.md 형식을 고친 뒤 다시 확인하세요.";
  if (previous && previous.author !== user) blocked = "다른 연구자가 같은 이름의 스킬을 등록했습니다. 프로젝트에서 이름을 바꾼 뒤 등록하세요.";
  const sameTree = previous ? revisionOf(previous).treeHash === hash : false;
  if (previous?.author === user && sameTree) blocked = "최신 판과 내용이 같습니다. 스킬을 고친 뒤 새 판을 등록하세요.";
  const preview: RegisterSkillPreview = {
    name: snapshot.name, description: scanned.description, files: fileList(snapshot.entries), treeHash: hash,
    origin: snapshot.origin, licence: scanned.licence, findings: scanned.findings,
    ...(previous ? { existing: { id: previous.id, latestRevision: previous.latestRevision, mode: previous.author === user ? "next" : "taken", sameTree } as const } : {}),
    ...(blocked ? { blocked } : {}),
  };
  return { preview, snapshot };
}
export async function previewHubSkill(store: HubSkillStore, body: RegisterSkillSource, user: string, deps: RegistrationDeps = {}) {
  return (await prepare(store, body, user, deps)).preview;
}
const texts = (values: unknown, label: string): string[] => {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.length > 40 || values.some((s) => typeof s !== "string" || !s.trim() || s.length > 100))
    throw new AuthoringError(`${label} 형식을 확인해 주세요.`);
  return [...new Set(values.map((s: string) => s.trim()))];
};
export async function registerHubSkill(store: HubSkillStore, body: RegisterSkillBody, user: string, deps: RegistrationDeps = {}) {
  if (typeof body?.treeHash !== "string" || !/^[a-f0-9]{64}$/.test(body.treeHash)) throw new AuthoringError("스킬을 먼저 확인해 주세요.");
  if (typeof body.note !== "string" || body.note.length > 4000) throw new AuthoringError("바뀐 점은 4000자 이내로 입력해 주세요.");
  if (!(await store.shared.folders()).some((f) => f.id === body.folderId)) throw new AuthoringError("주제 폴더를 찾을 수 없습니다.", 404);
  const tags = texts(body.tags, "태그"), formats = texts(body.formats, "자료 형식");
  const { preview, snapshot } = await prepare(store, body, user, deps);
  if (!snapshot) throw new AuthoringError("등록할 스킬을 하나 선택해 주세요.");
  if (preview.blocked) throw new AuthoringError(preview.blocked, 409);
  if (preview.treeHash !== body.treeHash) throw new AuthoringError("확인한 뒤 원본 스킬이 바뀌었습니다. 다시 확인해 주세요.", 409);
  return store.serial(preview.name, async () => {
    const previous = await store.find(preview.name);
    if (previous && previous.author !== user) throw new AuthoringError("등록한 연구자만 새 판을 등록할 수 있습니다.", 403);
    if (previous && revisionOf(previous).treeHash === preview.treeHash) throw new AuthoringError("최신 판과 내용이 같습니다.", 409);
    const revision = (previous?.latestRevision ?? 0) + 1;
    const archive = buildArchive(preview.name, snapshot.entries, revision);
    const at = now();
    const record: StoredHubSkill = {
      id: preview.name, name: preview.name, description: preview.description, author: previous?.author ?? user,
      tags, formats, folderId: body.folderId, latestRevision: revision, state: "unreviewed", visibility: shareable(preview.licence) ? "hub" : "author", updatedAt: at,
      revisions: [...(previous?.revisions ?? []), { revision, archiveSha256: digest(archive), size: archive.length, treeHash: preview.treeHash, files: preview.files, description: preview.description, note: body.note.trim(), registeredAt: at, registeredBy: user, origin: preview.origin, licence: preview.licence, findings: preview.findings, reviews: [] }],
    };
    await store.publish(record.id, revision, archive);
    await store.write(record);
    return skillView(store, record, user);
  });
}
