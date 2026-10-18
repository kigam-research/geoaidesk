"use client";

import { useEffect, useState } from "react";
import { FolderIcon, LoaderCircleIcon, SearchIcon, StarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HubEntry, HubFolder } from "@/geo/contracts/hub-shared";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";
import { sharedHub } from "./shared-api";
import { TechnicalDetail } from "./technical";

const text = geoText("hub");
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Browse the institute registry, independently of the researcher's authoring projects. */
export function SharedBrowse({ onOpen }: { onOpen: (id: string) => void }) {
  const [folders, setFolders] = useState<(HubFolder & { entries: number })[]>([]);
  const [entries, setEntries] = useState<HubEntry[]>([]);
  const [folder, setFolder] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    // Hide previous results immediately so they cannot be opened under a different filter.
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

  const changeFolder = (id: string) => { setLoading(true); setFolder(id); };
  const reset = () => { setLoading(true); setQuery(""); setFolder("all"); };
  const options = [
    { id: "all", name: text("home.browse.all"), entries: folders.reduce((n, f) => n + f.entries, 0) },
    ...folders,
  ];
  const filtered = folder !== "all" || !!query.trim();

  return (
    <section className="flex flex-col gap-4" aria-label={text("home.browse.title")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            className="pl-9"
            aria-label={text("home.browse.search.label")}
            placeholder={text("home.browse.search.placeholder")}
            value={query}
            onChange={(e) => { setLoading(true); setQuery(e.target.value); }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{text("home.browse.order")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
        <nav className="flex flex-col gap-1" aria-label={text("home.browse.folders")}>
          {options.map((f) => (
            <button
              type="button"
              key={f.id}
              aria-current={folder === f.id ? "true" : undefined}
              onClick={() => { if (folder !== f.id) changeFolder(f.id); }}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm", focus,
                folder === f.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
            >
              <FolderIcon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{f.entries}</span>
            </button>
          ))}
        </nav>
        <div aria-busy={loading} className="min-w-0">
          {loading ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />{text("home.browse.loading")}
            </p>
          ) : error ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-destructive">{text("home.browse.error")}</p>
              <Button variant="outline" onClick={() => { setLoading(true); setRetry((n) => n + 1); }}>
                {text("home.browse.retry.button")}
              </Button>
              <TechnicalDetail detail={error} />
            </div>
          ) : entries.length === 0 ? (
            <div role="status" className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
              <p className="text-sm text-muted-foreground">
                {text(filtered ? "home.browse.noResults" : "home.browse.empty")}
              </p>
              {filtered ? (
                <Button variant="outline" onClick={reset}>{text("home.browse.reset.button")}</Button>
              ) : (
                <button type="button" onClick={() => document.getElementById("hub-recommended")?.scrollIntoView({ behavior: "instant", block: "start" })} className={cn("rounded text-sm text-primary underline", focus)}>
                  {text("home.browse.recommended.action")}
                </button>
              )}
            </div>
          ) : (
            <>
              <p role="status" className="mb-3 text-xs text-muted-foreground">{text("home.browse.count", { count: entries.length })}</p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => onOpen(entry.id)}
                      aria-label={text("home.browse.open", { title: entry.title })}
                      className={cn("flex h-full w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/60", focus)}>
                      <span className="block w-full truncate text-sm font-semibold" title={entry.title}>{entry.title}</span>
                      <span className="line-clamp-1 text-sm text-muted-foreground" title={entry.tagline || entry.summary}>{entry.tagline || entry.summary}</span>
                      <span className="mt-auto flex w-full items-center gap-2 pt-1 text-xs text-muted-foreground">
                        <span className="min-w-0 flex-1 truncate" title={entry.author}>{entry.author}</span>
                        <span className="inline-flex shrink-0 items-center gap-1" aria-label={text("home.browse.stars", { count: entry.stars })}>
                          <StarIcon className="size-3.5" aria-hidden />{entry.stars}
                        </span>
                      </span>
                      <span className="w-full truncate text-xs text-muted-foreground" title={folders.find((f) => f.id === entry.folderId)?.name}>
                        {folders.find((f) => f.id === entry.folderId)?.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
