"use client";
import { geoText } from "@/geo/i18n";

import { useDeferredValue, useMemo, useState } from "react";

const filesText = geoText("files");

export const CSV_PAGE_SIZE = 250;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else current += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { cells.push(current); current = ""; }
      else current += ch;
    }
    cells.push(current);
    rows.push(cells);
  }
  return rows;
}

/** Pagination bounds the DOM without sacrificing full-data search or copying. */
export function CsvViewer({ content }: { content: string }) {
  const rows = useMemo(() => parseCsv(content), [content]);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim().toLowerCase());
  const [page, setPage] = useState(0);
  const [copyState, setCopyState] = useState("");
  const body = useMemo(() => rows.slice(1), [rows]);
  const matches = useMemo(() => search
    ? body.filter((row) => row.some((cell) => cell.toLowerCase().includes(search)))
    : body, [body, search]);
  const pages = Math.max(1, Math.ceil(matches.length / CSV_PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * CSV_PAGE_SIZE;
  const displayed = matches.slice(start, start + CSV_PAGE_SIZE);
  if (rows.length === 0) return null;
  return (
    <div className="flex h-full flex-col">
      {(body.length > CSV_PAGE_SIZE || query.length > 0) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-2 text-xs">
          <input
            type="search" aria-label={filesText("csv_viewer.search_all_csv_rows")} placeholder={filesText("csv_viewer.search_all_rows")}
            className="min-w-32 flex-1 rounded border bg-background px-2 py-1"
            value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }}
          />
          <span aria-live="polite">{filesText("csv_viewer.row_range", { start: matches.length ? start + 1 : 0, end: Math.min(start + CSV_PAGE_SIZE, matches.length), count: matches.length })}</span>
          <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{filesText("csv_viewer.previous")}</button>
          <span>{filesText("csv_viewer.pagination", { page: currentPage + 1, pages })}</span>
          <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>{filesText("csv_viewer.next")}</button>
          <button className="rounded border px-2 py-1" onClick={async () => {
            try { await navigator.clipboard.writeText(content); setCopyState(filesText("csv_viewer.full_csv_copied")); }
            catch { setCopyState(filesText("csv_viewer.copy_failed_use_download_instead")); }
          }}>{filesText("csv_viewer.copy_full_csv")}</button>
          {copyState && <span role="status">{copyState}</span>}
          <p className="w-full text-muted-foreground">{filesText("csv_viewer.search_includes_every_row_browser_find_searches_only_the_current_page_download_and_copy_include_the_full_file")}</p>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto" aria-busy={query.trim().toLowerCase() !== search}>
        <table className="w-full border-collapse text-xs">
          <thead><tr>{rows[0].map((cell, i) => <th scope="col" key={i} className="sticky top-0 border-b bg-muted px-3 py-1.5 text-left font-semibold">{cell}</th>)}</tr></thead>
          <tbody>{displayed.map((row, ri) => (
            <tr key={start + ri} className="border-b border-muted/50 hover:bg-muted/30">
              {row.map((cell, ci) => <td key={ci} className="whitespace-nowrap px-3 py-1 text-muted-foreground">{cell}</td>)}
            </tr>
          ))}</tbody>
        </table>
        {!matches.length && <p className="p-4 text-sm text-muted-foreground">{filesText("csv_viewer.no_matching_rows")}</p>}
      </div>
    </div>
  );
}
