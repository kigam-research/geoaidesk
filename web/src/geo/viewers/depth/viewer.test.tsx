import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DepthViewer from "./viewer";
import { curvePath, FLAG_STYLE } from "./tracks";
import { apiFetch } from "@/lib/projects";
vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn(), API_BASE: "", getActiveProjectId: () => "default" }));
const data = { schemaVersion: "geo-series/v1", path: "well.las", well: "Test", run: "1", version: "2.0", nullValue: -999.25, depth: { mnemonic: "DEPT", unit: "M", basis: "unknown", direction: "increasing" }, curves: [{ column: 0, mnemonic: "DEPT", originalMnemonic: "DEPT", unit: "M", finiteCount: 2, nullCount: 0 }, { column: 1, mnemonic: "GR", originalMnemonic: "GR", unit: "API", finiteCount: 1, nullCount: 1 }], selectedColumns: [1], sourceRows: 2, matchedRows: 2, displayedRows: 2, sampled: false, truncated: false, rows: [{ row: 1, depth: 100, values: [0], breakBefore: true }, { row: 2, depth: 101, values: [null], breakBefore: false }], nextRow: null, issues: [], method: "exact" };
beforeEach(() => vi.mocked(apiFetch).mockReset());
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
describe("LAS depth viewer", () => {
  it("keeps gap topology and uses distinct candidate symbols", () => {
    expect(curvePath([...data.rows, { row: 3, depth: 102, values: [3], breakBefore: false }, { row: 4, depth: 104, values: [4], breakBefore: true }], 0, n => n, n => n)).toBe("M0.00,100.00 M3.00,102.00 M4.00,104.00 ");
    expect(new Set(Object.values(FLAG_STYLE).map(v => v.mark)).size).toBe(7);
  });
  it("opens a manifest at its exact source rows with project-scoped source/code links", async () => {
    const manifest = { schemaVersion: "geo-result/v1", kind: "depth-track", dataPath: "well.las", depth: { column: 0, unit: "M", basis: "unknown" }, curves: [{ column: 1, unit: "API" }], flags: [{ kind: "spike", fromRow: 2, toRow: 2 }], status: "raw", sourceRow: 2, codePath: "analysis.py", limitations: [] };
    vi.mocked(apiFetch).mockImplementation(async url => response(url === "/geo/depth-result" ? manifest : data));
    render(<DepthViewer name="result" path="result.depth.json" projectId="p-two" content={null} />);
    await screen.findByTestId("depth-viewer");
    fireEvent.click(screen.getByText(/Spike candidate · Data row 2/));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/geo/series-window", expect.objectContaining({ body: expect.stringContaining('"startRow":2') }), "p-two"));
    await screen.findByRole("table");
    expect(document.querySelector('[data-source-row="2"]')).not.toBeNull();
    expect(screen.getByText("Download analysis code").getAttribute("href")).toContain("path=analysis.py&project=p-two");
    expect(screen.getByText("Download data file").getAttribute("href")).toContain("path=well.las&project=p-two");
  });
  it("does not display mismatched manifest units", async () => {
    vi.mocked(apiFetch).mockImplementation(async url => response(url === "/geo/depth-result" ? { schemaVersion: "geo-result/v1", kind: "depth-track", dataPath: "well.las", depth: { column: 0, unit: "ft", basis: "unknown" }, curves: [{ column: 1, unit: "API" }], flags: [], status: "raw", limitations: [] } : data));
    render(<DepthViewer name="result" path="result.depth.json" content={null} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("units disagree");
    expect(screen.queryByTestId("depth-viewer")).toBeNull();
  });
});
