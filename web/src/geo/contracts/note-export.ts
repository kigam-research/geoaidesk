/**
 * Research-note exports (gaid-note-bundle-export; user decision 2026-10-24, report
 * reports/2026-10-24-gaid-notebooklm-review §3.4 proposal 2 and §3.5 나). IO-free; server side
 * server/src/geo/notes/export.ts imports it.
 *
 * Two downloads start from one research note:
 * - 결과 묶음 (result bundle): the note folder (body and figures), fingerprints (sha256) of the data files the note's chats
 *   read or wrote, the environment records of those chats, the Workflow version and 지침, and the cited papers. For another
 *   researcher or a reviewer to check. Data files themselves are never included; the bundle does not claim reproduction.
 * - 공개 자료 내보내기 (public material export): only files the researcher ticks, each confirmed as allowed to leave the
 *   institute: the note as Markdown, the Workflow 지침 as Markdown, and PDFs of cited papers. For manual upload to Gemini
 *   Notebook. GAID calls no Google service and uploads nothing.
 *
 * Both are previewed first. The preview carries a `digest` of what would be written; the download sends it back and the
 * server refuses (409) when the note, its files or the candidate list changed in between.
 */

export const NOTE_BUNDLE_LIMITS = {
  /** Files copied from the note folder (index.md, figures/ …). */
  noteFiles: 200,
  /** Bytes copied from the note folder. */
  noteBytes: 64 * 1024 * 1024,
  /** Data fingerprints listed; more are counted as a gap. */
  dataFiles: 2000,
  /** Environment records included. */
  environments: 16,
  /** Bytes hashed to compare recorded fingerprints with the files as they are now. Over budget → `unknown`. */
  currentHashBytes: 2 * 1024 * 1024 * 1024,
  /** One file larger than this is not re-hashed (state `unknown`). */
  currentHashFile: 512 * 1024 * 1024,
} as const;

export const PUBLIC_EXPORT_LIMITS = {
  /** One paper PDF. */
  paperBytes: 50 * 1024 * 1024,
  /** Papers offered. */
  papers: 50,
  /** Whole export. */
  totalBytes: 200 * 1024 * 1024,
} as const;

/** What a file of the result bundle is. */
export type NoteBundlePart = "about" | "note" | "data" | "environment" | "workflow" | "references" | "checksums";

export interface NoteBundleFile {
  /** Path inside the ZIP (`note/index.md`, `note/figures/…`, `data-fingerprints.json` …). */
  name: string;
  part: NoteBundlePart;
  bytes: number;
  sha256: string;
}

/** One data file a chat behind the note read or wrote, as provenance recorded it. */
export interface NoteDataFingerprint {
  /** Sandbox-relative path. */
  path: string;
  /** sha256 recorded when the file was used; null when it was not hashed then. */
  sha256: string | null;
  bytes: number;
  /** ISO time of the latest recorded use. */
  usedAt: string;
  /** `read`: used as input; `written`: produced or changed by the analysis. Both → `written`. */
  use: "read" | "written";
  /** The file now compared with the recorded fingerprint. */
  now: "same" | "changed" | "missing" | "unknown";
}

export interface NoteBundleWorkflow {
  /** Title of the installed method, null when it is no longer installed. */
  title: string | null;
  methodId: string;
  workflowId: string | null;
  /** Hub version at the time the chat started (`0.1.2`); null for a draft or an unknown origin (shown as 초안). */
  version: string | null;
  /** The 지침 document is included only while the method is installed. */
  instructions: boolean;
}

export interface NoteBundleReference {
  key: string;
  /** Formatted reference line; null when the key is not in 서재. */
  reference: string | null;
}

/** What the bundle could not include or confirm; each is named in the preview and the bundle README. */
export type NoteBundleGap =
  | "no-chat" // no chat is recorded as having written the note
  | "no-provenance" // the chats have no recorded file use
  | "data-limit" // more data files than NOTE_BUNDLE_LIMITS.dataFiles
  | "unhashed-data" // some data files were used without a recorded fingerprint
  | "no-environment" // no environment record for the chats
  | "no-workflow" // the note did not come from a Workflow chat
  | "workflow-removed" // the Workflow's method is no longer installed; version kept, 지침 left out
  | "unresolved-citations" // some citation keys are not in 서재
  | "missing-figure"; // an image the note links to does not exist

/** GET /geo/notes/:id/bundle */
export interface NoteBundlePreview {
  noteId: string;
  title: string;
  /** sha256 over the file list (names and hashes). Send back with the download. */
  digest: string;
  files: NoteBundleFile[];
  /** Sum of file bytes (uncompressed). */
  totalBytes: number;
  data: NoteDataFingerprint[];
  environments: number;
  workflow: NoteBundleWorkflow | null;
  references: NoteBundleReference[];
  gaps: NoteBundleGap[];
}

/** POST /geo/notes/:id/bundle → application/zip with `X-Content-SHA256`. */
export interface NoteBundleRequest {
  digest: string;
  locale?: "ko" | "en";
}

export type PublicExportKind = "note" | "workflow" | "paper";

export interface PublicExportCandidate {
  /** Stable within one preview: `note`, `workflow`, `paper:<library item id>`. */
  id: string;
  kind: PublicExportKind;
  /** File name inside the ZIP. */
  name: string;
  /** What the researcher reads: note title, Workflow title, paper reference. */
  title: string;
  bytes: number;
  sha256: string;
  /** Papers: licence text from the paper's metadata, null when not recorded (shown as 이용 조건 확인 안 됨). */
  licence: string | null;
  /** Papers: citation key as used in the note. */
  key?: string;
}

/** Papers cited in the note that cannot be offered, with the reason. */
export interface PublicExportSkipped {
  key: string;
  title: string | null;
  reason: "not-in-library" | "no-pdf" | "too-large";
}

/** GET /geo/notes/:id/public-export */
export interface PublicExportPreview {
  noteId: string;
  /** sha256 over the candidate list (ids, names, hashes). */
  digest: string;
  candidates: PublicExportCandidate[];
  skipped: PublicExportSkipped[];
}

/**
 * POST /geo/notes/:id/public-export → application/zip with `X-Content-SHA256`. Every listed file must carry
 * `mayLeave: true` (the researcher's per-file confirmation that it may leave the institute); anything else is 400. The
 * server keeps a local record of what was exported (`.kady/geo/public-exports.jsonl`: time, note, file names, sha256).
 */
export interface PublicExportRequest {
  digest: string;
  files: { id: string; mayLeave: boolean }[];
  locale?: "ko" | "en";
}

/** Order the preview lists bundle parts in. */
export const NOTE_BUNDLE_PART_ORDER: readonly NoteBundlePart[] = ["note", "data", "environment", "workflow", "references", "about", "checksums"];
