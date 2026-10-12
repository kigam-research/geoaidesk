"use client";
import { geoText } from "../../i18n";
import { basemapAttribution, OFFLINE_BASEMAP_PROVIDERS, type BaseId, type BasemapProvider, type BasemapSelection, type OverlayId } from "./basemaps";

const t = geoText("basemap");
interface Props {
  providers: BasemapProvider[];
  value: BasemapSelection;
  onChange: (value: BasemapSelection) => void;
  disabled: boolean;
}
export function BasemapPicker({ providers, value, onChange, disabled }: Props) {
  const bases = [OFFLINE_BASEMAP_PROVIDERS[0], ...providers.filter(p => p.kind === "base" && p.id !== "none")];
  const overlays = providers.filter(p => p.kind === "overlay");
  const active = disabled ? [] : providers.filter(p => p.available && p.id !== "none" && (p.id === value.base || value.overlays.includes(p.id as OverlayId)));
  const reason = (p: BasemapProvider) => !p.available ? t(p.reason === "missing-referer" ? "missingReferer" : "missingKey") : "";
  return <section aria-label={t("title")} className="space-y-2 rounded border p-2">
    <label className="flex items-center gap-2">{t("base")}
      <select className="rounded border bg-background p-1" value={value.base} disabled={disabled}
        onChange={e => onChange({ ...value, base: e.target.value as BaseId })}>
        {bases.map(p => <option key={p.id} value={p.id} disabled={!p.available}>
          {t(`provider.${p.id}`)}{p.available ? "" : ` (${reason(p)})`}
        </option>)}
      </select>
    </label>
    {overlays.map(p => <div key={p.id}>
      <label className="flex items-center gap-2"><input type="checkbox" disabled={disabled || !p.available}
        checked={value.overlays.includes(p.id as OverlayId)} onChange={e => onChange({ ...value,
          overlays: e.target.checked ? [...new Set([...value.overlays, p.id as OverlayId])] : value.overlays.filter(id => id !== p.id) })} />
        {t(`provider.${p.id}`)}
      </label>
      {!p.available && <p className="text-xs text-muted-foreground">{reason(p)}</p>}
    </div>)}
    {disabled ? <p className="text-xs text-muted-foreground">{t("crsRequired")}</p> : <p className="text-xs text-muted-foreground">{t("onlineNotice")}</p>}
    {active.map(p => <p key={p.id} className="text-xs" data-basemap-attribution={p.id}>
      {p.attributionUrl ? <a className="underline" href={p.attributionUrl} target="_blank" rel="noopener noreferrer">{basemapAttribution(p)}</a> : basemapAttribution(p)}
    </p>)}
  </section>;
}
export default BasemapPicker;
