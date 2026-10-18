/**
 * Research notes (gaid-notebook-review; format docs/geo/research-notes.md). A research note is one Markdown file per
 * analysis (one research question) at `연구노트/<id>/index.md` in the project sandbox, with its figures in
 * `연구노트/<id>/figures/`. The file is the master: the researcher may edit it, Obsidian opens the folder as is, and
 * the server only parses it. The AI agent writes and updates notes with the ordinary write/edit tools; the existing
 * notebook entries stay as the work record behind a note.
 *
 * Server side: server/src/geo/notes/ imports this IO-free file.
 */

/** Sandbox-relative folder that holds every research note (visible in the file tree). */
export const RESEARCH_NOTES_DIR = "연구노트";
export const RESEARCH_NOTE_FILE = "index.md";
/** Folder name of a note: `YYYY-MM-DD-<topic>`; topic is letters/digits (any script), `-` or `_`. */
export const RESEARCH_NOTE_ID = /^\d{4}-\d{2}-\d{2}-[\p{L}\p{N}_-]{1,80}$/u;

/** Frontmatter `status`. Shown as 검토 전 / 확인함 / 대체됨; only the researcher sets `confirmed`. */
export type ResearchNoteStatus = "pending" | "confirmed" | "superseded";
export const RESEARCH_NOTE_STATUSES: readonly ResearchNoteStatus[] = ["pending", "confirmed", "superseded"];

/**
 * Section headings the parser recognises (Korean and English; the note follows the reply language).
 * Order in the file: glance, results, method, limits, decisions, evidence.
 */
export const RESEARCH_NOTE_SECTIONS = {
  glance: ["한눈에", "At a glance"],
  results: ["결과", "Results"],
  method: ["한 일", "What was done"],
  limits: ["한계", "Limits"],
  decisions: ["결정할 일", "Decisions"],
  evidence: ["근거", "Evidence"],
} as const;
export type ResearchNoteSection = keyof typeof RESEARCH_NOTE_SECTIONS;

/** One option line `- 가) <text> (권장: <reason>)` / `- a) <text> (recommended: <reason>)`. */
export interface ResearchNoteOption {
  /** The label as written: `가`, `나`, `a`, `b` … */
  label: string;
  text: string;
  recommended: boolean;
  /** Text after `권장:` / `recommended:`, when given. */
  reason: string | null;
}

/** One numbered question under the decisions section. */
export interface ResearchNoteDecision {
  /** 1-based number as written in the note. */
  number: number;
  question: string;
  options: ResearchNoteOption[];
}

/** A format problem the parser found; shown to the researcher as "형식 확인 필요" and to the agent after a write. */
export interface ResearchNoteProblem {
  code: "frontmatter" | "title" | "status" | "section-missing" | "decision-format" | "image-missing";
  /** Section key, frontmatter field or image path the problem is about. */
  target?: string;
}

/** The chat-started method behind a note, from the method-trial records of the chats that wrote it. */
export interface ResearchNoteMethod {
  /** Display name of the installed method, when it is still installed. */
  name: string | null;
  methodId: string;
  workflowId: string | null;
  /** The researcher's trial assessment, verbatim; null when not assessed. */
  assessment: "useful" | "needs-revision" | "failed" | null;
}

export interface ResearchNoteSummary {
  /** Folder name under RESEARCH_NOTES_DIR. */
  id: string;
  /** Sandbox-relative path of index.md. */
  path: string;
  title: string;
  /** Frontmatter `date` (YYYY-MM-DD), else the id's date. */
  date: string;
  status: ResearchNoteStatus;
  /** Frontmatter `headline`: the one-line conclusion. */
  headline: string | null;
  /** Sandbox-relative path of the frontmatter `cover` image when it exists. */
  cover: string | null;
  /** Ids from frontmatter `supersedes` (comma-separated or a list). */
  supersedes: string[];
  /** Id of a note whose `supersedes` names this one (then status reads as superseded). */
  supersededBy: string | null;
  decisions: ResearchNoteDecision[];
  /** Chat (session) ids whose lead agent wrote or edited the note, oldest first. Never shown as text (R1). */
  sessions: string[];
  method: ResearchNoteMethod | null;
  /** File mtime, ISO 8601. */
  updatedAt: string;
  problems: ResearchNoteProblem[];
}

/** GET /geo/notes */
export interface ResearchNoteListResponse {
  dir: typeof RESEARCH_NOTES_DIR;
  /** Newest first by date, then updatedAt. Folders without index.md are skipped; at most 500 notes. */
  notes: ResearchNoteSummary[];
}

/** GET /geo/notes/:id — the Markdown is read through the same response so list and body agree. */
export interface ResearchNoteResponse {
  note: ResearchNoteSummary;
  content: string;
}

/** POST /geo/notes/:id/status — rewrites only the frontmatter `status` line; answers the updated ResearchNoteSummary itself. */
export interface ResearchNoteStatusRequest {
  status: ResearchNoteStatus;
}
