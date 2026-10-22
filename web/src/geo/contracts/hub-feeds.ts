/**
 * Curated information feeds of the GAID hub (gaid-hub-feeds). IO-free; shared by the institute hub server
 * (`server/src/geo/hub-server/feeds/`), the GAID backend routes (`server/src/geo/routes/hub-feeds.ts`) and the web
 * screens (`web/src/geo/hub-feeds/`).
 *
 * User decisions 2026-10-22: only sources an administrator approved are read; items show the original title, the feed's
 * own short summary and the link (no model calls, never full text); the hub server collects, a GAID without a hub server
 * shows no items. The shipped proposals live in `geo/feeds/sources.json` (state `proposed` until an administrator approves).
 */

export const HUB_FEEDS_SCHEMA = "gaid-hub-feeds/v1" as const;

/** The four lists researchers pick from. */
export const FEED_CATEGORIES = ["tools", "skills", "papers", "news"] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number];

/** Geoscience field of a source (one per source; items inherit it). */
export const FEED_FIELDS = [
  "general",
  "geology",
  "hydrology",
  "climate",
  "remote-sensing",
  "hazards",
  "ocean",
  "resources",
  "modelling",
  "ai-tools",
] as const;
export type FeedField = (typeof FEED_FIELDS)[number];

/**
 * `feed`: RSS 2.0, RSS 1.0 (RDF) or Atom at `url`.
 * `github-releases`: published releases of `repo` (owner/name) through api.github.com.
 * `github-search`: repositories found by `queries` through the GitHub search API (skill discovery).
 */
export const FEED_SOURCE_KINDS = ["feed", "github-releases", "github-search"] as const;
export type FeedSourceKind = (typeof FEED_SOURCE_KINDS)[number];

export type FeedSourceState = "proposed" | "approved" | "stopped";

/** What defines a source; the shipped proposals and administrator additions have this shape. */
export interface FeedSourceDefinition {
  /** `^[a-z0-9][a-z0-9-]{1,47}$`. */
  id: string;
  kind: FeedSourceKind;
  /** Original name of the source, e.g. "Nature Geoscience". */
  title: string;
  publisher: string;
  /** Human page of the source (https). */
  homepage: string;
  /** `feed` only: the feed URL (http or https). */
  url?: string;
  /** `github-releases` only: owner/name. */
  repo?: string;
  /** `github-releases` only: leave out pre-releases (alpha/beta builds). */
  skipPrereleases?: boolean;
  /** `github-search` only: 1–5 GitHub repository search queries. */
  queries?: string[];
  category: FeedCategory;
  field: FeedField;
  /**
   * Keep only items whose title or summary contains one of these (case-insensitive substring; `\b` word match for
   * entries of 3 ASCII letters or fewer). Absent or empty: keep every item.
   */
  match?: string[];
  /** Why this source is worth reading (Korean, shown to administrators). */
  reason: string;
}

/** Last collection attempt of a source. */
export interface FeedFetchResult {
  at: string;
  ok: boolean;
  /** Items kept from this attempt (after `match`). */
  items: number;
  /** Korean sentence when `ok` is false. */
  error?: string;
}

/** A source as an administrator sees it. */
export interface FeedSource extends FeedSourceDefinition {
  state: FeedSourceState;
  /** True for the shipped proposals (`geo/feeds/sources.json`); those cannot be deleted, only stopped. */
  builtIn: boolean;
  /** Display name of the administrator who approved or stopped it last. */
  decidedBy?: string;
  decidedAt?: string;
  lastFetch?: FeedFetchResult;
}

/** One collected item. Text is plain (HTML removed, entities decoded). */
export interface FeedItem {
  /** First 32 hex characters of sha256(`<sourceId>\n<guid or link>`). */
  id: string;
  sourceId: string;
  sourceTitle: string;
  category: FeedCategory;
  field: FeedField;
  /** Original title, ≤ 300 characters. */
  title: string;
  /** The feed's own summary (or the release notes / repository description), ≤ 400 characters, may be empty. */
  summary: string;
  /** http(s) link to the original. */
  link: string;
  /** Publication or update time the feed states; null when it states none. */
  publishedAt: string | null;
  /** When the hub server first collected this item. */
  fetchedAt: string;
  /** `github-releases` and `github-search` items. */
  github?: {
    /** owner/name, usable as a skills CLI source in Settings → Skills. */
    repo: string;
    /** Release tag (`github-releases`). */
    release?: string;
    /** Stars when collected (`github-search`). */
    stars?: number;
  };
}

/** A source as researchers see it (approved sources only). */
export interface FeedSourceSummary {
  id: string;
  title: string;
  publisher: string;
  homepage: string;
  category: FeedCategory;
  field: FeedField;
  lastFetch?: FeedFetchResult;
}

/** Hub server `GET /hub/v1/feeds` (any account) and GAID `GET /geo/hub/feeds`. */
export interface FeedListResponse {
  schema: typeof HUB_FEEDS_SCHEMA;
  /** GAID only: false when no hub server account is logged in; then `items` and `sources` are empty. */
  connected: boolean;
  items: FeedItem[];
  sources: FeedSourceSummary[];
  /** Latest successful collection over all approved sources; null before the first one. */
  collectedAt: string | null;
}

/** Query of the list routes; every field optional. */
export interface FeedListQuery {
  category?: FeedCategory;
  field?: FeedField;
  /** Case-insensitive substring of title or summary, ≤ 100 characters. */
  q?: string;
  /** 1–300, default 200. */
  limit?: number;
}

/** Administrator routes (hub server `/hub/v1/admin/feeds/...`, GAID `/geo/hub-server/admin/feeds/...`). */
export interface FeedSourcesResponse {
  sources: FeedSource[];
}
/** `PATCH .../sources/:id`: approve (also a proposed one) or stop. */
export interface FeedSourceDecision {
  state: "approved" | "stopped";
}
/** `POST .../sources`: an administrator adds and thereby approves a source. */
export type FeedSourceAddBody = FeedSourceDefinition;
/** `POST .../fetch`: collect now; `sourceId` limits it to one approved source. */
export interface FeedFetchBody {
  sourceId?: string;
}
export interface FeedFetchResponse {
  results: Array<{ sourceId: string } & FeedFetchResult>;
}

/** Bounds every implementation keeps. */
export const FEED_LIMITS = {
  titleChars: 300,
  summaryChars: 400,
  /** Items kept per source (newest first); older ones are removed after each collection. */
  itemsPerSource: 100,
  /** Items older than this many days (by publishedAt, else fetchedAt) are removed. */
  maxAgeDays: 180,
  /** Response bytes read per request. */
  responseBytes: 4 * 1024 * 1024,
  timeoutMs: 20_000,
  maxRedirects: 3,
  /** Default collection interval of `serve`. */
  intervalHours: 6,
  listLimit: 300,
} as const;

export const FEED_SOURCE_ID = /^[a-z0-9][a-z0-9-]{1,47}$/;
