/**
 * Pure mapping of ORCID Public API v3.0 JSON (`/person`, `/works`, bulk `/works/{put-codes}`) to GAID shapes.
 * Missing fields are normal: a work may have no DOI, year, journal or contributors.
 */
import type { CslItem, CslName, LibraryItem } from "../../../../web/src/geo/contracts/library.ts";
import type { OrcidWork, OrcidWorkMatch } from "../../../../web/src/geo/contracts/orcid.ts";
import { list, object, str, titleSimilarity } from "../library/metadata/mapping.ts";
import { cslYear, normalizeDoi } from "../library/store.ts";
import { parseBibliography } from "../library/formats/index.ts";

const value = (v: unknown) => str(object(v).value).trim();

/** Public display name of a `/person` body: credit name, else given + family; undefined when private or empty. */
export function personName(body: unknown): string | undefined {
  const name = object(object(body).name);
  const credit = value(name["credit-name"]);
  if (credit) return credit.slice(0, 200);
  const full = [value(name["given-names"]), value(name["family-name"])].filter(Boolean).join(" ");
  return full ? full.slice(0, 200) : undefined;
}

/** DOI of a work's external ids (`self` relationship; `version-of`/`part-of` ids name other works). */
function selfDoi(externalIds: unknown): string | undefined {
  for (const id of list(object(externalIds)["external-id"])) {
    const e = object(id);
    if (str(e["external-id-type"]).toLowerCase() !== "doi") continue;
    if (str(e["external-id-relationship"]) && str(e["external-id-relationship"]) !== "self") continue;
    const doi = normalizeDoi(value(e["external-id-normalized"]) || str(e["external-id-value"]));
    if (doi) return doi;
  }
  return undefined;
}

function year(date: unknown): number | undefined {
  const y = Number(value(object(date).year));
  return Number.isInteger(y) && y > 0 && y < 10_000 ? y : undefined;
}

/** Work-summary shape of `/works` without the library match. */
export type OrcidWorkSummary = Omit<OrcidWork, "match">;

/**
 * One row per work group. ORCID lists a group's summaries with the researcher's preferred source first, so the first
 * summary gives title/journal/year; the DOI and sources are taken from the whole group.
 */
export function parseWorks(body: unknown, limit: number): { works: OrcidWorkSummary[]; omitted: number } {
  const groups = list(object(body).group);
  const works: OrcidWorkSummary[] = [];
  for (const g of groups.slice(0, limit)) {
    const summaries = list(object(g)["work-summary"]).map(object);
    const first = summaries[0];
    if (!first) continue;
    const putCode = Number(first["put-code"]);
    const title = value(object(first.title).title);
    if (!Number.isSafeInteger(putCode) || !title) continue;
    const doi = selfDoi(object(g)["external-ids"]) ?? summaries.map((s) => selfDoi(s["external-ids"])).find(Boolean);
    const container = value(first["journal-title"]);
    const y = year(first["publication-date"]);
    const sources = [...new Set(summaries.map((s) => value(object(s.source)["source-name"])).filter(Boolean))];
    works.push({ putCode, title: title.slice(0, 1000), ...(container ? { container: container.slice(0, 500) } : {}), ...(y ? { year: y } : {}), type: str(first.type) || "other", ...(doi ? { doi } : {}), sources });
  }
  return { works, omitted: Math.max(0, groups.length - limit) };
}

/**
 * Library match of a work: an item imported from this work earlier (own-work provenance) or with the same DOI is the
 * same paper; else a near-identical title in the same year is only "similar".
 */
export function matchWork(work: OrcidWorkSummary, items: LibraryItem[], orcid?: string): OrcidWorkMatch {
  const imported = orcid ? items.find((i) => i.ownWork?.orcid === orcid && i.ownWork.putCode === work.putCode) : undefined;
  if (imported) return { kind: "in-library", itemId: imported.id, title: imported.csl.title, ownWork: true };
  if (work.doi) {
    const same = items.find((i) => normalizeDoi(i.csl.DOI) === work.doi);
    if (same) return { kind: "in-library", itemId: same.id, title: same.csl.title, ownWork: Boolean(same.ownWork) };
  }
  const similar = items.find((i) => {
    const doi = normalizeDoi(i.csl.DOI);
    if (doi && work.doi && doi !== work.doi) return false;
    return (work.year === undefined || cslYear(i.csl) === undefined || cslYear(i.csl) === work.year) && titleSimilarity(i.csl.title, work.title) >= 0.9;
  });
  return similar ? { kind: "similar", itemId: similar.id, title: similar.csl.title } : { kind: "new" };
}

const CSL_TYPES: Record<string, string> = {
  "journal-article": "article-journal",
  "conference-paper": "paper-conference",
  "conference-abstract": "paper-conference",
  "conference-poster": "paper-conference",
  "book": "book",
  "edited-book": "book",
  "book-chapter": "chapter",
  "report": "report",
  "working-paper": "report",
  "dissertation-thesis": "thesis",
  "preprint": "article",
  "data-set": "dataset",
  "software": "software",
  "patent": "patent",
  "magazine-article": "article-magazine",
  "newspaper-article": "article-newspaper",
  "review": "review",
  "encyclopedia-entry": "entry-encyclopedia",
  "dictionary-entry": "entry-dictionary",
  "lecture-speech": "speech",
  "website": "webpage",
};

function contributors(work: Record<string, unknown>): CslName[] {
  const names: CslName[] = [];
  for (const c of list(object(work.contributors).contributor).slice(0, 100)) {
    const name = value(object(c)["credit-name"]);
    if (!name) continue;
    const comma = name.indexOf(",");
    names.push(comma > 0 ? { family: name.slice(0, comma).trim(), given: name.slice(comma + 1).trim() } : { literal: name });
  }
  return names;
}

/**
 * CSL-JSON of a full ORCID work record. A BibTeX citation on the record fills the fields it has; the record's own
 * fields (title, type, DOI, date, journal) take precedence where present.
 */
export function cslFromWork(work: unknown): CslItem | undefined {
  const w = object(work);
  const title = value(object(w.title).title);
  if (!title) return undefined;
  const citation = object(w.citation);
  let base: Partial<CslItem> = {};
  if (str(citation["citation-type"]).toLowerCase() === "bibtex" && str(citation["citation-value"])) {
    const parsed = parseBibliography(str(citation["citation-value"]).slice(0, 64 * 1024), "bibtex").items[0];
    if (parsed) { const { id: _key, ...rest } = parsed; base = rest; }
  }
  const date = object(w["publication-date"]);
  const parts = [year(date), Number(value(date.month)) || undefined, Number(value(date.day)) || undefined].filter((n): n is number => typeof n === "number" && n > 0);
  const container = value(w["journal-title"]);
  const doi = selfDoi(w["external-ids"]);
  const url = value(w.url);
  const authors = contributors(w);
  const csl: CslItem = {
    ...base,
    type: CSL_TYPES[str(w.type)] ?? (typeof base.type === "string" ? base.type : "article"),
    title: title.slice(0, 1000),
  };
  if (parts.length) csl.issued = { "date-parts": [parts] };
  if (container) csl["container-title"] = container.slice(0, 500);
  if (doi) csl.DOI = doi;
  if (url && /^https?:\/\//i.test(url)) csl.URL = url.slice(0, 2000);
  if (authors.length) csl.author = authors;
  const language = str(w["language-code"]);
  if (language) csl.language = language.slice(0, 20);
  return csl;
}
