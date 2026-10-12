"use client";
import { geoText } from "@/geo/i18n";
import { useEffect, useState } from "react";
import { fileCategory, sciSummaryUrl } from "@/lib/use-sandbox";
import { fetchSciJson, isAbortError } from "@/lib/sci-fetch";
import type { ViewerProps } from "@/lib/viewers/registry";
import DataTable, { type TableSummary } from "./data-table";
import { ArrayVisualization, formatNumber, type ArrayPlot } from "./data-plots";

const filesText = geoText("files");

// ---------------------------------------------------------------------------
// Shapes (mirrors server/src/helpers/arrays_helper.py's JSON output)
// ---------------------------------------------------------------------------

interface TreeNode {
  path: string;
  type: "group" | "dataset" | "link";
  shape?: number[];
  dtype?: string;
  attrs?: Record<string, string>;
}
interface TreeSummary {
  format: string;
  kind: "tree";
  file_size: number;
  tree: TreeNode[];
  truncated: boolean;
}

interface ArrayInfo {
  name: string;
  shape: number[];
  dtype: string;
  min: number | null;
  max: number | null;
  mean: number | null;
  preview: (number | string | null)[];
}
interface NdarraySummary {
  format: string;
  kind: "ndarray";
  file_size: number;
  arrays: ArrayInfo[];
}

interface VariableInfo {
  name: string;
  dims: string[];
  shape: number[];
  dtype: string;
  attrs: Record<string, string>;
}
interface VariablesSummary {
  format: string;
  kind: "variables";
  file_size: number;
  dimensions: Record<string, number>;
  variables: VariableInfo[];
  num_variables: number;
  truncated: boolean;
  global_attrs: Record<string, string>;
}

interface DatasetInfo { key: string; name: string; shape: number[]; dtype: string; unavailable?: string }
type ArraysSummary = (TreeSummary | TableSummary | NdarraySummary | VariablesSummary) & {
  datasets?: DatasetInfo[];
  selected?: string;
  plot?: ArrayPlot | null;
  plot_note?: string;
  value_preview?: string[];
  truncated?: boolean;
};

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-xs">{value}</div>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// kind:"tree" (HDF5)
// ---------------------------------------------------------------------------

function TreeView({ summary }: { summary: TreeSummary }) {
  return (
    <div className="p-4">
      <ul className="space-y-0.5 font-mono text-xs">
        {summary.tree.map((node, i) => {
          const depth = node.path.split("/").filter(Boolean).length - 1;
          return (
            <li
              key={`${node.path}-${i}`}
              className="flex flex-wrap items-center gap-2 py-0.5"
              style={{ paddingLeft: `${Math.max(depth, 0) * 16}px` }}
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-sans font-medium uppercase ${
                  node.type === "group"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    : "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300"
                }`}
              >
                {filesText("arraydata_viewer.node_type", { type: node.type })}
              </span>
              <span>{node.path || "/"}</span>
              {(node.shape || node.dtype) && (
                <span className="text-muted-foreground">
                  {node.shape ? `[${node.shape.join(", ")}]` : ""}
                  {node.shape && node.dtype ? " · " : ""}
                  {node.dtype ?? ""}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {summary.truncated && (
        <p className="mt-3 text-xs text-muted-foreground">{filesText("arraydata_viewer.tree_truncated", { count: summary.tree.length })}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// kind:"ndarray" (npy/npz)
// ---------------------------------------------------------------------------

function NdarrayView({ summary }: { summary: NdarraySummary }) {
  return (
    <div className="space-y-4 p-4">
      {summary.arrays.map((arr, i) => (
        <div key={`${arr.name}-${i}`} className="rounded-md border p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{arr.name || filesText("arraydata_viewer.unnamed")}</span>
            <span className="text-xs text-muted-foreground">
              [{arr.shape.join(", ")}] · {arr.dtype}
            </span>
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Stat label={filesText("arraydata_viewer.stat_min")} value={formatNumber(arr.min)} />
            <Stat label={filesText("arraydata_viewer.stat_max")} value={formatNumber(arr.max)} />
            <Stat label={filesText("arraydata_viewer.stat_mean")} value={formatNumber(arr.mean)} />
          </div>
          <div className="overflow-x-auto rounded bg-muted/20 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{filesText("arraydata_viewer.displayed_values", { count: arr.preview.length })}</p>
            <p className="whitespace-pre-wrap break-all font-mono text-[11px]">
              {arr.preview.length > 0 ? arr.preview.map(value => value ?? "—").join(", ") : filesText("arraydata_viewer.empty")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// kind:"variables" (NetCDF)
// ---------------------------------------------------------------------------

function VariablesView({ summary }: { summary: VariablesSummary }) {
  const globalAttrEntries = Object.entries(summary.global_attrs ?? {});
  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{filesText("arraydata_viewer.dimensions")}</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(summary.dimensions ?? {}).map(([name, size]) => (
            <span
              key={name}
              className="rounded-full border bg-muted/40 px-2.5 py-0.5 font-mono text-[11px]"
            >
              {name}: {size}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{filesText("arraydata_viewer.variable_count", { count: summary.num_variables })}</p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border-b bg-muted px-3 py-1.5 text-left font-semibold">{filesText("arraydata_viewer.column_name")}</th>
                <th className="border-b bg-muted px-3 py-1.5 text-left font-semibold">{filesText("arraydata_viewer.column_dims")}</th>
                <th className="border-b bg-muted px-3 py-1.5 text-left font-semibold">{filesText("arraydata_viewer.column_shape")}</th>
                <th className="border-b bg-muted px-3 py-1.5 text-left font-semibold">{filesText("arraydata_viewer.column_dtype")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.variables.map((v) => (
                <tr key={v.name} className="border-b border-muted/50 hover:bg-muted/20">
                  <td className="px-3 py-1 font-mono">{v.name}</td>
                  <td className="px-3 py-1 text-muted-foreground">{v.dims.join(", ")}</td>
                  <td className="px-3 py-1 text-muted-foreground">[{v.shape.join(", ")}]</td>
                  <td className="px-3 py-1 text-muted-foreground">{v.dtype}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {summary.truncated && (
          <p className="mt-1 text-xs text-muted-foreground">{filesText("arraydata_viewer.variables_truncated", { shown: summary.variables.length, total: summary.num_variables })}</p>
        )}
      </div>

      {globalAttrEntries.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{filesText("arraydata_viewer.global_attributes")}</p>
          <ul className="space-y-0.5 font-mono text-[11px]">
            {globalAttrEntries.map(([k, v]) => (
              <li key={k}>
                <span className="text-muted-foreground">{k}:</span> {v}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root viewer
// ---------------------------------------------------------------------------

export default function ArrayDataViewer(props: ViewerProps) {
  // Selection belongs to a file and project, including when an open tab is reused.
  return <DataPreview key={`${props.projectId}:${props.path}`} {...props} />;
}

function DataPreview({ path, projectId }: ViewerProps) {
  const [summary, setSummary] = useState<ArraysSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | undefined>();
  const [slice, setSlice] = useState(0);
  const [retry, setRetry] = useState(0);
  const [completedRequest, setCompletedRequest] = useState<string | null>(null);
  const kind = (fileCategory(path) === "datatable" || /\.xlsx$/i.test(path)) ? "tables" : "arrays";
  const requestId = JSON.stringify([kind, key, slice, retry]);
  const loading = completedRequest !== requestId;

  useEffect(() => {
    const ac = new AbortController();
    fetchSciJson<ArraysSummary>(sciSummaryUrl(path, kind, projectId, { key, slice }), { signal: ac.signal })
      .then((data) => { if (!ac.signal.aborted) { setSummary(data); setError(null); } })
      .catch((e) => { if (!ac.signal.aborted && !isAbortError(e)) setError(String(e.message ?? e)); })
      .finally(() => { if (!ac.signal.aborted) setCompletedRequest(requestId); });
    return () => ac.abort();
  }, [path, projectId, kind, key, slice, retry, requestId]);

  const collections = summary?.kind === "table" ? summary.collections : undefined;
  const selection = key ?? summary?.selected ?? "";
  const activeDataset = summary?.datasets?.find(dataset => dataset.key === selection);
  // A slice may use exact text when its integers cannot be plotted safely.
  // Keep navigation available so the user can still inspect other slices.
  const sliceCount = summary?.plot?.slices ?? activeDataset?.shape.slice(0, -2).reduce((count, size) => count * size, 1) ?? 1;
  const shownArrays = summary?.kind === "ndarray" && activeDataset
    ? { ...summary, arrays: summary.arrays.filter(array => array.name === activeDataset.name) } : null;

  return <div className="flex h-full flex-col overflow-auto" aria-busy={loading}>
    {summary && <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-xs">
        <span className="font-semibold">{summary.format}</span>
        <span className="text-muted-foreground">{fmtBytes(summary.file_size)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3 text-xs">
        {collections && collections.length > 0 && <label className="flex min-w-0 items-center gap-2">
          {summary.format === "xlsx" ? filesText("arraydata_viewer.sheet") : filesText("arraydata_viewer.table")}
          <select aria-label={summary.format === "xlsx" ? filesText("arraydata_viewer.sheet") : filesText("arraydata_viewer.table")} className="min-w-0 max-w-80 rounded border bg-background px-2 py-1.5"
            value={selection} disabled={loading} onChange={e => { setKey(e.target.value); setSlice(0); }}>
            {collections.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>}
        {summary.datasets && summary.datasets.length > 0 && <label className="flex min-w-0 items-center gap-2">{filesText("arraydata_viewer.dataset")} <select aria-label={filesText("arraydata_viewer.dataset")} className="min-w-0 max-w-96 rounded border bg-background px-2 py-1.5" value={selection}
            disabled={loading} onChange={e => { setKey(e.target.value); setSlice(0); }}>
            {summary.datasets.map(dataset => <option key={dataset.key} value={dataset.key}>
              {dataset.name || filesText("arraydata_viewer.array")} · [{dataset.shape.join(" × ")}] · {dataset.dtype}
            </option>)}
          </select>
        </label>}
        {Number.isSafeInteger(sliceCount) && sliceCount > 1 && <div className="flex items-center gap-2">
          <button aria-label={filesText("arraydata_viewer.previous_slice")} className="rounded border px-2 py-1 disabled:opacity-40" disabled={loading || slice === 0} onClick={() => setSlice(slice - 1)}>←</button>
          <label className="flex items-center gap-2">{filesText("arraydata_viewer.slice")} <input aria-label={filesText("arraydata_viewer.slice")} className="w-20 rounded border bg-background px-2 py-1" type="number" min={0} max={sliceCount - 1}
              value={slice} disabled={loading} onChange={e => {
                const value = Number(e.target.value);
                if (Number.isSafeInteger(value) && value >= 0 && value < sliceCount) setSlice(value);
              }} />
          </label>
          <span className="text-muted-foreground">{filesText("arraydata_viewer.slice_total", { count: sliceCount })}</span>
          <button aria-label={filesText("arraydata_viewer.next_slice")} className="rounded border px-2 py-1 disabled:opacity-40" disabled={loading || slice >= sliceCount - 1} onClick={() => setSlice(slice + 1)}>→</button>
        </div>}
      </div>
    </>}
    {loading ? <div role="status" className="flex flex-1 items-center justify-center gap-2 p-8 text-xs text-muted-foreground">
      <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />{filesText("arraydata_viewer.loading_preview")} </div> : error ? <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      <p className="font-medium">{filesText("arraydata_viewer.data_preview_failed")}</p><p className="max-w-md text-xs">{error}</p>
      <button className="mt-2 rounded border px-3 py-1 text-xs" onClick={() => setRetry(retry + 1)}>{filesText("arraydata_viewer.retry_preview")}</button>
    </div> : summary && <div className="flex-1 overflow-auto">
      {summary.plot && <div className="p-4 pb-0"><ArrayVisualization plot={summary.plot} /></div>}
      {summary.plot_note && <p className="px-4 pt-4 text-xs text-muted-foreground">{summary.plot_note}</p>}
      {!!summary.value_preview?.length && <p className="break-all px-4 pt-2 font-mono text-xs">{filesText("arraydata_viewer.values_preview", { values: summary.value_preview.join(", ") })}</p>}
      {summary.kind === "tree" && <TreeView summary={summary} />}
      {summary.kind === "table" && <DataTable key={summary.selected ?? "table"} summary={summary} />}
      {summary.kind === "ndarray" && <NdarrayView summary={shownArrays ?? summary} />}
      {summary.kind === "variables" && <VariablesView summary={summary} />}
      {summary.truncated && summary.kind === "ndarray" && <p className="px-4 pb-4 text-xs text-muted-foreground">{filesText("arraydata_viewer.dataset_list_limited_to_the_first_100_entries")}</p>}
      {summary.kind === "table" && summary.collections_truncated && <p className="px-4 pb-4 text-xs text-muted-foreground">{filesText("arraydata_viewer.sheet_table_list_limited_to_the_first_100_entries")}</p>}
    </div>}
  </div>;
}
