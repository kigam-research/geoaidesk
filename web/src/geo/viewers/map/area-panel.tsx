"use client";
import { useEffect, useRef, useState } from "react";
import type { MapAreaTable } from "../../contracts/maps";
import type { LayerState } from "./model";
import { areaCsv, areaRequest, hasCrs, sourceCrs } from "./model";
import { downloadBlob, mapPost } from "./client";
import { MapButton, MapSelect, mapInput } from "./controls";
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
  return <section className="space-y-3 pt-3 text-xs" aria-label={t("area")}>
    <h3 className="font-semibold">{t("area")}</h3>
    <details><summary className="cursor-pointer text-gaid-ink-2">{t("areaDetails")}</summary><p className="pt-2">{t("areaHint")}</p></details>
    {!hasCrs(sourceCrs(layer)) && <p>{t("nativeLimit")}</p>}
    <div className="flex flex-wrap gap-3">
      <label>{t("classField")} <MapSelect aria-label={t("classField")} value={classField} onChange={value => { invalidate(); setClassField(value); }}><option value="">{t("noField")}</option>{fields.map(f => <option key={f}>{f}</option>)}</MapSelect></label>
      <label>{t("method")} <MapSelect aria-label={t("method")} value={method} onChange={value => { invalidate(); setMethod(value); }}><option value="">{t("chooseMethod")}</option><option value="geodesic">{t("geodesic")}</option><option value="projected">{t("projected")}</option></MapSelect></label>
      {method === "projected" && <label>{t("areaCrs")} <input className={mapInput} value={crs} placeholder="EPSG:5186" onChange={e => { invalidate(); setCrs(e.target.value); }} /></label>}
      <MapButton disabled={!request || busy} onClick={calculate}>{t("runArea")}</MapButton>
    </div>
    {busy && <p role="status">{t("loading")}</p>}{error && <div role="alert">{t("areaError")}<details><summary>{t("technical")}</summary>{error}</details></div>}
    {table && <div className="space-y-2">
      <p>{t("fullLayer", { method: table.method, crs: table.areaCrs ?? t("geodesic") })}</p>
      <p>{t("totalArea", { area: table.totalArea, count: table.featureCount, empty: table.emptyCount })}</p>
      <div className="max-h-80 overflow-auto"><table className="w-full text-left"><thead className="sticky top-0 bg-gaid-chrome"><tr>{headers.map(h => <th className="border-b border-gaid-edge px-2 py-2 tabular-nums" key={h}>{h}</th>)}</tr></thead><tbody>{table.rows.map((r, n) => <tr key={n}>{[r.class ?? t("nodata"), r.featureCount, r.area, r.percent].map((v, c) => <td className="border-b border-gaid-edge px-2 py-2 tabular-nums" key={c}>{v}</td>)}</tr>)}</tbody></table></div>
      {table.limitations.length > 0 && <ul className="list-disc pl-5">{table.limitations.map((l, n) => <li key={n}>{l}</li>)}</ul>}
      <MapButton onClick={() => downloadBlob(new Blob([areaCsv(table, headers)], { type: "text/csv;charset=utf-8" }), t("csvName"))}>{t("downloadCsv")}</MapButton>
    </div>}
  </section>;
}
