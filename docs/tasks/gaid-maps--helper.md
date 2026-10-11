---
format: 1
status: active
updated: 2026-10-11T05:19:54Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"7e627c39-8f96-4667-b685-4abba81a1202","pid":3990813,"provider":"codex","session":"01a12947-209f-7462-af88-d33c6c6d402a","start":"15989002","token":"2dabed18e5678b6758b2e4cee4be4a86329fcde0a86a4b1c1a9f684785d9f064"}
branch: task/gaid-maps--helper
target: task/gaid-maps
parent: gaid-maps
---
# gaid-maps--helper

## Goal and done criteria
Request from the starter:

Implement WP05 bounded raster/vector Python helper and deterministic known-answer tests. Parent task gaid-maps. Read parent docs/tasks/gaid-maps.md, maps.ts contract (committed 91e7df38), and plan sections 3.2-3.3 in /home/seongin3/data/geoaidesk/work/gaid-maps/inputs/geo-byok-plan.md. No network raw.githubusercontent.com (blocked KIGAM); no paid model calls. Python commands uv run only. Single writer in your CLI-created worktree.
Owned files exclusively: server/src/geo/maps/helper.py (new), geo/tests/maps-helper.test.mjs (new Node test that invokes uv run --project server/src/helpers python, use existing patterns), geo/tests/fixtures/maps_fixture.py (new deterministic generator), optional README in same fixture dir. Do not edit contracts/routes, dependencies, inspection, report or other files. No subagents necessary. Check task doc own changes allowed.
Input stdin one JSON {operation:inspect|vector|raster|area,path:absolutePath,...MapRequest/MapAreaRequest}; stdout JSON. inspect returns additive GeoInspection fields (asset:{format} optional, crs/extent/layers/bands/dimensions/issues/preview, no authoritative source identity). Parent will replace path in responses with relative path. Normal errors exit 5 stderr concise; deps missing 3; not found 4; other 1. Use rasterio, pyogrio, pyproj, shapely, numpy, Pillow existing helper deps. Helper must enforce own sane limits (subprocess parent timeout 20s/output 8MiB); metadata no full scans. Return contract fields exactly, sourceCrs GeoCrs, displayCrs default EPSG:3857 if known else 'native'. Distinguish non-georeferenced tiff vs geotiff (geo affine tags even if missing CRS should allow pixel/native map). Shapefile .prj missing unknown, .shx/.dbf required missing issues; explicitly handle companions (.shx/.dbf as selected primary parent resolves .shp). GPKG list vector layers, require layer selection for multiple layers, report unsupported raster/nonspatial tables. GeoJSON coordinate interpretation explicit. Source/display CRS separate.
Vector page viewport bbox in display CRS -> source filter; limit max500 offset max100000; bounded field strings/vertices/feature geometry; no full-layer read for preview. Return fields, FC, preview sampled/truncated labels, nextOffset, categorical legend for selected variable, colors deterministic. Reject oversized geometries or truncate with explicit issues; do not silently overstate completeness.
Raster window bbox display CRS, selected band, requested width/height capped256 (values in response) image data:image/png;base64, bbox actual returned grid, nearest-neighbor for categorical (nearest default fine), nodata/mask distinct color; non-COG allowed bounded window/overview, display transform warp must not read full source into Python. Values match pixels incl null nodata; no full dataset min/max; legend sample min/max or categorical classes bounded. Missing CRS native/pixel display only.
Area full-layer polygons grouped classField: explicit method projected + areaCrs linear units, or geodesic source datum ellipsoid. Reject missing CRS and nonpolygons/invalid geometry rather than repair; don't default area Web Mercator. Work bounded max100000 features and geometry/output limits; reject too large instead of subset table. unit m², rows class featureCount area percent, totalArea featureCount emptyCount scope full-layer limitations sum overlaps twice denominator feature-area total. This matches installed WP06 geo-map-and-crs policy.
Tests must exercise exact projected rectangle 100x100 (10000m²), independent coordinate oracle (e.g. EPSG4326 lon0 lat0 ->3857 0,0 and known degree formula), multi-layer GPKG, missing CRS, categorical nearest no interpolated classes, nodata, plain TIFF versus GeoTIFF, non-COG windows, oversized/bounded requests. Generate binaries outside repo temporary dirs; tests invoked by scripts/check existing node --test geo/tests/*.test.mjs. Keep generated fixtures synthetic MIT. When done report commands/results/limitations and finish your child task; parent integrates with task complete.

## Current state
- Resumed in the assigned worktree; read repository rules, parent ownership, map/inspection contracts and plan §3.2–3.3.
- Helper dependencies import through the frozen uv helper environment (Python 3.12.14).
- Implemented all four stdin JSON operations in `server/src/geo/maps/helper.py`; no shared contracts/routes/dependencies were edited.
- Final focused verification: `node --test geo/tests/maps-helper.test.mjs` passed 11/11 (49.9 s). `git diff --check` passed.
- Follow-up review fixed invalid CRS / malformed geometry / SQLite source errors to use invalid-input exit 5 rather than internal-error exit 1. `node --test --test-name-pattern='normal request/source errors' geo/tests/maps-helper.test.mjs` passed with three additional invalid-CRS requests (raster/vector/area).
- Full `scripts/check` passed on candidate `19c07a4014ab67c5d59872c2381da0a5a12fb8bf` (verified CLI check-pass receipt): backend 1586 passed / 11 skipped, frontend 898 passed, GAID 22 passed, environment imports and production start/stop/restart passed. A final boolean category correction follows this candidate and must be rechecked before final completion.
- Boolean attributes now use explicit `true`/`false` strings consistently in attributes, legend values and analytical class labels, matching maps.ts scalar types. Focused boolean contract test passed.
- Known answers cover exact 10000 m² rectangles, independent spherical Mercator coordinates, WGS84 ellipsoidal area/holes, feet-to-m² conversion, missing CRS/companions, multi-layer GeoPackage with unsupported tables/tiles, GeoJSON recognized from `.json`, plain TIFF versus affine/identity GeoTIFF, mask/alpha/nodata and categorical nearest-neighbor PNG samples, non-COG windows, pagination and limits.
- Safe re-verification: run the focused Node command above; fixtures are generated in disposable temporary directories outside Git. The fixture generator expects a fresh destination.
- Implementation limits: 500 displayed features/page, offset 100000, 64 displayed fields (256 inventory), 512-char display attributes, 10000 vertices/feature and 30000/page; raster grid capped at 256², 128 categorical classes. Full-layer area rejects >100000 features, >2000000 vertices, >1000 classes, oversized geometries or invalid/nonpolygon geometry; never returns a subset area table. Helper response <=7 MiB; cooperative deadline 17 s plus parent's hard timeout.
- TIFF tag inspection uses already-installed `tifffile` (header only); raster pixels use bounded Rasterio windows/WarpedVRT. No new dependencies or paid model runs.
## Next steps
<!-- task:closed -->
Closed 2026-10-11T05:10:22Z: ready; the parent gaid-maps integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Two supplemental fixture checks exposed fixture construction mistakes, now corrected: GDAL writes explicit affine tags even for an identity transform (plain image fixture now uses tifffile); RGBA needs GTiff `ALPHA=YES` rather than only setting color interpretation. Focused final suite passes.
- Interrupted the first `task finish` before publication (SIGINT, exit 130) after review identified the invalid-CRS error-code omission. Backend typecheck had passed; the interrupted full check is not completion evidence. Fix is in place; rerun finish without resume as instructed.
- Second finish completed all declared checks and pushed its ready snapshot, but SIGINT arrived during publication before the completion notice. Remote branch and CLI check-pass receipt verify that snapshot. Preserve the boolean follow-up edits and use the CLI to finish the corrected snapshot; do not discard them.
- CLI rejected the corrected finish with `terminal snapshot is immutable; resume before editing` because the previous snapshot had in fact published. Resumed the same unit only for this published-state exception; returned worktree is unchanged and all three boolean follow-up file edits were preserved. No user relocation/approval was needed.
## Notes and decisions
- Sequential decisions: contracts are fixed by parent; helper keeps source/display CRS distinct; previews never provide analytical area input.
- Owned implementation and tests stay in the three assigned files; no child writers/readers or shared-seam edits.
- Integration order: helper + fixtures -> focused tests -> CLI declared checks -> parent contract handoff. Parent owns application transport/UI integration and the canonical report.
- Limitations passed to parent: unsupported GeoPackage raster/nonspatial content is inventory-only; unknown CRS cannot transform/overlay or calculate area; native rotated rasters require a declared CRS; GCP-only files retain native pixel inspection; geodesic polygons spanning >180° longitude are rejected. Attribute display truncation has explicit issues; analytical class labels are never truncated.
## Open items
None.
## Report
Child unit: evidence and limitations above are for the parent-owned canonical report; no separate report.
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
