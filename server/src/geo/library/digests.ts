/**
 * 문헌 정리 (literature digests) in the library (gaid-library-prep; user decision 2026-10-24 "모두 권장으로 하자.").
 *
 * A digest item (`kind: "digest"`) is several library papers read in advance and summarised. Two origins:
 * - `gaid`: made by the AI agent in a project chat with a general literature Workflow. The researcher asks for it from
 *   서재 (`createDigestRequest`): the papers are attached to the project's citation scope, the request is recorded in
 *   `.kady/geo/digest-requests.json`, and the chat message asks the agent to write `문헌정리/<id>/index.md`. A lead
 *   write/edit of that file (`makeDigestExtension`) mirrors it into 서재 (검토 전); the file stays the master and only the
 *   instance that holds the project refreshes the item, like research notes (`notes.ts`).
 * - `external`: a file exported from Gemini Notebook, imported as 외부 정리 (`addExternalDigest`); its text is the
 *   converted file, the original stays in library storage on this PC (the hub server keeps PDFs only, so it is not synced).
 *
 * A digest is never a reference: no citation key, not exported, not in folder checks, citation scope, Zotero or ORCID.
 * Workflows read it first (`library_digest`), but citations always point to the original papers' pages.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { listProjects, resolvePaths, type ProjectMeta, type ProjectPaths } from "../../projects.ts";
import { apiRelative } from "../../sandbox-fs.ts";
import workflowRows from "../../../../web/src/data/workflows.json" with { type: "json" };
import {
  DIGEST_FOLDER,
  DIGEST_WORKFLOWS,
  LIBRARY_DIGEST_TEXT_BYTES,
  folderSubtree,
  isDigestItem,
  isPaperItem,
  type DigestCandidate,
  type DigestWorkflowId,
  type LibraryCollection,
  type LibraryDigestExternal,
  type LibraryDigestMade,
  type LibraryDigestRef,
  type LibraryDigestStatus,
  type LibraryDigestSummary,
  type LibraryItem,
  type MakeDigestBody,
  type MakeDigestResponse,
} from "../../../../web/src/geo/contracts/library.ts";
import { libraryInstance, snapshot } from "./notes.ts";
import { LibraryError, libraryOwner, newItemId, type LibraryStore } from "./store.ts";
import { projectItems, readProjectLiterature, writeProjectLiterature } from "./uses.ts";

export const DIGEST_FILE = "index.md";
/** Folder names follow research notes: `YYYY-MM-DD-<topic>`. */
export const DIGEST_ID = /^\d{4}-\d{2}-\d{2}-[\p{L}\p{N}_-]{1,80}$/u;
export const DIGEST_LIMITS = { papers: 60, question: 600, title: 120, requests: 200, fileBytes: 2 * 1024 * 1024 } as const;
const REQUESTS_FILE = ["kady", "geo", "digest-requests.json"] as const;
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/** One 문헌 정리 the researcher asked for in a project (the file the agent writes is mirrored by this record). */
export interface DigestRequest {
  id: string;
  digestId: string;
  path: string;
  workflow: DigestWorkflowId;
  question: string;
  title: string;
  covers: string[];
  collectionId?: string;
  createdAt: string;
  /** Library item once the file was written. */
  itemId?: string;
}

interface RequestsFile {
  schema: "gaid-digest-requests/v1";
  requests: DigestRequest[];
}

const requestsPath = (paths: ProjectPaths) => path.join(paths.sandbox, `.${REQUESTS_FILE[0]}`, REQUESTS_FILE[1], REQUESTS_FILE[2]);

export function readDigestRequests(paths: ProjectPaths): DigestRequest[] {
  try {
    const value = JSON.parse(fs.readFileSync(requestsPath(paths), "utf8")) as Partial<RequestsFile>;
    return Array.isArray(value.requests) ? value.requests.filter((r): r is DigestRequest => Boolean(r) && typeof r.digestId === "string" && Array.isArray(r.covers)) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new LibraryError("Digest request record is unreadable", 409);
  }
}

function writeDigestRequests(paths: ProjectPaths, requests: DigestRequest[]): void {
  const file = requestsPath(paths);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID().slice(0, 8)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ schema: "gaid-digest-requests/v1", requests: requests.slice(-DIGEST_LIMITS.requests) } satisfies RequestsFile, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

/** `YYYY-MM-DD-<topic>` from a title: letters, digits, - and _ only (Korean kept), at most 60 topic characters. */
export function digestFolderId(title: string, date = today()): string {
  const topic = title.normalize("NFC").trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]+/gu, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "문헌정리";
  return `${date}-${topic}`;
}

/** Level-2 headings and the first level-1 heading of a Markdown text. */
export function digestOutline(text: string): { title?: string; headings: string[] } {
  let title: string | undefined;
  const headings: string[] = [];
  let fence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const h1 = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (h1 && !title) { title = h1[1].trim(); continue; }
    const h2 = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (h2 && headings.length < 40) headings.push(h2[1].trim().slice(0, 120));
  }
  return { ...(title ? { title: title.slice(0, DIGEST_LIMITS.title) } : {}), headings };
}

function digestText(text: string): Pick<LibraryDigestRef, "text" | "truncated" | "headings"> {
  const { markdown, truncated } = snapshot(text, LIBRARY_DIGEST_TEXT_BYTES);
  return { text: markdown, ...(truncated ? { truncated: true } : {}), headings: digestOutline(text).headings };
}

const issued = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? { issued: { "date-parts": [[Number(m[1]), Number(m[2]), Number(m[3])]] } } : {};
};

function digestCsl(title: string, createdAt: string, headline?: string): LibraryItem["csl"] {
  return { type: "document", title, ...issued(createdAt), ...(headline ? { abstract: headline } : {}) };
}

/** The papers a make request covers: a folder (subfolders included) plus explicit items; papers only, live ones. */
export function requestPapers(all: LibraryItem[], collections: LibraryCollection[], body: Pick<MakeDigestBody, "collectionId" | "itemIds">): LibraryItem[] {
  const folder = body.collectionId ? folderSubtree(collections, body.collectionId) : undefined;
  const ids = new Set((body.itemIds ?? []).filter((id): id is string => typeof id === "string"));
  return all.filter((i) => isPaperItem(i) && !i.removedFromSourceAt && (ids.has(i.id) || (folder ? i.collectionIds.some((c) => folder.has(c)) : false)));
}

const WORKFLOW_PROMPTS = new Map((workflowRows as { id: string; name: string; prompt: string }[]).map((w) => [w.id, w]));

/**
 * The chat message (model-facing instructions after a one-line Korean request): read only the listed papers with the
 * library tools, follow the general Workflow's procedure, write one Markdown file at `path`, cite PDF pages.
 */
export function digestRequestMessage(request: DigestRequest, papers: LibraryItem[]): string {
  const wf = WORKFLOW_PROMPTS.get(request.workflow);
  const procedure = (wf?.prompt ?? "")
    .replace(/\{task\}/g, request.question)
    .replace(/ grounded in the literature via web search across multiple sources/g, " grounded in the listed library papers")
    .replace(/Save the [^.]*?Markdown file[^.]*\.( [^.]*chat\.)?/g, "")
    .trim();
  const list = papers.map((p) => `- [@${p.citationKey ?? p.id}] ${p.csl.title}${p.attachments.some((a) => a.kind === "pdf") ? "" : " (no PDF: abstract only)"}`);
  return [
    `문헌 정리를 만들어 주세요: ${request.title}`,
    "",
    `<library-digest-request id="${request.id}" workflow="${request.workflow}" path="${request.path}">`,
    `Research question: ${request.question}`,
    "",
    `Papers (${papers.length}) — read only these, through library_search and library_read; do not use web search:`,
    ...list,
    "",
    `Procedure (general Workflow "${wf?.name ?? request.workflow}"):`,
    procedure,
    "",
    "Output rules:",
    `- Write exactly one Markdown file: ${request.path}. Start it with "# ${request.title}", then level-2 sections: "## 연구 질문" first, the procedure's sections next, "## 자료와 한계" and "## 인용 목록" last.`,
    "- Cite every claim about a paper as [@key, p. N] with the PDF page you read; for a paper without a PDF cite [@key] and say that only the abstract was read.",
    "- Do not cite this digest itself anywhere; it is reading material, the papers stay the sources.",
    "- Write in the researcher's language (Korean unless the papers' question is asked otherwise). Do not save the result anywhere else and do not write a research note for it.",
    "- When the file is written, reply with two or three lines: what it covers and what could not be read.",
    "</library-digest-request>",
  ].join("\n");
}

function projectMeta(projectId: string): ProjectMeta | undefined {
  return listProjects().find((p) => p.id === projectId);
}

/** `POST /geo/library/digests/requests`: attach the papers, record the request, return the chat message. */
export async function createDigestRequest(store: LibraryStore, body: MakeDigestBody): Promise<MakeDigestResponse> {
  const meta = typeof body?.projectId === "string" ? projectMeta(body.projectId) : undefined;
  if (!meta) throw new LibraryError("Project not found", 404);
  if (!DIGEST_WORKFLOWS.includes(body.workflow)) throw new LibraryError("Unknown digest workflow");
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) throw new LibraryError("question is required");
  if (question.length > DIGEST_LIMITS.question) throw new LibraryError(`question exceeds ${DIGEST_LIMITS.question} characters`);
  const all = await store.all(), collections = await store.collections();
  if (body.collectionId !== undefined && !collections.some((c) => c.id === body.collectionId)) throw new LibraryError("Folder not found", 404);
  const papers = requestPapers(all, collections, body);
  if (!papers.length) throw new LibraryError("Choose at least one paper");
  if (papers.length > DIGEST_LIMITS.papers) throw new LibraryError(`At most ${DIGEST_LIMITS.papers} papers per digest`, 413);
  const folderName = body.collectionId ? collections.find((c) => c.id === body.collectionId)?.name : undefined;
  const base = (folderName ?? papers[0].csl.title).trim();
  // "광상 탐사 문헌" → "광상 탐사 문헌 정리", not "… 문헌 문헌 정리".
  const title = ((typeof body.title === "string" && body.title.trim()) || (/문헌$/.test(base) ? `${base} 정리` : `${base} 문헌 정리`)).slice(0, DIGEST_LIMITS.title);
  const paths = resolvePaths(meta.id);
  const requests = readDigestRequests(paths);
  const folderBase = digestFolderId(title);
  const taken = new Set([...requests.map((r) => r.digestId.normalize("NFC")), ...existingDigestFolders(paths)]);
  let digestId = folderBase;
  for (let n = 2; taken.has(digestId.normalize("NFC")); n++) digestId = `${folderBase}-${n}`;
  const request: DigestRequest = {
    id: `dr-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    digestId,
    path: `${DIGEST_FOLDER}/${digestId}/${DIGEST_FILE}`,
    workflow: body.workflow,
    question,
    title,
    covers: papers.map((p) => p.id),
    ...(body.collectionId ? { collectionId: body.collectionId } : {}),
    createdAt: now(),
  };
  writeDigestRequests(paths, [...requests, request]);
  // The agent's library tools only see the project's citation scope.
  const literature = readProjectLiterature(paths);
  const scope = new Set(projectItems(literature, all, collections).map((i) => i.id));
  const missing = papers.filter((p) => !scope.has(p.id)).map((p) => p.id);
  if (missing.length) writeProjectLiterature(paths, { collectionIds: literature.collectionIds, itemIds: [...literature.itemIds, ...missing] });
  return { requestId: request.id, projectId: meta.id, path: request.path, covers: request.covers, message: digestRequestMessage(request, papers) };
}

function existingDigestFolders(paths: ProjectPaths): string[] {
  try { return fs.readdirSync(path.join(paths.sandbox, DIGEST_FOLDER)).map((n) => n.normalize("NFC")); } catch { return []; }
}

function readDigestFile(paths: ProjectPaths, digestId: string): { text: string; sha: string; mtime: string } {
  const file = path.join(paths.sandbox, DIGEST_FOLDER, digestId, DIGEST_FILE);
  const real = fs.realpathSync(file);
  const root = fs.realpathSync(paths.sandbox);
  if (!real.startsWith(root + path.sep)) throw new LibraryError("Digest file not found", 404);
  const stat = fs.statSync(real);
  if (stat.size > DIGEST_LIMITS.fileBytes) throw new LibraryError("Digest file exceeds 2 MiB", 413);
  const bytes = fs.readFileSync(real);
  return { text: bytes.toString("utf8"), sha: createHash("sha256").update(bytes).digest("hex"), mtime: stat.mtime.toISOString() };
}

async function findMadeItem(store: LibraryStore, origin: string, projectId: string, digestId: string): Promise<LibraryItem | undefined> {
  const id = digestId.normalize("NFC");
  return (await store.all()).find((i) => isDigestItem(i) && i.digest?.made?.origin === origin && i.digest.made.projectId === projectId && i.digest.made.digestId.normalize("NFC") === id);
}

/**
 * Mirrors a GAID-made digest file into 서재 (creates the item on the first write of a requested digest; later writes
 * refresh it). Files nobody asked for from 서재 are left alone. Returns the item, or undefined when not requested.
 */
export async function mirrorDigestFile(store: LibraryStore, paths: ProjectPaths, projectId: string, digestId: string): Promise<LibraryItem | undefined> {
  const meta = projectMeta(projectId);
  if (!meta || !DIGEST_ID.test(digestId.normalize("NFC"))) return undefined;
  const requests = readDigestRequests(paths);
  const request = requests.find((r) => r.digestId.normalize("NFC") === digestId.normalize("NFC"));
  if (!request) return undefined;
  const instance = libraryInstance(store);
  const file = readDigestFile(paths, digestId);
  const outline = digestOutline(file.text);
  const title = outline.title ?? request.title;
  const made: LibraryDigestMade = {
    workflow: request.workflow,
    question: request.question,
    origin: instance.id,
    originLabel: instance.label,
    projectId: meta.id,
    projectName: meta.name,
    digestId: request.digestId,
    path: request.path,
    contentSha256: file.sha,
    fileUpdatedAt: file.mtime,
    refreshedAt: now(),
  };
  const existing = await findMadeItem(store, instance.id, meta.id, request.digestId);
  if (existing) {
    return store.mutate(existing.id, (next) => {
      next.digest = { ...next.digest!, made, ...digestText(file.text) };
      delete next.digest.made!.missingAt;
      next.csl = digestCsl(title, next.digest.createdAt);
    });
  }
  if ((await store.all()).length >= 20_000) throw new LibraryError("Library is full", 413);
  const at = now();
  const item: LibraryItem = {
    id: newItemId(),
    owner: libraryOwner(),
    source: "gaid",
    kind: "digest",
    csl: digestCsl(title, at),
    metadataOrigin: "import",
    metadataConfirmed: true,
    collectionIds: request.collectionId ? [request.collectionId] : [],
    tags: [],
    attachments: [],
    read: { coverage: "full" },
    addedAt: at,
    updatedAt: at,
    digest: { origin: "gaid", made, status: "pending", covers: request.covers, ...(request.collectionId ? { collectionId: request.collectionId } : {}), ...digestText(file.text), createdAt: at },
  };
  const saved = await store.put(item);
  writeDigestRequests(paths, requests.map((r) => (r.id === request.id ? { ...r, itemId: saved.id } : r)));
  return saved;
}

/** Re-reads this instance's GAID-made digest files that changed or went missing; other items stay as synced. */
export async function refreshDigestItems(store: LibraryStore, only?: LibraryItem[]): Promise<number> {
  const instance = libraryInstance(store);
  const items = (only ?? (await store.all())).filter((i) => isDigestItem(i) && i.digest?.made?.origin === instance.id);
  if (!items.length) return 0;
  const projects = new Map(listProjects().map((p) => [p.id, p]));
  let changed = 0;
  for (const item of items) {
    const made = item.digest!.made!;
    const meta = projects.get(made.projectId);
    let mtime: string | undefined;
    if (meta) {
      try { mtime = fs.statSync(path.join(resolvePaths(meta.id).sandbox, DIGEST_FOLDER, made.digestId, DIGEST_FILE)).mtime.toISOString(); } catch { /* gone */ }
    }
    if (!meta || !mtime) {
      if (made.missingAt) continue;
      await store.mutate(item.id, (n) => { n.digest = { ...n.digest!, made: { ...made, missingAt: now(), refreshedAt: now() } }; });
      changed++;
      continue;
    }
    if (mtime === made.fileUpdatedAt && !made.missingAt && meta.name === made.projectName) continue;
    try {
      const file = readDigestFile(resolvePaths(meta.id), made.digestId);
      if (file.sha === made.contentSha256 && !made.missingAt && meta.name === made.projectName) {
        await store.mutate(item.id, (n) => { n.digest = { ...n.digest!, made: { ...made, fileUpdatedAt: file.mtime, refreshedAt: now() } }; });
      } else {
        const title = digestOutline(file.text).title ?? item.csl.title;
        await store.mutate(item.id, (n) => {
          n.digest = { ...n.digest!, made: { ...made, projectName: meta.name, contentSha256: file.sha, fileUpdatedAt: file.mtime, refreshedAt: now() }, ...digestText(file.text) };
          delete n.digest.made!.missingAt;
          n.csl = digestCsl(title, n.digest.createdAt);
        });
      }
      changed++;
    } catch (error) {
      if (!(error instanceof LibraryError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return changed;
}

/** Papers in the digest's folder (subfolders included) it does not cover. */
export function newPapersSince(item: LibraryItem, all: LibraryItem[], collections: LibraryCollection[]): number {
  const d = item.digest;
  if (!d?.collectionId) return 0;
  const sub = folderSubtree(collections, d.collectionId);
  const covered = new Set(d.covers);
  return all.filter((i) => isPaperItem(i) && !i.removedFromSourceAt && i.collectionIds.some((c) => sub.has(c)) && !covered.has(i.id) && !(i.aliases?.ids ?? []).some((a) => covered.has(a))).length;
}

export function digestSummary(item: LibraryItem, all: LibraryItem[], collections: LibraryCollection[], instanceId: string, projectIds: Set<string>): LibraryDigestSummary | undefined {
  const d = item.digest;
  if (!d) return undefined;
  return {
    origin: d.origin,
    status: d.status,
    ...(d.made ? { workflow: d.made.workflow, local: d.made.origin === instanceId && projectIds.has(d.made.projectId) && !d.made.missingAt } : {}),
    ...(d.external ? { fileName: d.external.fileName } : {}),
    covers: d.covers.length,
    unmatched: d.unmatched?.length ?? 0,
    date: d.createdAt.slice(0, 10),
    newPapers: newPapersSince(item, all, collections),
    ...(d.made?.missingAt ? { missing: true } : {}),
  };
}

/** The researcher's review mark: 확인함 or back to 검토 전. */
export async function setDigestStatus(store: LibraryStore, id: string, status: unknown): Promise<LibraryItem> {
  if (status !== "pending" && status !== "confirmed") throw new LibraryError("status must be pending or confirmed");
  const item = await store.get(id);
  if (!isDigestItem(item) || !item.digest) throw new LibraryError("Not a literature digest", 404);
  return store.mutate(id, (next) => {
    next.digest = { ...next.digest!, status: status as LibraryDigestStatus, ...(status === "confirmed" ? { confirmedAt: now() } : {}) };
    if (status === "pending") delete next.digest.confirmedAt;
  });
}

/**
 * Adds an imported external summary (외부 정리, 검토 전). `text` is the converted file; the original bytes must already
 * be stored with `store.storeFile`. Covered ids are checked against the library (papers only).
 */
export async function addExternalDigest(store: LibraryStore, input: {
  title: string;
  text: string;
  external: LibraryDigestExternal;
  covers: string[];
  unmatched?: { title: string; doi?: string }[];
  collectionId?: string;
}): Promise<LibraryItem> {
  const title = input.title.trim().slice(0, DIGEST_LIMITS.title);
  if (!title) throw new LibraryError("title is required");
  const all = await store.all(), collections = await store.collections();
  if (all.length >= 20_000) throw new LibraryError("Library is full", 413);
  if (input.collectionId !== undefined && !collections.some((c) => c.id === input.collectionId)) throw new LibraryError("Folder not found", 404);
  const papers = new Set(all.filter((i) => isPaperItem(i) && !i.removedFromSourceAt).map((i) => i.id));
  const covers = [...new Set(input.covers.filter((id) => papers.has(id)))].slice(0, 500);
  const at = now();
  const item: LibraryItem = {
    id: newItemId(),
    owner: libraryOwner(),
    source: "gaid",
    kind: "digest",
    csl: digestCsl(title, at),
    metadataOrigin: "import",
    metadataConfirmed: true,
    collectionIds: input.collectionId ? [input.collectionId] : [],
    tags: [],
    attachments: [],
    read: { coverage: "full" },
    addedAt: at,
    updatedAt: at,
    digest: {
      origin: "external",
      external: input.external,
      status: "pending",
      covers,
      ...(input.unmatched?.length ? { unmatched: input.unmatched.slice(0, 100) } : {}),
      ...(input.collectionId ? { collectionId: input.collectionId } : {}),
      ...digestText(input.text),
      createdAt: at,
    },
  };
  return store.put(item);
}

/**
 * Digests the Workflow start window offers in a project: those covering at least one of `basis` (the Workflow's source
 * papers in 서재, else the project's attached papers). Only a GAID-made digest covering every basis paper is
 * recommended; external summaries are offered for reference only and never recommended.
 */
export function digestCandidates(all: LibraryItem[], collections: LibraryCollection[], basis: string[]): DigestCandidate[] {
  const wanted = new Set(basis);
  const byId = new Map(all.filter((i) => isPaperItem(i) && !i.removedFromSourceAt).map((i) => [i.id, i]));
  const out: DigestCandidate[] = [];
  for (const item of all) {
    if (!isDigestItem(item) || !item.digest || item.removedFromSourceAt) continue;
    const covered = item.digest.covers.filter((id) => wanted.has(id)).length;
    if (!covered) continue;
    out.push({
      itemId: item.id,
      title: item.csl.title,
      origin: item.digest.origin,
      status: item.digest.status,
      date: item.digest.createdAt.slice(0, 10),
      covered,
      total: wanted.size,
      recommended: item.digest.origin === "gaid" && covered === wanted.size,
      newPapers: newPapersSince(item, all, collections),
      papers: item.digest.covers.flatMap((id) => {
        const paper = byId.get(id);
        return paper ? [{ key: paper.citationKey ?? paper.id, title: paper.csl.title }] : [];
      }),
    });
  }
  return out.sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.covered - a.covered || b.date.localeCompare(a.date)).slice(0, 10);
}

/** Lead-only hook: a write/edit of `문헌정리/<id>/index.md` refreshes (or creates, when requested) its 서재 item. */
export function makeDigestExtension(paths: ProjectPaths, projectId: string, storeOf: () => LibraryStore): ExtensionFactory {
  return (pi) => {
    pi.on("tool_result", async (event) => {
      if ((event.toolName !== "write" && event.toolName !== "edit") || event.isError) return;
      const target = (event.input as { path?: unknown } | null)?.path;
      if (typeof target !== "string") return;
      try {
        const relative = apiRelative(path.resolve(paths.sandbox), path.resolve(paths.sandbox, target.replace(/^@/, ""))).normalize("NFC");
        const [dir, id, file, extra] = relative.split("/");
        if (dir !== DIGEST_FOLDER || !id || file !== DIGEST_FILE || extra !== undefined) return;
        const item = await mirrorDigestFile(storeOf(), paths, projectId, id);
        if (!item) return;
        const problems: string[] = [];
        if (!digestOutline(item.digest!.text).title) problems.push('start with a level-1 title ("# …")');
        if (!item.digest!.headings.length) problems.push("use level-2 sections");
        if (!problems.length) return;
        return { content: [...event.content, { type: "text" as const, text: `Literature digest format check: fix ${relative}: ${problems.join("; ")}.` }] };
      } catch {
        return; // A failed mirror must not replace the successful tool result.
      }
    });
  };
}
