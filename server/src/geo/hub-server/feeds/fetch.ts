/** Bounded feed/GitHub reads through the process dispatcher; no model or full-text requests. */
import { readFileSync } from "node:fs";
import { FEED_LIMITS, type FeedItem, type FeedSourceDefinition } from "../../../../../web/src/geo/contracts/hub-feeds.ts";
import { HubServerError, object } from "../core.ts";
import { item, parseFeed } from "./parse.ts";
import { httpUrl } from "./sources.ts";
const version = (JSON.parse(readFileSync(new URL("../../../../../geo/distribution.json", import.meta.url), "utf8")) as { version: string }).version;
export class FeedResponseTooLarge extends HubServerError {
  constructor() { super("출처 응답이 허용 크기를 넘었습니다."); }
}
export interface FeedFetchOptions { feedFetch?: typeof fetch; githubToken?: () => string | undefined }
export async function readResponse(address: string, options: FeedFetchOptions = {}): Promise<string> {
  let url = httpUrl(address);
  if (!url) throw new HubServerError("수집 주소는 http 또는 https여야 합니다.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_LIMITS.timeoutMs);
  try {
    for (let redirects = 0; ; redirects++) {
      const headers: Record<string, string> = { "User-Agent": `GAID-hub-server/${version} (+https://github.com/kigam-research/geoaidesk)`, Accept: "application/atom+xml, application/rss+xml, application/xml, application/json, text/xml;q=0.9, */*;q=0.5" };
      // Never send a GitHub credential to a feed host or a cross-host redirect.
      if (new URL(url).hostname === "api.github.com") {
        const token = options.githubToken ? options.githubToken() : process.env.GAID_HUB_FEEDS_GITHUB_TOKEN;
        if (token) headers.Authorization = `Bearer ${token}`;
        headers["X-GitHub-Api-Version"] = "2022-11-28";
      }
      const response = await (options.feedFetch ?? fetch)(url, { headers, redirect: "manual", signal: controller.signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (redirects >= FEED_LIMITS.maxRedirects || !location) throw new HubServerError("출처의 주소 이동 횟수가 허용 범위를 넘었습니다.");
        let next: string | null;
        try { next = httpUrl(new URL(location, url).href); } catch { next = null; }
        if (!next) throw new HubServerError("출처의 이동 주소는 http 또는 https여야 합니다.");
        url = next; continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new HubServerError(`출처가 HTTP ${response.status} 오류를 반환했습니다.`); }
      if (Number(response.headers.get("content-length")) > FEED_LIMITS.responseBytes) {
        await response.body?.cancel(); throw new FeedResponseTooLarge();
      }
      if (!response.body) return "";
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > FEED_LIMITS.responseBytes) { await reader.cancel(); throw new FeedResponseTooLarge(); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      return Buffer.concat(chunks).toString("utf8");
    }
  } catch (error) {
    if (error instanceof HubServerError) throw error;
    throw new HubServerError(controller.signal.aborted ? "출처 응답 시간이 허용 범위를 넘었습니다." : "출처에 연결하거나 응답을 읽지 못했습니다.");
  } finally { clearTimeout(timer); }
}
async function json(address: string, options: FeedFetchOptions): Promise<unknown> {
  const body = await readResponse(address, options);
  try { return JSON.parse(body); } catch { throw new HubServerError("GitHub 응답 형식을 읽지 못했습니다."); }
}
export async function collectSource(source: FeedSourceDefinition, at: string, options: FeedFetchOptions = {}): Promise<FeedItem[]> {
  if (source.kind === "feed") return parseFeed(await readResponse(source.url!, options), source, at);
  const out: FeedItem[] = [];
  if (source.kind === "github-releases") {
    const addReleases = (releases: unknown[]) => {
      for (const release of releases) {
        if (!object(release) || release.draft || (source.skipPrereleases && release.prerelease) || typeof release.tag_name !== "string" || typeof release.html_url !== "string") continue;
        const value = item(source, { title: typeof release.name === "string" && release.name.trim() ? release.name : `${source.repo!.split("/")[1]} ${release.tag_name}`,
          summary: typeof release.body === "string" ? release.body : "", link: release.html_url, date: release.published_at ?? release.created_at,
          github: { repo: source.repo!, release: release.tag_name } }, at);
        if (value) out.push(value);
      }
    };
    try {
      const releases = await json(`https://api.github.com/repos/${source.repo}/releases?per_page=10`, options);
      if (!Array.isArray(releases)) throw new HubServerError("GitHub 릴리스 목록을 읽지 못했습니다.");
      addReleases(releases);
    } catch (error) {
      if (!source.skipPrereleases || !(error instanceof FeedResponseTooLarge)) throw error;
    }
    // Asset-heavy release lists can exceed the cap, or the latest ten can all be alphas.
    // Keep the same byte cap and obtain one stable release rather than increasing the read bound.
    if (source.skipPrereleases && !out.length) {
      const latest = await json(`https://api.github.com/repos/${source.repo}/releases/latest`, options);
      if (!object(latest)) throw new HubServerError("GitHub 최신 릴리스를 읽지 못했습니다.");
      addReleases([latest]);
    }
  } else {
    const seen = new Set<string>();
    for (const query of source.queries!) {
      const result = await json(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&per_page=20`, options);
      if (!object(result) || !Array.isArray(result.items)) throw new HubServerError("GitHub 저장소 목록을 읽지 못했습니다.");
      for (const repo of result.items) {
        if (!object(repo) || typeof repo.full_name !== "string" || typeof repo.html_url !== "string" || seen.has(repo.full_name.toLowerCase())) continue;
        seen.add(repo.full_name.toLowerCase());
        const value = item(source, { title: repo.full_name, summary: typeof repo.description === "string" ? repo.description : "", link: repo.html_url,
          date: repo.updated_at, github: { repo: repo.full_name, ...(typeof repo.stargazers_count === "number" ? { stars: repo.stargazers_count } : {}) } }, at);
        if (value) out.push(value);
      }
    }
  }
  return out;
}
