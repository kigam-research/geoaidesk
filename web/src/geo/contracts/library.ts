/**
 * Personal library (gaid-research-hub; ADR docs/adr/2026-10-21-research-hub-library.md). Every researcher has one GAID
 * library whose items come from two sources:
 *
 * - `zotero`: mirrored read-only from the researcher's Zotero (Local API of the running Zotero on the researcher's PC,
 *   or the Zotero Web API with the researcher's key). Zotero is the source of metadata, PDFs and annotations.
 * - `gaid`: added in GAID (PDF, DOI/URL, agent search result, BibTeX/RIS/CSL-JSON import). GAID is the source; PDFs
 *   sit in the researcher's personal GAID storage. "Zotero로 보내기" turns it into a `zotero` item with the same id.
 *
 * Everything downstream (project literature, evidence anchors, note citations, paper → Workflow) uses the GAID item id
 * and does not depend on the source. A project stores references only (`.kady/geo/literature.json`). Research notes
 * cite with Pandoc syntax (`[@key, p. 12]`); `parseCitations` is the one parser for the server hook and the note view.
 *
 * Folders (gaid-library-folders; ADR docs/adr/2026-10-21-library-folders.md): nested topic folders; an item can be in
 * several. A folder may be linked to one Zotero collection; for a Zotero item of that library, membership in a linked
 * folder comes from Zotero, every other membership is kept by GAID. A folder (with its subfolders) is a citation scope:
 * export, reference check and, when attached to a project, the project's citations.
 *
 * Research notes (gaid-note-library): a research note (`연구노트/<date>-<topic>/index.md`) can be brought into the library
 * as an item of its own category (`kind: "note"`). The note file stays the master: the item mirrors its title, status,
 * citations and a bounded text snapshot, refreshed from the file by the GAID instance whose project holds it. Note items
 * sync with the institute hub like other items, are never written to Zotero and are not references (no citation key,
 * not exported, not checked as papers).
 *
 * IO-free; the server imports it.
 */

export const LIBRARY_SCHEMA = "gaid-library/v1";
export const PROJECT_LITERATURE_SCHEMA = "gaid-project-literature/v1";
/** Project-relative file that lists the library collections and items attached to a project. */
export const PROJECT_LITERATURE_FILE = ".kady/geo/literature.json";
/** Name of the Zotero collection GAID adds confirmed papers to (the only collection GAID creates). */
export const ZOTERO_INBOX_COLLECTION = "GAID 수집함";

export type LibrarySource = "zotero" | "gaid";
/** How GAID reaches a Zotero library: the Local API of the running Zotero (PC) or the Web API (key). */
export type ZoteroConnectionKind = "local" | "web";

/**
 * Where a Zotero item lives. Versions are per connection: Local API versions belong to one `Zotero-Server-ID` and are
 * never compared with Web API versions, so a sync cursor is kept per (connection, serverId, library).
 */
export interface ZoteroItemRef {
  connection: ZoteroConnectionKind;
  /** `Zotero-Server-ID` response header of the Local API (Zotero 10+); absent for the Web API. */
  serverId?: string;
  libraryType: "user" | "group";
  libraryId: string;
  itemKey: string;
  version: number;
}

/** CSL-JSON name. */
export interface CslName {
  family?: string;
  given?: string;
  literal?: string;
}

/** The CSL-JSON fields GAID reads and writes (CSL-JSON is the interchange format; other fields round-trip). */
export interface CslItem {
  type: string;
  title: string;
  author?: CslName[];
  issued?: { "date-parts": number[][] };
  "container-title"?: string;
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  DOI?: string;
  URL?: string;
  ISSN?: string;
  language?: string;
  abstract?: string;
  [field: string]: unknown;
}

/** Where the metadata of an item came from; `gaid` items are confirmed by the researcher before they count as checked. */
/**
 * `orcid`: filled from the researcher's public ORCID record (a work without DOI metadata elsewhere).
 * `datacite`: DOIs Crossref does not register, such as arXiv preprints (`10.48550/arXiv.*`) and data repositories.
 */
export type MetadataOrigin = "zotero" | "crossref" | "openalex" | "kci" | "datacite" | "orcid" | "import" | "manual" | "note";

/** Library category: a paper (or other reference) or a research note brought in from a project. */
export type LibraryItemKind = "paper" | "note";
/** Research-note status as written in the note file (`web/src/geo/contracts/research-notes.ts`). */
export type LibraryNoteStatus = "pending" | "confirmed" | "superseded";
/** Largest note text kept in a library item (UTF-8 bytes); longer notes keep the beginning and set `truncated`. */
export const LIBRARY_NOTE_SNAPSHOT_BYTES = 64 * 1024;

/**
 * Where a research-note item comes from and what the library last read from the file. Projects live on one GAID
 * instance (and the project id `default` exists on every instance), so `origin` names that instance; only it refreshes
 * the item. `noteId` is the note folder name (`getResearchNote(paths, noteId)`).
 */
export interface LibraryNoteRef {
  origin: string;
  /** Host name of the origin instance, for "on another PC" wording. */
  originLabel: string;
  projectId: string;
  projectName: string;
  noteId: string;
  /** Project-relative note file (`연구노트/<id>/index.md`). */
  path: string;
  date: string;
  status: LibraryNoteStatus;
  headline?: string;
  /** Note Markdown at the last refresh (bounded by LIBRARY_NOTE_SNAPSHOT_BYTES). */
  markdown: string;
  truncated?: boolean;
  contentSha256: string;
  fileUpdatedAt: string;
  refreshedAt: string;
  /** Citation keys in the note and the library papers (id, title) they resolved to at the last refresh. */
  citations: { key: string; itemId?: string; title?: string; locators: string[] }[];
  /** Set when the note file (or its project) was not found at the last refresh; cleared when it is back. */
  missingAt?: string;
}

export const isNoteItem = (item: Pick<LibraryItem, "kind">): boolean => item.kind === "note";

export interface LibraryAttachment {
  id: string;
  kind: "pdf" | "other";
  title?: string;
  /** Zotero attachment item key (`zotero` items; also used for `zotero://open-pdf` page links). */
  zoteroAttachmentKey?: string;
  /** File kept in the researcher's personal GAID storage (`gaid` items), addressed by content hash. */
  stored?: { sha256: string; size: number; mediaType: string };
  pages?: number;
}

/**
 * How much of an item GAID has read, shown next to every answer that uses it: `full` body read, `partial` some pages
 * unreadable, `abstract` only abstract/metadata text, `none` nothing readable yet (no PDF, scan without OCR …).
 */
export type ReadCoverage = "full" | "partial" | "abstract" | "none";

export interface ReadState {
  coverage: ReadCoverage;
  pagesRead?: number;
  pagesTotal?: number;
  unreadablePages?: number[];
  /** Converter and version that produced the page text, so a re-read can be compared. */
  reader?: { name: string; version: string };
  readAt?: string;
}

export interface LibraryItem {
  /** GAID id, stable across sources (`li-` + random); never the Zotero key or the citation key. */
  id: string;
  /** Owner display/account id; present from day one so a library can move to an institute server with accounts. */
  owner: string;
  source: LibrarySource;
  zotero?: ZoteroItemRef;
  csl: CslItem;
  /**
   * Key used in note citations. `zotero` items: Zotero's own citation-key field (Zotero 8+, set by Better BibTeX).
   * `gaid` items: generated by GAID (author + year + letter), unique within the library. An alias, not an id.
   */
  citationKey?: string;
  metadataOrigin: MetadataOrigin;
  metadataConfirmed: boolean;
  collectionIds: string[];
  tags: string[];
  attachments: LibraryAttachment[];
  read: ReadState;
  addedAt: string;
  updatedAt: string;
  /** Set when a `gaid` item was sent to Zotero (it is then a `zotero` item; citations keep working). */
  sentToZoteroAt?: string;
  /** Set when the item disappeared from its Zotero library; kept so existing citations and links still resolve. */
  removedFromSourceAt?: string;
  /**
   * Earlier ids and citation keys that still resolve to this item: a GAID item merged into the Zotero copy of the same
   * paper when it was sent, or a citation key that changed when Zotero (Better BibTeX) assigned its own.
   */
  aliases?: { ids?: string[]; citationKeys?: string[] };
  /** Retraction/correction evidence seen when the metadata was looked up (Crossref, OpenAlex). */
  signals?: UpdateSignal[];
  /**
   * Set when the researcher confirmed this paper as their own work from their ORCID record (gaid-orcid; basis of
   * 내 논문). GAID-side: kept across Zotero refreshes and merges.
   */
  ownWork?: OwnWorkMark;
  /** `note` for a research note brought in from a project; absent or `paper` for references. */
  kind?: LibraryItemKind;
  /** Research-note items only. */
  note?: LibraryNoteRef;
}

/** Provenance of an own-work mark: the ORCID iD and the work's put-code on that record. */
export interface OwnWorkMark {
  orcid: string;
  putCode: number;
  markedAt: string;
}

/**
 * A folder. `source: "gaid"` = made in GAID and not linked; `source: "zotero"` = linked to a Zotero collection, either
 * mirrored from Zotero (`zc-` id) or a GAID folder sent to Zotero (keeps its `lc-` id). A linked folder takes its name
 * and parent from Zotero; GAID renames, moves or deletes unlinked folders only.
 */
export interface LibraryCollection {
  id: string;
  owner: string;
  name: string;
  source: LibrarySource;
  parentId?: string;
  zotero?: { connection: ZoteroConnectionKind; serverId?: string; libraryType: "user" | "group"; libraryId: string; collectionKey: string };
  createdAt?: string;
  /** Researcher-saved external notebook page, opened only; GAID-side field kept across Zotero reconcile and hub sync. */
  notebookUrl?: string;
}

/** CSL with numeric date parts: Zotero's CSL export writes them as strings ("2023"); CSL-JSON and GAID use numbers. */
export function numericCslDates<T extends CslItem>(csl: T): T {
  const out = { ...csl };
  for (const field of ["issued", "accessed"] as const) {
    const date = out[field] as { "date-parts"?: unknown[][] } | undefined;
    if (!date || !Array.isArray(date["date-parts"])) continue;
    (out as Record<string, unknown>)[field] = { ...date, "date-parts": date["date-parts"].map((parts) => (Array.isArray(parts) ? parts.map((p) => (typeof p === "string" && /^-?\d+$/.test(p.trim()) ? Number(p) : p)) : parts)) };
  }
  return out;
}

/** Folder ids of `id` and all its subfolders (cycle-safe). */
export function folderSubtree(collections: Pick<LibraryCollection, "id" | "parentId">[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of collections) if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); grew = true; }
  }
  return out;
}

/** Sync cursor and status of one Zotero library GAID follows. */
export interface ZoteroLibraryState {
  connection: ZoteroConnectionKind;
  serverId?: string;
  libraryType: "user" | "group";
  libraryId: string;
  name: string;
  /** `all` or the Zotero collection keys the researcher chose to follow. */
  follow: "all" | string[];
  libraryVersion: number;
  lastSyncAt?: string;
  /** Research-language state for the screen; raw errors stay behind 기술 정보 (UI guide R2). */
  state: ZoteroState;
  /** When the last refresh failed (cleared by the next successful one). */
  failedAt?: string;
  /** Technical detail of that failure: an error code and HTTP status only, never response bodies or keys. */
  detail?: string;
}

/**
 * Why Zotero could not be read, worded per state on the screen. `zotero-closed`/`local-api-off` are the PC (Local API)
 * states; `key-invalid`/`no-library-access` the web-key ones; `unreachable` is a network failure or time-out only.
 */
export type ZoteroState =
  | "ok"
  | "zotero-closed"
  | "local-api-off"
  | "key-rejected"
  | "key-invalid"
  | "no-library-access"
  | "library-not-found"
  | "rate-limited"
  | "server-error"
  | "library-changing"
  | "certificate-untrusted"
  | "unreachable"
  | "failed";

/** The only writes GAID makes to Zotero, each after the researcher confirms (ADR decision 3). */
export type ZoteroWrite =
  | { kind: "add-to-inbox"; itemId: string }
  | { kind: "add-note-link"; itemId: string; noteId: string; projectId: string }
  | { kind: "add-tags"; itemId: string; tags: string[] };

/**
 * A place in a source that supports a statement. Generalises hub authoring's `Anchor`: the quote is rechecked against
 * the page text when the PDF is reopened; a changed file (hash) or a quote no longer found makes it `moved`.
 */
export interface EvidenceAnchor {
  itemId: string;
  attachmentId?: string;
  page?: number;
  figureLabel?: string;
  zoteroAnnotationKey?: string;
  quote: string;
  fileSha256?: string;
  state: "verified" | "moved" | "unverified";
  checkedAt?: string;
}

/** `.kady/geo/literature.json`: what a project uses from the library (references only, no copies). */
export interface ProjectLiterature {
  schema: typeof PROJECT_LITERATURE_SCHEMA;
  collectionIds: string[];
  itemIds: string[];
}

/**
 * One source paper of an installed Workflow (gaid-workflow-cite-scope): found in the researcher's library by DOI, else
 * by exact title. `attached`: in the project's citation scope; `in-library`: can be attached; `not-in-library`: add it
 * through 논문 넣기 first.
 */
export interface WorkflowPaper {
  /** The package's own reference (DOI or file name). */
  ref: string;
  title: string;
  doi?: string;
  state: "attached" | "in-library" | "not-in-library";
  itemId?: string;
  itemTitle?: string;
  citationKey?: string;
  matchedBy?: "doi" | "title";
}

/** `GET /geo/library/workflow-papers?method=<runtimeName>` for the request's project. */
export interface WorkflowPapersResponse {
  method: string;
  papers: WorkflowPaper[];
}

/** `POST /geo/library/workflow-papers/attach`: the researcher's explicit consent for these items. */
export interface AttachWorkflowPapersBody {
  method: string;
  itemIds: string[];
}

export interface AttachWorkflowPapersResponse extends WorkflowPapersResponse {
  added: string[];
}

/**
 * `.kady/geo/literature.json` lists folders and single items; together (folders with their subfolders) they are the
 * project's citation scope. An empty file means no scope: the whole library counts.
 */

/** One Pandoc citation in Markdown: `[@key]`, `[@key, p. 12]`, `[see @a, pp. 3-5; @b]`. */
export interface NoteCitation {
  key: string;
  /** Locator text after the key (`p. 12`, `그림 4`), trimmed; absent when none. */
  locator?: string;
  /** Offset of the opening `[` of the bracket group in the input. */
  index: number;
}

// Pandoc citation keys: start with a letter, digit or `_`; inner characters may include :.#$%&-+?<>~/ (Pandoc manual,
// "Citation syntax"). A trailing punctuation character is not part of the key.
const KEY = String.raw`[\p{L}\p{N}_](?:[\p{L}\p{N}_:.#$%&+?<>~/-]*[\p{L}\p{N}_])?`;
const GROUP = /\[([^\[\]]*@[^\[\]]*)\](?!\()/gu;
const ITEM = new RegExp(String.raw`(?:^|[\s;])-?@(${KEY})(?:\s*,\s*([^;]*))?`, "gu");

/**
 * Bracketed Pandoc citations in Markdown, in order. Fenced and inline code are skipped; e-mail addresses and
 * Markdown links (`[text](url)`) are not citations.
 */
export function parseCitations(markdown: string): NoteCitation[] {
  const masked = maskCode(markdown);
  const out: NoteCitation[] = [];
  for (const group of masked.matchAll(GROUP)) {
    const inner = group[1];
    for (const item of inner.matchAll(ITEM)) {
      const locator = item[2]?.trim();
      out.push({ key: item[1], ...(locator ? { locator } : {}), index: group.index ?? 0 });
    }
  }
  return out;
}

/** Replace fenced blocks and inline code spans with spaces so offsets stay valid. */
function maskCode(text: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  return text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank).replace(/`[^`\n]*`/g, blank);
}

// --- Routes (`/geo/library/*`; the project comes from the usual X-Project-Id scope) ---------------------------------

/** One row of the library table (나안 columns: paper, year, source, read coverage, used in). */
export interface LibraryItemSummary {
  id: string;
  source: LibrarySource;
  title: string;
  /** "홍길동 외" style short author line, already shortened by the server. */
  authors: string;
  year?: number;
  container?: string;
  citationKey?: string;
  coverage: ReadCoverage;
  hasPdf: boolean;
  /** A PDF stored in GAID, which 서재 can show in its PDF pane (`GET /geo/library/items/:id/pdf`); a Zotero-only PDF is not. */
  storedPdf?: boolean;
  collectionIds: string[];
  tags: string[];
  used: { notes: number; workflows: number; projects: number };
  metadataConfirmed: boolean;
  addedAt: string;
  /** True when a retraction notice was seen for this paper. */
  retracted?: boolean;
  /** The researcher's own work (from ORCID). */
  ownWork?: boolean;
  kind: LibraryItemKind;
  /** Research-note items only. `local`: the note's project is on this GAID instance, so it can be opened and read. */
  note?: LibraryNoteSummary;
}

export interface LibraryNoteSummary {
  projectId: string;
  noteId: string;
  projectName: string;
  originLabel: string;
  date: string;
  status: LibraryNoteStatus;
  headline?: string;
  local: boolean;
  missing?: boolean;
  /** Papers of this library the note cites. */
  cites: number;
}

export interface LibraryListQuery {
  q?: string;
  source?: LibrarySource;
  /** Category; absent = both. */
  kind?: LibraryItemKind;
  /** Research notes only: status in the note file. */
  noteStatus?: LibraryNoteStatus;
  collectionId?: string;
  /** `unread` = coverage none/abstract; `cited` = cited in at least one research note; `mine` = own works (ORCID). */
  filter?: "unread" | "cited" | "project" | "mine";
  limit?: number;
  offset?: number;
}

export interface LibraryListResponse {
  items: LibraryItemSummary[];
  total: number;
  /** Paper counts (`all` = papers) plus `notes` (research notes) and notes per status. */
  counts: { all: number; zotero: number; gaid: number; unread: number; cited: number; mine: number; notes: number; notesPending: number; notesConfirmed: number };
  collections: LibraryCollection[];
  /** Items of the requested category (`kind`; papers when absent) per folder, subfolders included. */
  folderCounts: Record<string, number>;
  zotero: ZoteroLibraryState[];
}

/** Where an item is used (가안 detail pane "내 연구에서 쓰인 곳"). */
export type LibraryUse =
  /** `libraryItemId`: the citing note is in the library; `remote`: known only from that item (project on another PC). */
  | { kind: "note"; projectId: string; projectName: string; noteId: string; title: string; locators: string[]; libraryItemId?: string; remote?: boolean }
  /** A hub draft made from the item (`authoringId`), or a Workflow installed in a project whose source papers include it (`projectId`). */
  | { kind: "workflow"; entryId?: string; authoringId?: string; title: string; revision?: number; projectId?: string; projectName?: string }
  | { kind: "project"; projectId: string; projectName: string };

export interface LibraryItemResponse {
  item: LibraryItem;
  uses: LibraryUse[];
  /** Research-note items: whether the note can be opened on this GAID instance (project present, file found). */
  noteLocal?: boolean;
}

/** `POST /geo/library/notes`: bring a research note into the library (project from the body, else the request scope). */
export interface AddLibraryNoteBody {
  projectId?: string;
  noteId: string;
  collectionIds?: string[];
}

export interface AddLibraryNoteResponse {
  item: LibraryItem;
  /** False when the note was already in the library (the existing item, refreshed). */
  created: boolean;
}

/** `GET /geo/library/notes/candidates`: research notes of the projects on this GAID instance. */
export interface LibraryNoteCandidate {
  projectId: string;
  projectName: string;
  noteId: string;
  title: string;
  date: string;
  status: LibraryNoteStatus;
  headline?: string;
  /** Library item of this note, when it is already in the library. */
  itemId?: string;
}

export interface LibraryNoteCandidatesResponse {
  notes: LibraryNoteCandidate[];
  /** True when the list stopped at its bound. */
  truncated: boolean;
}

/** Add a GAID-managed item after the researcher confirmed the looked-up or typed metadata. */
export interface CreateLibraryItemBody {
  csl: CslItem;
  metadataOrigin: MetadataOrigin;
  collectionIds?: string[];
  tags?: string[];
  /** Content hash of a PDF uploaded before (`POST /geo/library/files`), attached to the new item. */
  pdfSha256?: string;
  signals?: UpdateSignal[];
}

export interface UploadedLibraryFile {
  sha256: string;
  size: number;
  mediaType: string;
  pages?: number;
}

/** Resolution of note citation keys against the library (note view, write/edit hook). */
export interface CitationResolution {
  key: string;
  itemId?: string;
  title?: string;
  /** One plain reference line for the note's reference list. */
  reference?: string;
  /** In the library but outside the project's citation scope (attached folders and items). */
  outsideScope?: boolean;
}

// --- Folders ---------------------------------------------------------------------------------------------------------

/** `POST /geo/library/collections/:id/items`: add or remove items. */
export interface FolderMembershipBody {
  itemIds: string[];
  action: "add" | "remove";
}

export interface FolderMembershipResult {
  changed: number;
  /** Zotero items added to the linked Zotero collection (written to Zotero). */
  writtenToZotero: number;
  /** Zotero items whose membership in a linked folder can only be removed in Zotero. */
  removeInZotero: string[];
}

/** Bibliography export formats; `text` is a plain APA-like reference list, not a full CSL style. */
export type ExportFormat = "bibtex" | "ris" | "csl-json" | "text";

/** One finding of a folder's reference check; never a verdict on a paper. */
export type FolderIssue =
  | { kind: "retracted" | "no-doi" | "unconfirmed" | "no-year" | "no-authors" | "unread" | "removed-from-zotero"; itemId: string; title: string }
  | { kind: "duplicate"; itemIds: string[]; title: string }
  /** A research note in a project that uses this folder cites a key outside the folder (or not in the library). */
  | { kind: "cited-outside"; key: string; itemId?: string; title?: string; projectId: string; projectName: string; noteId: string; noteTitle: string };

export interface FolderCheckResponse {
  folderId: string;
  items: number;
  /** Projects whose citation scope includes this folder. */
  projects: { id: string; name: string }[];
  issues: FolderIssue[];
}

/** Result of "Zotero로 보내기" for one item or a folder. */
export interface SendToZoteroResult {
  /** New Zotero items created from GAID items. */
  created: number;
  /** GAID items that were already in Zotero: merged into the Zotero copy, no new Zotero item. */
  merged: number;
  /** Existing Zotero items added to a linked collection. */
  addedToCollections: number;
  /** PDFs uploaded to Zotero. */
  attachments: number;
  /** Folders created in or linked to Zotero. */
  folders: number;
  /** Items not sent, with a research-language reason id for the screen. */
  skipped: { itemId: string; reason: "unsupported-type" | "pdf-failed" | "other-library" | "research-note" }[];
  /** Set when Zotero refused further writes (single-use key spent, key revoked); earlier steps are kept. */
  stopped?: ZoteroLibraryState["state"];
  item?: LibraryItem;
}

/** Update evidence from Crossref/OpenAlex (retraction, correction); never a verdict on the paper. */
export interface UpdateSignal {
  kind: "retraction" | "correction" | "update";
  relation: string;
  doi?: string;
  source: MetadataOrigin;
  label?: string;
  updatedAt?: string;
}

/** A looked-up reference the researcher confirms before it enters the library. */
export interface MetadataCandidate {
  csl: CslItem;
  metadataOrigin: MetadataOrigin;
  signals: UpdateSignal[];
  score?: number;
}

/** `POST /geo/library/lookup` with one of doi, url, title, or a stored PDF hash. */
export interface LookupBody {
  doi?: string;
  url?: string;
  title?: string;
  author?: string;
  pdfSha256?: string;
}

export interface LookupResponse {
  candidates: MetadataCandidate[];
  /** What the lookup could not do, worded by the screen: no text in the PDF (scan), no DOI found, a provider failed. */
  notes: ("pdf-no-text" | "no-doi" | "provider-error" | "not-found")[];
  titleGuess?: string;
}

/** `POST /geo/library/import` preview; nothing is stored until `/import/confirm`. */
export interface ImportPreview {
  items: CslItem[];
  errors: { index: number; message: string }[];
}
