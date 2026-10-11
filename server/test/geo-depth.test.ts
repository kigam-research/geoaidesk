import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readSeriesWindow, validateSeriesRequest, readDepthResult, LAS_MAX_BYTES } from "../src/geo/well/series.ts";
import { runHelperScript } from "../src/api/sci-helpers.ts";
import { sandboxFixture } from "./fixtures/geo/factories.ts";
vi.mock("../src/api/sci-helpers.ts", () => ({ runHelperScript: vi.fn() }));
let f: ReturnType<typeof sandboxFixture>;
beforeEach(() => { f = sandboxFixture(); vi.clearAllMocks(); });
afterEach(() => f.cleanup());
it("refuses invalid windows, oversized files and escaped paths before invoking the helper", async () => {
  for (const b of [{ path: "x", startRow: 0 }, { path: "x", columns: [1, 1] }, { path: "x", minDepth: 2, maxDepth: 1 }, { path: "x", limit: Infinity }, { path: "x", columns: [] }]) expect(() => validateSeriesRequest(b)).toThrow();
  await expect(readSeriesWindow(f.paths, { path: "../x" })).rejects.toThrow();
  f.write("huge.las", "x"); fs.truncateSync(path.join(f.root, "huge.las"), LAS_MAX_BYTES + 1);
  await expect(readSeriesWindow(f.paths, { path: "huge.las" })).rejects.toThrow(/64 MiB/);
  expect(runHelperScript).not.toHaveBeenCalled();
});
it("returns exact source identity and prevents results from a file changed during reading", async () => {
  f.write("well.las", "fixture");
  vi.mocked(runHelperScript).mockResolvedValue({ status: 0, stdout: '{"schemaVersion":"geo-series/v1","rows":[]}', stderr: "", timedOut: false });
  expect(await readSeriesWindow(f.paths, { path: "well.las" })).toMatchObject({ path: "well.las", fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
  vi.mocked(runHelperScript).mockImplementation(async () => { f.write("well.las", "changed fixture"); return { status: 0, stdout: '{}', stderr: "", timedOut: false }; });
  await expect(readSeriesWindow(f.paths, { path: "well.las" })).rejects.toThrow(/changed/);
});
it("validates depth manifests and resolves source/code files inside the project", async () => {
  f.write("well.las", "data"); f.write("analysis.py", "# code");
  const manifest = { schemaVersion: "geo-result/v1", kind: "depth-track", dataPath: "well.las", depth: { column: 0, unit: "M", basis: "unknown" }, curves: [{ column: 1, unit: "API" }], flags: [{ kind: "spike", fromRow: 20, toRow: 20 }], status: "raw", sourceRow: 20, codePath: "analysis.py", limitations: ["Candidate, not invalid geology"] };
  f.write("result.depth.json", JSON.stringify(manifest)); expect(await readDepthResult(f.paths, "result.depth.json")).toEqual(manifest);
  f.write("result.depth.json", JSON.stringify({ ...manifest, dataPath: "../outside.las" })); await expect(readDepthResult(f.paths, "result.depth.json")).rejects.toThrow(/Invalid/);
  f.write("result.depth.json", JSON.stringify({ ...manifest, codePath: "missing.py" })); await expect(readDepthResult(f.paths, "result.depth.json")).rejects.toThrow(/not found/);
});
