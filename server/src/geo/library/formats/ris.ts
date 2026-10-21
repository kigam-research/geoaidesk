import type { CslItem } from "../../../../../web/src/geo/contracts/library.ts";
import { MAX_ENTRIES, type ParseResult, message, nameText, parseName, validateCsl, yearOf } from "./common.ts";

const TYPES: Record<string, string> = { JOUR: "article-journal", EJOUR: "article-journal", BOOK: "book", CHAP: "chapter", CONF: "paper-conference", CPAPER: "paper-conference", THES: "thesis", RPRT: "report", DATA: "dataset", GEN: "article", UNPB: "manuscript" };
const FIELDS: Record<string, string> = { T2: "container-title", VL: "volume", IS: "issue", PB: "publisher", DO: "DOI", UR: "URL", SN: "ISSN", LA: "language", AB: "abstract", N1: "note", KW: "keyword" };

export function parseRis(input: string): ParseResult {
  const result: ParseResult = { items: [], errors: [] };
  let fields: Record<string, string[]> | undefined, last: string | undefined, index = 0, invalid = false;
  const fail = (text: string) => { result.errors.push({ index: index || 1, message: text }); invalid = true; };
  for (const line of input.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const match = /^([A-Z0-9]{2}) {2}-\s?(.*)$/.exec(line);
    if (!match) {
      if (!line.trim()) continue;
      if (/^\s/.test(line) && fields && last) fields[last][fields[last].length - 1] += ` ${line.trim()}`;
      else fail("Malformed RIS line");
      continue;
    }
    const [, tag, value] = match;
    if (tag === "TY") {
      if (fields) fail("Previous RIS entry is missing ER");
      index++; fields = { TY: [value] }; last = "TY"; invalid = false;
      if (index > MAX_ENTRIES) { fail("Too many bibliography entries"); break; }
      continue;
    }
    if (!fields) { fail(`RIS ${tag} occurs outside an entry`); continue; }
    if (tag === "ER") {
      if (!invalid) {
        const f = fields;
        const first = (...tags: string[]) => tags.map((t) => f[t]?.[0]).find(Boolean) ?? "";
        try {
          const csl: CslItem = { type: TYPES[first("TY")] ?? "article", title: first("TI", "T1", "CT"), "gaid-ris": f };
          for (const [tag, target] of Object.entries(FIELDS)) if (f[tag]?.length) csl[target] = f[tag].join(tag === "KW" ? "; " : "\n");
          if (!csl["container-title"]) csl["container-title"] = first("JO", "JF", "JA");
          const authors = [...(f.AU ?? f.A1 ?? [])].filter(Boolean);
          if (authors.length) csl.author = authors.map(parseName);
          if (f.A2?.length) csl.editor = f.A2.map(parseName);
          const date = first("PY", "Y1", "DA");
          if (date) {
            const parts = /^(\d{4})(?:[/-](\d{1,2}))?(?:[/-](\d{1,2}))?/.exec(date);
            if (!parts) throw new Error("Invalid RIS publication date");
            csl.issued = { "date-parts": [parts.slice(1).filter(Boolean).map(Number)] };
          }
          const pages = [...new Set([first("SP"), first("EP")].filter(Boolean))];
          if (pages.length) csl.page = pages.join("-");
          if (f.ID?.[0]) csl.id = f.ID[0];
          if (!TYPES[first("TY")]) result.errors.push({ index, message: `Unmapped RIS type preserved: ${first("TY")}` });
          result.items.push(validateCsl(csl));
        } catch (e) { fail(message(e)); }
      }
      fields = undefined; last = undefined;
    } else { (fields[tag] ??= []).push(value); last = tag; }
  }
  if (fields) fail("RIS entry is missing ER");
  return result;
}

export function exportRis(items: CslItem[]): string {
  const clean = (v: unknown) => String(v ?? "").replace(/[\r\n]+/g, " ");
  return items.map((item) => {
    validateCsl(item);
    const fields: [string, string][] = [];
    const add = (tag: string, v: unknown) => { if (v !== undefined && v !== "") fields.push([tag, clean(v)]); };
    add("TY", Object.entries(TYPES).find(([, type]) => type === item.type)?.[0] ?? "GEN");
    add("TI", item.title);
    for (const n of item.author ?? []) add("AU", nameText(n));
    for (const n of item.editor as CslItem["author"] ?? []) add("A2", nameText(n));
    if (yearOf(item)) add("PY", item.issued!["date-parts"][0].join("/"));
    for (const [tag, target] of Object.entries(FIELDS)) if (item[target]) add(tag, item[target]);
    if (item.page) { const [first, ...last] = item.page.split(/[-–]/); add("SP", first); if (last.length) add("EP", last.join("-")); }
    if (item.id) add("ID", item.id);
    const original = item["gaid-ris"] as Record<string, string[]> | undefined;
    const recognised = new Set(["TY", "TI", "T1", "CT", "JO", "JF", "JA", "AU", "A1", "A2", "PY", "Y1", "DA", "SP", "EP", "ID", "ER", ...Object.keys(FIELDS)]);
    for (const [tag, values] of Object.entries(original ?? {})) if (!recognised.has(tag) && /^[A-Z0-9]{2}$/.test(tag)) for (const v of values) add(tag, v);
    return fields.map(([tag, value]) => `${tag}  - ${value}`).join("\n") + "\nER  -\n";
  }).join("\n");
}
