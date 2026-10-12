"use client";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { MapSource } from "../../contracts/maps";
import { hasCrs, isVector, layerView, sourceCrs, type LayerState } from "./model";
import { layerLegend } from "./colors";
import { mapText as t } from "./strings";

const input = "rounded border bg-background p-1";
const iconButton = "rounded border p-1 disabled:opacity-40";
const baseName = (path: string) => path.split("/").pop() || path;
interface Props {
  layers: LayerState[]; active?: LayerState; crs: string; colorFields: Record<string, string>; fields: string[];
  pathToAdd: string; adding: boolean;
  onPathToAdd(value: string): void; onAdd(): void;
  onSelect(id: string): void; onUpdate(id: string, patch: Partial<LayerState>): void; onMove(id: string, direction: number): void; onRemove(id: string): void;
  onSource(patch: Partial<MapSource>): void; onColorField(field: string): void;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section aria-label={title} className="min-w-0 space-y-2 border-b pb-3 last:border-b-0 @lg:border-b-0"><h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>{children}</section>;
}
/**
 * Right-hand map panel: layers, legend and basic layer information next to the map, so they
 * stay visible without scrolling the viewer. Display information only; nothing here feeds analysis.
 */
export default function MapSidePanel(p: Props) {
  const { active, crs } = p;
  const view = active && layerView(active);
  const crsInfo = active && sourceCrs(active);
  // Below the map (narrow viewer) the panel is wide: two columns keep legend and information near the map.
  return <div className="@container text-xs"><div className="space-y-3 @lg:grid @lg:grid-cols-2 @lg:gap-x-6 @lg:gap-y-3 @lg:space-y-0">
    <Section title={t("layers")}>
      <ul className="space-y-1">{p.layers.map((l, index) => <li key={l.id} data-layer-row={l.source.path} className={`space-y-1 rounded border p-1.5 ${active?.id === l.id ? "border-primary bg-muted/60" : ""}`}>
        <div className="flex items-center gap-1.5">
          <input type="checkbox" aria-label={t("visible")} title={t("visible")} checked={l.visible} onChange={e => p.onUpdate(l.id, { visible: e.target.checked, loading: false })} />
          <button className="min-w-0 flex-1 truncate text-left font-medium" title={l.source.path} aria-pressed={active?.id === l.id} aria-label={`${t("select")}: ${l.source.path}`} onClick={() => p.onSelect(l.id)}>{baseName(l.source.path)}</button>
          <button className={iconButton} disabled={index === 0} aria-label={`${t("up")}: ${l.source.path}`} title={t("up")} onClick={() => p.onMove(l.id, -1)}><ArrowUp aria-hidden className="size-3" /></button>
          <button className={iconButton} disabled={index === p.layers.length - 1} aria-label={`${t("down")}: ${l.source.path}`} title={t("down")} onClick={() => p.onMove(l.id, 1)}><ArrowDown aria-hidden className="size-3" /></button>
          <button className={iconButton} aria-label={`${t("remove")}: ${l.source.path}`} title={t("remove")} onClick={() => p.onRemove(l.id)}><X aria-hidden className="size-3" /></button>
        </div>
        <label className="flex items-center gap-2 text-muted-foreground">{t("opacity")}<input className="min-w-0 flex-1" aria-label={`${t("opacity")}: ${l.source.path}`} type="range" min="0" max="1" step="0.05" value={l.opacity} onChange={e => p.onUpdate(l.id, { opacity: Number(e.target.value) })} /></label>
        {l.loading && <p role="status">{t("loading")}</p>}{l.error && <p role="alert">{l.error}</p>}
      </li>)}</ul>
      <form className="flex gap-1" onSubmit={e => { e.preventDefault(); p.onAdd(); }}>
        <input className={`${input} min-w-0 flex-1`} aria-label={t("addPath")} placeholder={t("addPath")} value={p.pathToAdd} onChange={e => p.onPathToAdd(e.target.value)} />
        <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={p.adding || !p.pathToAdd.trim()}>{t("add")}</button>
      </form>
    </Section>
    {active && <Section title={t("legend")}>
      <ul className="max-h-48 space-y-0.5 overflow-auto">{layerLegend(active, p.colorFields[active.id]).map((item, n) => <li className="flex items-center gap-2" key={n}><span aria-hidden className="inline-block h-3 w-4 shrink-0 border" style={{ backgroundColor: item.color }} /><span className="break-all">{item.label}</span></li>)}
        <li className="flex items-center gap-2"><span aria-hidden className="inline-block h-3 w-4 shrink-0 border border-dashed" />{t("nodata")}{(view?.nodata ?? active.manifest?.nodata) != null ? `: ${view?.nodata ?? active.manifest?.nodata}` : ""}</li></ul>
    </Section>}
    {active && crsInfo && <Section title={t("info")}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1">
        <dt className="text-muted-foreground">{t("sourceFile")}</dt><dd className="[overflow-wrap:anywhere]">{active.source.path}</dd>
        <dt className="text-muted-foreground">{t("sourceCrs")}</dt><dd>{crsInfo.authority ?? crsInfo.name ?? t("unknown")} · {t(crsInfo.status)}</dd>
        <dt className="text-muted-foreground">{t("displayCrs")}</dt><dd>{crs === "native" ? t("native") : crs}</dd>
        <dt className="text-muted-foreground">{t("unit")}</dt><dd>{active.manifest?.unit || active.inspection.bands?.find(b => b.index === active.source.band)?.unit || t("unknown")}</dd>
        <dt className="text-muted-foreground">{t("coordinateUnits")}</dt><dd>{crsInfo.axisUnits || t("unknown")}</dd>
      </dl>
      {view && <>
        <p>{t("extent", { crs: view.displayCrs })}: <span className="break-all">{view.bbox.map(n => n.toPrecision(10)).join(", ")}</span></p>
        {view.kind === "raster-style" ? <><p>{t("rasterSize", { width: view.preview.width ?? 0, height: view.preview.height ?? 0 })}</p><p>{t("sourceResolution", { resolution: view.resolution.toPrecision(6), crs: view.displayCrs === "native" ? t("native") : view.displayCrs })}</p></>
          : <p>{t("featureCount", { shown: view.features.features.length, total: view.preview.totalFeatures ?? t("unknown") })}</p>}
        <p className="text-muted-foreground">{t("sampling", { method: view.preview.method, sampled: t(view.preview.sampled ? "yes" : "no"), truncated: t(view.preview.truncated ? "yes" : "no") })}</p>
        <p className="text-muted-foreground">{view.kind === "raster-style" ? t("pixelHint") : t(active.vectorMode === "full" ? "vectorFull" : "vectorViewport")}</p>
      </>}
      <p className="text-muted-foreground">{t("unchanged")}</p>
      {!hasCrs(crsInfo) && <p>{t("nativeLimit")}</p>}
      {active.manifest && active.manifest.displayCrs !== crs && <p>{t("displayFallback")}</p>}
      {(view?.issues ?? active.inspection.issues).length > 0 && <ul className="list-disc space-y-0.5 pl-4">{(view?.issues ?? active.inspection.issues).map((issue, n) => <li key={n}>{issue.message}{issue.requiredInput ? ` · ${issue.requiredInput}` : ""}</li>)}</ul>}
    </Section>}
    {active && <Section title={t("displayOptions")}>
      <div className="flex flex-col gap-2">
        {active.inspection.layers?.length ? <label className="flex flex-col gap-1">{t("layer")}<select className={input} value={active.source.layer ?? ""} onChange={e => p.onSource({ layer: e.target.value })}>{active.inspection.layers.map(l => <option key={l.name}>{l.name}</option>)}</select></label> : null}
        {active.inspection.bands?.length ? <label className="flex flex-col gap-1">{t("band")}<select className={input} value={active.source.band} onChange={e => p.onSource({ band: Number(e.target.value) })}>{active.inspection.bands.map(b => <option key={b.index} value={b.index}>{b.index}{b.description ? ` · ${b.description}` : ""}</option>)}</select></label> : null}
        {!isVector(active) && <form className="flex items-end gap-1" key={active.id + active.source.layer} onSubmit={e => { e.preventDefault(); p.onSource({ variable: String(new FormData(e.currentTarget).get("variable") ?? "").trim() || undefined }); }}><label className="flex min-w-0 flex-1 flex-col gap-1">{t("variable")}<input className={input} name="variable" defaultValue={active.source.variable ?? ""} /></label><button className="rounded border px-2 py-1">{t("apply")}</button></form>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!active.source.categorical} onChange={e => p.onSource({ categorical: e.target.checked })} />{t("categorical")}</label>
        {isVector(active) && active.source.categorical && <label className="flex flex-col gap-1">{t("categoryField")}<select className={input} value={p.colorFields[active.id] ?? ""} onChange={e => p.onColorField(e.target.value)}><option value="">{t("noField")}</option>{p.fields.map(f => <option key={f}>{f}</option>)}</select></label>}
      </div>
    </Section>}
  </div></div>;
}
