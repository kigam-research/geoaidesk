/**
 * GAID Workspace home summary (gaid-ia-connect-workspace, ADR 2026-10-24 gaid-connect-workspace).
 *
 * The Workspace home shows, across all active (not archived) projects, what the researcher can continue (recent chats
 * and research notes with their state) and the Workflows installed in projects. The server builds it from the stores
 * that already exist per project (session metadata, live run state, research notes, the session exposure record,
 * installed methods and the catalogue); nothing is written.
 *
 *   GET /geo/workspace/home → WorkspaceHomeResponse   (not scoped by X-Project-Id; reads every active project)
 *
 * Researcher view: no session ids or internal paths are shown; ids here only open the item.
 */

export const WORKSPACE_HOME_SCHEMA = "gaid-workspace-home/v1";
/** At most this many `recent` entries, newest first. */
export const WORKSPACE_HOME_RECENT_LIMIT = 8;

/**
 * State of a recent entry, shown as one chip:
 * - `running`: a chat whose run is live now;
 * - `decisions`: a research note with open decisions for the researcher (`decisions` > 0);
 * - `unreviewed`: a research note not yet reviewed (검토 전);
 * - `checked`: a research note the researcher marked checked (확인함);
 * - `idle`: a chat with no live run.
 */
export type WorkspaceHomeState = "running" | "decisions" | "unreviewed" | "checked" | "idle";

export interface WorkspaceHomeWorkflowRef {
  /** Method slug or catalogue Workflow id. */
  id: string;
  title: string;
  /** Hub-recorded version (`0.1.1`) for installed hub Workflows; null for built-in or unknown. */
  version: string | null;
}

export interface WorkspaceHomeRecent {
  kind: "chat" | "note";
  projectId: string;
  projectName: string;
  /** Session id (chat) or research-note id (note); used only to open the entry. */
  id: string;
  title: string;
  /** The Workflow the chat was started from (exposure record) or the note's Workflow, when known. */
  workflow: WorkspaceHomeWorkflowRef | null;
  state: WorkspaceHomeState;
  /** Open decisions of a note; 0 otherwise. */
  decisions: number;
  /** ISO time of the last change (newest first). */
  updatedAt: string;
}

export interface WorkspaceHomeWorkflow {
  /** Method slug (installed) or catalogue Workflow id (built-in). */
  id: string;
  title: string;
  /** One-line purpose. */
  line: string;
  /** `catalogue` = 기본 Workflow; `shared` = installed from GAID Connect; `draft` = an installed Connect draft (초안). */
  source: "catalogue" | "shared" | "draft";
  version: string | null;
  /**
   * Ready to start in at least one of `projects` (no missing skill, environment or required input). `false` also means
   * "not checked yet" (only settled cached environment probes count), so the UI shows only `true`.
   */
  ready: boolean;
  /** Projects where it is installed (built-in Workflows: the projects that used it); most recent first. */
  projects: { id: string; name: string }[];
}

export interface WorkspaceHomeResponse {
  schemaVersion: typeof WORKSPACE_HOME_SCHEMA;
  recent: WorkspaceHomeRecent[];
  /** Installed Workflows first (most recently used first), then built-in ones that a project used. */
  workflows: WorkspaceHomeWorkflow[];
  /** Number of active projects. */
  projectCount: number;
  /** Projects that could not be read (counted, not named), so a partial summary is visible. */
  unreadableProjects: number;
}
