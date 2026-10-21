import type { CslItem } from "../../../../../web/src/geo/contracts/library.ts";
import { type ParseResult, MAX_ENTRIES, message, parseName, nameText, validateCsl, yearOf } from "./common.ts";
import { citationKeyFor } from "./reference.ts";

const TYPES: Record<string, string> = { article: "article-journal", book: "book", inbook: "chapter", incollection: "chapter",
  inproceedings: "paper-conference", conference: "paper-conference", phdthesis: "thesis", mastersthesis: "thesis", techreport: "report", misc: "article", unpublished: "manuscript" };
const FIELDS: Record<string, string> = { journal: "container-title", booktitle: "container-title", volume: "volume", number: "issue", pages: "page",
  publisher: "publisher", doi: "DOI", url: "URL", issn: "ISSN", isbn: "ISBN", language: "language", abstract: "abstract", edition: "edition", note: "note", keywords: "keyword" };

function tex(s: string): string {
  const combining: Record<string, string> = { "'": "\u0301", '`': "\u0300", '"': "\u0308", "^": "\u0302", "~": "\u0303", "=": "\u0304", "c": "\u0327", "v": "\u030c" };
  return s.replace(/\\textbackslash\{\}/g, "\uE000").replace(/\\\{/g, "\uE001").replace(/\\\}/g, "\uE002")
    .replace(/\\(['`"^~=cv])\s*\{?([A-Za-z])\}?/g, (_, accent: string, char: string) => (char + combining[accent]).normalize("NFC"))
    .replace(/\\([&%_$#])/g, "$1").replace(/[{}]/g, "")
    .replace(/\uE000/g, "\\").replace(/\uE001/g, "{").replace(/\uE002/g, "}").replace(/\s+/g, " ").trim();
}

/** Small balanced BibTeX reader: nested braces, quoted values, @string macros and # concatenation. */
export function parseBibtex(input: string): ParseResult {
  const result: ParseResult = { items: [], errors: [] };
  const macros = new Map(Object.entries({ jan: "1", feb: "2", mar: "3", apr: "4", may: "5", jun: "6", jul: "7", aug: "8", sep: "9", oct: "10", nov: "11", dec: "12" }));
  let pos = 0, index = 0;
  const whitespace = () => { for (;;) { while (/\s/.test(input[pos] ?? "") && pos < input.length) pos++; if (input[pos] !== "%") break; while (pos < input.length && input[pos] !== "\n") pos++; } };
  const readValue = (): string => {
    whitespace();
    let value = "";
    const opener = input[pos];
    if (opener === "{" || opener === '"') {
      pos++; let depth = 1, closed = false;
      while (pos < input.length) {
        const c = input[pos++];
        if (c === "\\") { value += c + (input[pos++] ?? ""); continue; }
        if (opener === "{" && c === "{") depth++;
        if ((opener === "{" && c === "}" && --depth === 0) || (opener === '"' && c === '"')) { closed = true; break; }
        value += c;
      }
      if (!closed) throw new Error("Unclosed BibTeX field");
    } else {
      const token = /^[^\s,#})]+/.exec(input.slice(pos))?.[0];
      if (!token) throw new Error("Missing BibTeX field value");
      pos += token.length;
      if (/^\d+$/.test(token)) value = token;
      else if (macros.has(token.toLowerCase())) value = macros.get(token.toLowerCase())!;
      else throw new Error(`Unknown BibTeX string macro: ${token}`);
    }
    whitespace();
    if (input[pos] === "#") { pos++; value += readValue(); }
    return value;
  };
  while (pos < input.length) {
    whitespace();
    if (pos >= input.length) break;
    const start = pos;
    let key: string | undefined;
    try {
      const header = /^@([a-z]+)\s*([({])/i.exec(input.slice(pos));
      if (!header) throw new Error("Expected a BibTeX entry");
      pos += header[0].length;
      const type = header[1].toLowerCase(), close = header[2] === "{" ? "}" : ")";
      if (["comment", "preamble"].includes(type)) {
        // Preamble is a value; comments are balanced uninterpreted text.
        if (type === "preamble") { readValue(); whitespace(); if (input[pos++] !== close) throw new Error("Unclosed preamble"); }
        else { let depth = 1; while (pos < input.length && depth) { const c = input[pos++]; if (c === "\\") pos++; else if (c === header[2]) depth++; else if (c === close) depth--; } if (depth) throw new Error("Unclosed comment"); }
        continue;
      }
      if (type === "string") {
        whitespace(); const m = /^([\w:-]+)\s*=/.exec(input.slice(pos));
        if (!m) throw new Error("Invalid @string"); pos += m[0].length;
        macros.set(m[1].toLowerCase(), readValue()); whitespace(); if (input[pos] === ",") pos++; whitespace();
        if (input[pos++] !== close) throw new Error("Unclosed @string"); continue;
      }
      if (index >= MAX_ENTRIES) throw new Error("Too many bibliography entries");
      index++;
      whitespace(); const k = /^[^,\s{}()]+\s*,/.exec(input.slice(pos));
      if (!k) throw new Error("BibTeX entry key is missing"); key = k[0].slice(0, -1).trim(); pos += k[0].length;
      const fields: Record<string, string> = {};
      for (;;) {
        whitespace();
        if (input[pos] === close) { pos++; break; }
        const field = /^([\w-]+)\s*=/.exec(input.slice(pos));
        if (!field) throw new Error("Invalid BibTeX field"); pos += field[0].length;
        const fieldName = field[1].toLowerCase();
        if (fieldName in fields) throw new Error(`Duplicate BibTeX field: ${fieldName}`);
        fields[fieldName] = readValue(); whitespace();
        if (input[pos] === ",") pos++;
        else if (input[pos] !== close) throw new Error("Missing BibTeX field separator");
      }
      const csl: CslItem = { id: key, type: TYPES[type] ?? "article", title: tex(fields.title ?? "") };
      for (const [name, target] of Object.entries(FIELDS)) if (fields[name]) csl[target] = tex(fields[name]);
      for (const name of ["author", "editor"]) if (fields[name]) csl[name] = fields[name].split(/\s+and\s+(?![^{}]*})/i).map((s) => {
        const n = parseName(s); return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, tex(v)]));
      });
      if (fields.date) {
        const parts = /^(\d{4})(?:-(\d\d))?(?:-(\d\d))?$/.exec(fields.date);
        if (!parts) throw new Error("Invalid BibTeX date");
        csl.issued = { "date-parts": [parts.slice(1).filter(Boolean).map(Number)] };
      } else if (fields.year) {
        const year = Number(fields.year);
        if (!Number.isInteger(year) || year < 1) throw new Error("Invalid BibTeX year");
        const parts = [year];
        if (fields.month) { const m = Number(macros.get(fields.month.toLowerCase()) ?? fields.month); parts.push(m); }
        if (fields.day) { if (!fields.month) throw new Error("BibTeX day requires month"); parts.push(Number(fields.day)); }
        csl.issued = { "date-parts": [parts] };
      }
      // Preserve fields we do not interpret for subsequent export; never silently discard them.
      csl["gaid-bibtex"] = { type, fields };
      if (!TYPES[type]) result.errors.push({ index, key, message: `Unmapped BibTeX type preserved: ${type}` });
      result.items.push(validateCsl(csl));
    } catch (e) {
      result.errors.push({ index: index || 1, key, message: message(e) });
      const next = /(?:^|\n)[ \t]*@[a-z]+\s*[{(]/ig; next.lastIndex = start + 1;
      const m = next.exec(input); if (!m) break; pos = m.index + (m[0].startsWith("\n") ? 1 : 0);
    }
  }
  return result;
}

const escape = (s: string) => s.replace(/[\\&%_$#{}]/g, (c) => c === "\\" ? "\\textbackslash{}" : `\\${c}`);
export function exportBibtex(items: CslItem[]): string {
  const taken = new Set<string>();
  return items.map((item) => {
    validateCsl(item);
    const requestedKey = item["citation-key"] ?? item.id;
    const key = typeof requestedKey === "string" && /^[A-Za-z0-9_][A-Za-z0-9_:./+-]*$/.test(requestedKey) && !taken.has(requestedKey)
      ? requestedKey : citationKeyFor(item, taken);
    taken.add(key);
    const old = item["gaid-bibtex"] as { type?: string; fields?: Record<string, string> } | undefined;
    const type = Object.entries(TYPES).find(([, v]) => v === item.type)?.[0] ?? old?.type ?? "misc";
    const fields = { ...old?.fields };
    for (const name of ["title", "author", "editor", "year", "date", "month", "day", ...Object.keys(FIELDS)]) delete fields[name];
    // Raw unknown fields are emitted escaped too; recognised fields always reflect current CSL metadata.
    for (const name of Object.keys(fields)) fields[name] = escape(tex(fields[name]));
    fields.title = escape(item.title);
    if (yearOf(item)) fields.year = `${yearOf(item)}`;
    const date = item.issued?.["date-parts"][0];
    if (date && date.length > 1) {
      fields.month = `${date[1]}`;
      fields.date = date.map((n, i) => String(n).padStart(i === 0 ? 4 : 2, "0")).join("-");
    }
    for (const name of ["author", "editor"] as const) {
      const names = item[name] as CslItem["author"];
      if (names?.length) fields[name] = names.map((n) => n.literal ? `{${escape(n.literal)}}` : escape(nameText(n))).join(" and ");
    }
    for (const [name, target] of Object.entries(FIELDS)) {
      const containerField = ["chapter", "paper-conference"].includes(item.type) ? "booktitle" : "journal";
      if (["booktitle", "journal"].includes(name) && name !== containerField) continue;
      if (typeof item[target] === "string" && item[target]) fields[name] = escape(String(item[target]));
    }
    return `@${type}{${key},\n${Object.entries(fields).map(([k, v]) => `  ${k} = {${v}}`).join(",\n")}\n}`;
  }).join("\n\n") + (items.length ? "\n" : "");
}
