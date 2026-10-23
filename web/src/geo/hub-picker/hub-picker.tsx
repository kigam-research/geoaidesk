"use client";

import { hubVersionOf } from "@/geo/contracts/hub-version";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HubEntry } from "@/geo/contracts/hub-shared";
import { sharedHub } from "@/geo/hub/shared-api";
import { t } from "@/geo/i18n";

/** A bounded list within the current task, not navigation away to the hub. */
export function HubPicker({ recipesOnly = false, disabled, onSelect }: {
  recipesOnly?: boolean; disabled?: boolean; onSelect: (entry: HubEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<HubEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true); setFailed(false);
      void sharedHub.entries(undefined, query).then((data) => {
        if (!Array.isArray(data.entries)) throw new Error("Invalid hub list");
        if (alive) setEntries(data.entries);
      }).catch(() => { if (alive) setFailed(true); }).finally(() => { if (alive) setLoading(false); });
    }, query ? 200 : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [query, retry]);
  const rows = entries.filter((entry) => !recipesOnly || entry.recipe === true);
  return <section className="min-w-0 space-y-3" aria-label={t("hubPicker.search.label")}>
    <Input type="search" aria-label={t("hubPicker.search.label")} placeholder={t("hubPicker.search.placeholder")} value={query} disabled={disabled}
      onChange={(event) => { setQuery(event.target.value); setLoading(true); }} />
    {loading ? <p role="status" className="text-sm text-muted-foreground">{t("hubPicker.loading")}</p>
      : failed ? <div role="alert" className="space-y-2 text-sm"><p>{t("hubPicker.error")}</p><Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>{t("hubPicker.retry.button")}</Button></div>
      : rows.length === 0 ? <p role="status" className="text-sm text-muted-foreground">{t(recipesOnly ? "hubPicker.emptyRecipes" : "hubPicker.empty")}</p>
      : <ul className="max-h-64 overflow-y-auto divide-y rounded-md border" aria-label={t("hubPicker.results")}>
        {rows.map((entry) => <li key={entry.id}>
          <button type="button" disabled={disabled} className="w-full min-w-0 space-y-1 p-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" onClick={() => onSelect(entry)}>
            <span className="block truncate text-sm font-medium" title={entry.title}>{entry.title}</span>
            <span className="block truncate text-xs text-muted-foreground" title={entry.tagline || entry.summary}>{entry.tagline || entry.summary}</span>
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="max-w-40 truncate">{entry.author}</span>
              <span>{t("hubPicker.stars", { count: entry.stars })}</span>
              <span>{t("hubPicker.revision", { version: hubVersionOf(entry) ?? "" })}</span>
              <span className="rounded-full border px-1.5 py-px" title={t("hubPicker.kindTip")}>{t(`hubPicker.kind.${entry.kind}`)}</span>
              {entry.recipe && <span className="rounded-full border px-1.5 py-px" title={t("hubPicker.recipeTip")}>{t("hubPicker.recipe")}</span>}
            </span>
          </button>
        </li>)}
      </ul>}
  </section>;
}
