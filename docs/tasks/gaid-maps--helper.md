---
format: 1
status: active
updated: 2026-10-11T04:45:19Z
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
