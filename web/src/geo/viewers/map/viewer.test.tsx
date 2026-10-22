import type React from "react";
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
  return { default: forwardRef(function MockCanvas(props: { onViewport(v: unknown): void; onCoordinate(c: number[]): void; onPick(id: string, row: number, c: number[]): void; popup?: { at: unknown; content: React.ReactNode } }, ref) {
    useImperativeHandle(ref, () => ({ fit: vi.fn(), exportPng: vi.fn().mockResolvedValue(undefined) }));
    return <div><button onClick={() => props.onViewport({ bbox: [0, 0, 10, 10], width: 1000, height: 800 })}>pan-map</button><button onClick={() => props.onCoordinate([5, 15])}>pixel-zero</button><button onClick={() => props.onCoordinate([15, 15])}>pixel-null</button><button onClick={() => props.onPick("0", 0, [1, 1])}>pick-feature</button><button onClick={() => props.onPick("0", 500, [1, 1])}>pick-feature-later</button><div data-testid="map-popup" data-at={JSON.stringify(props.popup?.at ?? null)}>{props.popup?.content}</div></div>;
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
function expand(name: string) {
  fireEvent.click(screen.getAllByText(name).find(el => el.tagName === "SUMMARY")!);
}
async function choose(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}
describe("map viewer", () => {
  it("inspects before paging, uses selected GPKG layer, bounds and explicit project scope", async () => {
    render(<MapViewer {...props} />);
    // The heading follows an inspect and a page request; under a full parallel suite this takes over the 1 s default.
    await screen.findByRole("heading", { name: "Viewport attribute table" }, { timeout: 10_000 });
    // The whole layer is tried first; a truncated answer switches to viewport pages.
    // Wait for both requests: under load the heading can render before the second page request.
    await waitFor(() => expect(mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page").length).toBeGreaterThanOrEqual(2));
    const [first, second] = mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page");
    expect(body(first)).toMatchObject({ layer: "rocks", full: true, displayCrs: "EPSG:3857" }); expect(body(first)).not.toHaveProperty("bbox"); expect(first[2]).toBe("project-a");
    expect(body(second)).toMatchObject({ layer: "rocks", limit: 500, offset: 0, displayCrs: "EPSG:3857" }); expect(second[2]).toBe("project-a");
    // Basic information sits in the panel next to the map.
    const info = within(screen.getByRole("complementary", { name: "Map information" })).getByRole("region", { name: "Layer information" });
    expect(info).toHaveTextContent("Source CRSEPSG:5186"); expect(info).toHaveTextContent("Display CRS: EPSG:3857");
    const basemaps = screen.getByRole("region", { name: /basemap/i });
    expect(within(basemaps).getByRole("combobox")).toBeEnabled(); expect(within(basemaps).getByRole("combobox")).toHaveTextContent("No basemap");
    fireEvent.click(screen.getByText("Next page"));
    await waitFor(() => expect(mockFetch.mock.calls.some(c => c[0] === "/geo/vector-page" && body(c).offset === 500)).toBe(true));
    fireEvent.click(screen.getByText("pan-map"));
    await waitFor(() => expect(body(mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page").at(-1)!)).toMatchObject({ bbox: [0, 0, 10, 10], offset: 0 }));
    expand("Display settings"); await choose("GeoPackage layer", "faults");
    await waitFor(() => expect(body(mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page").at(-1)!)).toMatchObject({ layer: "faults", offset: 0 }));
    await screen.findAllByRole("cell", { name: "granite" });
    fireEvent.click(screen.getByText("pick-feature"));
    // The selected feature opens as a mini popup on the map at the clicked point, not as a list below the table.
    const popup = screen.getByTestId("map-popup");
    expect(within(popup).getByRole("dialog", { name: "Selected feature properties" })).toHaveTextContent("classgranite"); expect(popup).toHaveAttribute("data-at", '"selected"');
    fireEvent.click(within(popup).getByRole("button", { name: "Close popup" }));
    expect(within(popup).queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps unknown CRS native, blocks overlay, and disables analytical area", async () => {
    mockFetch.mockImplementation((url, init) => url === "/geo/inspect" ? respond(inspection(JSON.parse(String(init?.body)).path, true)) : respond({ ...page(), displayCrs: "native", sourceCrs: { status: "unknown" } }));
    render(<MapViewer {...props} />);
    await screen.findAllByText(/Native coordinates \(no geographic placement\)/);
    // The native-coordinate notice comes from inspection; the page request may follow it under load.
    await waitFor(() => expect(mockFetch.mock.calls.some(c => c[0] === "/geo/vector-page")).toBe(true));
    expect(body(mockFetch.mock.calls.find(c => c[0] === "/geo/vector-page")!).displayCrs).toBe("native");
    expand("Full-layer area table");
    expect(screen.getByText("Calculate full-layer area")).toBeDisabled();
    // Basemaps need a declared CRS: the picker stays visible but disabled, "none" selected.
    const basemaps = screen.getByRole("region", { name: /basemap/i });
    expect(within(basemaps).getByRole("combobox")).toBeDisabled(); expect(within(basemaps).getByRole("combobox")).toHaveTextContent("No basemap");
    fireEvent.click(screen.getByRole("button", { name: "Add layer" }));
    fireEvent.change(screen.getByLabelText("Sandbox-relative path"), { target: { value: "other.gpkg" } }); fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add layer" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await screen.findByText(/Sources with missing or conflicting CRS cannot overlay/);
    expect(screen.queryByRole("button", { name: "Select layer: other.gpkg" })).not.toBeInTheDocument();
  });
  it("calculates a full-layer numerical table only after explicit method selection", async () => {
    mockFetch.mockImplementation(url => url === "/geo/inspect" ? respond(inspection()) : url === "/geo/area-table" ? respond({ scope: "full-layer", unit: "m²", rows: [{ class: "granite", featureCount: 600, area: 1234.5, percent: 100 }], path: "rocks.gpkg", classField: "class", method: "geodesic", totalArea: 1234.5, featureCount: 600, emptyCount: 0, limitations: [] }) : respond(page()));
    render(<MapViewer {...props} />); await screen.findByText("pan-map"); expand("Full-layer area table"); await screen.findByRole("heading", { name: "Full-layer area table" });
    fireEvent.click(screen.getByText("pan-map"));
    await choose("Area class field", "class");
    expect(screen.getByText("Calculate full-layer area")).toBeDisabled();
    await choose("Area method", "Projected CRS area");
    fireEvent.change(screen.getByLabelText("Area CRS (EPSG code)"), { target: { value: "EPSG:3857" } });
    expect(screen.getByText("Calculate full-layer area")).toBeDisabled();
    await choose("Area method", "Ellipsoidal geodesic area");
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
    fireEvent.click(screen.getByText("pixel-zero")); expect(await within(screen.getByTestId("map-popup")).findByText(/row 0, column 0, value 0/)).toBeInTheDocument();
    expect(screen.getByTestId("map-popup")).toHaveAttribute("data-at", "[5,15]");
    expect(body(mockFetch.mock.calls.filter(c => c[0] === "/geo/raster-point").at(-1)!)).toEqual({ path: "dem.tif", band: 1, displayCrs: "EPSG:3857", coordinate: [5, 15] });
    fireEvent.click(screen.getByText("pixel-null")); expect(await screen.findByText(/row 0, column 1, value No data/)).toBeInTheDocument();
    const styles = () => mockFetch.mock.calls.filter(c => c[0] === "/geo/raster-style");
    fireEvent.click(screen.getByText("pan-map"));
    expect(styles()).toHaveLength(1); expect(mockFetch.mock.calls.some(c => c[0] === "/geo/raster-window")).toBe(false);
    expand("Display settings"); await choose("Band", "2"); await waitFor(() => expect(body(styles().at(-1)!).band).toBe(2));
  });
  it("preserves ordinary TIFF fallback and initializes artifact layers/analysis paths", async () => {
    mockFetch.mockImplementation(() => respond({ ...inspection(), asset: { ...inspection().asset, format: "tiff", family: "raster" } }));
    const first = render(<MapViewer {...props} path="photo.tiff" />); await screen.findByText("imaging-fallback"); first.unmount();
    const artifact: MapManifestResponse = { manifest: { schemaVersion: "geo-result/v1", kind: "map-layer", title: "Result", layers: ["one.gpkg", "two.gpkg"].map(path => ({ path, variable: "class", sourceCrs: "EPSG:5186", displayCrs: "EPSG:3857", unit: "m", legend: [], nodata: null, extent: [0, 0, 20, 20] })), analysis: { method: "full-layer", tablePath: "results/area.csv", scriptPath: "scripts/area.py" }, limitations: ["fixture limitation"] }, inspections: [inspection("one.gpkg"), inspection("two.gpkg")] };
    // Whole-layer answers: no viewport pages follow, so opacity must not cause any request.
    mockFetch.mockImplementation(url => url === "/geo/result" ? respond(artifact) : respond({ ...page(), full: true, nextOffset: null }));
    render(<MapViewer {...props} path="result.geomap.json" />);
    await screen.findByRole("heading", { name: "Result" });
    expand("Analysis artifacts"); expand("Display settings");
    expect(screen.getByRole("button", { name: "Select layer: two.gpkg" })).toBeInTheDocument(); expect(screen.getByText("Full analysis table: results/area.csv")).toBeInTheDocument(); expect(screen.getByText("Analysis script: scripts/area.py")).toBeInTheDocument();
    expect(screen.getByLabelText("Categorical colors")).toBeChecked(); expect(screen.getByLabelText("Color class field")).toHaveTextContent("class");
    expect(geoFileCategory("RESULT.GEOMAP.JSON")).toBe("geo-map"); expect(geoFileCategory("other.json")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Layers" })).getAllByRole("slider")).toHaveLength(2);
    await waitFor(() => expect(mockFetch.mock.calls.filter(c => c[0] === "/geo/vector-page")).toHaveLength(2));
    const requestsBeforeOpacity = mockFetch.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Opacity: two.gpkg"), { target: { value: "0.35" } });
    expect(screen.getByLabelText("Opacity: two.gpkg")).toHaveValue("0.35");
    expect(mockFetch.mock.calls).toHaveLength(requestsBeforeOpacity);
    fireEvent.click(screen.getAllByRole("button", { name: /^Move layer up/ })[1]);
    expect(screen.getAllByRole("button", { name: /Select layer:/ })[0]).toHaveTextContent("two.gpkg");
    const twoRow = screen.getByRole("button", { name: "Select layer: two.gpkg" }).closest<HTMLElement>("[data-layer-row]")!;
    fireEvent.click(within(twoRow).getByLabelText("Show on map"));
    expect(within(twoRow).getByLabelText("Show on map")).not.toBeChecked();
  });
  it("sorts and filters the whole-layer table from the column headers and opens a table row as a map popup", async () => {
    const full: VectorPage = { ...page(), full: true, nextOffset: null, preview: { sampled: false, truncated: false, method: "full", totalFeatures: 3 }, fields: ["class", "age"],
      features: { type: "FeatureCollection", features: [{ class: "granite", age: 220 }, { class: "gneiss", age: null }, { class: "alluvium", age: 0 }].map(properties => ({ type: "Feature" as const, geometry: null, properties })) } };
    mockFetch.mockImplementation(url => url === "/geo/inspect" ? respond(inspection()) : respond(full));
    render(<MapViewer {...props} />);
    const table = await screen.findByRole("region", { name: "Layer attribute table" });
    expect(within(table).getByRole("heading")).toHaveAttribute("title", expect.stringContaining("Sort and filters apply to every feature of the layer"));
    const firstColumn = () => within(table).getAllByRole("row").slice(1).map(r => within(r).getAllByRole("cell")[0].textContent);
    expect(firstColumn()).toEqual(["granite", "gneiss", "alluvium"]);
    fireEvent.click(within(table).getByRole("button", { name: "age" }));
    expect(within(table).getByRole("columnheader", { name: /age/ })).toHaveAttribute("aria-sort", "ascending");
    expect(firstColumn()).toEqual(["alluvium", "granite", "gneiss"]); // 0 before 220, missing last
    fireEvent.click(within(table).getByRole("button", { name: "age" }));
    expect(firstColumn()).toEqual(["granite", "alluvium", "gneiss"]);
    fireEvent.click(within(table).getByRole("button", { name: "Sort and filter column class" }));
    const menu = await screen.findByRole("dialog");
    fireEvent.change(within(menu).getByLabelText("Contains"), { target: { value: "GN" } });
    expect(firstColumn()).toEqual(["gneiss"]); expect(table).toHaveTextContent("Matching rows: 1 of 3");
    fireEvent.click(within(menu).getByRole("button", { name: "Clear column filter" }));
    fireEvent.click(within(menu).getByRole("checkbox", { name: /granite/ }));
    expect(firstColumn()).toEqual(["alluvium", "gneiss"]);
    fireEvent.keyDown(menu, { key: "Escape" });
    fireEvent.click(within(table).getByRole("button", { name: "Clear sort and filters" }));
    expect(firstColumn()).toEqual(["granite", "gneiss", "alluvium"]);
    // A table row selects the feature; the canvas places the popup at that feature.
    fireEvent.click(within(table).getAllByRole("row")[2]);
    expect(screen.getByTestId("map-popup")).toHaveAttribute("data-at", '"selected"');
    expect(within(screen.getByTestId("map-popup")).getByRole("dialog", { name: "Selected feature properties" })).toHaveTextContent("classgneissageNo data");
  });
  it("reveals a filtered-out selected record on a later page with every attribute", async () => {
    const fields = ["class", ...Array.from({ length: 9 }, (_, i) => `field${i}`)];
    const full: VectorPage = { ...page(), full: true, nextOffset: null, fields,
      features: { type: "FeatureCollection", features: Array.from({ length: 501 }, (_, row) => ({ type: "Feature", geometry: null, properties: Object.fromEntries(fields.map(field => [field, field === "class" ? `rock-${row}` : row])) })) } };
    mockFetch.mockImplementation(url => url === "/geo/inspect" ? respond(inspection()) : respond(full));
    render(<MapViewer {...props} />);
    const table = await screen.findByRole("region", { name: "Layer attribute table" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    fireEvent.click(within(table).getByRole("button", { name: "Sort and filter column class" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Contains"), { target: { value: "no-matching-rock" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(within(table).getByRole("button", { name: "Sort and filter column class" })).toHaveFocus());
    fireEvent.click(screen.getByText("pick-feature-later"));
    const popup = within(screen.getByTestId("map-popup"));
    expect(popup.getAllByRole("term")).toHaveLength(8);
    fireEvent.click(popup.getByRole("button", { name: "View all attributes" }));
    await waitFor(() => expect(within(table).getAllByRole("columnheader")).toHaveLength(10));
    expect(within(table).getByRole("row", { selected: true })).toHaveTextContent("rock-500");
    expect(table.querySelector("[data-map-table-scroller]")).toHaveFocus();
  });

});
