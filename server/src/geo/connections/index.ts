/** Read-only neighbourhood over existing research records. No graph store. */
import fs from "node:fs";
import { t } from "../../../../web/src/geo/i18n.ts";
import path from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { ProjectPaths } from "../../projects.ts";
import { apiRelative, isUserVisible, isWithin } from "../../sandbox-fs.ts";
import { artifactProvenance, type ArtifactProvenance } from "../../provenance/lookup.ts";
import { readProjectSteps, USER_SESSION_ID } from "../../provenance/store.ts";
import { listResearchNotes } from "../notes/store.ts";
import { parseResearchNote } from "../notes/parser.ts";
import { markdownImageTargets } from "../markdown-images.ts";
import { projectNoteCitations } from "../library/uses.ts";
import { LibraryStore, libraryStore, shortAuthors, cslYear, isRetracted } from "../library/store.ts";
import { AuthoringStore } from "../authoring/store.ts";
import { installedMethods } from "../methods/local-methods.ts";
import type { LibraryItem, LibraryUse } from "../../../../web/src/geo/contracts/library.ts";
import { FIGURE_EXTENSIONS } from "../../../../web/src/geo/contracts/figures.ts";
import {
  CONNECTION_LIMITS, parseConnectionFocus, type ConnectionEdge, type ConnectionNode,
  type ConnectionNodeKind, type ConnectionMapResponse,
} from "../../../../web/src/geo/contracts/connections.ts";

export class ConnectionError extends Error {
  constructor(readonly statusCode: number, message: string) { super(message); }
}
const short = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 160);
const image = (p: string) => (FIGURE_EXTENSIONS as readonly string[]).includes(path.extname(p).toLowerCase());
const script = (p: string) => /\.(?:py|r|rmd|m|jl|ipynb|sh|js|ts)$/i.test(p);

/** Same source as LibraryUse kind=workflow, without changing the library module. */
async function paperWorkflowUses(store: LibraryStore, authoring: AuthoringStore): Promise<Map<string, (LibraryUse & { methodId?: string })[]>> {
  const out = new Map<string, (LibraryUse & { methodId?: string })[]>();
  let links: Record<string, string[]>;
  try { links = JSON.parse(fs.readFileSync(path.join(store.root, "links.json"), "utf8")).authoring ?? {}; }
  catch { return out; }
  for (const [item, ids] of Object.entries(links)) {
    if (!Array.isArray(ids)) continue;
    for (const id of ids.slice(0, 200)) {
      try {
        const p = await authoring.read(id);
        out.set(item, [...(out.get(item) ?? []), { kind: "workflow", authoringId: id, title: p.title, ...(p.packages?.at(-1)?.methodId ? { methodId: p.packages.at(-1)!.methodId } : {}), ...(p.hubEntry ? { entryId: p.hubEntry.entryId } : {}) }]);
      } catch { /* A deleted draft supplies no link. */ }
    }
  }
  return out;
}

export interface ConnectionOptions {
  store?: LibraryStore;
  authoring?: AuthoringStore;
  /** Test seam; production titles use the SDK's existing session history reader. */
  chats?: () => Promise<{ id: string; name?: string; created?: Date }[]>;
  workflowUses?: (item: LibraryItem) => LibraryUse[];
  locale?: "ko" | "en";
}

export async function connectionMap(paths: ProjectPaths, focus: string, depth = 1, options: ConnectionOptions = {}): Promise<ConnectionMapResponse> {
  const parsed = parseConnectionFocus(focus);
  if (!parsed || ![1, 2].includes(depth)) throw new ConnectionError(400, "Invalid connection focus or depth");
  const en = options.locale === "en";
  const locale = en ? "en" : "ko";
  const fallback = { chat: t("connections.kind.chat", {}, locale), workflow: t("connections.kind.workflow", {}, locale) };
  const nodes = new Map<string, ConnectionNode>();
  const edges = new Map<string, ConnectionEdge>();
  const adjacency = new Map<string, Set<string>>();
  const add = (kind: ConnectionNodeKind, ref: string, title: string, detail: string | null = null, attention: ConnectionNode["attention"] = null) => {
    const id = kind + ":" + ref;
    const old = nodes.get(id);
    if (!old) nodes.set(id, { id, kind, title: short(title), detail: detail ? short(detail) : null, depth: 0, attention, open: { kind, ref } });
    else if (attention && old.attention !== "missing") old.attention = attention;
    return id;
  };
  const link = (from: string, to: string, kind: ConnectionEdge["kind"], confidence: ConnectionEdge["confidence"] = "observed") => {
    if (from === to) return;
    const key = JSON.stringify([from, to, kind]);
    if (edges.get(key)?.confidence === "observed") return;
    edges.set(key, { from, to, kind, confidence });
    for (const [a, b] of [[from, to], [to, from]]) {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      adjacency.get(a)!.add(b);
    }
  };
  // Validate real ancestors as well as lexical paths, including missing leaves.
  const safePath = (ref: string): string | null => {
    if (!ref || path.isAbsolute(ref) || /\\|\0/.test(ref)) return null;
    const abs = path.resolve(paths.sandbox, ref);
    if (!isWithin(paths.sandbox, abs) || !isUserVisible(abs, paths.sandbox)) return null;
    let ancestor = abs;
    try {
      while (!fs.existsSync(ancestor)) {
        const up = path.dirname(ancestor);
        if (up === ancestor) return null;
        ancestor = up;
      }
      if (!isWithin(fs.realpathSync(paths.sandbox), fs.realpathSync(ancestor))) return null;
    } catch { return null; }
    return apiRelative(paths.sandbox, abs).normalize("NFC");
  };
  const fileNode = (ref: string, attention: ConnectionNode["attention"] = null) => {
    const p = safePath(ref);
    if (!p) return null;
    return add(image(p) ? "figure" : "file", p, path.posix.basename(p), path.posix.dirname(p) === "." ? null : path.posix.dirname(p), !fs.existsSync(path.join(paths.sandbox, p)) ? "missing" : attention);
  };
  const chats = new Map((await (options.chats?.() ?? SessionManager.list(paths.sandbox, paths.sessionsDir))).map(c => [c.id, c]));
  const chatNode = (id: string, date?: string) => {
    if (id === USER_SESSION_ID || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) return null;
    const c = chats.get(id);
    return add("chat", id, c?.name || fallback.chat, c?.created?.toISOString().slice(0, 10) ?? date?.slice(0, 10) ?? null);
  };
  const store = options.store ?? libraryStore();
  const items = await store.all();
  const byKey = new Map<string, LibraryItem>();
  for (const item of items) for (const key of item.aliases?.citationKeys ?? []) byKey.set(key, item);
  for (const item of items) if (item.citationKey) byKey.set(item.citationKey, item);
  const paperNode = (item: LibraryItem) => add("paper", item.id, item.csl.title || t("connections.kind.paper", {}, locale), [shortAuthors(item.csl, en ? "en" : "ko"), cslYear(item.csl)].filter(Boolean).join(" · "), isRetracted(item.signals) ? "retracted" : null);
  const citations = new Map(projectNoteCitations(paths).map(n => [n.noteId, n.citations]));
  for (const note of listResearchNotes(paths).notes) {
    const id = add("note", note.id, note.title, note.date);
    for (const c of citations.get(note.id) ?? []) {
      const item = byKey.get(c.key);
      if (item) link(id, paperNode(item), "cites");
    }
    for (const session of note.sessions) {
      const chat = chatNode(session, note.date);
      if (chat) link(chat, id, "wrote");
    }
    const p = safePath(note.path);
    if (!p) continue;
    let content = "";
    try {
      const file = path.join(paths.sandbox, p);
      if (fs.statSync(file).size > 2 * 1024 * 1024) continue;
      content = fs.readFileSync(file, "utf8");
    } catch { continue; }
    const cover = parseResearchNote(content, note.id).cover;
    for (const target of new Set([...(cover ? [cover] : []), ...markdownImageTargets(content)])) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(target)) continue;
      try {
        const figure = fileNode(path.posix.join(path.posix.dirname(p), decodeURIComponent(target.split(/[?#]/)[0])));
        if (figure && nodes.get(figure)?.kind === "figure") link(id, figure, "contains");
      } catch { /* Invalid URL escaping supplies no file. */ }
    }
  }
  const methods = installedMethods(paths);
  const methodTitles = new Map(methods.flatMap(m => m.file.method ? [[m.file.method.methodId, m.file.method.title[en ? "en" : "ko"] || m.file.method.title.en || fallback.workflow] as const] : []));
  const trials = path.join(paths.kadyDir, "geo", "method-trials");
  let trialNames: string[] = [];
  try { trialNames = fs.readdirSync(trials).filter(n => n.endsWith(".json")).sort().slice(0, 200); } catch { /* none */ }
  for (const name of trialNames) {
    try {
      const p = path.join(trials, name);
      if (fs.statSync(p).size > 256 * 1024) continue;
      const trial = JSON.parse(fs.readFileSync(p, "utf8"));
      if (trial.schemaVersion !== "gaid-method-trial/v1" || typeof trial.methodId !== "string" || typeof trial.sessionId !== "string") continue;
      const chat = chatNode(trial.sessionId, trial.startedAt);
      if (chat) link(add("workflow", trial.methodId, methodTitles.get(trial.methodId) ?? fallback.workflow), chat, "started-from");
    } catch { /* Unreadable records stay untouched. */ }
  }
  const uses = options.workflowUses ? null : await paperWorkflowUses(store, options.authoring ?? new AuthoringStore());
  for (const item of items) {
    for (const use of options.workflowUses?.(item) ?? uses?.get(item.id) ?? []) {
      if (use.kind !== "workflow") continue;
      const ref = "methodId" in use && typeof use.methodId === "string" ? use.methodId : use.entryId ?? use.authoringId;
      if (ref) link(paperNode(item), add("workflow", ref, use.title), "made-from");
    }
  }
  // Candidate outputs come from inputs; actual version-aware links come from lineage.
  const downstream = new Map<string, Set<string>>();
  const steps = readProjectSteps(paths.id);
  for (const step of steps) for (const input of step.inputs) {
    if (!downstream.has(input.path)) downstream.set(input.path, new Set());
    for (const output of step.outputs) downstream.get(input.path)!.add(output.path);
  }
  const loaded = new Set<string>();
  let truncated = false;
  const loadLineage = (ref: string) => {
    const p = safePath(ref);
    if (!p || loaded.has(p)) return;
    if (loaded.size >= CONNECTION_LIMITS.nodes + 1) { truncated = true; return; }
    loaded.add(p);
    let record: ArtifactProvenance;
    try { record = artifactProvenance(paths.id, p); } catch { return; }
    fileNode(p, record.staleness === "stale" ? "changed" : null);
    for (const n of record.lineage.nodes) fileNode(n.path, !n.current ? "missing" : n.changedSinceUse ? "changed" : null);
    // An image whose bytes equal its image input is a copy (e.g. a result figure copied into a note), not a new drawing.
    const shaOf = new Map(record.lineage.nodes.map(n => [n.path, n.current?.sha256]));
    const isCopy = (from: string, to: string) => image(from) && image(to) && !!shaOf.get(to) && shaOf.get(from) === shaOf.get(to);
    for (const e of record.lineage.edges) {
      if (e.confidence === "declared") continue;
      const from = fileNode(e.from), to = fileNode(e.to);
      const kind = isCopy(e.from, e.to) ? "copied" : image(e.to) && script(e.from) ? "drew" : "used";
      if (from && to) link(from, to, kind, e.confidence === "observed" ? "observed" : "inferred");
    }
    for (const n of record.lineage.nodes) {
      if (!image(n.path) || !n.stepId) continue;
      const step = record.lineage.steps[n.stepId];
      if (!step || step.role === "user" || record.lineage.edges.some(e => e.to === n.path && (script(e.from) || isCopy(e.from, e.to)))) continue;
      const chat = chatNode(step.sessionId, new Date(step.timestamp).toISOString()), figure = fileNode(n.path);
      if (chat && figure) link(chat, figure, "drew");
    }
  };
  let normalizedFocus = focus;
  if (parsed.kind === "figure" || parsed.kind === "file") {
    const p = safePath(parsed.ref);
    if (!p) throw new ConnectionError(400, "Invalid sandbox path");
    normalizedFocus = fileNode(p)!;
    loadLineage(p);
  } else if (parsed.kind === "paper") {
    const item = items.find(i => i.id === parsed.ref || i.aliases?.ids?.includes(parsed.ref));
    if (item) normalizedFocus = paperNode(item);
  } else if (parsed.kind === "chat" && chats.has(parsed.ref)) chatNode(parsed.ref);
  if (!nodes.has(normalizedFocus)) throw new ConnectionError(404, "Connection focus not found");
  const distance = new Map<string, number>([[normalizedFocus, 0]]);
  const queue = [normalizedFocus];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i], hops = distance.get(id)!;
    if (hops >= depth) continue;
    const node = nodes.get(id)!;
    if (node.kind === "file" || node.kind === "figure") {
      loadLineage(node.open.ref);
      for (const output of downstream.get(node.open.ref) ?? []) loadLineage(output);
    }
    if (node.kind === "chat") {
      for (const step of steps.filter(s => s.sessionId === node.open.ref)) for (const output of step.outputs) if (image(output.path)) loadLineage(output.path);
    }
    for (const next of adjacency.get(id) ?? []) {
      if (distance.has(next) || !nodes.has(next)) continue;
      if (distance.size >= CONNECTION_LIMITS.nodes) { truncated = true; continue; }
      distance.set(next, hops + 1); queue.push(next);
    }
  }
  for (const id of distance.keys()) {
    const node = nodes.get(id)!;
    if (node.kind === "figure" || node.kind === "file") loadLineage(node.open.ref);
  }
  return {
    focus: normalizedFocus,
    nodes: [...distance].map(([id, d]) => ({ ...nodes.get(id)!, depth: d })),
    edges: [...edges.values()].filter(e => distance.has(e.from) && distance.has(e.to)), truncated,
  };
}
