"use client";
import { MapSelect } from "./controls";
import { mapText } from "./strings";
import { geoText } from "../../i18n";
import { basemapAttribution, OFFLINE_BASEMAP_PROVIDERS, type BaseId, type BasemapProvider, type BasemapSelection, type OverlayId } from "./basemaps";

const t = geoText("basemap");
interface Props {
  providers: BasemapProvider[];
  value: BasemapSelection;
  onChange: (value: BasemapSelection) => void;
  disabled: boolean;
}
function activeProviders({ providers, value, disabled }: Omit<Props, "onChange">) {
  return disabled ? [] : providers.filter(p => p.available && p.id !== "none" && (p.id === value.base || value.overlays.includes(p.id as OverlayId)));
}
/** One compact row above the map: base map, overlays, then the network/CRS notice. */
export function BasemapPicker({ providers, value, onChange, disabled }: Props) {
  const bases = [OFFLINE_BASEMAP_PROVIDERS[0], ...providers.filter(p => p.kind === "base" && p.id !== "none")];
  const overlays = providers.filter(p => p.kind === "overlay");
  const reason = (p: BasemapProvider) => !p.available ? t(p.reason === "missing-referer" ? "missingReferer" : "missingKey") : "";
  return <section aria-label={t("title")} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    <label className="flex items-center gap-2">{t("base")}
      <MapSelect aria-label={t("base")} value={value.base} disabled={disabled}
        onChange={base => onChange({ ...value, base: base as BaseId })}>
        {bases.map(p => <option key={p.id} value={p.id} disabled={!p.available}>
          {t(`provider.${p.id}`)}{p.available ? "" : ` (${reason(p)})`}
        </option>)}
      </MapSelect>
    </label>
    {overlays.map(p => <label key={p.id} className="flex items-center gap-2" title={reason(p) || undefined}><input type="checkbox" disabled={disabled || !p.available}
        checked={value.overlays.includes(p.id as OverlayId)} onChange={e => onChange({ ...value,
          overlays: e.target.checked ? [...new Set([...value.overlays, p.id as OverlayId])] : value.overlays.filter(id => id !== p.id) })} />
        {t(`provider.${p.id}`)}{p.available ? "" : ` (${reason(p)})`}
      </label>)}
    {disabled ? <span className="text-xs text-gaid-ink-2" title={t("crsRequired")}>{mapText("basemapCrsLimit")}</span> : activeProviders({ providers, value, disabled }).length > 0 ? <span className="text-xs text-gaid-ink-2" title={t("onlineNotice")}>{mapText("onlineBasemap")}</span> : null}
  </section>;
}
/** Credits of the shown basemaps, drawn in the map's corner so they stay visible with the map. */
export function BasemapAttributions(props: Omit<Props, "onChange"> & { className?: string }) {
  const active = activeProviders(props);
  if (!active.length) return null;
  return <div className={props.className}>{active.map(p => <span key={p.id} className="block" data-basemap-attribution={p.id}>
    {p.attributionUrl ? <a className="underline" href={p.attributionUrl} target="_blank" rel="noopener noreferrer">{basemapAttribution(p)}</a> : basemapAttribution(p)}
  </span>)}</div>;
}
export default BasemapPicker;
