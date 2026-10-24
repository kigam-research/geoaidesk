/**
 * A Workflow's source papers in the researcher's library (gaid-workflow-cite-scope, F23). A hub package records the
 * papers it was made from in `gaid-method.json` `sources[]`: a DOI, or for a paper without one its file name and title.
 * Library item ids are personal, so the papers are found in the installer's library by DOI, else by exact title. Only an
 * explicit request attaches them to a project's citation scope (`.kady/geo/literature.json`).
 */
import type { MethodSourceRef } from "../../../../web/src/geo/contracts/methods.ts";
import type { LibraryCollection, LibraryItem, ProjectLiterature, WorkflowPaper } from "../../../../web/src/geo/contracts/library.ts";
import { normalizeDoi } from "./store.ts";
import { projectItems } from "./uses.ts";

/** At most this many papers of one Workflow are resolved (a package lists at most 30 sources). */
const MAX_PAPERS = 50;

const titleKey = (value: unknown) =>
  typeof value === "string" ? value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() : "";

/** The papers among a package's sources: every DOI, and file/url sources the package marks as a paper with a title. */
export function workflowPaperSources(sources: MethodSourceRef[]): { doi?: string; title?: string; ref: string }[] {
  const out: { doi?: string; title?: string; ref: string }[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const doi = source.kind === "doi" ? normalizeDoi(source.ref) : undefined;
    const paper = doi || (/^paper/i.test(source.documentKind ?? "") && titleKey(source.title));
    if (!paper) continue;
    const key = doi ? `doi:${doi}` : `title:${titleKey(source.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ref: source.ref, ...(doi ? { doi } : {}), ...(source.title ? { title: source.title } : {}) });
    if (out.length >= MAX_PAPERS) break;
  }
  return out;
}

/** Each source paper with the library item it matches and whether the project's citation scope already holds it. */
export function resolveWorkflowPapers(
  sources: MethodSourceRef[],
  items: LibraryItem[],
  literature: ProjectLiterature,
  collections: Pick<LibraryCollection, "id" | "parentId">[] = [],
): WorkflowPaper[] {
  const papers = items.filter((i) => (!i.kind || i.kind === "paper") && !i.removedFromSourceAt);
  const byDoi = new Map<string, LibraryItem>();
  const byTitle = new Map<string, LibraryItem>();
  for (const item of papers) {
    const doi = normalizeDoi(item.csl.DOI);
    if (doi && !byDoi.has(doi)) byDoi.set(doi, item);
    const title = titleKey(item.csl.title);
    if (title && !byTitle.has(title)) byTitle.set(title, item);
  }
  const scope = new Set(projectItems(literature, papers, collections).map((i) => i.id));
  return workflowPaperSources(sources).map((source) => {
    let item = (source.doi && byDoi.get(source.doi)) || byTitle.get(titleKey(source.title));
    // Same title but a different DOI (a preprint and its article, an erratum): not the same paper.
    const itemDoi = item && normalizeDoi(item.csl.DOI);
    if (item && source.doi && itemDoi && itemDoi !== source.doi) item = undefined;
    const base = { ref: source.ref, title: source.title ?? item?.csl.title ?? source.ref, ...(source.doi ? { doi: source.doi } : {}) };
    if (!item) return { ...base, state: "not-in-library" as const };
    return {
      ...base,
      state: scope.has(item.id) ? ("attached" as const) : ("in-library" as const),
      itemId: item.id,
      itemTitle: item.csl.title,
      ...(item.citationKey ? { citationKey: item.citationKey } : {}),
      matchedBy: source.doi && byDoi.get(source.doi) === item ? ("doi" as const) : ("title" as const),
    };
  });
}

/** Literature with the given items added (only items among `papers` that are in the library and not yet attached). */
export function withWorkflowPapers(literature: ProjectLiterature, papers: WorkflowPaper[], itemIds: string[]): { collectionIds: string[]; itemIds: string[]; added: string[] } {
  const wanted = new Set(itemIds);
  const added = papers.filter((p) => p.state === "in-library" && p.itemId && wanted.has(p.itemId)).map((p) => p.itemId!);
  return { collectionIds: literature.collectionIds, itemIds: [...new Set([...literature.itemIds, ...added])], added: [...new Set(added)] };
}
