"use client";
import { lazy, Suspense, useState, type ReactNode } from "react";
import type { ViewerProps } from "@/lib/viewers/registry";
import { geoText } from "@/geo/i18n";
const TableRolesViewer = lazy(() => import("./table-roles-viewer"));
const t = geoText("tables");
/** Explicit read-only overlay, never replaces the existing generic table/editor. */
export function TableInspectionOption({ children, ...props }: ViewerProps & { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  if (!/\.(csv|tsv|xlsx)$/i.test(props.path)) return <>{children}</>;
  return <div className="flex h-full min-h-0 flex-col">
    <div className="border-b px-3 py-2"><button className="rounded border px-2 py-1 text-xs" aria-pressed={enabled} onClick={() => setEnabled(v => !v)}>{t(enabled ? "ordinary" : "inspect")}</button></div>
    <div className="min-h-0 flex-1 overflow-auto">{enabled ? <Suspense fallback={<p role="status" className="p-4">{t("loading")}</p>}><TableRolesViewer {...props} /></Suspense> : children}</div>
  </div>;
}
