import { Parser } from "htmlparser2";
import type { MetadataRecord } from "./types.ts";
import { doiCandidates } from "./identifiers.ts";

interface Node { name: string; attrs: Record<string, string>; text: string; children: Node[] }
/** XML mode: entities decoded, CDATA read, external entities never fetched. */
export function parseKciXml(xml: string): MetadataRecord[] {
  const root: Node = { name: "root", attrs: {}, text: "", children: [] };
  const stack = [root];
  new Parser({
    onopentag(name, attrs) { const node = { name, attrs, text: "", children: [] }; stack.at(-1)!.children.push(node); stack.push(node); },
    ontext(text) { stack.at(-1)!.text += text; },
    onclosetag() { if (stack.length > 1) stack.pop(); },
  }, { xmlMode: true, decodeEntities: true }).end(xml);
  const all = (n: Node, name: string): Node[] => [...(n.name === name ? [n] : []), ...n.children.flatMap((c) => all(c, name))];
  const text = (n: Node): string => (n.text + n.children.map(text).join("")).trim();
  const get = (n: Node, name: string) => all(n, name).map(text).find(Boolean) ?? "";
  if (all(root, "error").length || all(root, "errorCode").some((n) => !["", "0"].includes(text(n))))
    throw new Error("KCI returned an API error");
  const records = all(root, "record");
  if (!records.length && !all(root, "total").length) throw new Error("Unrecognised KCI XML response");
  return records.map((n) => {
    const titles = all(n, "article-title");
    const titleNode = titles.find((t) => t.attrs.lang === "original") ?? titles[0];
    const title = titleNode ? text(titleNode) : "";
    if (!title) throw new Error("KCI record has no title");
    const year = Number(get(n, "pub-year"));
    const page = [...new Set([get(n, "fpage"), get(n, "lpage")].filter(Boolean))].join("-");
    const authors = all(n, "author").map((a) => text(a).replace(/\s*\([^)]*\)\s*$/, "")).filter(Boolean);
    return { csl: { type: "article-journal", title, ...(authors.length ? { author: authors.map((literal) => ({ literal })) } : {}),
      ...(year ? { issued: { "date-parts": [[year]] } } : {}),
      "container-title": get(n, "journal-name"), publisher: get(n, "publisher-name"),
      volume: get(n, "volume"), issue: get(n, "issue"), page, DOI: doiCandidates(get(n, "doi"))[0], URL: get(n, "url"),
    }, metadataOrigin: "kci", metadataConfirmed: false, signals: [] };
  });
}
