import { Parser } from "htmlparser2";
import type { CslItem, CslName } from "../../../../../web/src/geo/contracts/library.ts";
import { doiCandidates } from "./identifiers.ts";
import type { MetadataRecord, MetadataSignal } from "./types.ts";

export const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
export const str = (v: unknown): string => typeof v === "string" ? v : typeof v === "number" ? `${v}` : "";
export function plain(text: unknown): string {
  let out = "";
  new Parser({ ontext: (s) => { out += s; } }, { decodeEntities: true }).end(str(text));
  return out.replace(/\s+/g, " ").trim();
}
const first = (v: unknown) => plain(Array.isArray(v) ? v[0] : v);
const date = (v: unknown): CslItem["issued"] => {
  const parts = list(object(v)["date-parts"]).map((p) => list(p).filter((n): n is number => typeof n === "number" && Number.isFinite(n)));
  return parts[0]?.length ? { "date-parts": parts } : undefined;
};
const compact = <T extends object>(v: T): T => Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== "")) as T;
function names(v: unknown): CslName[] | undefined {
  const result = list(v).map(object).map((n) => compact({ family: plain(n.family) || undefined, given: plain(n.given) || undefined,
    literal: plain(n.name) || undefined })).filter((n) => n.family || n.given || n.literal);
  return result.length ? result : undefined;
}
function kind(relation: string): MetadataSignal["kind"] {
  return /retract|withdraw/i.test(relation) ? "retraction" : /correct|errat/i.test(relation) ? "correction" : "update";
}

export function fromCrossref(value: unknown): MetadataRecord {
  const w = object(value);
  const title = first(w.title);
  if (!title) throw new Error("Crossref record has no title");
  const signals: MetadataSignal[] = [];
  for (const u of list(w["update-to"]).map(object)) {
    const relation = `update-to:${str(u.type) || "update"}`;
    signals.push({ kind: kind(relation), relation, doi: doiCandidates(str(u.DOI))[0], source: "crossref" });
  }
  for (const [relation, entries] of Object.entries(object(w.relation))) {
    if (!/retract|withdraw|correct|errat|update/i.test(relation)) continue;
    for (const entry of list(entries).map(object)) signals.push({ kind: kind(relation), relation,
      doi: doiCandidates(str(entry.id))[0], source: "crossref" });
  }
  if (w["update-type"]) {
    const relation = `update-type:${str(w["update-type"]) || str(object(w["update-type"]).type) || "update"}`;
    signals.push({ kind: kind(relation), relation, source: "crossref" });
  }
  const typeMap: Record<string, string> = { "journal-article": "article-journal", "proceedings-article": "paper-conference", "book-chapter": "chapter",
    "posted-content": "article", "dataset": "dataset", "report": "report", "book": "book" };
  const csl: CslItem = compact({
    type: typeMap[str(w.type)] ?? "article", title,
    author: names(w.author), issued: date(w.issued) ?? date(w.published) ?? date(w["published-print"]) ?? date(w["published-online"]),
    "container-title": first(w["container-title"]), volume: str(w.volume), issue: str(w.issue), page: str(w.page),
    publisher: plain(w.publisher), DOI: doiCandidates(str(w.DOI))[0], URL: str(w.URL),
    ISSN: first(w.ISSN), language: str(w.language), abstract: plain(w.abstract),
  });
  return { csl, metadataOrigin: "crossref", metadataConfirmed: false, signals };
}

export function fromOpenAlex(value: unknown): MetadataRecord {
  const w = object(value);
  const title = plain(w.title || w.display_name);
  if (!title) throw new Error("OpenAlex record has no title");
  const source = object(object(w.primary_location).source);
  const biblio = object(w.biblio);
  const author = list(w.authorships).map(object).map((n) => ({ literal: plain(n.raw_author_name || object(n.author).display_name) })).filter((n) => n.literal);
  const issued = /^(\d{4})(?:-(\d\d))?(?:-(\d\d))?/.exec(str(w.publication_date));
  const year = Number(w.publication_year);
  const pages = [str(biblio.first_page), str(biblio.last_page)].filter(Boolean);
  const csl: CslItem = compact({ type: w.type === "book" ? "book" : w.type === "dataset" ? "dataset" : "article-journal", title,
    author: author.length ? author : undefined,
    issued: issued ? { "date-parts": [issued.slice(1).filter(Boolean).map(Number)] } : year > 0 ? { "date-parts": [[year]] } : undefined,
    DOI: doiCandidates(str(w.doi || object(w.ids).doi))[0], URL: str(object(w.primary_location).landing_page_url || w.doi || w.id),
    "container-title": plain(source.display_name), ISSN: first(source.issn), volume: str(biblio.volume), issue: str(biblio.issue),
    page: [...new Set(pages)].join("-"), language: str(w.language),
  });
  return { csl, metadataOrigin: "openalex", metadataConfirmed: false,
    signals: w.is_retracted === true ? [{ kind: "retraction", relation: "is_retracted", source: "openalex" }] : [] };
}

/** Unicode word/character bigrams cover Korean as well as Latin titles without a language model. */
export function titleSimilarity(a: string, b: string): number {
  const norm = (s: string) => plain(s).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2));
  const xs = grams(x), ys = grams(y), counts = new Map<string, number>();
  for (const g of ys) counts.set(g, (counts.get(g) ?? 0) + 1);
  let common = 0;
  for (const g of xs) if ((counts.get(g) ?? 0) > 0) { common++; counts.set(g, counts.get(g)! - 1); }
  return xs.length + ys.length ? 2 * common / (xs.length + ys.length) : 0;
}
