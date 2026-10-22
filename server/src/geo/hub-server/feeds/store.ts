import { FEED_CATEGORIES, FEED_FIELDS, FEED_LIMITS, HUB_FEEDS_SCHEMA, type FeedFetchResponse, type FeedFetchResult, type FeedItem, type FeedListResponse, type FeedSource, type FeedSourceDefinition } from "../../../../../web/src/geo/contracts/hub-feeds.ts";
import { HubDatabase, HubServerError, object, type AuditActor } from "../core.ts";
import { collectSource, type FeedFetchOptions } from "./fetch.ts";
import { definition, shippedSources, sourceId } from "./sources.ts";
interface SourceRow { id: string; record: string; last_success: string | null }
export interface FeedActor extends AuditActor { name: string }
export class HubFeeds {
  private readonly proposals: FeedSourceDefinition[];
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
  constructor(readonly hub: HubDatabase, private options: FeedFetchOptions & { proposals?: FeedSourceDefinition[] } = {}) {
    this.proposals = (options.proposals ?? shippedSources()).map(definition);
  }
  sources(): FeedSource[] {
    const rows = new Map(this.hub.all<SourceRow>("SELECT * FROM feed_sources").map((r) => [r.id, JSON.parse(r.record) as FeedSource]));
    return [...this.proposals.map((s) => rows.get(s.id) ?? { ...s, state: "proposed" as const, builtIn: true }),
      ...[...rows.values()].filter((s) => !this.proposals.some((p) => p.id === s.id))];
  }
  private source(id: unknown): FeedSource {
    sourceId(id);
    const source = this.sources().find((s) => s.id === id);
    if (!source) throw new HubServerError("출처를 찾을 수 없습니다.", 404);
    return source;
  }
  private write(source: FeedSource) {
    this.hub.run("INSERT INTO feed_sources(id,record) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record", source.id, JSON.stringify(source));
  }
  add(input: unknown, actor: FeedActor): FeedSource {
    const source = definition(input);
    if (this.sources().some((s) => s.id === source.id)) throw new HubServerError("이미 등록된 출처 식별자입니다.", 409);
    const out: FeedSource = { ...source, state: "approved", builtIn: false, decidedBy: actor.name, decidedAt: this.hub.now() };
    this.hub.tx(() => { this.write(out); this.hub.audit(actor, "feeds.add", source.id); });
    return out;
  }
  decide(id: unknown, input: unknown, actor: FeedActor): FeedSource {
    if (!object(input) || Object.keys(input).some((k) => k !== "state") || !["approved", "stopped"].includes(input.state as string))
      throw new HubServerError("출처 승인 또는 중지 상태를 확인해 주세요.");
    const source = this.source(id);
    // An existing row is the approved definition, even if the shipped proposal later changes.
    const out: FeedSource = { ...source, state: input.state as "approved" | "stopped", decidedBy: actor.name, decidedAt: this.hub.now() };
    this.hub.tx(() => { this.write(out); this.hub.audit(actor, `feeds.${out.state === "approved" ? "approve" : "stop"}`, out.id); });
    return out;
  }
  delete(id: unknown, actor: FeedActor) {
    const source = this.source(id);
    if (source.builtIn || this.proposals.some((p) => p.id === source.id)) throw new HubServerError("기본 제안 출처는 삭제할 수 없습니다. 중지를 사용하세요.", 409);
    this.hub.tx(() => {
      this.hub.run("DELETE FROM feed_items WHERE source_id=?", source.id);
      this.hub.run("DELETE FROM feed_sources WHERE id=?", source.id);
      this.hub.audit(actor, "feeds.delete", source.id);
    });
  }
  list(query: Record<string, unknown> = {}): FeedListResponse {
    const { category, field } = query;
    if ((category !== undefined && !FEED_CATEGORIES.includes(category as never)) || (field !== undefined && !FEED_FIELDS.includes(field as never)))
      throw new HubServerError("소식 분류와 분야를 확인해 주세요.");
    if (query.q !== undefined && (typeof query.q !== "string" || [...query.q].length > 100)) throw new HubServerError("검색어는 100자까지 입력할 수 있습니다.");
    const limit = query.limit === undefined ? 200 : Number(query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > FEED_LIMITS.listLimit) throw new HubServerError("소식 개수는 1~300 사이여야 합니다.");
    const sources = this.sources().filter((s) => s.state === "approved");
    const ids = new Set(sources.map((s) => s.id));
    const needle = (query.q as string | undefined)?.toLowerCase() ?? "";
    const perSource = new Map<string, number>();
    const unfiltered = !category && !field && !needle;
    const items = this.hub.all<{ record: string }>("SELECT record FROM feed_items ORDER BY sort_at DESC,id ASC")
      .map((row) => JSON.parse(row.record) as FeedItem).filter((i) => ids.has(i.sourceId) && (!category || i.category === category) && (!field || i.field === field) &&
        (!needle || `${i.title}\n${i.summary}`.toLowerCase().includes(needle))).filter((i) => {
          if (!unfiltered) return true;
          const count = perSource.get(i.sourceId) ?? 0;
          perSource.set(i.sourceId, count + 1);
          return count < FEED_LIMITS.perSourceUnfiltered;
        }).slice(0, limit);
    const latest = this.hub.all<SourceRow>("SELECT * FROM feed_sources WHERE last_success IS NOT NULL").filter((s) => ids.has(s.id)).map((s) => s.last_success!).sort().at(-1) ?? null;
    return { schema: HUB_FEEDS_SCHEMA, connected: true, items, sources: sources.map(({ id, title, publisher, homepage, category, field, lastFetch }) =>
      ({ id, title, publisher, homepage, category, field, ...(lastFetch ? { lastFetch } : {}) })), collectedAt: latest };
  }
  /** Serialize scheduled/manual batches. A failed source is isolated; approval is rechecked after network waits. */
  fetch(input: unknown = {}): Promise<FeedFetchResponse> {
    if (!object(input) || Object.keys(input).some((k) => k !== "sourceId")) throw new HubServerError("수집 요청을 확인해 주세요.");
    const id = input.sourceId;
    if (id !== undefined && this.source(id).state !== "approved") throw new HubServerError("승인된 출처만 수집할 수 있습니다.", 409);
    const run = this.queue.then(() => this.collect(id as string | undefined));
    this.queue = run.catch(() => {});
    return run;
  }
  private async collect(id?: string): Promise<FeedFetchResponse> {
    const results: FeedFetchResponse["results"] = [];
    for (const source of this.sources().filter((s) => s.state === "approved" && (!id || s.id === id))) {
      if (this.closed) break;
      const latest = this.sources().find((s) => s.id === source.id);
      if (!latest || latest.state !== "approved" || latest.decidedAt !== source.decidedAt) continue;
      let result: FeedFetchResult;
      try {
        const values = await collectSource(source, this.hub.now(), this.options);
        result = { at: this.hub.now(), ok: true, items: values.length };
        this.hub.tx(() => {
          // A stop/delete during fetch must not re-approve or recreate the source.
          const current = this.sources().find((s) => s.id === source.id);
          if (!current || current.state !== "approved" || current.decidedAt !== source.decidedAt) return;
          // Undated items of a source's first collection are older posts we happened to see now: keep them below dated
          // items (in feed order) instead of letting their collection time put them first.
          const first = !this.hub.get<{ last_success: string | null }>("SELECT last_success FROM feed_sources WHERE id=?", source.id)?.last_success;
          values.forEach((value, index) => {
            const old = this.hub.get<{ fetched_at: string; sort_at: string }>("SELECT fetched_at,sort_at FROM feed_items WHERE id=?", value.id);
            if (old) value.fetchedAt = old.fetched_at;
            const sortAt = value.publishedAt ?? old?.sort_at ?? (first ? new Date(-1000 * (index + 1)).toISOString() : value.fetchedAt);
            this.hub.run(`INSERT INTO feed_items(id,source_id,record,published_at,fetched_at,sort_at) VALUES (?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET record=excluded.record,published_at=excluded.published_at,sort_at=excluded.sort_at`,
              value.id, source.id, JSON.stringify(value), value.publishedAt, value.fetchedAt, sortAt);
          });
          this.write({ ...current, lastFetch: result });
          this.hub.run("UPDATE feed_sources SET last_success=? WHERE id=?", result.at, source.id);
          this.prune(source.id);
        });
      } catch (error) {
        result = { at: this.hub.now(), ok: false, items: 0, error: error instanceof HubServerError ? error.message : "출처 소식을 수집하지 못했습니다." };
        const current = this.sources().find((s) => s.id === source.id);
        if (current && current.state === "approved" && current.decidedAt === source.decidedAt) this.write({ ...current, lastFetch: result });
      }
      results.push({ sourceId: source.id, ...result });
    }
    return { results };
  }
  private prune(id: string) {
    const cutoff = new Date(Date.parse(this.hub.now()) - FEED_LIMITS.maxAgeDays * 86400_000).toISOString();
    this.hub.run("DELETE FROM feed_items WHERE source_id=? AND COALESCE(published_at,fetched_at) < ?", id, cutoff);
    this.hub.run(`DELETE FROM feed_items WHERE source_id=? AND id NOT IN
      (SELECT id FROM feed_items WHERE source_id=? ORDER BY sort_at DESC,id ASC LIMIT ?)`, id, id, FEED_LIMITS.itemsPerSource);
  }
  async close() { this.closed = true; await this.queue; }
}
