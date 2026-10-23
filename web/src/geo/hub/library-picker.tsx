"use client";
/**
 * "서재에서 추가" (gaid-authoring-sources): choose several papers and research notes from 서재 as sources of a Workflow
 * draft. Papers enter with their PDF (or metadata and abstract), notes with their text and figures.
 */
import { BookOpenIcon, NotebookTextIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LibraryItemSummary } from "@/geo/contracts/library";
import { geoText } from "@/geo/i18n";
import { listLibrary } from "@/geo/library/api";
import { cn } from "@/lib/utils";

const text = geoText("hub");

export type LibraryCategory = "paper" | "note";

/** A library row as gaid-note-library adds it: `kind` "note" marks a research note (absent = paper). */
type Row = LibraryItemSummary & {
  kind?: LibraryCategory;
  note?: { projectName?: string; date?: string; local?: boolean };
};

export const categoryOf = (row: LibraryItemSummary): LibraryCategory => ((row as Row).kind === "note" ? "note" : "paper");

/** One line under the title: authors and year for a paper, project and date for a note. */
export function rowDetail(row: LibraryItemSummary): string {
  const r = row as Row;
  if (categoryOf(r) === "note")
    return [r.note?.projectName, r.note?.date, r.note && r.note.local === false ? text("library.otherPc") : ""]
      .filter(Boolean)
      .join(" · ");
  return [r.authors, r.year, r.hasPdf ? "" : text("library.noPdf")].filter(Boolean).join(" · ");
}

export function LibrarySourcePicker({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (itemIds: string[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<LibraryItemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<LibraryCategory>("paper");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setRows(null);
    setError(null);
    setChosen([]);
    listLibrary({ limit: 500 })
      .then((res) => active && setRows(res.items))
      .catch((e) => active && setError((e as Error).message));
    return () => {
      active = false;
    };
  }, [open]);

  const counts = useMemo(
    () => ({
      paper: rows?.filter((r) => categoryOf(r) === "paper").length ?? 0,
      note: rows?.filter((r) => categoryOf(r) === "note").length ?? 0,
    }),
    [rows],
  );
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (rows ?? []).filter(
      (r) =>
        categoryOf(r) === category &&
        words.every((w) => `${r.title} ${r.authors} ${r.citationKey ?? ""} ${rowDetail(r)}`.toLowerCase().includes(w)),
    );
  }, [rows, category, query]);
  const toggle = (id: string, on: boolean) =>
    setChosen((cur) => (on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id)));

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{text("library.title")}</DialogTitle>
          <DialogDescription>{text("library.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="gaid-seg flex items-center gap-0.5 rounded-lg border border-gaid-edge bg-gaid-hover p-0.5"
            role="group"
            aria-label={text("library.category")}
          >
            {(["paper", "note"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                  category === c
                    ? "bg-gaid-face text-gaid-ink shadow-[0_0_0_1px_var(--gaid-edge)]"
                    : "text-gaid-ink-2 hover:text-gaid-ink",
                )}
              >
                {text(c === "paper" ? "library.papers" : "library.notes")}
                <span className="tabular-nums text-gaid-ink-3">{counts[c]}</span>
              </button>
            ))}
          </div>
          <label className="relative min-w-48 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={text("library.search")}
              aria-label={text("library.search")}
            />
          </label>
        </div>
        <div className="min-h-40 flex-1 overflow-y-auto rounded-md border border-gaid-edge">
          {error && <p className="p-3 text-sm text-destructive">{error}</p>}
          {!rows && !error && (
            <p role="status" className="p-3 text-sm text-muted-foreground">
              {text("library.loading")}
            </p>
          )}
          {rows && !shown.length && (
            <p className="p-3 text-sm text-muted-foreground">
              {text(query.trim() ? "library.noMatch" : category === "note" ? "library.emptyNotes" : "library.emptyPapers")}
            </p>
          )}
          <ul className="divide-y divide-gaid-edge">
            {shown.map((r) => {
              const on = chosen.includes(r.id);
              const Icon = categoryOf(r) === "note" ? NotebookTextIcon : BookOpenIcon;
              return (
                <li key={r.id}>
                  <label className={cn("flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2", on && "bg-gaid-signal-tint")}>
                    <input type="checkbox" checked={on} onChange={(e) => toggle(r.id, e.target.checked)} />
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{r.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{rowDetail(r)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <DialogFooter className="items-center">
          <span className="mr-auto text-xs text-muted-foreground tabular-nums">
            {text("library.selected", { count: chosen.length })}
          </span>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {text("library.cancel")}
          </Button>
          <Button
            disabled={!chosen.length || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onAdd(chosen);
                onOpenChange(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {text(busy ? "library.adding" : chosen.length ? "library.addAction" : "library.addEmpty", { count: chosen.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
