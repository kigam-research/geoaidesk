/**
 * Project workspace state on the GAID server (gaid-project-resume).
 *
 * The browser's per-project workspace (open chat tabs and the active one,
 * per-tab composer settings and draft text, open files, panel layout) is kept
 * in `<sandbox>/.kady/geo/workspace-state.json`, so the project reopens in its
 * last state from any PC or browser. The server stores the client-sanitized
 * object as is; the client re-sanitizes whatever it reads
 * (`web/src/lib/workspace-persistence.ts`). Concurrent browsers: the last save
 * wins. Binary drafts (composer attachments, queued-message images) stay in the
 * browser that made them; the record only names them.
 *
 *   GET /geo/workspace-state  → GeoWorkspaceStateResponse
 *   PUT /geo/workspace-state  { state, clientId } → GeoWorkspaceStateSaved
 *
 * Both are scoped by X-Project-Id; the response echoes `projectId` so a reply
 * that fell back to the default project (unknown id on a GET) is recognized.
 */

export const WORKSPACE_STATE_SCHEMA = "gaid-workspace-state/v1";
/** Upper bound of the serialized `state` (a started Workflow block may be up to 200,000 chars per tab). */
export const WORKSPACE_STATE_MAX_BYTES = 4 * 1024 * 1024;

export interface GeoWorkspaceStateRecord {
  schemaVersion: typeof WORKSPACE_STATE_SCHEMA;
  /** Increases by one per save. */
  revision: number;
  savedAt: string;
  /** Random per-browser id of the last writer (diagnostics only). */
  clientId: string;
  /** Stored project workspace state, sanitized again by the client on load. */
  state: Record<string, unknown>;
}

export interface GeoWorkspaceStateResponse {
  projectId: string;
  record: GeoWorkspaceStateRecord | null;
}

export interface GeoWorkspaceStateSaved {
  projectId: string;
  revision: number;
  savedAt: string;
}
