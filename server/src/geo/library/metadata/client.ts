import { setTimeout as delay } from "node:timers/promises";
import { Parser } from "htmlparser2";
import { doiCandidates, normalizeDoi } from "./identifiers.ts";
import { boundedText, fetchPublisherHtml } from "./http.ts";
import { fromCrossref, fromOpenAlex, list, object, titleSimilarity } from "./mapping.ts";
import { parseKciXml } from "./kci.ts";
import { MetadataLookupError, type MetadataClientOptions, type MetadataRecord, type ProviderError, type SearchCandidate, type SearchResult } from "./types.ts";

/** A reusable client preserves provider cooldowns across calls. No accepted metadata is written here. */
export function createMetadataClient(options: MetadataClientOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const mailto = options.mailto ?? process.env.CROSSREF_MAILTO;
  const openAlexKey = options.openAlexApiKey ?? process.env.OPENALEX_API_KEY;
  const kciKey = options.kciApiKey ?? process.env.KCI_API_KEY;
  const timeout = options.timeoutMs ?? 30_000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => delay(ms));
  const maxWait = options.maxRateWaitMs ?? 60_000;
  const cooldown = new Map<string, number>();
  const rateNext = new Map<string, number>();
  const spacing = new Map<string, number>();
  let queue: Promise<unknown> = Promise.resolve();

  async function request(url: URL): Promise<string> {
    // Crossref applies separate singleton/list quotas. A fast singleton response must not reset list pacing.
    const isCrossref = url.host === "api.crossref.org";
    const isList = url.pathname === "/works";
    const bucket = isCrossref ? `${url.host}:${isList ? "list" : "singleton"}` : url.host;
    const defaultSpacing = isCrossref ? Math.ceil(1000 / (isList ? mailto ? 3 : 1 : mailto ? 10 : 5)) : 0;
    // Serialize this client's provider requests, including backoff and stream consumption.
    const call = queue.then(async () => {
      for (let attempt = 0; ; attempt++) {
        const wait = Math.max(0, Math.max(cooldown.get(url.host) ?? 0, rateNext.get(bucket) ?? 0) - now());
        if (wait > maxWait) throw new Error("Provider cooldown exceeds request wait budget");
        if (wait) await sleep(wait);
        const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(timeout), headers: {
          Accept: url.host === "open.kci.go.kr" ? "application/xml, text/xml" : "application/json",
          "User-Agent": `GAID-metadata/1${mailto ? ` (mailto:${mailto})` : ""}`,
        } });
        const interval = /^(\d+(?:\.\d+)?)s?$/.exec(response.headers.get("x-rate-limit-interval") ?? "");
        const limit = Number(response.headers.get("x-rate-limit-limit"));
        if (isCrossref && interval && limit > 0) spacing.set(bucket, Math.ceil(Number(interval[1]) * 1000 / limit));
        if (isCrossref) rateNext.set(bucket, now() + (spacing.get(bucket) ?? defaultSpacing));
        const retry = response.headers.get("retry-after");
        if (retry || [429, 503].includes(response.status)) {
          const ms = retry && /^\d+(?:\.\d+)?$/.test(retry) ? Number(retry) * 1000 : retry ? Math.max(0, Date.parse(retry) - now()) : 1000;
          cooldown.set(url.host, Math.max(cooldown.get(url.host) ?? 0, now() + (Number.isFinite(ms) ? ms : 1000)));
        }
        if ([429, 503].includes(response.status) && attempt === 0) { await response.body?.cancel(); continue; }
        if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
        return boundedText(response);
      }
    });
    queue = call.catch(() => {});
    return call;
  }

  function crossref(path: string) { const u = new URL(`https://api.crossref.org${path}`); if (mailto) u.searchParams.set("mailto", mailto); return u; }
  function openalex(path: string) { const u = new URL(`https://api.openalex.org${path}`); if (openAlexKey) u.searchParams.set("api_key", openAlexKey); return u; }
  // Do not surface fetch error text: it may contain a key-bearing URL.
  const error = (provider: ProviderError["provider"], e: unknown): ProviderError => ({ provider,
    message: e instanceof Error && /^(?:HTTP \d+|Provider cooldown|Crossref record|OpenAlex record|KCI returned|Unrecognised KCI|Metadata response)/.test(e.message)
      ? e.message : "Metadata service unavailable or response invalid" });

  async function lookupDoi(input: string, provider?: "crossref" | "openalex"): Promise<MetadataRecord> {
    const doi = normalizeDoi(input), errors: ProviderError[] = [];
    for (const p of provider ? [provider] : ["crossref", "openalex"] as const) {
      try {
        const value = JSON.parse(await request(p === "crossref" ? crossref(`/works/${encodeURIComponent(doi)}`) : openalex(`/works/doi:${encodeURIComponent(doi)}`)));
        const item = p === "crossref" ? fromCrossref(object(value).message) : fromOpenAlex(value);
        // A successful response for another work must not confirm the requested DOI.
        if (item.csl.DOI !== doi) throw new Error("DOI mismatch");
        return item;
      } catch (e) { errors.push(error(p, e)); }
    }
    throw new MetadataLookupError(errors);
  }

  async function searchKci(title: string, authorHint?: string): Promise<SearchResult & { skipped: boolean }> {
    if (!kciKey) return { candidates: [], errors: [], requiresSelection: true, skipped: true };
    if (!title.trim() || title.length > 2000) throw new Error("Title must contain 1–2000 characters");
    const url = new URL("https://open.kci.go.kr/po/openapi/openApiSearch.kci");
    url.searchParams.set("key", kciKey); url.searchParams.set("apiCode", "articleSearch");
    url.searchParams.set("title", title.trim()); url.searchParams.set("displayCount", "10");
    if (authorHint) url.searchParams.set("author", authorHint);
    try { return { candidates: parseKciXml(await request(url)).map((r) => ({ ...r, score: titleSimilarity(title, r.csl.title) })), errors: [], requiresSelection: true, skipped: false }; }
    catch (e) { return { candidates: [], errors: [error("kci", e)], requiresSelection: true, skipped: false }; }
  }

  async function searchByTitle(title: string, authorHint?: string): Promise<SearchResult> {
    if (!title.trim() || title.length > 2000) throw new Error("Title must contain 1–2000 characters");
    const candidates: SearchCandidate[] = [], errors: ProviderError[] = [];
    const cr = crossref("/works"); cr.searchParams.set("query.bibliographic", `${title}${authorHint ? ` ${authorHint}` : ""}`); cr.searchParams.set("rows", "10");
    const oa = openalex("/works"); oa.searchParams.set("search", `${title}${authorHint ? ` ${authorHint}` : ""}`); oa.searchParams.set("per-page", "10");
    for (const [provider, url] of [["crossref", cr], ["openalex", oa]] as const) {
      try {
        const value = object(JSON.parse(await request(url)));
        const rows = provider === "crossref" ? list(object(value.message).items) : list(value.results);
        for (const row of rows) {
          try {
            const r = provider === "crossref" ? fromCrossref(row) : fromOpenAlex(row);
            const author = r.csl.author?.map((a) => a.literal || [a.given, a.family].filter(Boolean).join(" ")).join(" ") ?? "";
            const score = titleSimilarity(title, r.csl.title) * (authorHint ? .9 : 1) + (authorHint ? .1 * titleSimilarity(authorHint, author) : 0);
            candidates.push({ ...r, score });
          } catch (e) { errors.push(error(provider, e)); }
        }
      } catch (e) { errors.push(error(provider, e)); }
    }
    const kci = await searchKci(title, authorHint); candidates.push(...kci.candidates); errors.push(...kci.errors);
    candidates.sort((a, b) => b.score - a.score);
    // Keep provider provenance rather than silently merge conflicting records for the same DOI.
    return { candidates, errors, requiresSelection: true };
  }

  async function resolveUrl(value: string): Promise<{ doiCandidates: string[]; url: string; method: "url" | "html" | "none" }> {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || value.length > 8192) throw new Error("Invalid publisher URL");
    const direct = doiCandidates([decodeURIComponent(url.pathname), url.searchParams.get("doi"), url.searchParams.get("DOI"), url.searchParams.get("rft_id")].filter(Boolean).join("\n"));
    if (direct.length) return { doiCandidates: direct, url: url.href, method: "url" };
    const fetched = await fetchPublisherHtml(value, fetcher, timeout);
    const candidates: string[] = doiCandidates(decodeURIComponent(new URL(fetched.url).pathname));
    new Parser({ onopentag(tag, attrs) {
      if (tag === "meta" && /^(?:citation_doi|dc\.identifier|prism\.doi)$/i.test(attrs.name || attrs.property || ""))
        candidates.push(...doiCandidates(attrs.content || ""));
    } }, { decodeEntities: true }).end(fetched.html);
    return { doiCandidates: [...new Set(candidates)], url: fetched.url, method: candidates.length ? "html" : "none" };
  }

  return { lookupDoi, searchByTitle, searchKci, resolveUrl };
}
