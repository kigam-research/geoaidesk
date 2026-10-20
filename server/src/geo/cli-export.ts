/** Portable Workflow documents and bounded Agent Skills ZIPs. No installation or model calls. */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import type { ProjectPaths } from "../projects.ts";
import { loadGeoCatalogue, type GeoCatalogue } from "./catalogue.ts";
import { GEO_CATALOGUE_MODE } from "../config.ts";
import { findInstalledMethod } from "./methods/local-methods.ts";
import { LOCAL_SKILL_PREFIX } from "../../../web/src/geo/contracts/methods.ts";
import type { GeoWorkflow } from "./catalogue-types.ts";
import { catalogueProcedure, packageProcedure, procedureSteps, workflowDocFor, workflowDocSay } from "./workflow-doc.ts";
import { renderWorkflowDocument, type WorkflowDoc } from "../../../web/src/geo/contracts/workflow-doc.ts";
import { SKILL_HUB_LIMITS } from "./skill-hub.ts";
import { readTar, safeEntryPath } from "./tar.ts";
import { SharedHubStore } from "./hub-shared/store.ts";

// Only targets verified with their real PC74 CLI are offered (task evidence records versions and probes).
export const CLI_TARGETS = ["pi", "claude"] as const;
export type CliTarget = typeof CLI_TARGETS[number];
export class CliExportError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export interface CliSource {
  doc: WorkflowDoc;
  /** File names are relative to the individual skill folder. */
  files: Map<string, { path: string; data: Buffer; mode: number }[]>;
  missing: string[];
}
type SkillFiles = { path: string; data: Buffer; mode: number }[];
export function cliCatalogue(): GeoCatalogue | null {
  return GEO_CATALOGUE_MODE ? loadGeoCatalogue() : null;
}
const nameOf = (value: string) => {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) throw new CliExportError("Invalid Workflow or skill name", 400);
  return value;
};
const budget = () => ({ entries: 0, bytes: 0 });
function account(b: ReturnType<typeof budget>, bytes: number) {
  if (++b.entries > SKILL_HUB_LIMITS.entries || (b.bytes += bytes) > SKILL_HUB_LIMITS.expanded)
    throw new CliExportError("CLI export exceeds the package size limit", 413);
}
/** Refuse links at the skill root and in its parents, as well as within the tree. */
function noLinks(dir: string) {
  for (let at = path.resolve(dir); ; at = path.dirname(at)) {
    if (fs.lstatSync(at).isSymbolicLink()) throw new CliExportError("Skill links cannot be exported");
    if (path.dirname(at) === at) break;
  }
}
function tree(dir: string, b: ReturnType<typeof budget>): SkillFiles {
  noLinks(dir);
  const files: { path: string; data: Buffer; mode: number }[] = [];
  function walk(base: string, rel: string) {
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (/^\.env/.test(entry.name) || ["secrets", "secure"].includes(entry.name) || /\.(pem|key)$/.test(entry.name))
        throw new CliExportError("Skill contains a private file; remove it before exporting");
      const key = safeEntryPath(rel ? `${rel}/${entry.name}` : entry.name);
      const file = path.join(base, entry.name);
      const stat = fs.lstatSync(file);
      if (stat.isDirectory()) { account(b, 0); walk(file, key); }
      else if (stat.isFile()) {
        account(b, stat.size);
        const data = fs.readFileSync(file);
        if (data.length !== stat.size) throw new CliExportError("Skill changed during export; retry");
        files.push({ path: key, data, mode: stat.mode });
      } else throw new CliExportError("Skill links and special files cannot be exported");
    }
  }
  walk(dir, "");
  if (!files.some(f => f.path === "SKILL.md")) throw new CliExportError("Skill has no SKILL.md");
  return files;
}
function resolveFiles(doc: WorkflowDoc, paths: ProjectPaths, catalogue: GeoCatalogue | null, bundled?: { name: string; dir?: string; files?: SkillFiles }): CliSource {
  const files: CliSource["files"] = new Map();
  const missing: string[] = [];
  const b = budget();
  for (const skill of doc.skills) {
    nameOf(skill.name);
    if (files.has(skill.name) || missing.includes(skill.name)) continue;
    if (skill.source === "bundled" && bundled?.name === skill.name && bundled.files) {
      for (const f of bundled.files) account(b, f.data.length);
      files.set(skill.name, bundled.files);
      continue;
    }
    const entry = catalogue?.index.skills.find(s => s.runtimeName === skill.name || s.id === skill.name);
    let dir: string | undefined;
    if (skill.source === "catalogue" && entry && catalogue)
      dir = path.join(catalogue.root, safeEntryPath(entry.packageRef));
    else if (skill.source === "bundled" && bundled?.name === skill.name) dir = bundled.dir;
    else if (skill.source === "imported") dir = path.join(paths.skillsDir, skill.name);
    if (!dir || !fs.existsSync(dir)) {
      if (skill.source === "imported") { missing.push(skill.name); continue; }
      throw new CliExportError(`Required skill is unavailable: ${skill.name}`);
    }
    files.set(skill.name, tree(dir, b));
  }
  return { doc, files, missing };
}
function skillsFor(workflow: GeoWorkflow, catalogue: GeoCatalogue | null, bundled?: string) {
  return workflow.skillIds.map(id => {
    if (id.startsWith(LOCAL_SKILL_PREFIX) && bundled) return { name: bundled, source: "bundled" as const };
    const entry = catalogue?.index.skills.find(s => s.id === id);
    return { name: entry?.runtimeName ?? id, title: entry?.title, source: "catalogue" as const };
  });
}
export function projectCliSource(paths: ProjectPaths, catalogue: GeoCatalogue | null, id: string, method?: string): CliSource {
  nameOf(id);
  if (method) {
    nameOf(method);
    const installed = findInstalledMethod(paths, method);
    const file = installed?.file.method;
    const workflow = file?.workflows.find(w => w.id === id);
    if (!installed || !file || !workflow) throw new CliExportError("Workflow was not found", 404);
    const doc = workflowDocFor(workflow, { revision: file.revision, skills: skillsFor(workflow, catalogue, method), procedure: packageProcedure(installed.dir) });
    return resolveFiles(doc, paths, catalogue, { name: method, dir: installed.dir });
  }
  const workflow = catalogue?.workflows.find(w => w.id === id);
  if (!workflow || !catalogue) throw new CliExportError("Workflow was not found", 404);
  return resolveFiles(workflowDocFor(workflow, { skills: skillsFor(workflow, catalogue), procedure: catalogueProcedure(catalogue, workflow.skillIds[0] ?? "") }), paths, catalogue);
}
export async function hubCliSource(paths: ProjectPaths, catalogue: GeoCatalogue | null, store: SharedHubStore, id: string): Promise<CliSource> {
  const record = await store.read(id);
  const snapshot = record.snapshots[record.entry.latestRevision];
  if (!snapshot?.draft.workflow) throw new CliExportError("Workflow was not found", 404);
  const archive = await store.bytes(id, `packages/${record.entry.latestRevision}.tar.gz`);
  if (archive.length > SKILL_HUB_LIMITS.compressed) throw new CliExportError("Package exceeds the size limit", 413);
  if (archive.length !== snapshot.package.size || createHash("sha256").update(archive).digest("hex") !== snapshot.package.sha256)
    throw new CliExportError("Package does not match the registered revision");
  const slug = nameOf(snapshot.draft.slug);
  let entries;
  try { entries = readTar(zlib.gunzipSync(archive, { maxOutputLength: SKILL_HUB_LIMITS.expanded })); }
  catch { throw new CliExportError("Package is not a safe, bounded archive"); }
  if (entries.length > SKILL_HUB_LIMITS.entries) throw new CliExportError("Package exceeds the entry limit", 413);
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.path) || (entry.path !== slug && !entry.path.startsWith(`${slug}/`))) throw new CliExportError("Package has duplicate or unexpected paths");
    seen.add(entry.path);
  }
  const files = entries.filter(e => e.type === "file").map(e => ({ ...e, path: e.path.slice(slug.length + 1) }));
  if (!files.some(f => f.path === "SKILL.md")) throw new CliExportError("Package has no SKILL.md");
  const workflow = snapshot.draft.workflow as unknown as GeoWorkflow;
  const doc = workflowDocFor(workflow, { revision: record.entry.latestRevision, skills: skillsFor(workflow, catalogue, slug), procedure: procedureSteps(snapshot.draft.profile) });
  return resolveFiles(doc, paths, catalogue, { name: slug, files });
}
export function buildCliZip(source: CliSource, target: CliTarget, locale: "ko" | "en", limits = SKILL_HUB_LIMITS): Buffer {
  if (!CLI_TARGETS.includes(target)) throw new CliExportError("CLI target has not been verified", 400);
  const id = nameOf(source.doc.id);
  const base = target === "pi" ? ".pi" : ".claude";
  const command = `${base}/${target === "pi" ? "prompts" : "commands"}/${id}.md`;
  const title = (locale === "en" ? source.doc.title.en ?? source.doc.title.ko : source.doc.title.ko).replace(/[\r\n]/g, " ");
  const body = renderWorkflowDocument(source.doc, { target: "cli", locale, say: workflowDocSay(locale) });
  const zip = new AdmZip();
  let count = 0, bytes = 0;
  const add = (key: string, data: Buffer, mode = 0o644) => {
    safeEntryPath(key);
    if (++count > limits.entries || (bytes += data.length) > limits.expanded) throw new CliExportError("CLI export exceeds the package size limit", 413);
    zip.addFile(key, data, "", mode & 0o111 ? 0o755 : 0o644);
  };
  add(command, Buffer.from(`---\ndescription: ${JSON.stringify(title)}\nargument-hint: "[input files and analysis conditions]"\n---\n${body}\n`));
  for (const [name, files] of source.files) {
    nameOf(name);
    for (const file of files) add(`${base}/skills/${name}/${safeEntryPath(file.path)}`, file.data, file.mode);
  }
  const cli = target === "pi" ? "pi" : "claude";
  const missing = source.missing.length ? source.missing.map(n => `- ${n}`).join("\n") : "없음 / None";
  add("README.md", Buffer.from(`# ${title}\n\n## 한국어\n1. 새 작업 폴더에 ZIP을 풉니다. 숨김 폴더 ${base}도 그대로 둡니다.\n2. 이 폴더에서 ${cli}를 실행합니다. 프로젝트 파일 신뢰 안내가 나오면 내용을 확인합니다.\n3. /${id} 뒤에 입력 파일과 분석 조건을 적어 보냅니다. 비워 두면 AI agent가 필요한 조건을 묻습니다.\n\n지침: ${command}\n스킬: ${base}/skills/\n분석 환경과 자료는 포함하지 않습니다. 스킬 지침의 준비 절차를 따릅니다. 기존 폴더에 풀 때 같은 이름의 파일을 덮어쓰지 않도록 확인합니다.\n\n## English\n1. Unpack into a new working folder, keeping the hidden ${base} folder.\n2. Run ${cli} in that folder. Review any project-file trust prompt.\n3. Send /${id} followed by input files and analysis conditions. With no arguments, the AI agent asks for the required settings.\n\nInstructions: ${command}\nSkills: ${base}/skills/\nData and analysis environments are not included. Follow the skills' setup instructions. Check for same-name files before unpacking into an existing folder.\n\n## 포함하지 못한 가져온 스킬 / Missing imported skills\n${missing}\n\n위 스킬이 있으면 별도로 설치한 뒤 시작합니다. / Install any listed skills before starting.\n`));
  const result = zip.toBuffer();
  if (result.length > limits.compressed) throw new CliExportError("CLI export exceeds the compressed size limit", 413);
  return result;
}
