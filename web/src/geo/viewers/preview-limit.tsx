"use client";
// gaid-system-ui-followups: a text file over the preview limit (CSV 8 MB, other text 512 KB) gets its own state instead
// of a load error. The sample comes from the bounded shared inspection (`POST /geo/inspect`), never from the file read.
import { useEffect, useState } from "react";
import { DownloadIcon, FileWarningIcon } from "lucide-react";
import { apiFetch } from "@/lib/projects";
import { GEO_INSPECTION_SCHEMA, type GeoInspection } from "../contracts/inspection";
import { inspectionText as t } from "./strings";

const SAMPLE_ROWS = 8;
const DEFAULT_COLUMNS = 8;

const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

export function PreviewLimit({ path, projectId, onDownload }: { path: string; projectId: string; onDownload?: () => void }) {
  const [inspection, setInspection] = useState<GeoInspection | null>(null);
  const [failed, setFailed] = useState(false);
  const [allColumns, setAllColumns] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15_000);
    let live = true;
    apiFetch("/geo/inspect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, previewRows: SAMPLE_ROWS }), signal: ac.signal }, projectId)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || body.schemaVersion !== GEO_INSPECTION_SCHEMA || !body.asset) throw new Error("inspect");
        if (live) setInspection(body);
      })
      .catch(() => { if (live) setFailed(true); })
      .finally(() => clearTimeout(timer));
    return () => { live = false; clearTimeout(timer); ac.abort(); };
  }, [path, projectId]);

  const preview = inspection?.preview;
  const header = inspection?.columns?.map((column) => column.name) ?? [];
  const rows = preview?.rows ?? [];
  const tabular = header.length > 0;
  const width = tabular ? header.length : 0;
  const shown = allColumns ? width : Math.min(width, DEFAULT_COLUMNS);
  const cell = (value: string | number | null | undefined) => value === null || value === undefined ? t("nodata") : String(value);

  return <div className="flex h-full min-h-0 flex-col gap-3 p-4 text-sm" data-testid="preview-limit">
    <div className="flex items-start gap-3">
      <FileWarningIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="font-medium">{t("oversize.title")}</h3>
        <p className="text-muted-foreground">
          {inspection ? t("oversize.size", { size: megabytes(inspection.asset.sizeBytes) }) + " " : ""}{t("oversize.body")}
        </p>
        {onDownload && <button type="button" onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <DownloadIcon aria-hidden className="size-3.5" />{t("oversize.download")}
        </button>}
      </div>
    </div>
    {!inspection && !failed && <p role="status" className="text-muted-foreground">{t("oversize.loading")}</p>}
    {failed && <p className="text-muted-foreground">{t("oversize.failed")}</p>}
    {inspection && rows.length > 0 && <section className="flex min-h-0 flex-col gap-2" aria-label={t("oversize.sample")}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{tabular
          ? t("oversize.state", { rows: rows.length, columns: width, estimate: preview?.sourceRows ?? -1 })
          : t("oversize.lines", { rows: rows.length })}</span>
        {width > DEFAULT_COLUMNS && <button type="button" className="rounded border px-2 py-0.5 text-foreground hover:bg-muted" aria-pressed={allColumns} onClick={() => setAllColumns((value) => !value)}>
          {t(allColumns ? "oversize.fewerColumns" : "oversize.allColumns", { count: width })}
        </button>}
      </div>
      {tabular
        ? <div className="min-h-0 overflow-auto rounded border">
          <table className="w-full border-collapse text-left text-xs tabular-nums">
            <thead className="sticky top-0 bg-muted"><tr>{header.slice(0, shown).map((name, i) => <th key={i} scope="col" className="whitespace-nowrap border-b px-2 py-1 font-medium">{name}</th>)}</tr></thead>
            <tbody>{rows.map((row, r) => <tr key={r} className="border-b last:border-0">{Array.from({ length: shown }, (_, c) => <td key={c} className="whitespace-nowrap px-2 py-1">{cell(row[c])}</td>)}</tr>)}</tbody>
          </table>
        </div>
        : <pre className="min-h-0 overflow-auto whitespace-pre rounded border p-2 text-xs">{rows.map((row) => cell(row[0])).join("\n")}</pre>}
    </section>}
  </div>;
}
