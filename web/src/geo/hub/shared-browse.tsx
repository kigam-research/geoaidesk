"use client";

import { useEffect, useState } from "react";
import { FolderIcon, Grid3x3Icon, LoaderCircleIcon, SearchIcon, StarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HubEntry, HubFolder } from "@/geo/contracts/hub-shared";
import { geoLocale, geoText } from "@/geo/i18n";
import { withApiToken } from "@/lib/api-auth";
import { API_BASE } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { ConceptPicture } from "./concept-picture";
import { sharedHub } from "./shared-api";
import { TechnicalDetail } from "./technical";

const text = geoText("hub");
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function shortDate(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(geoLocale() === "ko" ? "ko-KR" : "en", { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Column layout shared by the header and the rows (UI guide v2 G2: every Workflow row has the same fields in the same places). */
const ROW = "grid grid-cols-[44px_minmax(0,1fr)_minmax(0,9rem)_6rem_3.5rem_3.5rem_5.5rem] items-center gap-4";

/**
 * Browse the institute registry, independently of the researcher's authoring projects. On the hub page the folder and
 * the search are controlled by the page (sidebar and header); used alone it shows its own search and folder list.
 */
export function SharedBrowse({
  onOpen,
  folder: folderProp,
  query: queryProp,
  onReset,
}: {
  onOpen: (id: string) => void;
  folder?: string;
  query?: string;
  onReset?: () => void;
}) {
  const controlled = folderProp !== undefined;
  const [folders, setFolders] = useState<(HubFolder & { entries: number })[]>([]);
  const [entries, setEntries] = useState<HubEntry[]>([]);
  const [ownFolder, setOwnFolder] = useState("all");
  const [ownQuery, setOwnQuery] = useState("");
  const folder = folderProp ?? ownFolder;
  const query = queryProp ?? ownQuery;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    // Hide previous results immediately so they cannot be opened under a different filter.
    setLoading(true);
    const timer = window.setTimeout(() => {
      void Promise.all([sharedHub.folders(), sharedHub.entries(folder, query)])
        .then(([f, e]) => {
          if (!live) return;
          setFolders(f.folders);
          setEntries(e.entries);
          setError(null);
        })
        .catch((e: Error) => live && setError(e.message))
        .finally(() => live && setLoading(false));
    }, query.trim() ? 250 : 0);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [folder, query, retry]);

  const changeFolder = (id: string) => setOwnFolder(id);
  const reset = () => {
    if (onReset) onReset();
    else {
      setOwnQuery("");
      setOwnFolder("all");
    }
  };
  const options = [
    { id: "all", name: text("home.browse.all"), entries: folders.reduce((n, f) => n + f.entries, 0) },
    ...folders,
  ];
  const filtered = folder !== "all" || !!query.trim();
  const folderName = (id: string) => folders.find((f) => f.id === id)?.name;

  const list = (
    <div aria-busy={loading} className="min-w-0">
      {loading ? (
        <p role="status" className="flex items-center gap-2 py-3 text-sm text-gaid-ink-2">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />{text("home.browse.loading")}
        </p>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-3 py-3">
          <p className="text-sm text-destructive">{text("home.browse.error")}</p>
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
            {text("home.browse.retry.button")}
          </Button>
          <TechnicalDetail detail={error} />
        </div>
      ) : entries.length === 0 ? (
        <div role="status" className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-gaid-edge p-6">
          <p className="text-sm text-gaid-ink-2">
            {text(filtered ? "home.browse.noResults" : "home.browse.empty")}
          </p>
          {filtered && <p className="text-sm text-gaid-ink-2">{text("home.browse.search.hint")}</p>}
          {filtered ? (
            <Button variant="outline" onClick={reset}>{text("home.browse.reset.button")}</Button>
          ) : (
            <button type="button" onClick={() => document.getElementById("hub-recommended")?.scrollIntoView({ behavior: "instant", block: "start" })} className={cn("rounded text-sm text-gaid-signal-ink underline", focus)}>
              {text("home.browse.recommended.action")}
            </button>
          )}
        </div>
      ) : (
        <>
          <p role="status" className="sr-only">{text("home.browse.count", { count: entries.length })}</p>
          <div className={cn(ROW, "px-3 pb-2 text-xs font-medium text-gaid-ink-2")} aria-hidden>
            <span />
            <span>{text("home.list.name")}</span>
            <span>{text("home.list.folder")}</span>
            <span>{text("home.list.author")}</span>
            <span className="text-right">{text("home.list.revision")}</span>
            <span className="text-right">{text("home.list.stars")}</span>
            <span className="text-right">{text("home.list.updated")}</span>
          </div>
          <ul className="border-t border-gaid-frame">
            {entries.map((entry) => {
              const cover = entry.cover ? withApiToken(`${API_BASE}${entry.cover}`) : null;
              return (
                <li key={entry.id} className="border-b border-gaid-edge">
                  <button
                    type="button"
                    onClick={() => onOpen(entry.id)}
                    aria-label={text("home.browse.open", { title: entry.title })}
                    className={cn(ROW, "min-h-16 w-full px-3 py-2.5 text-left transition-colors hover:bg-gaid-hover/60", focus)}
                  >
                    {cover ? (
                      <ConceptPicture
                        src={cover}
                        themed={entry.coverThemed}
                        fit="cover"
                        className="size-11 rounded-md border-gaid-edge"
                        imageClassName="h-full"
                      />
                    ) : (
                      <span className="flex size-11 items-center justify-center overflow-hidden rounded-md border border-gaid-edge bg-gaid-face-2 text-gaid-ink-2">
                        <Grid3x3Icon className="size-5" aria-hidden />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold" title={entry.title}>{entry.title}</span>
                      <span className="truncate text-sm text-gaid-ink-2" title={entry.tagline || entry.summary}>{entry.tagline || entry.summary}</span>
                    </span>
                    <span className="truncate text-sm text-gaid-ink-2" title={folderName(entry.folderId)}>{folderName(entry.folderId)}</span>
                    <span className="truncate text-sm text-gaid-ink-2" title={entry.author}>{entry.author}</span>
                    <span className="text-right text-sm tabular-nums text-gaid-ink-2">{entry.latestRevision ? text("draft.revision", { n: entry.latestRevision }) : ""}</span>
                    <span className="inline-flex items-center justify-end gap-1 text-sm tabular-nums text-gaid-ink-2" aria-label={text("home.browse.stars", { count: entry.stars })}>
                      <StarIcon className="size-3.5" aria-hidden />{entry.stars}
                    </span>
                    <span className="text-right text-sm tabular-nums text-gaid-ink-2">{shortDate(entry.updatedAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );

  if (controlled) return <section aria-label={text("home.browse.title")}>{list}</section>;

  return (
    <section className="flex flex-col gap-4" aria-label={text("home.browse.title")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-2.5 size-4 text-gaid-ink-2" aria-hidden />
          <Input
            type="search"
            className="pl-9"
            aria-label={text("home.browse.search.label")}
            placeholder={text("home.browse.search.placeholder")}
            value={query}
            onChange={(e) => setOwnQuery(e.target.value)}
          />
        </div>
        <p className="text-xs text-gaid-ink-2">{text("home.browse.order")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
        <nav className="flex flex-col gap-1" aria-label={text("home.browse.folders")}>
          {options.map((f) => (
            <button
              type="button"
              key={f.id}
              aria-current={folder === f.id ? "true" : undefined}
              onClick={() => { if (folder !== f.id) changeFolder(f.id); }}
              className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm", focus,
                folder === f.id ? "bg-gaid-signal-tint font-semibold" : "hover:bg-gaid-hover")}
            >
              <FolderIcon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
              <span className="text-xs tabular-nums text-gaid-ink-3">{f.entries}</span>
            </button>
          ))}
        </nav>
        {list}
      </div>
    </section>
  );
}
