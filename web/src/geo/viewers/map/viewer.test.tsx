import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoInspection } from "../../contracts/inspection";
import type { MapManifestResponse, VectorPage, RasterStyle } from "../../contracts/maps";
import { apiFetch } from "@/lib/projects";
import MapViewer from "./index";
import { geoFileCategory } from "../registry";
vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn(), API_BASE: "", getActiveProjectId: () => "default" }));
vi.mock("../inspection-viewer", () => ({ default: () => <div>imaging-fallback</div> }));
vi.mock("./map-canvas", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return { default: forwardRef(function MockCanvas(props: { onViewport(v: unknown): void; onCoordinate(c: number[]): void; onPick(id: string, row: number): void }, ref) {
    useImperativeHandle(ref, () => ({ fit: vi.fn(), exportPng: vi.fn().mockResolvedValue(undefined) }));
    return <div><button onClick={() => props.onViewport({ bbox: [0, 0, 10, 10], width: 1000, height: 800 })}>pan-map</button><button onClick={() => props.onCoordinate([5, 15])}>pixel-zero</button><button onClick={() => props.onCoordinate([15, 15])}>pixel-null</button><button onClick={() => props.onPick("0", 0)}>pick-feature</button></div>;
  }) };
});
const mockFetch = vi.mocked(apiFetch);
const respond = (body: unknown) => Promise.resolve({ ok: true, json: async () => body } as Response);
function inspection(path = "rocks.gpkg", unknown = false): GeoInspection {
  return { schemaVersion: "geo-inspection/v1", asset: { path, projectId: "p", family: "vector", format: "geopackage", sourceFiles: [path], sizeBytes: 100, fingerprint: "cache" }, crs: { status: unknown ? "unknown" : "declared", authority: unknown ? undefined : "EPSG:5186" }, layers: [{ name: "rocks", fields: [{ name: "class", type: "string" }] }, { name: "faults", fields: [{ name: "class", type: "string" }] }], issues: [], inspector: { name: "fixture", version: "1" } };
}
function page(): VectorPage { return { kind: "vector", path: "rocks.gpkg", sourceCrs: { status: "declared", authority: "EPSG:5186" }, displayCrs: "EPSG:3857", bbox: [0, 0, 20, 20], preview: { sampled: true, truncated: true, method: "viewport", totalFeatures: 600 }, features: { type: "FeatureCollection", features: [{ type: "Feature", geometry: null, properties: { class: "granite" } }] }, fields: ["class"], issues: [], nextOffset: 500, legend: [], nodata: null }; }
const props = { path: "rocks.gpkg", name: "rocks.gpkg", content: null, projectId: "project-a" };
const body = (call: Parameters<typeof apiFetch>) => JSON.parse(String(call[1]?.body));
beforeEach(() => {
  Object.defineProperty(navigator, "languages", { configurable: true, value: ["en"] });
  mockFetch.mockImplementation((url, init) => url === "/geo/inspect" ? respond(inspection(JSON.parse(String(init?.body)).path)) : respond(page()));
});
describe("map viewer", () => {
  it("inspects before paging, uses selected GPKG layer, bounds and explicit project scope", async () => {
    render(<MapViewer {...props} />);
    await screen.findByRole("heading", { name: "Viewport attribute table" });
    // The whole layer is tried first; a truncated answer switches to viewport pages.
    const [first, second] = mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page");
    expect(body(first)).toMatchObject({ layer: "rocks", full: true, displayCrs: "EPSG:3857" }); expect(body(first)).not.toHaveProperty("bbox"); expect(first[2]).toBe("project-a");
    expect(body(second)).toMatchObject({ layer: "rocks", limit: 500, offset: 0, displayCrs: "EPSG:3857" }); expect(second[2]).toBe("project-a");
    expect(screen.getByText(/Source CRS: EPSG:5186/)).toBeInTheDocument(); expect(screen.getByText(/Display CRS: EPSG:3857/)).toBeInTheDocument();
    const basemaps = screen.getByRole("region", { name: /basemap/i });
    expect(within(basemaps).getByRole("combobox")).toBeEnabled(); expect(within(basemaps).getByRole("combobox")).toHaveValue("none");
    fireEvent.click(screen.getByText("Next page"));
    await waitFor(() => expect(mockFetch.mock.calls.some(c => c[0] === "/geo/vector-page" && body(c).offset === 500)).toBe(true));
    fireEvent.click(screen.getByText("pan-map"));
    await waitFor(() => expect(body(mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page").at(-1)!)).toMatchObject({ bbox: [0, 0, 10, 10], offset: 0 }));
    fireEvent.change(screen.getByLabelText("GeoPackage layer"), { target: { value: "faults" } });
    await waitFor(() => expect(body(mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page").at(-1)!)).toMatchObject({ layer: "faults", offset: 0 }));
    fireEvent.click(screen.getByText("pick-feature")); await screen.findByText("Selected feature properties");
  });
  it("keeps unknown CRS native, blocks overlay, and disables analytical area", async () => {
    mockFetch.mockImplementation((url, init) => url === "/geo/inspect" ? respond(inspection(JSON.parse(String(init?.body)).path, true)) : respond({ ...page(), displayCrs: "native", sourceCrs: { status: "unknown" } }));
    render(<MapViewer {...props} />);
    await screen.findByText(/Native coordinates \(no geographic placement\)/);
    expect(body(mockFetch.mock.calls.find(c => c[0] === "/geo/vector-page")!).displayCrs).toBe("native");
    expect(screen.getByText("Calculate full-layer area")).toBeDisabled();
    // Basemaps need a declared CRS: the picker stays visible but disabled, "none" selected.
    const basemaps = screen.getByRole("region", { name: /basemap/i });
    expect(within(basemaps).getByRole("combobox")).toBeDisabled(); expect(within(basemaps).getByRole("combobox")).toHaveValue("none");
    fireEvent.change(screen.getByLabelText("Sandbox-relative path"), { target: { value: "other.gpkg" } }); fireEvent.click(screen.getByText("Add layer"));
    await screen.findByText(/Sources with missing or conflicting CRS cannot overlay/);
    expect(screen.queryByRole("button", { name: "Select layer: other.gpkg" })).not.toBeInTheDocument();
  });
  it("calculates a full-layer numerical table only after explicit method selection", async () => {
    mockFetch.mockImplementation(url => url === "/geo/inspect" ? respond(inspection()) : url === "/geo/area-table" ? respond({ scope: "full-layer", unit: "m²", rows: [{ class: "granite", featureCount: 600, area: 1234.5, percent: 100 }], path: "rocks.gpkg", classField: "class", method: "geodesic", totalArea: 1234.5, featureCount: 600, emptyCount: 0, limitations: [] }) : respond(page()));
    render(<MapViewer {...props} />); await screen.findByRole("heading", { name: "Full-layer area table" });
    fireEvent.click(screen.getByText("pan-map"));
    fireEvent.change(screen.getByLabelText("Area class field"), { target: { value: "class" } });
    expect(screen.getByText("Calculate full-layer area")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Area method"), { target: { value: "projected" } });
    fireEvent.change(screen.getByLabelText("Area CRS (EPSG code)"), { target: { value: "EPSG:3857" } });
    expect(screen.getByText("Calculate full-layer area")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Area method"), { target: { value: "geodesic" } });
    fireEvent.click(screen.getByText("Calculate full-layer area"));
    await screen.findByText(/Total area: 1234.5 m²/);
    const request = body(mockFetch.mock.calls.find(c => c[0] === "/geo/area-table")!);
    expect(request).toMatchObject({ classField: "class", method: "geodesic", layer: "rocks" }); expect(request).not.toHaveProperty("bbox"); expect(request).not.toHaveProperty("offset");
    expect(screen.getByRole("button", { name: "Save area CSV" })).toBeEnabled();
  });
  it("cancels a previous project's pending response and never shows its properties", async () => {
    let resolveOld!: (value: Response) => void;
    mockFetch.mockImplementation((url, init, project) => project === "project-a" && url === "/geo/inspect" ? new Promise(resolve => { resolveOld = resolve; }) : url === "/geo/inspect" ? respond(inspection("new.gpkg")) : respond(page()));
    const { rerender } = render(<MapViewer {...props} />);
    const oldSignal = mockFetch.mock.calls[0][1]?.signal;
    rerender(<MapViewer {...props} projectId="project-b" path="new.gpkg" name="new.gpkg" />);
    await screen.findByRole("heading", { name: "new.gpkg" });
    await act(async () => resolveOld({ ok: true, json: async () => inspection("old.gpkg") } as Response));
    expect(oldSignal?.aborted).toBe(true); expect(screen.queryByRole("button", { name: "Select layer: old.gpkg" })).not.toBeInTheDocument();
    expect(mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page").every(c => c[2] === "project-b")).toBe(true);
  });
  it("discards a delayed viewport response when a newer window has arrived", async () => {
    let resolveOld!: (value: Response) => void;
    mockFetch.mockImplementation((url, init) => url === "/geo/inspect" ? respond(inspection()) : body([url, init]).bbox || body([url, init]).full ? respond(page()) : new Promise(resolve => { resolveOld = resolve; }));
    render(<MapViewer {...props} />); await screen.findByText("pan-map");
    await waitFor(() => expect(resolveOld).toBeDefined());
    const oldSignal = mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page")[1][1]?.signal;
    fireEvent.click(screen.getByText("pan-map")); await screen.findByRole("heading", { name: "Viewport attribute table" });
    const old = page(); old.features.features[0].properties.class = "stale-response";
    await act(async () => resolveOld({ ok: true, json: async () => old } as Response));
    expect(oldSignal?.aborted).toBe(true); expect(screen.queryByText("stale-response")).not.toBeInTheDocument();
  });
  it("loads one raster style for tiles, reads clicked values from the source file, and keeps zero distinct from null", async () => {
    const rasterInspection = { ...inspection("dem.tif"), asset: { ...inspection("dem.tif").asset, family: "raster", format: "geotiff" }, layers: undefined, bands: [{ index: 1 }, { index: 2 }] } as GeoInspection;
    const style = { kind: "raster-style", path: "dem.tif", band: 1, sourceCrs: rasterInspection.crs!, displayCrs: "EPSG:3857", bbox: [0, 0, 20, 20], legend: [{ label: "low", value: -1, color: "#1e46b4" }, { label: "high", value: 5, color: "#e6dc28" }, { label: "nodata", value: null, color: "#80808000" }], nodata: -9999, issues: [], categorical: false, low: -1, high: 5, resolution: 10, overviews: false, needsOverviews: false, version: "v1", preview: { method: "tiles", sampled: true, truncated: false, width: 2, height: 2 } } as RasterStyle;
    mockFetch.mockImplementation((url, init) => url === "/geo/inspect" ? respond(rasterInspection) : url === "/geo/raster-point" ? respond(body([url, init]).coordinate[0] === 5 ? { kind: "raster-point", band: 1, inside: true, row: 0, col: 0, value: 0 } : { kind: "raster-point", band: 1, inside: true, row: 0, col: 1, value: null }) : respond(style));
    render(<MapViewer {...props} path="dem.tif" />); await screen.findByText(/Source size: 2 × 2 pixels/);
    expect(screen.getByText(/-1\.00000 or less/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("pixel-zero")); expect(await screen.findByText(/row 0, column 0, value 0/)).toBeInTheDocument();
    expect(body(mockFetch.mock.calls.filter(c => c[0] === "/geo/raster-point").at(-1)!)).toEqual({ path: "dem.tif", band: 1, displayCrs: "EPSG:3857", coordinate: [5, 15] });
    fireEvent.click(screen.getByText("pixel-null")); expect(await screen.findByText(/row 0, column 1, value No data/)).toBeInTheDocument();
    const styles = () => mockFetch.mock.calls.filter(c => c[0] === "/geo/raster-style");
    fireEvent.click(screen.getByText("pan-map"));
    expect(styles()).toHaveLength(1); expect(mockFetch.mock.calls.some(c => c[0] === "/geo/raster-window")).toBe(false);
    fireEvent.change(screen.getByLabelText("Band"), { target: { value: "2" } }); await waitFor(() => expect(body(styles().at(-1)!).band).toBe(2));
  });
  it("preserves ordinary TIFF fallback and initializes artifact layers/analysis paths", async () => {
    mockFetch.mockImplementation(() => respond({ ...inspection(), asset: { ...inspection().asset, format: "tiff", family: "raster" } }));
    const first = render(<MapViewer {...props} path="photo.tiff" />); await screen.findByText("imaging-fallback"); first.unmount();
    const artifact: MapManifestResponse = { manifest: { schemaVersion: "geo-result/v1", kind: "map-layer", title: "Result", layers: ["one.gpkg", "two.gpkg"].map(path => ({ path, variable: "class", sourceCrs: "EPSG:5186", displayCrs: "EPSG:3857", unit: "m", legend: [], nodata: null, extent: [0, 0, 20, 20] })), analysis: { method: "full-layer", tablePath: "results/area.csv", scriptPath: "scripts/area.py" }, limitations: ["fixture limitation"] }, inspections: [inspection("one.gpkg"), inspection("two.gpkg")] };
    // Whole-layer answers: no viewport pages follow, so opacity must not cause any request.
    mockFetch.mockImplementation(url => url === "/geo/result" ? respond(artifact) : respond({ ...page(), full: true, nextOffset: null }));
    render(<MapViewer {...props} path="result.geomap.json" />);
    await screen.findByRole("heading", { name: "Result" });
    expect(screen.getByRole("button", { name: "Select layer: two.gpkg" })).toBeInTheDocument(); expect(screen.getByText("Full analysis table: results/area.csv")).toBeInTheDocument(); expect(screen.getByText("Analysis script: scripts/area.py")).toBeInTheDocument();
    expect(screen.getByLabelText("Categorical colors")).toBeChecked(); expect(screen.getByLabelText("Color class field")).toHaveValue("class");
    expect(geoFileCategory("RESULT.GEOMAP.JSON")).toBe("geo-map"); expect(geoFileCategory("other.json")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Layers" })).getAllByRole("slider")).toHaveLength(2);
    await waitFor(() => expect(mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page")).toHaveLength(2));
    const requestsBeforeOpacity = mockFetch.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Opacity: two.gpkg"), { target: { value: "0.35" } });
    expect(screen.getByLabelText("Opacity: two.gpkg")).toHaveValue("0.35");
    expect(mockFetch.mock.calls).toHaveLength(requestsBeforeOpacity);
    fireEvent.click(screen.getAllByText("Move layer up")[1]);
    expect(screen.getAllByRole("button", { name: /Select layer:/ })[0]).toHaveTextContent("two.gpkg");
    const twoRow = screen.getByRole("button", { name: "Select layer: two.gpkg" }).parentElement!;
    fireEvent.click(within(twoRow).getByLabelText("Show on map"));
    expect(within(twoRow).getByLabelText("Show on map")).not.toBeChecked();
  });
});
