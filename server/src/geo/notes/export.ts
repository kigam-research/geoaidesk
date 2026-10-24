/**
 * Research-note exports (contract web/src/geo/contracts/note-export.ts): the result bundle for reviewers and the public
 * material export for manual upload to Gemini Notebook. Built on the evidence-package readers (bounded safe reads,
 * provenance and environment validation); nothing here runs analyses, calls models or contacts an outside service.
 */
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import type { ProjectPaths } from "../../projects.ts";
import { isUserVisible } from "../../sandbox-fs.ts";
import { geoStateDir } from "../context.ts";
import { artifactPath, bytesHash, hashEvidenceFile, readEvidenceBytes, type ReadBudget } from "../../evidence/storage.ts";
import { packageProvenance, storedEnvironment } from "../../evidence/provenance.ts";
import { findInstalledMethod } from "../methods/local-methods.ts";
import { packageStore, readPackageOrigin } from "../methods/package-origin.ts";
import { cliCatalogue, projectCliSource } from "../cli-export.ts";
import { localeSay, workflowDocSay } from "../workflow-doc.ts";
import { libraryStore, type LibraryStore } from "../library/store.ts";
import { storedPdf } from "../library/reader.ts";
import { formatReference } from "../library/formats/reference.ts";
import { researchNoteLocation, ResearchNoteError } from "./store.ts";
import { renderWorkflowDocument } from "../../../../web/src/geo/contracts/workflow-doc.ts";
import { hubRefVersion } from "../../../../web/src/geo/contracts/hub-version.ts";
import { parseCitations, type LibraryItem } from "../../../../web/src/geo/contracts/library.ts";
import type { ResearchNoteSummary } from "../../../../web/src/geo/contracts/research-notes.ts";
import type { EvidenceIssue } from "../../../../web/src/lib/evidence-packages.ts";
import {
  NOTE_BUNDLE_LIMITS, PUBLIC_EXPORT_LIMITS,
  type NoteBundleFile, type NoteBundleGap, type NoteBundlePart, type NoteBundlePreview, type NoteBundleReference, type NoteBundleWorkflow,
  type NoteDataFingerprint, type PublicExportCandidate, type PublicExportPreview, type PublicExportSkipped,
} from "../../../../web/src/geo/contracts/note-export.ts";

type Locale = "ko" | "en";
export interface NoteExportOptions { library?: () => LibraryStore; now?: () => Date }
interface Built { name: string; part: NoteBundlePart; data: Buffer }
const SHA = /^[a-f0-9]{64}$/;
/** Fixed entry time so the same content gives the same archive bytes. */
const ZIP_TIME = new Date(Date.UTC(2000, 0, 1));

export const localeOf = (value: unknown): Locale => (value === "en" ? "en" : "ko");

function zipOf(entries: { name: string; data: Buffer }[]): Buffer {
  const zip = new AdmZip();
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    zip.addFile(entry.name, entry.data);
    const added = zip.getEntry(entry.name);
    if (added) added.header.time = ZIP_TIME;
  }
  return zip.toBuffer();
}

const listDigest = (rows: unknown[]) => bytesHash(JSON.stringify(rows));

// --- Shared reads ---------------------------------------------------------------------------------------------------

/** Regular, visible files of the note folder (no links, no dot files), bounded. */
async function noteFolderFiles(paths: ProjectPaths, dir: string): Promise<{ rel: string; data: Buffer }[]> {
  const root = fs.realpathSync(paths.sandbox);
  const out: { rel: string; data: Buffer }[] = [];
  const budget: ReadBudget = { remaining: NOTE_BUNDLE_LIMITS.noteBytes };
  const walk = async (current: string, rel: string): Promise<void> => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".")) continue;
      const abs = path.join(current, entry.name), childRel = rel ? `${rel}/${entry.name.normalize("NFC")}` : entry.name.normalize("NFC");
      if (entry.isSymbolicLink() || !isUserVisible(abs, root)) continue;
      if (entry.isDirectory()) { await walk(abs, childRel); continue; }
      if (!entry.isFile()) continue;
      if (out.length >= NOTE_BUNDLE_LIMITS.noteFiles) throw new ResearchNoteError(413, "The note folder has too many files to bundle");
      try { out.push({ rel: childRel, data: await readEvidenceBytes(paths.id, abs, NOTE_BUNDLE_LIMITS.noteBytes, budget) }); }
      catch (error) {
        if ((error as { code?: string }).code === "READ_BUDGET") throw new ResearchNoteError(413, "The note folder is too large to bundle");
        throw error;
      }
    }
  };
  await walk(dir, "");
  return out;
}

interface TrialRecord { runtimeName: string; methodId: string | null; workflowId: string; packageSha256: string | null; treeHash?: string; startedAt: string }

/** The newest method-trial record among the note's chats (the Workflow chat the note came from). */
function noteTrial(paths: ProjectPaths, sessions: string[]): TrialRecord | null {
  for (const sessionId of [...sessions].reverse()) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(geoStateDir(paths), "method-trials", `${sessionId}.json`), "utf8")) as TrialRecord & { schemaVersion?: string };
      if (record?.schemaVersion === "gaid-method-trial/v1" && typeof record.runtimeName === "string" && typeof record.workflowId === "string") return record;
    } catch { /* not a Workflow chat */ }
  }
  return null;
}

interface NoteWorkflow { summary: NoteBundleWorkflow; instructions: string | null; record: Record<string, unknown> }

function noteWorkflow(paths: ProjectPaths, note: ResearchNoteSummary, locale: Locale): NoteWorkflow | null {
  const trial = noteTrial(paths, note.sessions);
  if (!trial || !trial.methodId) return null;
  const origin = trial.packageSha256 && SHA.test(trial.packageSha256) ? readPackageOrigin(packageStore(), trial.packageSha256) : null;
  const version = hubRefVersion(origin?.hubEntry ?? null);
  const installed = findInstalledMethod(paths, trial.runtimeName);
  const file = installed?.file.method && installed.file.method.methodId === trial.methodId ? installed.file.method : null;
  const title = file ? (file.title?.[locale] ?? file.title?.ko ?? file.title?.en ?? null) : null;
  let instructions: string | null = null;
  if (file) {
    try {
      const doc = projectCliSource(paths, cliCatalogue(), trial.workflowId, trial.runtimeName).doc;
      instructions = renderWorkflowDocument(doc, { locale, target: "preview", say: workflowDocSay(locale) });
    } catch { instructions = null; }
  }
  return {
    summary: { title, methodId: trial.methodId, workflowId: trial.workflowId, version, instructions: instructions !== null },
    instructions,
    record: {
      schema: "gaid-note-bundle-workflow/v1", title, methodId: trial.methodId, workflowId: trial.workflowId,
      versionAtStart: version, packageSha256: trial.packageSha256, treeHashAtStart: trial.treeHash ?? null, startedAt: trial.startedAt,
      installedNow: !!file,
    },
  };
}

interface Cited { key: string; item: LibraryItem | null }

async function citedPapers(content: string, store: LibraryStore): Promise<Cited[]> {
  const keys = [...new Set(parseCitations(content).map((c) => c.key))];
  const out: Cited[] = [];
  for (const key of keys) {
    const item = (await store.byCitationKey(key)) ?? null;
    out.push({ key, item: item && item.kind !== "note" ? item : null });
  }
  return out;
}

// --- Result bundle --------------------------------------------------------------------------------------------------

interface DataScan { data: NoteDataFingerprint[]; environmentIds: string[]; steps: number; limited: boolean }

async function noteData(paths: ProjectPaths, note: ResearchNoteSummary): Promise<DataScan> {
  if (!note.sessions.length) return { data: [], environmentIds: [], steps: 0, limited: false };
  const issues: EvidenceIssue[] = [];
  const sessions = new Set(note.sessions);
  const steps = (await packageProvenance(paths.id, note.sessions, issues)).filter((s) => sessions.has(s.sessionId));
  const notePrefix = `${note.path.slice(0, -"index.md".length)}`;
  const byPath = new Map<string, NoteDataFingerprint>();
  const environments: string[] = [];
  for (const step of steps) {
    if (step.environmentId && SHA.test(step.environmentId)) {
      const at = environments.indexOf(step.environmentId);
      if (at >= 0) environments.splice(at, 1);
      environments.unshift(step.environmentId);
    }
    const refs = [...step.inputs.map((r) => ({ r, use: "read" as const })), ...step.outputs.map((r) => ({ r, use: "written" as const }))];
    for (const { r, use } of refs) {
      if (r.change === "deleted" || r.change === "unchanged") continue;
      const rel = r.path.normalize("NFC");
      if (rel.startsWith(notePrefix) || rel.split("/").some((part) => part.startsWith("."))) continue;
      const prior = byPath.get(rel);
      const usedAt = new Date(step.timestamp).toISOString();
      byPath.set(rel, {
        path: rel, sha256: r.sha256 ?? null, bytes: r.size, usedAt,
        use: prior?.use === "written" || use === "written" ? "written" : "read", now: "unknown",
      });
    }
  }
  const all = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  const data = all.slice(0, NOTE_BUNDLE_LIMITS.dataFiles);
  const budget: ReadBudget = { remaining: NOTE_BUNDLE_LIMITS.currentHashBytes };
  for (const row of data) {
    let absolute: string;
    try { absolute = artifactPath(paths.id, row.path).absolute; }
    catch { continue; }
    let stat: fs.Stats;
    try { stat = fs.statSync(absolute); }
    catch { row.now = "missing"; continue; }
    if (!stat.isFile()) { row.now = "missing"; continue; }
    if (!row.sha256) continue;
    if (stat.size !== row.bytes) { row.now = "changed"; continue; }
    if (stat.size > NOTE_BUNDLE_LIMITS.currentHashFile || stat.size > budget.remaining) continue;
    try { row.now = (await hashEvidenceFile(paths.id, absolute, NOTE_BUNDLE_LIMITS.currentHashFile, budget)).sha256 === row.sha256 ? "same" : "changed"; }
    catch { /* unknown */ }
  }
  const limited = all.length > data.length || issues.some((i) => /limit/.test(i.code));
  return { data, environmentIds: environments.slice(0, NOTE_BUNDLE_LIMITS.environments), steps: steps.length, limited };
}

function readme(say: ReturnType<typeof localeSay>, note: ResearchNoteSummary, scan: DataScan, workflow: NoteWorkflow | null, references: NoteBundleReference[], environments: number, gaps: NoteBundleGap[], updatedAt: string): string {
  const lines: string[] = [];
  lines.push(`# ${note.title}`, "");
  lines.push(say("readme.intro"), "");
  lines.push(`- ${say("readme.date", { date: note.date })}`);
  lines.push(`- ${say(`readme.status.${note.status}`)}`);
  if (note.headline) lines.push(`- ${say("readme.headline", { headline: note.headline })}`);
  lines.push(`- ${say("readme.updated", { date: updatedAt.slice(0, 10) })}`, "");
  lines.push(`## ${say("readme.contents")}`, "");
  lines.push(`- \`note/\`: ${say("readme.part.note")}`);
  lines.push(`- \`data-fingerprints.json\`: ${say("readme.part.data", { count: scan.data.length })}`);
  if (environments) lines.push(`- \`environment/\`: ${say("readme.part.environment", { count: environments })}`);
  if (workflow) lines.push(`- \`workflow/\`: ${say("readme.part.workflow")}`);
  lines.push(`- \`references.md\`, \`references.json\`: ${say("readme.part.references", { count: references.length })}`);
  lines.push(`- \`manifest.json\`, \`SHA256SUMS\`: ${say("readme.part.checksums")}`, "");
  if (workflow) {
    lines.push(`## ${say("readme.workflow")}`, "");
    lines.push(`- ${workflow.summary.title ?? workflow.summary.methodId}`);
    lines.push(`- ${workflow.summary.version ? say("readme.version", { version: workflow.summary.version }) : say("readme.draft")}`, "");
  }
  lines.push(`## ${say("readme.data")}`, "");
  if (!scan.data.length) lines.push(say("readme.noData"), "");
  else {
    lines.push(`| ${say("readme.col.path")} | ${say("readme.col.use")} | ${say("readme.col.bytes")} | sha256 | ${say("readme.col.now")} |`, "|---|---|---:|---|---|");
    for (const row of scan.data) lines.push(`| \`${row.path.replace(/\|/g, "\\|")}\` | ${say(`readme.use.${row.use}`)} | ${row.bytes} | ${row.sha256 ? `\`${row.sha256}\`` : say("readme.unhashed")} | ${say(`readme.now.${row.now}`)} |`);
    lines.push("");
  }
  lines.push(`## ${say("readme.references")}`, "");
  if (!references.length) lines.push(say("readme.noReferences"), "");
  else { for (const ref of references) lines.push(`- [@${ref.key}] ${ref.reference ?? say("readme.notInLibrary")}`); lines.push(""); }
  if (gaps.length) {
    lines.push(`## ${say("readme.gaps")}`, "");
    for (const gap of gaps) lines.push(`- ${say(`gap.${gap}`)}`);
    lines.push("");
  }
  lines.push(`## ${say("readme.limits")}`, "", say("readme.limitsText"), "");
  lines.push(say("readme.verify"), "");
  return lines.join("\n");
}

async function assembleBundle(paths: ProjectPaths, id: string, locale: Locale, options: NoteExportOptions) {
  const { response, dir } = researchNoteLocation(paths, id);
  const note = response.note;
  const gaps = new Set<NoteBundleGap>();
  const built: Built[] = [];
  for (const file of await noteFolderFiles(paths, dir)) built.push({ name: `note/${file.rel}`, part: "note", data: file.data });
  if (note.problems.some((p) => p.code === "image-missing")) gaps.add("missing-figure");

  const scan = await noteData(paths, note);
  if (!note.sessions.length) gaps.add("no-chat");
  else if (!scan.steps) gaps.add("no-provenance");
  if (scan.limited) gaps.add("data-limit");
  if (scan.data.some((d) => !d.sha256)) gaps.add("unhashed-data");
  built.push({ name: "data-fingerprints.json", part: "data", data: Buffer.from(JSON.stringify({ schema: "gaid-note-data/v1", note: note.id, files: scan.data }, null, 2) + "\n") });

  let environments = 0;
  const envBudget: ReadBudget = { remaining: 8 * 1024 * 1024 };
  for (const envId of scan.environmentIds) {
    try {
      const snapshot = await storedEnvironment(paths.id, envId, envBudget);
      built.push({ name: `environment/${envId}.json`, part: "environment", data: Buffer.from(JSON.stringify(snapshot, null, 2) + "\n") });
      environments++;
    } catch { /* an unreadable record is reported as missing below when none remain */ }
  }
  if (!environments && note.sessions.length) gaps.add("no-environment");

  const workflow = noteWorkflow(paths, note, locale);
  if (!workflow) gaps.add("no-workflow");
  else {
    built.push({ name: "workflow/workflow.json", part: "workflow", data: Buffer.from(JSON.stringify(workflow.record, null, 2) + "\n") });
    if (workflow.instructions !== null) built.push({ name: "workflow/instructions.md", part: "workflow", data: Buffer.from(workflow.instructions) });
    else gaps.add("workflow-removed");
  }

  const store = (options.library ?? libraryStore)();
  const cited = await citedPapers(response.content, store);
  const references: NoteBundleReference[] = cited.map((c) => ({ key: c.key, reference: c.item ? formatReference(c.item.csl, locale) : null }));
  if (references.some((r) => !r.reference)) gaps.add("unresolved-citations");
  built.push({ name: "references.md", part: "references", data: Buffer.from(references.map((r) => `- [@${r.key}] ${r.reference ?? ""}`.trimEnd()).join("\n") + (references.length ? "\n" : "")) });
  built.push({ name: "references.json", part: "references", data: Buffer.from(JSON.stringify(cited.filter((c) => c.item).map((c) => ({ ...c.item!.csl, id: c.key })), null, 2) + "\n") });

  const gapList = [...gaps];
  built.push({ name: "README.md", part: "about", data: Buffer.from(readme(localeSay("noteExport", locale), note, scan, workflow, references, environments, gapList, note.updatedAt)) });

  const listed: NoteBundleFile[] = built.map((b) => ({ name: b.name, part: b.part, bytes: b.data.length, sha256: bytesHash(b.data) }));
  const manifest = Buffer.from(JSON.stringify({ schema: "gaid-note-bundle/v1", note: { id: note.id, title: note.title, date: note.date, status: note.status }, files: listed, gaps: gapList }, null, 2) + "\n");
  const sums = Buffer.from(listed.map((f) => `${f.sha256}  ${f.name}`).join("\n") + "\n");
  built.push({ name: "manifest.json", part: "checksums", data: manifest }, { name: "SHA256SUMS", part: "checksums", data: sums });
  const files: NoteBundleFile[] = built.map((b) => ({ name: b.name, part: b.part, bytes: b.data.length, sha256: bytesHash(b.data) }));
  const preview: NoteBundlePreview = {
    noteId: note.id, title: note.title, digest: listDigest(files.map((f) => [f.name, f.sha256])), files,
    totalBytes: files.reduce((sum, f) => sum + f.bytes, 0), data: scan.data, environments, workflow: workflow?.summary ?? null, references, gaps: gapList,
  };
  return { preview, built };
}

export async function previewNoteBundle(paths: ProjectPaths, id: string, locale: Locale, options: NoteExportOptions = {}): Promise<NoteBundlePreview> {
  return (await assembleBundle(paths, id, locale, options)).preview;
}

export async function buildNoteBundle(paths: ProjectPaths, id: string, body: { digest?: unknown; locale?: unknown }, options: NoteExportOptions = {}): Promise<{ zip: Buffer; sha256: string; fileName: string }> {
  if (typeof body?.digest !== "string" || !SHA.test(body.digest)) throw new ResearchNoteError(400, "digest is required");
  const { preview, built } = await assembleBundle(paths, id, localeOf(body.locale), options);
  if (preview.digest !== body.digest) throw new ResearchNoteError(409, "The note changed since the preview; review the bundle again");
  const zip = zipOf(built);
  return { zip, sha256: bytesHash(zip), fileName: `${preview.noteId}-bundle.zip` };
}

// --- Public material export ----------------------------------------------------------------------------------------

interface Candidate extends PublicExportCandidate { data: () => Promise<Buffer> }

function referenceSection(say: ReturnType<typeof localeSay>, cited: Cited[], locale: Locale): string {
  const found = cited.filter((c) => c.item);
  if (!found.length) return "";
  return `\n\n## ${say("public.referencesHeading")}\n\n${found.map((c) => `- [@${c.key}] ${formatReference(c.item!.csl, locale)}`).join("\n")}\n`;
}

const licenceOf = (item: LibraryItem): string | null => {
  const raw = (item.csl as Record<string, unknown>).license;
  return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 300) : null;
};

const fileSafe = (value: string) => value.normalize("NFC").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "file";

async function publicCandidates(paths: ProjectPaths, id: string, locale: Locale, options: NoteExportOptions): Promise<{ preview: PublicExportPreview; candidates: Candidate[] }> {
  const { response } = researchNoteLocation(paths, id);
  const note = response.note;
  const say = localeSay("noteExport", locale);
  const store = (options.library ?? libraryStore)();
  const cited = await citedPapers(response.content, store);
  const candidates: Candidate[] = [];
  const noteText = Buffer.from(response.content.replace(/\s*$/, "") + referenceSection(say, cited, locale) + "\n");
  candidates.push({ id: "note", kind: "note", name: `${fileSafe(note.id)}.md`, title: note.title, bytes: noteText.length, sha256: bytesHash(noteText), licence: null, data: async () => noteText });
  const workflow = noteWorkflow(paths, note, locale);
  if (workflow?.instructions) {
    const text = Buffer.from(workflow.instructions);
    candidates.push({ id: "workflow", kind: "workflow", name: `workflow-${fileSafe(workflow.summary.workflowId ?? workflow.summary.methodId)}.md`, title: workflow.summary.title ?? workflow.summary.methodId, bytes: text.length, sha256: bytesHash(text), licence: null, data: async () => text });
  }
  const skipped: PublicExportSkipped[] = [];
  const seen = new Set<string>();
  for (const c of cited) {
    if (!c.item) { skipped.push({ key: c.key, title: null, reason: "not-in-library" }); continue; }
    if (seen.has(c.item.id)) continue;
    seen.add(c.item.id);
    const title = formatReference(c.item.csl, locale);
    const sha = storedPdf(c.item);
    const file = sha && SHA.test(sha) ? store.filePath(sha) : null;
    let size = -1;
    try { if (file) size = fs.statSync(file).size; } catch { size = -1; }
    if (!file || size < 0) { skipped.push({ key: c.key, title, reason: "no-pdf" }); continue; }
    if (size > PUBLIC_EXPORT_LIMITS.paperBytes || candidates.filter((x) => x.kind === "paper").length >= PUBLIC_EXPORT_LIMITS.papers) { skipped.push({ key: c.key, title, reason: "too-large" }); continue; }
    candidates.push({
      id: `paper:${c.item.id}`, kind: "paper", name: `${fileSafe(c.key)}.pdf`, title, bytes: size, sha256: sha!, licence: licenceOf(c.item), key: c.key,
      data: async () => {
        const bytes = await fs.promises.readFile(file);
        if (bytes.length > PUBLIC_EXPORT_LIMITS.paperBytes || bytesHash(bytes) !== sha) throw new ResearchNoteError(409, "A paper file changed; review the export again");
        return bytes;
      },
    });
  }
  const rows = candidates.map(({ data: _data, ...rest }) => rest);
  return { preview: { noteId: note.id, digest: listDigest(rows.map((r) => [r.id, r.name, r.sha256])), candidates: rows, skipped }, candidates };
}

export async function previewPublicExport(paths: ProjectPaths, id: string, locale: Locale, options: NoteExportOptions = {}): Promise<PublicExportPreview> {
  return (await publicCandidates(paths, id, locale, options)).preview;
}

export async function buildPublicExport(paths: ProjectPaths, id: string, body: { digest?: unknown; files?: unknown; locale?: unknown }, options: NoteExportOptions = {}): Promise<{ zip: Buffer; sha256: string; fileName: string }> {
  if (typeof body?.digest !== "string" || !SHA.test(body.digest)) throw new ResearchNoteError(400, "digest is required");
  if (!Array.isArray(body.files) || !body.files.length || body.files.length > PUBLIC_EXPORT_LIMITS.papers + 2) throw new ResearchNoteError(400, "files must list the chosen files");
  const chosen = body.files as { id?: unknown; mayLeave?: unknown }[];
  if (!chosen.every((f) => f && typeof f.id === "string" && f.mayLeave === true)) throw new ResearchNoteError(400, "Every chosen file needs the researcher's confirmation that it may leave the institute");
  const ids = [...new Set(chosen.map((f) => f.id as string))];
  const { preview, candidates } = await publicCandidates(paths, id, localeOf(body.locale), options);
  if (preview.digest !== body.digest) throw new ResearchNoteError(409, "The files changed since the preview; review the export again");
  const picked = ids.map((x) => candidates.find((c) => c.id === x));
  if (picked.some((c) => !c)) throw new ResearchNoteError(400, "A chosen file is not offered for this note");
  if (picked.reduce((sum, c) => sum + c!.bytes, 0) > PUBLIC_EXPORT_LIMITS.totalBytes) throw new ResearchNoteError(413, "The chosen files exceed the export size limit");
  const entries: { name: string; data: Buffer }[] = [];
  for (const c of picked) {
    const data = await c!.data();
    if (bytesHash(data) !== c!.sha256) throw new ResearchNoteError(409, "A file changed; review the export again");
    entries.push({ name: c!.name, data });
  }
  const zip = zipOf(entries);
  const sha256 = bytesHash(zip);
  const record = { at: (options.now ?? (() => new Date()))().toISOString(), note: preview.noteId, zipSha256: sha256, files: picked.map((c) => ({ id: c!.id, name: c!.name, sha256: c!.sha256, bytes: c!.bytes, licence: c!.licence })), confirmedMayLeave: true };
  const log = path.join(geoStateDir(paths), "public-exports.jsonl");
  fs.mkdirSync(path.dirname(log), { recursive: true });
  fs.appendFileSync(log, JSON.stringify(record) + "\n");
  return { zip, sha256, fileName: `${preview.noteId}-public.zip` };
}
