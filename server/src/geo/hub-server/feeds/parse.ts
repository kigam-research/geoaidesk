/** Only feed-supplied title/summary are retained. Never reads content:encoded or a linked page. */
import { Parser } from "htmlparser2";
import { FEED_LIMITS, type FeedItem, type FeedSourceDefinition } from "../../../../../web/src/geo/contracts/hub-feeds.ts";
import { HubServerError, sha256 } from "../core.ts";
import { httpUrl } from "./sources.ts";
interface Element { name: string; attrs: Record<string, string>; children: Element[]; parts: (string | Element)[] }
const content = (node: Element): string => node.parts.map((p) => typeof p === "string" ? p : ` ${content(p)} `).join("");
export function plain(input: string): string {
  let out = "";
  let hidden = 0;
  const parser = new Parser({ onopentag(name) { if (["script", "style"].includes(name)) hidden++; else if (!hidden) out += " "; },
    onclosetag(name) { if (["script", "style"].includes(name)) hidden = Math.max(0, hidden - 1); else if (!hidden) out += " "; },
    ontext(value) { if (!hidden) out += value; } }, { decodeEntities: true });
  parser.end(input);
  return out.replace(/\s+/gu, " ").trim();
}
export function truncate(input: string, max: number): string { const chars = [...input]; return chars.length > max ? chars.slice(0, max - 1).join("").trimEnd() + "…" : input; }
export function matches(source: Pick<FeedSourceDefinition, "match">, title: string, summary: string): boolean {
  const haystack = `${title}\n${summary}`.toLowerCase();
  return !source.match?.length || source.match.some((word) => /^[a-z]{1,3}$/i.test(word)
    ? new RegExp(`\\b${word}\\b`, "i").test(haystack) : haystack.includes(word.toLowerCase()));
}
export function iso(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const time = Date.parse(input); return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
export function item(source: FeedSourceDefinition, raw: { title: string; summary: string; link: string; guid?: string; date?: unknown; github?: FeedItem["github"] }, at: string): FeedItem | null {
  const link = httpUrl(raw.link);
  const fullTitle = plain(raw.title);
  let summary = plain(raw.summary).replace(/\s*The post\s+[\s\S]*?\s+appeared first on\s+[\s\S]*$/i, "").trim();
  if (fullTitle && summary.toLowerCase().startsWith(fullTitle.toLowerCase())) summary = summary.slice(fullTitle.length).replace(/^[\s:—–-]+/, "");
  if (!link || !fullTitle || !matches(source, fullTitle, summary)) return null;
  const title = truncate(fullTitle, FEED_LIMITS.titleChars);
  summary = truncate(summary, FEED_LIMITS.summaryChars);
  return { id: sha256(`${source.id}\n${raw.guid?.trim() || link}`).slice(0, 32), sourceId: source.id, sourceTitle: source.title,
    category: source.category, field: source.field, title, summary, link, publishedAt: iso(raw.date), fetchedAt: at,
    ...(raw.github ? { github: raw.github } : {}) };
}
export function parseFeed(xml: string, source: FeedSourceDefinition, at: string): FeedItem[] {
  const root: Element = { name: "document", attrs: {}, children: [], parts: [] };
  const stack = [root];
  const parser = new Parser({ onopentag(name, attrs) {
    const node: Element = { name: name.toLowerCase(), attrs, children: [], parts: [] };
    stack.at(-1)!.children.push(node); stack.at(-1)!.parts.push(node); stack.push(node);
  }, ontext(value) { stack.at(-1)!.parts.push(value); }, onclosetag() { if (stack.length > 1) stack.pop(); } }, { xmlMode: true, decodeEntities: true });
  parser.end(xml);
  const feed = root.children.find((n) => ["rss", "rdf:rdf", "feed"].includes(n.name));
  if (!feed) throw new HubServerError("RSS 또는 Atom 피드 형식을 읽지 못했습니다.");
  const entries = feed.name === "rss" ? feed.children.find((n) => n.name === "channel")?.children.filter((n) => n.name === "item") ?? []
    : feed.children.filter((n) => n.name === (feed.name === "feed" ? "entry" : "item"));
  return entries.flatMap((node) => {
    const get = (...names: string[]) => { for (const name of names) { const found = node.children.find((n) => n.name === name); if (found && content(found).trim()) return content(found); } return ""; };
    const links = node.children.filter((n) => n.name === "link");
    const link = feed.name === "feed" ? (links.find((n) => n.attrs.rel === "alternate") ?? links[0])?.attrs.href ?? "" : get("link");
    const result = item(source, { title: get("title"), link: link.trim(), guid: get("guid", "id"), summary: get("summary", "description", "content"), date: get("published", "pubdate", "dc:date", "updated") }, at);
    return result ? [result] : [];
  });
}
