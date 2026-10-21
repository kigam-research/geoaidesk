import type { CslItem, CslName } from "../../../../../web/src/geo/contracts/library.ts";

export type BibliographyFormat = "bibtex" | "ris" | "csl-json";
export interface EntryError { index: number; key?: string; message: string }
export interface ParseResult { items: CslItem[]; errors: EntryError[] }
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const MAX_ENTRIES = 10_000;

export function validateCsl(value: unknown): CslItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Entry must be a CSL object");
  const v = value as CslItem;
  if (typeof v.title !== "string" || !v.title.trim()) throw new Error("Entry title is missing");
  if (typeof v.type !== "string" || !v.type.trim()) throw new Error("Entry type is missing");
  for (const field of ["author", "editor"] as const) {
    const names = v[field];
    if (names !== undefined && (!Array.isArray(names) || names.some((n: CslName) => !n || typeof n !== "object" ||
      ![n.family, n.given, n.literal].some((s) => typeof s === "string" && s.trim()) ||
      [n.family, n.given, n.literal].some((s) => s !== undefined && typeof s !== "string")))) throw new Error(`Invalid ${field} names`);
  }
  if (v.issued !== undefined && (!v.issued || !Array.isArray(v.issued["date-parts"]) ||
    !v.issued["date-parts"].length || v.issued["date-parts"].some((p) => !Array.isArray(p) || !p.length || p.length > 3 ||
      p.some((n) => !Number.isInteger(n)) || p[0] < 1 || (p[1] !== undefined && (p[1] < 1 || p[1] > 12)) ||
      (p[2] !== undefined && (p[2] < 1 || p[2] > 31))))) throw new Error("Invalid issued date-parts");
  for (const field of ["DOI", "URL", "volume", "issue", "page", "publisher", "container-title"])
    if (v[field] !== undefined && typeof v[field] !== "string") throw new Error(`Invalid ${field}`);
  return v;
}

export function parseName(value: string): CslName {
  const s = value.trim();
  if (s.startsWith("{") && s.endsWith("}")) return { literal: s.slice(1, -1) };
  if (s.includes(",")) {
    const [family, ...given] = s.split(",").map((x) => x.trim());
    return { family, ...(given.join(" ") ? { given: given.join(" ") } : {}) };
  }
  // Do not invent the family/given split of Korean or a single-token name.
  if (/[^\u0000-\u024f\s.'-]/u.test(s) || !s.includes(" ")) return { literal: s };
  const parts = s.split(/\s+/);
  return { family: parts.pop()!, given: parts.join(" ") };
}

export const nameText = (n: CslName) => n.literal ?? [n.family, n.given].filter(Boolean).join(", ");
export const yearOf = (csl: CslItem) => csl.issued?.["date-parts"]?.[0]?.[0];
export const message = (e: unknown) => e instanceof Error ? e.message : "Invalid entry";
