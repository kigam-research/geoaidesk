"use client";
import { useEffect, useRef, useState } from "react";
import type { MapAreaTable } from "../../contracts/maps";
import type { LayerState } from "./model";
import { areaCsv, areaRequest, hasCrs, sourceCrs } from "./model";
import { downloadBlob, mapPost } from "./client";
import { mapText as t } from "./strings";
export default function AreaPanel({ layer, projectId, fields }: { layer: LayerState; projectId?: string; fields: string[] }) {
  const [classField, setClassField] = useState("");
  const [method, setMethod] = useState("");
  const [crs, setCrs] = useState("");
  const [table, setTable] = useState<MapAreaTable>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const invalidate = () => { pending.current?.abort(); setBusy(false); setTable(undefined); setError(""); };
  const request = areaRequest(layer, classField, method, crs);
  async function calculate() {
    if (!request) return;
    pending.current?.abort();
    const ac = new AbortController(); pending.current = ac;
    setBusy(true); setError(""); setTable(undefined);
    try {
      const result = await mapPost<MapAreaTable>("/geo/area-table", request, projectId, ac.signal);
      if (ac.signal.aborted) return;
      if (result.scope !== "full-layer" || result.unit !== "m²" || !Array.isArray(result.rows)) throw new Error(t("areaError"));
      setTable(result);
    } catch (e) { if (!ac.signal.aborted) setError(e instanceof Error ? e.message : t("areaError")); }
    finally { if (!ac.signal.aborted) setBusy(false); }
  }
  const headers = [t("class"), t("count"), t("areaM2"), t("percent")];
  return <section className="space-y-2 rounded border p-3" aria-label={t("area")}>
    <h3 className="font-semibold">{t("area")}</h3>
    <p>{t("areaHint")}</p>
    {!hasCrs(sourceCrs(layer)) && <p>{t("nativeLimit")}</p>}
    <div className="flex flex-wrap gap-3">
      <label>{t("classField")} <select className="rounded border bg-background p-1" value={classField} onChange={e => { invalidate(); setClassField(e.target.value); }}><option value="">{t("noField")}</option>{fields.map(f => <option key={f}>{f}</option>)}</select></label>
      <label>{t("method")} <select className="rounded border bg-background p-1" value={method} onChange={e => { invalidate(); setMethod(e.target.value); }}><option value="">{t("chooseMethod")}</option><option value="geodesic">{t("geodesic")}</option><option value="projected">{t("projected")}</option></select></label>
      {method === "projected" && <label>{t("areaCrs")} <input className="rounded border bg-background p-1" value={crs} placeholder="EPSG:5186" onChange={e => { invalidate(); setCrs(e.target.value); }} /></label>}
      <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={!request || busy} onClick={calculate}>{t("runArea")}</button>
    </div>
    {busy && <p role="status">{t("loading")}</p>}{error && <p role="alert">{error}</p>}
    {table && <div className="space-y-2">
      <p>{t("fullLayer", { method: table.method, crs: table.areaCrs ?? t("geodesic") })}</p>
      <p>{t("totalArea", { area: table.totalArea, count: table.featureCount, empty: table.emptyCount })}</p>
      <div className="max-h-80 overflow-auto"><table className="w-full text-left"><thead><tr>{headers.map(h => <th className="border p-1" key={h}>{h}</th>)}</tr></thead><tbody>{table.rows.map((r, n) => <tr key={n}>{[r.class ?? t("nodata"), r.featureCount, r.area, r.percent].map((v, c) => <td className="border p-1" key={c}>{v}</td>)}</tr>)}</tbody></table></div>
      {table.limitations.length > 0 && <ul className="list-disc pl-5">{table.limitations.map((l, n) => <li key={n}>{l}</li>)}</ul>}
      <button className="rounded border px-2 py-1" onClick={() => downloadBlob(new Blob([areaCsv(table, headers)], { type: "text/csv;charset=utf-8" }), t("csvName"))}>{t("downloadCsv")}</button>
    </div>}
  </section>;
}
