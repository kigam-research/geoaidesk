import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import GeoInspectionViewer from "./inspection-viewer";
import type { GeoInspection } from "../contracts/inspection";
vi.mock("@/components/viewers/imaging-viewer", () => ({ default: (props: { path: string; projectId?: string }) => <div data-testid="imaging">{props.path} · {props.projectId}</div> }));
function result(format: GeoInspection["asset"]["format"]): GeoInspection {
  return { schemaVersion: "geo-inspection/v1", asset: { projectId: "p", path: "data", sourceFiles: ["data"], sizeBytes: 1234, format, family: "raster", fingerprint: "cache-only" }, issues: [], inspector: { name: "gaid-baseline", version: "1.0.0" } };
}
function respond(value: GeoInspection) { vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(value), { status: 200 }))); }
beforeEach(() => { vi.spyOn(navigator, "languages", "get").mockReturnValue(["ko-KR"]); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("shared inspection viewer", () => {
  it("requests the active project without fetching the data and shows LAS units/depth/preview/provenance", async () => {
    const i = result("las"); i.depth = { basis: "unknown", unit: "M", start: 10, stop: 20, step: 1 }; i.curveInventory = [{ mnemonic: "GR", unit: "API", description: "Gamma ray" }]; i.preview = { sampled: true, truncated: true, rows: [[10, 12], [11, null]], displayedRows: 2, headerLines: ["~V", "VERS. 2.0"] };
    respond(i); render(<GeoInspectionViewer path="data.las" name="data.las" content={null} projectId="project-7" />);
    expect(await screen.findByText("GR")).toBeInTheDocument(); expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.getByText(/심도 기준.*알 수 없음/)).toBeInTheDocument(); expect(screen.getByText(/일부 자료만 표시.*예/)).toBeInTheDocument(); expect(screen.getByText(/gaid-baseline@1.0.0/)).toBeInTheDocument();
    const [url, options] = vi.mocked(fetch).mock.calls[0]; expect(url).toContain("/geo/inspect"); expect(options!.method).toBe("POST"); expect(new Headers(options!.headers).get("X-Project-Id")).toBe("project-7"); expect(JSON.parse(options!.body as string)).toEqual({ path: "data.las", previewRows: 8 }); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("shows missing shapefile companions, fields, and explicit unknown CRS", async () => {
    const i = result("shapefile"); i.crs = { status: "unknown" }; i.layers = [{ name: "Rocks", featureCount: 2, fields: [{ name: "ROCK", type: "C" }] }]; i.missingCompanions = ["rocks.prj"]; i.issues = [{ code: "missing-prj", message: "Source CRS not declared", severity: "warning" }];
    respond(i); render(<GeoInspectionViewer path="rocks.shp" name="rocks.shp" content={null} />);
    expect(await screen.findByText("rocks.prj")).toBeInTheDocument(); expect(screen.getByText(/ROCK \(C\)/)).toBeInTheDocument(); expect(screen.getByText("missing-prj")).toBeInTheDocument(); expect(screen.getAllByText(/좌표계: 알 수 없음/).length).toBeGreaterThan(0);
  });
  it("shows declared GeoTIFF CRS, bands and extent without microscopy fallback", async () => {
    const i = result("geotiff"); i.crs = { status: "declared", authority: "EPSG:5186" }; i.extent = { coordinateSpace: "crs", bbox: [1, 2, 3, 4] }; i.bands = [{ index: 1, dtype: "float32", nodata: -999 }];
    respond(i); render(<GeoInspectionViewer path="raster.tif" name="raster.tif" content={null} />);
    expect(await screen.findByText(/EPSG:5186/)).toBeInTheDocument(); expect(screen.getByText(/float32/)).toBeInTheDocument(); expect(screen.getByText(/1, 2, 3, 4/)).toBeInTheDocument(); expect(screen.queryByTestId("imaging")).not.toBeInTheDocument();
  });
  it("falls back to the upstream imaging viewer only for a non-georeferenced TIFF", async () => {
    respond(result("tiff")); render(<GeoInspectionViewer path="cells.tif" name="cells.tif" content={null} projectId="p2" />);
    expect(await screen.findByTestId("imaging")).toHaveTextContent("cells.tif · p2"); expect(screen.getByText(/지리 참조가 없는 TIFF/)).toBeInTheDocument();
  });
  it("does not show a stale response after switching project/file and allows retry after errors", async () => {
    let resolveFirst: (response: Response) => void = () => {};
    const mock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveFirst = resolve; })).mockResolvedValueOnce(new Response(JSON.stringify(result("geojson")))); vi.stubGlobal("fetch", mock);
    const { rerender } = render(<GeoInspectionViewer path="a.las" name="a.las" content={null} projectId="p1" />);
    rerender(<GeoInspectionViewer path="b.geojson" name="b.geojson" content={null} projectId="p2" />); await screen.findByText(/형식: geojson/);
    resolveFirst(new Response(JSON.stringify(result("las")))); await waitFor(() => expect(screen.queryByText(/형식: las/)).not.toBeInTheDocument());
    mock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Missing file" }), { status: 404 })); rerender(<GeoInspectionViewer path="c.shp" name="c.shp" content={null} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Missing file"); mock.mockResolvedValueOnce(new Response(JSON.stringify(result("shapefile")))); fireEvent.click(screen.getByText("다시 시도")); await screen.findByText(/형식: shapefile/);
  });
});
