"use client";
/**
 * 자료 소식 (`#hub/feeds`, gaid-hub-feeds): items the institute hub server collected from administrator-approved sources.
 * Each row shows the original title (link), the feed's own summary and where and when it came from; nothing is
 * summarised or reviewed by GAID. GitHub skill rows hand the repository to Settings → Skills (preview + consent there).
 */
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FEED_CATEGORIES, FEED_FIELDS, type FeedCategory, type FeedField, type FeedItem, type FeedListResponse, type FeedSourceSummary } from "@/geo/contracts/hub-feeds";
import { HUB_CONNECTION_CHANGED } from "@/geo/hub-server/api";
import { geoLocale, geoText } from "@/geo/i18n";
import { requestSkillImport } from "@/geo/skills/import-request";
import { cn } from "@/lib/utils";
import { openSettings } from "@/lib/settings-nav";

import { hubFeeds } from "./api";

export const text = geoText("hubFeeds");
export const selectClass =
  "h-9 max-w-full rounded-md border border-gaid-control-edge bg-gaid-face px-3 text-sm text-gaid-ink focus-visible:outline-2 focus-visible:outline-ring";

export function feedDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat(geoLocale() === "ko" ? "ko-KR" : "en-US", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

export function FeedFailure({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="space-y-2 text-sm" role="alert">
      <p className="text-gaid-danger">{text("failed")}</p>
      <details className="text-xs text-gaid-ink-2">
        <summary className="cursor-pointer">{text("technical")}</summary>
        <p className="my-2 break-words whitespace-pre-wrap">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(error).catch(() => undefined)}>
          {text("copyTechnical.button")}
        </Button>
      </details>
      {retry && <Button variant="outline" onClick={retry}>{text("retry")}</Button>}
    </div>
  );
}

type Category = FeedCategory | "all";
/** Researcher-facing order of the category control. */
const CATEGORY_ORDER: Category[] = ["all", "tools", "papers", "news", "skills"];

export function FeedScreen({ projects }: { projects: { id: string; name: string }[] }) {
  const [data, setData] = useState<FeedListResponse | null>(null);
  const [category, setCategory] = useState<Category>("all");
  const [field, setField] = useState<FeedField | "all">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const again = () => setReload((n) => n + 1);
    window.addEventListener(HUB_CONNECTION_CHANGED, again);
    return () => window.removeEventListener(HUB_CONNECTION_CHANGED, again);
  }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      hubFeeds
        .list({ category: category === "all" ? undefined : category, field: field === "all" ? undefined : field, q: query.trim() || undefined })
        .then((value) => { if (alive) { setData(value); setError(null); } })
        .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
        .finally(() => { if (alive) setLoading(false); });
    }, 180);
    return () => { alive = false; clearTimeout(timer); };
  }, [category, field, query, reload]);
  const filtered = category !== "all" || field !== "all" || !!query.trim();
  const sources = data?.sources ?? [];
  // Field choices: only fields that approved sources cover, in the contract's order.
  const fields = FEED_FIELDS.filter((f) => sources.some((s) => s.field === f));
  const offline = data && !data.connected;
  return (
    <section className="flex min-h-0 flex-1 flex-col text-gaid-ink" aria-labelledby="hub-feeds-title">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-gaid-edge bg-gaid-chrome px-6 py-4">
        <div className="min-w-0">
          <h1 id="hub-feeds-title" className="text-2xl font-bold">{text("title")}</h1>
          {data?.connected && <p className="mt-1 max-w-[680px] text-sm text-gaid-ink-2">{text("context", { count: sources.length })}</p>}
        </div>
        {data?.connected && (
          <p className="text-xs tabular-nums text-gaid-ink-2" role="status">
            {data.collectedAt ? text("collectedAt", { when: feedDate(data.collectedAt, true) }) : text("notCollected")}
          </p>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto bg-gaid-face p-6">
        {offline ? (
          <Offline />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="gaid-seg flex flex-wrap items-center gap-0.5 rounded-lg border border-gaid-edge bg-gaid-hover p-0.5" role="group" aria-label={text("categoryGroup")}>
                {CATEGORY_ORDER.filter((c) => c === "all" || (FEED_CATEGORIES as readonly string[]).includes(c)).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium",
                      category === c ? "bg-gaid-face text-gaid-ink shadow-[0_0_0_1px_var(--gaid-edge)]" : "text-gaid-ink-2 hover:text-gaid-ink",
                    )}
                  >
                    {text(`category.${c}`)}
                  </button>
                ))}
              </div>
              <select className={selectClass} aria-label={text("field.label")} value={field} onChange={(e) => setField(e.target.value as FeedField | "all")}>
                <option value="all">{text("field.all")}</option>
                {fields.map((f) => <option key={f} value={f}>{text(`field.${f}`)}</option>)}
              </select>
              <Input data-gaid-search aria-label={text("search")} placeholder={text("search")} value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-48 flex-1" />
            </div>
            {error ? (
              <FeedFailure error={error} retry={() => setReload((n) => n + 1)} />
            ) : loading && !data ? (
              <div role="status" className="space-y-3">
                <p className="text-sm text-gaid-ink-2">{text("loading")}</p>
                {[0, 1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded bg-gaid-face-2" />)}
              </div>
            ) : data ? (
              <>
                <p className="text-xs tabular-nums text-gaid-ink-2" role="status" aria-busy={loading}>{text("count", { count: data.items.length })}</p>
                {!data.items.length ? (
                  <p className="max-w-[680px] text-sm text-gaid-ink-2">{text(filtered ? "empty" : "emptyAll")}</p>
                ) : (
                  <ul className="max-w-[960px] divide-y divide-gaid-edge">
                    {data.items.map((item) => <FeedRow key={item.id} item={item} projects={projects} />)}
                  </ul>
                )}
                {sources.length > 0 && <SourceList sources={sources} />}
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function Offline() {
  return (
    <div className="flex max-w-[680px] flex-col items-start gap-3">
      <h2 className="text-lg font-semibold">{text("offline.title")}</h2>
      <p className="text-sm text-gaid-ink-2">{text("offline.body")}</p>
      <Button onClick={() => openSettings({ tab: "services", section: "gaid-hub-server" })}>{text("offline.button")}</Button>
    </div>
  );
}

function FeedRow({ item, projects }: { item: FeedItem; projects: { id: string; name: string }[] }) {
  const [importing, setImporting] = useState(false);
  const published = feedDate(item.publishedAt);
  const meta = [
    item.sourceTitle,
    text(`field.${item.field}`),
    published ? text("published", { when: published }) : text("fetched", { when: feedDate(item.fetchedAt) }),
    item.github?.release ? text("release", { tag: item.github.release }) : null,
    item.github?.stars !== undefined ? text("stars", { count: item.github.stars }) : null,
  ].filter(Boolean);
  const skill = item.category === "skills" && item.github?.repo;
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="flex items-start justify-between gap-4">
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          title={text("openOriginal")}
          className="group inline-flex min-w-0 items-start gap-1.5 text-[15px] font-semibold text-gaid-ink underline-offset-[3px] hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="min-w-0 break-words">{item.title}</span>
          <ExternalLinkIcon className="mt-1 size-3.5 shrink-0 text-gaid-ink-3 group-hover:text-gaid-ink-2" aria-hidden />
        </a>
        {skill && (
          <Button size="sm" variant="outline" className="shrink-0" aria-expanded={importing} onClick={() => setImporting((v) => !v)}>
            {text("import.button")}
          </Button>
        )}
      </div>
      {item.summary ? (
        <p className="line-clamp-2 max-w-[680px] text-sm text-gaid-ink-2">{item.summary}</p>
      ) : (
        <p className="text-sm text-gaid-ink-3">{text("noSummary")}</p>
      )}
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-gaid-ink-2">
        {meta.map((part, i) => <span key={i} className={i === 0 ? "font-medium text-gaid-ink" : undefined}>{part}</span>)}
      </p>
      {skill && importing && <SkillImport repo={item.github!.repo} projects={projects} />}
    </li>
  );
}

function SkillImport({ repo, projects }: { repo: string; projects: { id: string; name: string }[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  if (!projects.length) return <p className="text-sm text-gaid-ink-2">{text("import.noProjects")}</p>;
  return (
    <div className="mt-1 flex max-w-[680px] flex-col gap-2 rounded-md border border-gaid-edge bg-gaid-face-2 p-3">
      <p className="text-xs text-gaid-ink-2">{text("import.note", { repo })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectClass} aria-label={text("import.project")} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Button size="sm" disabled={!projectId} onClick={() => requestSkillImport(projectId, repo)}>{text("import.open.button")}</Button>
      </div>
    </div>
  );
}

function SourceList({ sources }: { sources: FeedSourceSummary[] }) {
  return (
    <details className="max-w-[960px] text-sm">
      <summary className="cursor-pointer text-gaid-ink-2">{text("sources.show", { count: sources.length })}</summary>
      <ul className="mt-3 divide-y divide-gaid-edge">
        {sources.map((s) => (
          <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span className="min-w-0">
              <a href={s.homepage} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-[3px] hover:underline">{s.title}</a>
              <span className="ml-2 text-xs text-gaid-ink-2">{s.publisher} · {text(`field.${s.field}`)}</span>
            </span>
            <span className={cn("text-xs tabular-nums", s.lastFetch && !s.lastFetch.ok ? "text-gaid-warning" : "text-gaid-ink-2")}>
              {!s.lastFetch ? text("sources.never") : text(s.lastFetch.ok ? "sources.ok" : "sources.failed", { when: feedDate(s.lastFetch.at, true) })}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
