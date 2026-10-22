"use client";
import { useState, type ReactNode } from "react";
import { MapButton, MapSelect, mapInput } from "./controls";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { MapSource } from "../../contracts/maps";
import { hasCrs, isVector, layerView, sourceCrs, type LayerState } from "./model";
import { layerLegend } from "./colors";
import { mapText as t } from "./strings";

const input = mapInput;
const iconButton = "size-7 shrink-0 p-1";
const baseName = (path: string) => path.split("/").pop() || path;
interface Props {
  layers: LayerState[]; active?: LayerState; crs: string; colorFields: Record<string, string>; fields: string[];
  pathToAdd: string; adding: boolean;
  onPathToAdd(value: string): void; onAdd(): void;
  onSelect(id: string): void; onUpdate(id: string, patch: Partial<LayerState>): void; onMove(id: string, direction: number): void; onRemove(id: string): void;
  onSource(patch: Partial<MapSource>): void; onColorField(field: string): void;
}
function Section({ title, heading = title, action, children }: { title: string; heading?: string; action?: ReactNode; children: ReactNode }) {
  return <section aria-label={title} className="min-w-0 space-y-2 border-b border-gaid-edge pb-3 last:border-b-0"><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-muted-foreground">{heading}</h3>{action}</div>{children}</section>;
}
/**
 * Right-hand map panel: layers, legend and basic layer information next to the map, so they
 * stay visible without scrolling the viewer. Display information only; nothing here feeds analysis.
 */
export default function MapSidePanel(p: Props) {
  const { active, crs } = p;
  const view = active && layerView(active);
  const crsInfo = active && sourceCrs(active);
  const [allLegend, setAllLegend] = useState(false);
  const legend = active ? layerLegend(active, p.colorFields[active.id]) : [];
  const legendRows = (items: typeof legend) => items.map((item, n) => <li className="flex min-w-0 items-center gap-2" key={n}><span aria-hidden className="inline-block h-3 w-4 shrink-0 border border-gaid-edge" style={{ backgroundColor: item.color }} /><span className="truncate" title={item.label}>{item.label}</span></li>);
  return <div className="space-y-3 text-xs">
    <Section title={t("layers")} action={<Popover><PopoverTrigger asChild><MapButton variant="ghost">{t("add")}</MapButton></PopoverTrigger><PopoverContent className="w-80 p-3"><form className="flex gap-1" onSubmit={e => { e.preventDefault(); p.onAdd(); }}>
        <input className={`${input} min-w-0 flex-1`} aria-label={t("addPath")} placeholder={t("addPath")} value={p.pathToAdd} onChange={e => p.onPathToAdd(e.target.value)} />
        <MapButton type="submit" disabled={p.adding || !p.pathToAdd.trim()}>{t("add")}</MapButton>
      </form></PopoverContent></Popover>}>
      <ul className="max-h-36 space-y-1 overflow-auto pl-3">{p.layers.map((l, index) => <li key={l.id} data-layer-row={l.source.path} className={`relative space-y-1 rounded-md px-2 py-1 ${active?.id === l.id ? "gaid-index bg-gaid-signal-tint" : ""}`}>
        <div className="flex items-center gap-1.5">
          <input type="checkbox" aria-label={t("visible")} title={t("visible")} checked={l.visible} onChange={e => p.onUpdate(l.id, { visible: e.target.checked, loading: false })} />
          <MapButton variant="ghost" className="min-w-0 flex-1 justify-start truncate px-0 text-left font-medium" title={l.source.path} aria-pressed={active?.id === l.id} aria-label={`${t("select")}: ${l.source.path}`} onClick={() => p.onSelect(l.id)}>{baseName(l.source.path)}</MapButton>
          <MapButton className={iconButton} disabled={index === 0} aria-label={`${t("up")}: ${l.source.path}`} title={t("up")} onClick={() => p.onMove(l.id, -1)}><ArrowUp aria-hidden className="size-3" /></MapButton>
          <MapButton className={iconButton} disabled={index === p.layers.length - 1} aria-label={`${t("down")}: ${l.source.path}`} title={t("down")} onClick={() => p.onMove(l.id, 1)}><ArrowDown aria-hidden className="size-3" /></MapButton>
          <MapButton className={iconButton} aria-label={`${t("remove")}: ${l.source.path}`} title={t("remove")} onClick={() => p.onRemove(l.id)}><X aria-hidden className="size-3" /></MapButton>
        </div>
        <label className="flex items-center gap-2 text-muted-foreground">{t("opacity")}<input className="min-w-0 flex-1" aria-label={`${t("opacity")}: ${l.source.path}`} type="range" min="0" max="1" step="0.05" value={l.opacity} onChange={e => p.onUpdate(l.id, { opacity: Number(e.target.value) })} /></label>
        {l.loading && <p role="status">{t("loading")}</p>}{l.error && <div role="alert">{t("requestError")}<details><summary>{t("technical")}</summary>{l.error}</details></div>}
      </li>)}</ul>

    </Section>
    {active && <Section title={t("legend")} heading={t("legendCount", { count: legend.length })} action={legend.length > 2 ? <Popover open={allLegend} onOpenChange={setAllLegend}><PopoverTrigger asChild><MapButton variant="ghost">{t("showAll")}</MapButton></PopoverTrigger><PopoverContent side="left" className="w-80 p-3 text-xs"><h4 className="mb-2 font-semibold">{t("legendCount", { count: legend.length })}</h4><ul className="max-h-80 space-y-2 overflow-auto">{legendRows(legend)}</ul></PopoverContent></Popover> : undefined}>
      <ul className="space-y-1">{legendRows(legend.slice(0, 2))}<li className="flex items-center gap-2 text-gaid-nodata"><span aria-hidden className="inline-block h-3 w-4 shrink-0 border border-dashed border-gaid-nodata" />{t("nodata")}{(view?.nodata ?? active.manifest?.nodata) != null ? `: ${view?.nodata ?? active.manifest?.nodata}` : ""}</li></ul>
    </Section>}
    {active && crsInfo && <Section title={t("info")}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1.5">
        <dt className="text-gaid-ink-2">{t("sourceFile")}</dt><dd className="truncate" title={active.source.path}>{baseName(active.source.path)}</dd>
        <dt className="text-gaid-ink-2">{t("sourceCrs")}</dt><dd className="line-clamp-2" title={[crsInfo.name, crsInfo.authority].filter(Boolean).join(" · ")}>{crsInfo.name && crsInfo.authority ? `${crsInfo.name} (${crsInfo.authority})` : crsInfo.authority ?? crsInfo.name ?? t("unknown")}{crsInfo.name && !crsInfo.authority && /^(transverse mercator|mercator|lambert conformal conic(?: 2sp)?|albers equal area|stereographic|orthographic|utm)$/i.test(crsInfo.name.replaceAll("_", " ")) ? ` · ${t("projectionOnly")}` : ""}</dd>
        <dt className="text-gaid-ink-2">{t("unit")}</dt><dd>{active.manifest?.unit || active.inspection.bands?.find(b => b.index === active.source.band)?.unit || t("unknown")}</dd>
        <dt className="text-gaid-ink-2">{t(isVector(active) ? "count" : "pixelCount")}</dt><dd className="tabular-nums">{view?.kind === "raster-style" ? t("rasterSize", { width: view.preview.width ?? 0, height: view.preview.height ?? 0 }) : view?.kind === "vector" ? t("featureCount", { shown: view.features.features.length, total: view.preview.totalFeatures ?? t("unknown") }) : t("loading")}</dd>
      </dl>
      <details><summary className="cursor-pointer py-1 text-gaid-ink-2">{t("details")}</summary><div className="space-y-2 py-2 text-gaid-ink-2">
        <p>{t("displayCrs")}: {crs === "native" ? t("native") : crs}</p><p>{t("coordinateUnits")}: {crsInfo.axisUnits || t("unknown")}</p><p>{t(crsInfo.status)}</p>
        {view && <><p>{t("extent", { crs: view.displayCrs })}: <span className="break-all tabular-nums">{view.bbox.map(n => n.toPrecision(10)).join(", ")}</span></p>
          {view.kind === "raster-style" && <p>{t("sourceResolution", { resolution: view.resolution.toPrecision(6), crs: view.displayCrs === "native" ? t("native") : view.displayCrs })}</p>}
          <p>{t("sampling", { method: view.preview.method, sampled: t(view.preview.sampled ? "yes" : "no"), truncated: t(view.preview.truncated ? "yes" : "no") })}</p><p>{view.kind === "raster-style" ? t("pixelHint") : t(active.vectorMode === "full" ? "vectorFull" : "vectorViewport")}</p></>}
        <p>{t("subset")}</p><p>{t("figureNotice")}</p><p>{t("unchanged")}</p>
        {!hasCrs(crsInfo) && <p>{t("nativeLimit")}</p>}
        {active.manifest && active.manifest.displayCrs !== crs && <p>{t("displayFallback")}</p>}
        {(view?.issues ?? active.inspection.issues).length > 0 && <ul className="list-disc space-y-1 pl-4">{(view?.issues ?? active.inspection.issues).map((issue, n) => <li key={n}>{issue.message}{issue.requiredInput ? ` · ${issue.requiredInput}` : ""}</li>)}</ul>}
      </div></details>
    </Section>}
    {active && <details><summary className="cursor-pointer font-semibold text-gaid-ink-2">{t("displayOptions")}</summary><div className="pt-3">
      <div className="flex flex-col gap-2">
        {active.inspection.layers?.length ? <label className="flex flex-col gap-1">{t("layer")}<MapSelect aria-label={t("layer")} value={active.source.layer ?? ""} onChange={value => p.onSource({ layer: value })}>{active.inspection.layers.map(l => <option key={l.name}>{l.name}</option>)}</MapSelect></label> : null}
        {active.inspection.bands?.length ? <label className="flex flex-col gap-1">{t("band")}<MapSelect aria-label={t("band")} value={active.source.band} onChange={value => p.onSource({ band: Number(value) })}>{active.inspection.bands.map(b => <option key={b.index} value={b.index}>{b.index}{b.description ? ` · ${b.description}` : ""}</option>)}</MapSelect></label> : null}
        {!isVector(active) && <form className="flex items-end gap-1" key={active.id + active.source.layer} onSubmit={e => { e.preventDefault(); p.onSource({ variable: String(new FormData(e.currentTarget).get("variable") ?? "").trim() || undefined }); }}><label className="flex min-w-0 flex-1 flex-col gap-1">{t("variable")}<input className={input} name="variable" defaultValue={active.source.variable ?? ""} /></label><MapButton type="submit">{t("apply")}</MapButton></form>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!active.source.categorical} onChange={e => p.onSource({ categorical: e.target.checked })} />{t("categorical")}</label>
        {isVector(active) && active.source.categorical && <label className="flex flex-col gap-1">{t("categoryField")}<MapSelect aria-label={t("categoryField")} value={p.colorFields[active.id] ?? ""} onChange={value => p.onColorField(value)}><option value="">{t("noField")}</option>{p.fields.map(f => <option key={f}>{f}</option>)}</MapSelect></label>}
      </div>
    </div></details>}
  </div>;
}
