/** Source definitions are snapshotted when approved, never fetched from a proposal implicitly. */
import { readFileSync } from "node:fs";
import { FEED_CATEGORIES, FEED_FIELDS, FEED_SOURCE_ID, FEED_SOURCE_KINDS, type FeedSourceDefinition } from "../../../../../web/src/geo/contracts/hub-feeds.ts";
import { HubServerError, object, text } from "../core.ts";

export function httpUrl(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 4096) return null;
  try { const url = new URL(input); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function sourceId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !FEED_SOURCE_ID.test(id)) throw new HubServerError("출처 식별자를 확인해 주세요.");
}
export function definition(input: unknown): FeedSourceDefinition {
  if (!object(input)) throw new HubServerError("출처 정보를 확인해 주세요.");
  const allowed = ["id", "kind", "title", "publisher", "homepage", "url", "repo", "skipPrereleases", "queries", "category", "field", "match", "reason"];
  if (Object.keys(input).some((k) => !allowed.includes(k))) throw new HubServerError("출처에 알 수 없는 항목이 있습니다.");
  sourceId(input.id);
  if (!FEED_SOURCE_KINDS.includes(input.kind as never) || !FEED_CATEGORIES.includes(input.category as never) || !FEED_FIELDS.includes(input.field as never))
    throw new HubServerError("출처 종류, 분류와 분야를 확인해 주세요.");
  const homepage = httpUrl(input.homepage);
  if (!homepage) throw new HubServerError("출처 홈페이지 주소는 http 또는 https여야 합니다.");
  const out: FeedSourceDefinition = { id: input.id, kind: input.kind as FeedSourceDefinition["kind"], title: text(input.title, "출처 이름", 300),
    publisher: text(input.publisher, "발행처", 300), homepage, category: input.category as FeedSourceDefinition["category"],
    field: input.field as FeedSourceDefinition["field"], reason: text(input.reason, "선정 이유", 2000) };
  if (input.kind === "feed") {
    const url = httpUrl(input.url);
    if (!url || ["repo", "skipPrereleases", "queries"].some((k) => k in input)) throw new HubServerError("피드 주소와 피드 종류의 항목을 확인해 주세요.");
    out.url = url;
  } else if (input.kind === "github-releases") {
    if (typeof input.repo !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/.test(input.repo) ||
        ["url", "queries"].some((k) => k in input) || ("skipPrereleases" in input && typeof input.skipPrereleases !== "boolean"))
      throw new HubServerError("GitHub 저장소와 릴리스 항목을 확인해 주세요.");
    out.repo = input.repo;
    if (typeof input.skipPrereleases === "boolean") out.skipPrereleases = input.skipPrereleases;
  } else {
    if (["url", "repo", "skipPrereleases"].some((k) => k in input) || !Array.isArray(input.queries) || input.queries.length < 1 || input.queries.length > 5)
      throw new HubServerError("GitHub 검색어를 1~5개 입력해 주세요.");
    out.queries = input.queries.map((q) => text(q, "GitHub 검색어", 200));
  }
  if ("match" in input) {
    if (!Array.isArray(input.match) || input.match.length > 60) throw new HubServerError("선별 단어는 60개까지 입력할 수 있습니다.");
    out.match = input.match.map((word) => text(word, "선별 단어", 200));
  }
  return out;
}
export function shippedSources(): FeedSourceDefinition[] {
  const raw = JSON.parse(readFileSync(new URL("../../../../../geo/feeds/sources.json", import.meta.url), "utf8"));
  if (!object(raw) || !Array.isArray(raw.sources)) throw new Error("Invalid shipped feed sources");
  const sources = raw.sources.map(definition);
  if (new Set(sources.map((s) => s.id)).size !== sources.length) throw new Error("Duplicate shipped feed source");
  return sources;
}
