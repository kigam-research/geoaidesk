"use client";
import { useEffect, useState } from "react";
import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import TileLayer from "ol/layer/Tile";
import type BaseLayer from "ol/layer/Base";
import XYZ from "ol/source/XYZ";
import TileImage from "ol/source/TileImage";
import TileGrid from "ol/tilegrid/TileGrid";
import { API_BASE, apiFetch } from "@/lib/projects";
import { withApiToken } from "@/lib/api-auth";
import { geoText } from "../../i18n";

export type BaseId = "none" | "osm" | "ngii-base" | "ngii-satellite" | "ngii-white";
export type OverlayId = "kigam-geology";
export interface BasemapSelection { base: BaseId; overlays: OverlayId[] }
export interface BasemapProvider {
  id: BaseId | OverlayId;
  kind: "base" | "overlay";
  available: boolean;
  reason?: "missing-key" | "missing-referer";
  attribution: string;
  attributionUrl?: string;
  crs: "EPSG:3857" | "EPSG:5179" | "EPSG:5186";
  minZoom?: number;
  maxZoom?: number;
}
export const DEFAULT_BASEMAP_SELECTION: BasemapSelection = { base: "none", overlays: [] };
const t = geoText("basemap");
// These two choices do not require the catalogue endpoint or any credential.
export const OFFLINE_BASEMAP_PROVIDERS: BasemapProvider[] = [
  { id: "none", kind: "base", available: true, attribution: "", crs: "EPSG:3857" },
  { id: "osm", kind: "base", available: true, attribution: "© OpenStreetMap contributors", attributionUrl: "https://www.openstreetmap.org/copyright", crs: "EPSG:3857", minZoom: 0, maxZoom: 19 },
];
let registered = false;
export function registerBasemapProjections(): void {
  if (registered) return;
  proj4.defs("EPSG:5179", "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
  proj4.defs("EPSG:5186", "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
  register(proj4);
  registered = true;
}

export function useBasemapCatalog(): { providers: BasemapProvider[]; error?: string } {
  const [providers, setProviders] = useState<BasemapProvider[]>(OFFLINE_BASEMAP_PROVIDERS);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let controller: AbortController | undefined;
    const load = async () => {
      controller?.abort();
      const ac = new AbortController(); controller = ac;
      try {
        const response = await apiFetch("/geo/basemaps", { signal: ac.signal });
        if (!response.ok) throw new Error();
        const body = await response.json() as { providers?: BasemapProvider[] };
        if (!Array.isArray(body.providers)) throw new Error();
        if (!ac.signal.aborted) {
          setProviders([...OFFLINE_BASEMAP_PROVIDERS, ...body.providers.filter(p =>
            ["ngii-base", "ngii-satellite", "ngii-white", "kigam-geology"].includes(p.id))]);
          setError(undefined);
        }
      } catch {
        if (!ac.signal.aborted) { setProviders(OFFLINE_BASEMAP_PROVIDERS); setError(t("catalogError")); }
      }
    };
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => { controller?.abort(); window.removeEventListener("focus", refresh); };
  }, []);
  return { providers, error };
}

export function basemapAttribution(provider: BasemapProvider): string {
  // Store the standard copyright entity in copy catalogues: the shared emoji rule also matches literal ©.
  return provider.id === "none" ? "" : t(`attribution.${provider.id.startsWith("ngii-") ? "ngii" : provider.id}`).replaceAll("&copy;", "\u00a9");
}
function attributionHtml(provider: BasemapProvider): string {
  const text = basemapAttribution(provider);
  // Links are fixed here, not interpolated from endpoint data into source HTML.
  const url = provider.id === "osm" ? "https://www.openstreetmap.org/copyright" : provider.id === "kigam-geology" ? "https://data.kigam.re.kr/" : "https://map.ngii.go.kr/";
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
}
const backendUrl = (route: string) => withApiToken(`${API_BASE}${route}`);
const ngiiLayer = { "ngii-base": "korean_map", "ngii-satellite": "satellite_map", "ngii-white": "white_map" } as const;

/** On-demand only; no proxy for OSM, persistent imagery cache or tile prefetch. */
export function basemapLayers(selection: BasemapSelection, providers: BasemapProvider[]): BaseLayer[] {
  registerBasemapProjections();
  const layers: BaseLayer[] = [];
  const selected = providers.filter(p => p.available && (p.kind === "base" ? p.id === selection.base : selection.overlays.includes(p.id as OverlayId)));
  for (const provider of selected) {
    if (provider.id === "none") continue;
    let source: XYZ | TileImage;
    if (provider.id === "osm") {
      source = new XYZ({ url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", projection: "EPSG:3857", maxZoom: 19,
        crossOrigin: "anonymous", attributions: attributionHtml(provider), attributionsCollapsible: false });
    } else if (provider.id.startsWith("ngii-")) {
      const resolutions = Array.from({ length: 14 }, (_, i) => 2088.96 / 2 ** i);
      const grid = new TileGrid({ origin: [-200000, 4000000], tileSize: 256, resolutions,
        sizes: resolutions.map(r => { const size = Math.ceil(32024123.62 / (r * 256)); return [size, size]; }) });
      source = new TileImage({ projection: "EPSG:5179", tileGrid: grid, wrapX: false, crossOrigin: "anonymous",
        attributions: attributionHtml(provider), attributionsCollapsible: false,
        tileUrlFunction: coord => coord ? backendUrl(`/geo/basemap/ngii/${ngiiLayer[provider.id as keyof typeof ngiiLayer]}/${coord[0] + 5}/${coord[2]}/${coord[1]}`) : undefined });
    } else if (provider.id === "kigam-geology") {
      // EPSG:5186, Korea bounds. Coarsest 256px tile spans 51.2km, below the server's 60km cap.
      const grid = new TileGrid({ extent: [-100000, -100000, 600000, 1000000], origin: [-100000, 1000000], tileSize: 256,
        resolutions: Array.from({ length: 12 }, (_, i) => 200 / 2 ** i) });
      source = new TileImage({ projection: "EPSG:5186", tileGrid: grid, wrapX: false, crossOrigin: "anonymous",
        attributions: attributionHtml(provider), attributionsCollapsible: false,
        tileUrlFunction: coord => {
          if (!coord) return undefined;
          const params = new URLSearchParams({ bbox: grid.getTileCoordExtent(coord).join(","), width: "256", height: "256" });
          return backendUrl(`/geo/basemap/kigam?${params}`);
        } });
    } else continue;
    layers.push(new TileLayer({ source, zIndex: provider.kind === "base" ? -200 : -100, preload: 0, properties: { basemapId: provider.id } }));
  }
  return layers;
}
