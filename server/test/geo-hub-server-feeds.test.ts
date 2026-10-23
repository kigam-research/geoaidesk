/** Deterministic parser, transport, persistence, auth and scheduling checks. No external network. */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FEED_LIMITS, type FeedSourceDefinition } from "../../web/src/geo/contracts/hub-feeds.ts";
import { buildHubServer, HubDatabase, type HubServerApp } from "../src/geo/hub-server/index.ts";
import { backupHub, checkBackup } from "../src/geo/hub-server/backup.ts";
import { HubFeeds } from "../src/geo/hub-server/feeds/store.ts";
import { definition, shippedSources } from "../src/geo/hub-server/feeds/sources.ts";
import { item, matches, parseFeed, plain } from "../src/geo/hub-server/feeds/parse.ts";
import { collectSource, readResponse } from "../src/geo/hub-server/feeds/fetch.ts";
import { intervalHours, scheduleFeeds } from "../src/geo/hub-server/feeds/schedule.ts";
const at = "2026-10-22T01:00:00.000Z";
const source: FeedSourceDefinition = { id: "test-source", kind: "feed", title: "Source", publisher: "Publisher", homepage: "https://example.org/", url: "https://example.org/rss", category: "papers", field: "general", reason: "시험 출처" };
const actor = { id: "operator", name: "operator (CLI)", device: "CLI" };
const rss = (n = 1) => `<rss><channel>${Array.from({ length: n }, (_, i) => `<item><title>Title ${i}</title><link>https://example.org/${i}</link><guid>guid-${i}</guid><description>Summary ${i}</description><pubDate>${new Date(Date.parse(at) - i * 1000).toUTCString()}</pubDate></item>`).join("")}</channel></rss>`;
const asFetch = (fn: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>) => vi.fn(fn) as unknown as typeof fetch;
const fetchOK = asFetch(() => new Response(rss()));
const roots: string[] = [];
const apps: HubServerApp[] = [];
const databases: HubDatabase[] = [];
function home() {
  const work = join(homedir(), "data/geoaidesk/work/gaid-hub-feeds/tests");
  mkdirSync(work, { recursive: true }); const root = mkdtempSync(join(work, "case-")); roots.push(root); return root;
}
function db() { const hub = new HubDatabase({ home: home(), now: () => at }); databases.push(hub); return hub; }
function app() { const hub = buildHubServer({ home: home(), now: () => at, feedFetch: fetchOK, feedProposals: [source] }); apps.push(hub); return hub; }
afterEach(async () => { vi.useRealTimers(); for (const a of apps.splice(0)) await a.close(); for (const d of databases.splice(0)) d.close(); for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); vi.clearAllMocks(); });

describe("feed parsing", () => {
  it("parses Nature RDF, original entities and dc:date without fetching linked text", () => {
    const values = parseFeed(`<rdf:RDF xmlns:rdf="urn:rdf"><item><title>Earth &amp; ocean</title><link>https://nature.example/article</link><description>&lt;p&gt;An &lt;b&gt;original&lt;/b&gt; abstract.&lt;/p&gt;</description><dc:date>2026-10-21T12:00:00Z</dc:date><content:encoded>Never use this full text</content:encoded></item></rdf:RDF>`, source, at);
    expect(values).toHaveLength(1); expect(values[0]).toMatchObject({ title: "Earth & ocean", summary: "An original abstract.", publishedAt: "2026-10-21T12:00:00.000Z" });
  });
  it("parses Copernicus RSS, drops a repeated title and does not substitute encoded full text", () => {
    const values = parseFeed(`<rss><channel><item><title>River change</title><link>https://hess.example/1</link><description><![CDATA[<p>River change</p><p>A. Author</p><p>Short abstract</p>]]></description><pubDate>Wed, 21 Oct 2026 12:00:00 GMT</pubDate></item><item><title>No abstract</title><link>https://hess.example/2</link><content:encoded>FULL</content:encoded></item></channel></rss>`, source, at);
    expect(values[0].summary).toBe("A. Author Short abstract"); expect(values[1].summary).toBe(""); expect(values[1].publishedAt).toBeNull();
  });
  it("reads GeekNews Atom HTML content, alternate links and summary preference", () => {
    const values = parseFeed(`<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>gn-1</id><title>AI &amp; GIS</title><link rel="self" href="https://news.example/self"/><link rel="alternate" href="https://news.example/1"/><content type="html">&lt;p&gt;A &lt;strong&gt;feed&lt;/strong&gt; description&lt;/p&gt;</content><updated>2026-10-20</updated></entry><entry><title>Second</title><link href="https://news.example/2"/><summary>Summary</summary><content>Ignore content</content><published>bad date</published></entry></feed>`, source, at);
    expect(values[0]).toMatchObject({ title: "AI & GIS", summary: "A feed description", link: "https://news.example/1", publishedAt: "2026-10-20T00:00:00.000Z" });
    expect(values[1]).toMatchObject({ summary: "Summary", publishedAt: null });
  });
  it("removes WordPress tails, collapses HTML, rejects unsafe links and bounds Unicode", () => {
    const values = parseFeed(`<rss><channel><item><title>Title</title><link>https://blog.example/1</link><description><![CDATA[<p>Summary&nbsp; here</p><p>The post <a href="https://blog.example/1">Title</a> appeared first on Blog.</p>]]></description></item><item><title>Drop</title><link>javascript:alert(1)</link></item></channel></rss>`, source, at);
    expect(values).toHaveLength(1); expect(values[0].summary).toBe("Summary here");
    const long = item(source, { title: "🌍".repeat(310), summary: "한".repeat(410), link: "https://example.org" }, at)!;
    expect([...long.title]).toHaveLength(300); expect([...long.summary]).toHaveLength(400); expect(long.title.endsWith("…")).toBe(true);
    expect(plain("<script>no</script><p>A &amp; B</p>")).toBe("A & B");
    expect(plain("CO<sub>2</sub> and 지질<b>모델</b>링.")).toBe("CO2 and 지질모델링.");
    expect(() => parseFeed("<html>not a feed</html>", source, at)).toThrow(/피드/);
  });
  it("preserves boundaries in Atom XHTML content", () => {
    expect(parseFeed(`<feed><entry><title>Test</title><link href="https://example.org/1"/><content type="xhtml"><div><p>First</p><p>second</p></div></content></entry></feed>`, source, at)[0].summary).toBe("First second");
  });
  it("preserves inline scientific notation in XML titles", () => {
    expect(parseFeed(`<rss><channel><item><title>CO<sub>2</sub> uptake</title><link>https://example.org/1</link></item></channel></rss>`, source, at)[0].title).toBe("CO2 uptake");
  });
  it("matches short ASCII words as words and other terms as case-insensitive substrings", () => {
    expect(matches({ match: ["AI"] }, "rainfall", "")).toBe(false);
    expect(matches({ match: ["GIS"] }, "logistics", "")).toBe(false);
    expect(matches({ match: ["AI"] }, "AI-tools", "")).toBe(true);
    expect(matches({ match: ["climate"] }, "Paleoclimate", "")).toBe(true);
    expect(matches({ match: ["지질"] }, "응용지질학", "")).toBe(true);
    expect(matches({}, "anything", "")).toBe(true);
  });
});
describe("source validation and bounded transport", () => {
  it("validates shipped proposals and rejects unknown/kind-inappropriate values", () => {
    expect(shippedSources()).toHaveLength(18);
    for (const patch of [{ id: "Bad" }, { url: "file:///tmp/feed" }, { homepage: "javascript:foo" }, { repo: "a/b" }, { unknown: 1 }, { match: Array(61).fill("earth") }, { field: "x" }]) expect(() => definition({ ...source, ...patch })).toThrow();
    const { url: _url, ...base } = source;
    expect(() => definition({ ...base, kind: "github-releases", repo: "owner/repo", skipPrereleases: "true" })).toThrow();
    expect(() => definition({ ...base, kind: "github-search", queries: [] })).toThrow();
    expect(() => definition({ ...base, kind: "github-search", queries: ["a".repeat(201)] })).toThrow();
  });
  it("streams to the byte cap and cancels an oversized response", async () => {
    let canceled = false;
    const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(FEED_LIMITS.responseBytes)); controller.enqueue(new Uint8Array(1)); }, cancel() { canceled = true; } }));
    await expect(readResponse(source.url!, { feedFetch: asFetch(() => response) })).rejects.toThrow(/크기/);
    expect(canceled).toBe(true);
  });
  it("bounds redirects, refuses non-http destinations and redacts fetch failures", async () => {
    const redirect = asFetch(() => new Response(null, { status: 302, headers: { location: "/next" } }));
    await expect(readResponse(source.url!, { feedFetch: redirect })).rejects.toThrow(/이동 횟수/);
    expect(redirect).toHaveBeenCalledTimes(4);
    await expect(readResponse(source.url!, { feedFetch: asFetch(() => new Response(null, { status: 302, headers: { location: "file:///tmp/x" } })) })).rejects.toThrow(/http/);
    await expect(readResponse(source.url!, { feedFetch: asFetch(() => { throw new Error("SECRET"); }) })).rejects.toThrow("출처에 연결하거나 응답을 읽지 못했습니다.");
  });
  it("sends the optional token only to the GitHub API, including redirects", async () => {
    const calls: { url: string; headers: Headers }[] = [];
    const stub = asFetch((url, init) => { calls.push({ url: String(url), headers: new Headers(init?.headers) }); return calls.length === 1 ? new Response(null, { status: 302, headers: { location: source.url! } }) : new Response("ok"); });
    expect(await readResponse("https://api.github.com/repos/a/b", { feedFetch: stub, githubToken: () => "test-token" })).toBe("ok");
    expect(calls[0].headers.get("authorization")).toBe("Bearer test-token"); expect(calls[1].headers.get("authorization")).toBeNull();
    expect(calls[1].headers.get("user-agent")).toMatch(/^GAID-hub-server\//);
  });
  it("times out a fetch with the abort signal", async () => {
    vi.useFakeTimers();
    const run = readResponse(source.url!, { feedFetch: asFetch((_url, init) => new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("aborted"))))) });
    const assertion = expect(run).rejects.toThrow(/시간/);
    await vi.advanceTimersByTimeAsync(FEED_LIMITS.timeoutMs); await assertion;
  });
  it("skips draft/prerelease releases and deduplicates GitHub searches", async () => {
    const { url: _url, ...base } = source;
    const releases = [{ name: "Release 1", tag_name: "v1", body: "<p>Notes</p>", html_url: "https://github.com/o/r/releases/v1", published_at: at }, { draft: true }, { prerelease: true }];
    const values = await collectSource({ ...base, kind: "github-releases", repo: "o/r", skipPrereleases: true }, at, { feedFetch: asFetch(() => Response.json(releases)) });
    expect(values).toHaveLength(1); expect(values[0]).toMatchObject({ summary: "Notes", github: { repo: "o/r", release: "v1" } });
    const repos = await collectSource({ ...base, kind: "github-search", queries: ["one", "two"] }, at, { feedFetch: asFetch(() => Response.json({ items: [{ full_name: "o/r", html_url: "https://github.com/o/r", description: "Geo skill", stargazers_count: 23, updated_at: at }] })) });
    expect(repos).toHaveLength(1); expect(repos[0].github).toEqual({ repo: "o/r", stars: 23 });
  });
});
it.each(["byte-cap", "prereleases-only"])("falls back to one stable GitHub release on %s", async (trigger) => {
  const { url: _url, ...base } = source;
  const seen: string[] = [];
  const release = { name: "Stable", tag_name: "v1", body: "Release notes", html_url: "https://github.com/o/r/releases/v1", published_at: at };
  const stub = asFetch((url) => {
    seen.push(String(url));
    if (String(url).endsWith("/latest")) return Response.json(release);
    return trigger === "byte-cap" ? new Response(null, { headers: { "content-length": String(FEED_LIMITS.responseBytes + 1) } }) : Response.json([{ ...release, prerelease: true }]);
  });
  const values = await collectSource({ ...base, kind: "github-releases", repo: "o/r", skipPrereleases: true }, at, { feedFetch: stub });
  expect(seen).toEqual(["https://api.github.com/repos/o/r/releases?per_page=10", "https://api.github.com/repos/o/r/releases/latest"]);
  expect(values).toHaveLength(1); expect(values[0].github?.release).toBe("v1");
});
it("keeps the byte cap for the latest release too and does not fall back on unrelated failures", async () => {
  const { url: _url, ...base } = source;
  const oversized = asFetch(() => new Response(null, { headers: { "content-length": String(FEED_LIMITS.responseBytes + 1) } }));
  await expect(collectSource({ ...base, kind: "github-releases", repo: "o/r", skipPrereleases: true }, at, { feedFetch: oversized })).rejects.toThrow(/크기/);
  expect(oversized).toHaveBeenCalledTimes(2);
  const unavailable = asFetch(() => new Response(null, { status: 503 }));
  await expect(collectSource({ ...base, kind: "github-releases", repo: "o/r", skipPrereleases: true }, at, { feedFetch: unavailable })).rejects.toThrow(/503/);
  expect(unavailable).toHaveBeenCalledTimes(1);
});
async function user(a: HubServerApp, role: "admin" | "member") {
  const invite = a.accounts.invite({ email: `${role}@example.org`, role });
  const response = await a.inject({ method: "POST", url: "/hub/v1/auth/invites/accept", payload: { code: invite.code, displayName: role, password: "correct password 123", device: "test" } });
  expect(response.statusCode, response.body).toBe(200);
  return { authorization: `Bearer ${response.json().token}` };
}
describe("approval, persistence and serving", () => {
  it("protects admin routes, snapshots approval, hides stopped items and audits mutations", async () => {
    const a = app(); const admin = await user(a, "admin"); const member = await user(a, "member");
    const call = (method: "GET" | "POST" | "PATCH" | "DELETE", path: string, payload?: object) => a.inject({ method, url: `/hub/v1${path}`, headers: admin, ...(payload ? { payload } : {}) });
    expect((await a.inject("/hub/v1/feeds")).statusCode).toBe(401);
    for (const [method, path, payload] of [["GET", "/sources"], ["POST", "/sources", source], ["PATCH", "/sources/test-source", { state: "approved" }], ["DELETE", "/sources/test-source"], ["POST", "/fetch", {}]] as const)
      expect((await a.inject({ method, url: `/hub/v1/admin/feeds${path}`, headers: member, ...(payload ? { payload } : {}) })).statusCode).toBe(403);
    expect((await call("GET", "/admin/feeds/sources")).json().sources[0].state).toBe("proposed");
    expect((await call("POST", "/admin/feeds/fetch", {})).json().results).toEqual([]); expect(fetchOK).not.toHaveBeenCalled();
    expect((await call("POST", "/admin/feeds/fetch", { sourceId: source.id })).statusCode).toBe(409);
    expect((await call("PATCH", `/admin/feeds/sources/${source.id}`, { state: "approved" })).json().source).toMatchObject({ state: "approved", decidedBy: "admin", builtIn: true });
    expect((await call("POST", "/admin/feeds/fetch", {})).json().results[0].ok).toBe(true);
    const list = (await a.inject({ url: "/hub/v1/feeds?category=papers&field=general&q=summary&limit=1", headers: member })).json();
    expect(list.items).toHaveLength(1); expect(list.collectedAt).toBe(at); expect(list.sources).toHaveLength(1);
    expect((await a.inject({ url: "/hub/v1/feeds?category=news", headers: member })).json().items).toEqual([]);
    for (const query of ["limit=301", "q=" + "a".repeat(101), "category=wrong", "field=wrong"]) expect((await a.inject({ url: `/hub/v1/feeds?${query}`, headers: member })).statusCode).toBe(400);
    expect((await call("DELETE", `/admin/feeds/sources/${source.id}`)).statusCode).toBe(409);
    expect((await call("PATCH", `/admin/feeds/sources/${source.id}`, { state: "stopped" })).statusCode).toBe(200);
    expect((await a.inject({ url: "/hub/v1/feeds", headers: member })).json()).toMatchObject({ items: [], sources: [], collectedAt: null });
    expect(a.hub.counts().feed_items).toBe(1);
    const added = { ...source, id: "custom-source" };
    expect((await call("POST", "/admin/feeds/sources", added)).statusCode).toBe(201);
    expect((await call("POST", "/admin/feeds/sources", added)).statusCode).toBe(409);
    expect((await call("DELETE", `/admin/feeds/sources/${added.id}`)).statusCode).toBe(204);
    expect(a.hub.all<{ action: string }>("SELECT action FROM audit_events WHERE action LIKE 'feeds.%'").map((r) => r.action)).toEqual(["feeds.approve", "feeds.stop", "feeds.add", "feeds.delete"]);
    const changed = new HubFeeds(a.hub, { proposals: [{ ...source, url: "https://changed.example/rss" }] });
    expect(changed.sources()[0].url).toBe(source.url);
  });
  it("keeps undated items of a first collection below dated ones; later undated items sort by collection time", async () => {
    let now = at;
    const hub = new HubDatabase({ home: home(), now: () => now }); databases.push(hub);
    const undated = (ids: number[]) => `<rss><channel>${ids.map((i) => `<item><title>Undated ${i}</title><link>https://undated.example/${i}</link></item>`).join("")}</channel></rss>`;
    let body = undated([1, 2]);
    const feeds = new HubFeeds(hub, { proposals: [source, { ...source, id: "undated", url: "https://undated.example/rss" }],
      feedFetch: asFetch((url) => new Response(String(url).includes("undated") ? body : rss(1))) });
    for (const s of feeds.sources()) feeds.decide(s.id, { state: "approved" }, actor);
    await feeds.fetch();
    expect(feeds.list().items.map((i) => i.title)).toEqual(["Title 0", "Undated 1", "Undated 2"]);
    now = "2026-10-23T01:00:00.000Z"; body = undated([3, 1, 2]);
    await feeds.fetch();
    expect(feeds.list().items.map((i) => i.title)).toEqual(["Undated 3", "Title 0", "Undated 1", "Undated 2"]);
    expect(feeds.list().items[0].fetchedAt).toBe(now);
  });
  it("isolates failures, keeps first fetchedAt, prunes age/count, and records latest success despite later failures", async () => {
    const hub = db(); let fail = false;
    const stub = asFetch((url) => String(url).includes("fail") || fail ? new Response("no", { status: 503 }) : new Response(rss(110)));
    const feeds = new HubFeeds(hub, { proposals: [{ ...source, id: "fail-source", url: "https://fail.example/rss" }, source], feedFetch: stub });
    for (const s of feeds.sources()) feeds.decide(s.id, { state: "approved" }, actor);
    const result = await feeds.fetch(); expect(result.results.map((r) => r.ok)).toEqual([false, true]); expect(feeds.list({ category: "papers" }).items).toHaveLength(100);
    const before = feeds.list().items[0];
    hub.run("UPDATE feed_items SET fetched_at=?,record=? WHERE id=?", "2026-10-20T01:00:00.000Z", JSON.stringify({ ...before, fetchedAt: "2026-10-20T01:00:00.000Z" }), before.id);
    await feeds.fetch({ sourceId: source.id }); expect(feeds.list().items[0].fetchedAt).toBe("2026-10-20T01:00:00.000Z");
    fail = true; await feeds.fetch(); expect(feeds.list().collectedAt).toBe(at); expect(feeds.sources()[1].lastFetch?.ok).toBe(false);
    const old = item(source, { title: "Old", link: "https://example.org/old", date: "2020-01-01" }, at)!;
    hub.run("INSERT INTO feed_items VALUES (?,?,?,?,?,?)", old.id, source.id, JSON.stringify(old), old.publishedAt, old.fetchedAt, old.publishedAt ?? old.fetchedAt);
    fail = false; await feeds.fetch(); expect(hub.get("SELECT id FROM feed_items WHERE id=?", old.id)).toBeUndefined();
    const manifest = backupHub(hub, join(home(), "backup")); expect(checkBackup(join(roots.at(-1)!, "backup")).rows).toEqual(manifest.rows);
  });
  it("limits an unfiltered list to ten per source without limiting filtered lists", async () => {
    const hub = db();
    const feeds = new HubFeeds(hub, { proposals: [source, { ...source, id: "dated-source", url: "https://dated.example/rss" }], feedFetch: asFetch((url) =>
      new Response(String(url).includes("dated") ? rss(20) : rss(110).replace(/<pubDate>.*?<\/pubDate>/g, ""))) });
    for (const s of feeds.sources()) feeds.decide(s.id, { state: "approved" }, actor);
    await feeds.fetch();
    const all = feeds.list().items;
    expect(all).toHaveLength(20);
    expect(all.filter((i) => i.sourceId === source.id)).toHaveLength(10);
    expect(all.filter((i) => i.sourceId === "dated-source")).toHaveLength(10);
    expect(feeds.list({ category: "papers" }).items).toHaveLength(120);
    expect(feeds.list({ field: "general" }).items).toHaveLength(120);
    expect(feeds.list({ q: "Summary" }).items).toHaveLength(120);
    expect(feeds.list({ limit: 12 }).items).toHaveLength(12);
    expect(feeds.list({ q: "" }).items).toHaveLength(20);
  });
  it("does not fetch a stopped next source or resurrect one stopped during its read", async () => {
    const hub = db(); let feeds: HubFeeds;
    const stub = asFetch(() => { feeds.decide("next-source", { state: "stopped" }, actor); feeds.decide(source.id, { state: "stopped" }, actor); return new Response(rss()); });
    feeds = new HubFeeds(hub, { proposals: [source, { ...source, id: "next-source" }], feedFetch: stub });
    for (const s of feeds.sources()) feeds.decide(s.id, { state: "approved" }, actor);
    await feeds.fetch(); expect(stub).toHaveBeenCalledTimes(1); expect(hub.counts().feed_items).toBe(0); expect(feeds.list().items).toEqual([]);
  });
  it("migrates a v2 home without losing its account/session identity", async () => {
    const a = app(); const headers = await user(a, "admin"); const identity = a.hub.server.serverId;
    a.hub.db.exec("DROP TABLE hub_entry_removals; DROP TABLE orcid_states; DROP TABLE account_orcid; DROP TABLE feed_items; DROP TABLE feed_sources; DELETE FROM schema_migrations WHERE version>=3");
    const path = a.hub.home; await a.close(); apps.splice(apps.indexOf(a), 1);
    const migrated = buildHubServer({ home: path, feedProposals: [source], feedFetch: fetchOK }); apps.push(migrated);
    expect(migrated.hub.server.serverId).toBe(identity); expect(migrated.hub.counts()).toMatchObject({ schema_migrations: 5, hub_entry_removals: 0, feed_sources: 0, feed_items: 0, accounts: 1, sessions: 1 });
    expect((await migrated.inject({ url: "/hub/v1/auth/me", headers })).statusCode).toBe(200);
  });
});
describe("schedule", () => {
  it("defaults the interval, accepts off, rejects invalid values, and clears the startup timer", async () => {
    expect(intervalHours(0)).toBe(0); expect(intervalHours(6)).toBe(6);
    for (const value of ["", -1, "no", Infinity]) expect(() => intervalHours(value)).toThrow();
    vi.useFakeTimers(); const fetch = vi.fn(async () => ({ results: [] })); const feeds = { fetch } as unknown as HubFeeds;
    const stop = scheduleFeeds(feeds, 6);
    await vi.advanceTimersByTimeAsync(29_999); expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6 * 3600_000); expect(fetch).toHaveBeenCalledTimes(2);
    stop(); await vi.advanceTimersByTimeAsync(6 * 3600_000); expect(fetch).toHaveBeenCalledTimes(2);
    const off = scheduleFeeds(feeds, 0); await vi.advanceTimersByTimeAsync(40_000); expect(fetch).toHaveBeenCalledTimes(2); off();
  });
});
