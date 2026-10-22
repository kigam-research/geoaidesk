/**
 * Connection map (gaid-research-visuals, ADR docs/adr/2026-10-22-figure-records-and-connection-map.md decision 8). The map
 * shows the neighbourhood of one focus item inside the researcher's own work: papers, research notes, figures, files, chats
 * and Workflows, joined only by links GAID already records (note citations, the chats that wrote a note, a note's figures,
 * provenance lineage, method trials and Workflows made from papers). It is computed per request; there is no graph store.
 *
 * IO-free: imported by server/src/geo/connections/ and web/src/geo/connections/.
 */

export type ConnectionNodeKind = "paper" | "note" | "figure" | "file" | "chat" | "workflow";
export const CONNECTION_NODE_KINDS: readonly ConnectionNodeKind[] = ["paper", "note", "figure", "file", "chat", "workflow"];

/**
 * Edge meaning, read from → to:
 * - `cites`: note → paper (a citation in the note).
 * - `wrote`: chat → note (the chat's agent wrote or edited the note).
 * - `contains`: note → figure (the note shows the figure).
 * - `drew`: file (script) → figure, or chat → figure when no script was recorded.
 * - `used`: file (data) → figure or file → file (a recorded input of the step that wrote it).
 * - `started-from`: workflow → chat (the chat was started from the Workflow).
 * - `made-from`: paper → workflow (the Workflow was authored from the paper).
 */
export type ConnectionEdgeKind = "cites" | "wrote" | "contains" | "drew" | "used" | "started-from" | "made-from";

/** Focus id forms: `paper:<libraryItemId>`, `note:<noteId>`, `figure:<path>`, `file:<path>`, `chat:<sessionId>`, `workflow:<methodId>`. */
export type ConnectionFocus = `${ConnectionNodeKind}:${string}`;

export const CONNECTION_LIMITS = { nodes: 80, depth: 2 } as const;

export interface ConnectionNode {
  /** `<kind>:<id>`, unique in a response. */
  id: string;
  kind: ConnectionNodeKind;
  /** Short display title (note title, paper title, file name, Workflow name, chat title). */
  title: string;
  /** One secondary line (year and authors, date, folder), already shortened by the server. */
  detail: string | null;
  /** Hops from the focus. */
  depth: number;
  /** Something about this node needs attention: a figure or input changed since use, a missing file, a retracted paper. */
  attention: "changed" | "missing" | "retracted" | null;
  /** What opening the node does: a note id, a sandbox path, a chat id, a library item id or a method id. */
  open: { kind: ConnectionNodeKind; ref: string };
}

export interface ConnectionEdge {
  from: string;
  to: string;
  kind: ConnectionEdgeKind;
  /** Inferred provenance edges are leads, not facts; drawn dashed. */
  confidence: "observed" | "inferred";
}

/** GET /geo/connections?focus=<ConnectionFocus>&depth=1|2 */
export interface ConnectionMapResponse {
  focus: string;
  nodes: ConnectionNode[];
  edges: ConnectionEdge[];
  /** True when the node limit cut the neighbourhood. */
  truncated: boolean;
}

export function parseConnectionFocus(value: string): { kind: ConnectionNodeKind; ref: string } | null {
  const at = value.indexOf(":");
  if (at <= 0) return null;
  const kind = value.slice(0, at) as ConnectionNodeKind;
  const ref = value.slice(at + 1);
  if (!CONNECTION_NODE_KINDS.includes(kind) || !ref || ref.length > 1024) return null;
  return { kind, ref };
}

export function connectionNodeId(kind: ConnectionNodeKind, ref: string): string {
  return `${kind}:${ref}`;
}
