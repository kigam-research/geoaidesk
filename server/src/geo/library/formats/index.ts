import type { CslItem } from "../../../../../web/src/geo/contracts/library.ts";
import { MAX_IMPORT_BYTES, MAX_ENTRIES, type BibliographyFormat, type ParseResult, message, validateCsl } from "./common.ts";
import { parseBibtex, exportBibtex } from "./bibtex.ts";
import { parseRis, exportRis } from "./ris.ts";
export { citationKeyFor, formatReference } from "./reference.ts";
export type { BibliographyFormat, ParseResult, EntryError } from "./common.ts";

/** One-based error indices refer to input entries, not successful imports; valid neighbours survive. */
export function parseBibliography(text: string, format: BibliographyFormat): ParseResult {
  if (Buffer.byteLength(text, "utf8") > MAX_IMPORT_BYTES) return { items: [], errors: [{ index: 0, message: "Bibliography exceeds 8 MiB" }] };
  if (format === "bibtex") return parseBibtex(text.replace(/^\uFEFF/, ""));
  if (format === "ris") return parseRis(text);
  if (format !== "csl-json") throw new Error("Unknown bibliography format");
  const result: ParseResult = { items: [], errors: [] };
  try {
    const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
    const rows = Array.isArray(value) ? value : [value];
    if (rows.length > MAX_ENTRIES) throw new Error("Too many bibliography entries");
    rows.forEach((row, i) => {
      try { result.items.push(validateCsl(row)); }
      catch (e) { result.errors.push({ index: i + 1, message: message(e) }); }
    });
  } catch (e) { result.errors.push({ index: 0, message: message(e) }); }
  return result;
}

export function exportBibliography(items: CslItem[], format: BibliographyFormat): string {
  items.forEach(validateCsl);
  if (format === "bibtex") return exportBibtex(items);
  if (format === "ris") return exportRis(items);
  if (format === "csl-json") return JSON.stringify(items, null, 2) + "\n";
  throw new Error("Unknown bibliography format");
}
