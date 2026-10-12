import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type TileLayer from "ol/layer/Tile";
import type TileImage from "ol/source/TileImage";
import type ImageTile from "ol/ImageTile";
import { transform } from "ol/proj";
import { apiFetch } from "@/lib/projects";
import { setApiToken } from "@/lib/api-auth";
import { basemapLayers, DEFAULT_BASEMAP_SELECTION, OFFLINE_BASEMAP_PROVIDERS, registerBasemapProjections, useBasemapCatalog, type BasemapProvider } from "./basemaps";
import { BasemapAttributions, BasemapPicker } from "./basemaps-picker";

vi.mock("@/lib/projects", () => ({ API_BASE: "http://localhost:8000", apiFetch: vi.fn() }));
const providers: BasemapProvider[] = [...OFFLINE_BASEMAP_PROVIDERS,
  ...["ngii-base", "ngii-satellite", "ngii-white"].map(id => ({ id, kind: "base", available: true, attribution: "", crs: "EPSG:5179" } as BasemapProvider)),
  { id: "kigam-geology", kind: "overlay", available: true, attribution: "", crs: "EPSG:5186" }];
afterEach(() => { cleanup(); localStorage.clear(); vi.resetAllMocks(); });
const source = (layer: unknown) => (layer as TileLayer<TileImage>).getSource()!;
const imageElement = (s: TileImage) => (s.getTile(0, 0, 0, 1, s.getProjection()!) as ImageTile).getImage() as HTMLImageElement;

describe("basemap layer factory", () => {
  it("defaults to no layers and ignores unavailable selections", () => {
    expect(basemapLayers(DEFAULT_BASEMAP_SELECTION, providers)).toEqual([]);
    expect(basemapLayers({ base: "ngii-base", overlays: ["kigam-geology"] }, providers.map(p => ({ ...p, available: false })))).toEqual([]);
  });
  it("uses direct OSM requests, server-only NGII/KIGAM URLs, correct grids/projections/zIndex", () => {
    localStorage.setItem("gaid:locale", "en");
    setApiToken("test-access-token");
    const osm = basemapLayers({ base: "osm", overlays: [] }, providers);
    expect(osm[0].getZIndex()).toBe(-200);
    expect(source(osm[0]).getProjection()?.getCode()).toBe("EPSG:3857");
    expect(source(osm[0]).getTileUrlFunction()([1, 1, 1], 1, source(osm[0]).getProjection()!)).toBe("https://tile.openstreetmap.org/1/1/1.png");
    expect(source(osm[0]).getAttributionsCollapsible()).toBe(false);
    for (const [id, layer] of [["ngii-base", "korean_map"], ["ngii-satellite", "satellite_map"], ["ngii-white", "white_map"]] as const) {
      const layers = basemapLayers({ base: id, overlays: ["kigam-geology"] }, providers);
      expect(layers.map(l => l.getZIndex())).toEqual([-200, -100]);
      const ngii = source(layers[0]);
      expect(ngii.getProjection()?.getCode()).toBe("EPSG:5179");
      expect(imageElement(ngii).crossOrigin).toBe("anonymous");
      expect(ngii.getTileGrid()?.getOrigin(0)).toEqual([-200000, 4000000]);
      expect(ngii.getTileGrid()?.getResolution(0)).toBe(2088.96);
      expect(ngii.getTileUrlFunction()([8, 553, 981], 1, ngii.getProjection()!)).toBe(`http://localhost:8000/geo/basemap/ngii/${layer}/13/981/553?kady_token=test-access-token`);
      const kigam = source(layers[1]);
      expect(kigam.getProjection()?.getCode()).toBe("EPSG:5186");
      expect(imageElement(kigam).crossOrigin).toBe("anonymous");
      const url = new URL(kigam.getTileUrlFunction()([0, 0, 0], 1, kigam.getProjection()!)!);
      expect(url.pathname).toBe("/geo/basemap/kigam");
      expect(url.searchParams.get("width")).toBe("256");
      const bbox = url.searchParams.get("bbox")!.split(",").map(Number);
      expect(bbox[2] - bbox[0]).toBeLessThanOrEqual(60000);
      expect(bbox[3] - bbox[1]).toBeLessThanOrEqual(60000);
      layers.forEach(l => l.dispose());
    }
    osm.forEach(l => l.dispose());
  });
  it("registers Korean CRS transforms idempotently", () => {
    registerBasemapProjections(); registerBasemapProjections();
    for (const crs of ["EPSG:5179", "EPSG:5186"]) {
      const projected = transform([126.978, 37.566], "EPSG:4326", crs);
      expect(projected.every(Number.isFinite)).toBe(true);
      const point = transform(projected, crs, "EPSG:4326");
      expect(point[0]).toBeCloseTo(126.978, 6); expect(point[1]).toBeCloseTo(37.566, 6);
    }
  });
});

describe("picker and catalogue", () => {
  it("lists None first, disables unavailable entries with reasons, and keeps overlay selection independent", () => {
    localStorage.setItem("gaid:locale", "en");
    const onChange = vi.fn();
    render(<BasemapPicker providers={providers.map(p => p.id === "ngii-base" ? { ...p, available: false, reason: "missing-referer" } : p.id === "ngii-white" ? { ...p, available: false, reason: "missing-key" } : p)} value={{ base: "none", overlays: [] }} onChange={onChange} disabled={false} />);
    const select = screen.getByRole("combobox", { name: "Basemap" }) as HTMLSelectElement;
    expect(select.options[0].value).toBe("none");
    expect(screen.getByRole("option", { name: /standard.*registered/ })).toBeDisabled();
    expect(screen.getByRole("option", { name: /white.*API key/ })).toBeDisabled();
    fireEvent.change(select, { target: { value: "osm" } });
    expect(onChange).toHaveBeenLastCalledWith({ base: "osm", overlays: [] });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith({ base: "none", overlays: ["kigam-geology"] });
  });
  it("disables pixel-view controls, shows the CRS limit and hides inactive attribution", () => {
    localStorage.setItem("gaid:locale", "en");
    render(<BasemapPicker providers={providers} value={{ base: "osm", overlays: ["kigam-geology"] }} onChange={vi.fn()} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled(); expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByText(/require a declared source CRS/)).toBeInTheDocument();
    render(<BasemapAttributions providers={providers} value={{ base: "osm", overlays: ["kigam-geology"] }} disabled />);
    expect(screen.queryByText("© OpenStreetMap contributors")).not.toBeInTheDocument();
  });
  it("always shows visible active OSM attribution linked to its copyright page", () => {
    render(<BasemapAttributions providers={providers} value={{ base: "osm", overlays: [] }} disabled={false} />);
    expect(screen.getByRole("link", { name: "© OpenStreetMap contributors" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  });
  it("falls back without keys/network and refreshes the catalogue on focus", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(useBasemapCatalog);
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.providers.map(p => p.id)).toEqual(["none", "osm"]);
    vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({ providers })));
    fireEvent.focus(window);
    await waitFor(() => expect(result.current.providers).toHaveLength(6));
    expect(result.current.error).toBeUndefined();
  });
});
