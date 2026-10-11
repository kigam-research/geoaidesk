---
format: 1
status: ready
updated: 2026-10-11T05:01:05Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"2bcba6ab-0329-4c49-8cb2-c835676e8dc3","pid":3995197,"provider":"codex","session":"01a12947-6e00-7253-b082-3d48ae1ad554","start":"15990995","token":"e4dda53a5d60153028223e9b921305b1392870ba97e28ebb495282f32a5a0fc9"}
branch: task/gaid-maps--viewer
target: task/gaid-maps
parent: gaid-maps
---
# gaid-maps--viewer

## Goal and done criteria
Request from the starter:

Implement WP05 OpenLayers map viewer frontend. Parent gaid-maps. Shared contract web/src/geo/contracts/maps.ts committed 91e7df38. Read parent task doc and plan 3.2-3.3,4.5-4.6 at /home/seongin3/data/geoaidesk/work/gaid-maps/inputs/geo-byok-plan.md. No raw.githubusercontent.com (KIGAM blocked), paid calls or model runs. Work in your CLI-returned worktree.
Owned files: web/src/geo/viewers/map/** (new viewer, utilities, strings, tests); web/src/geo/viewers/registry.ts ONLY add lazy MapViewer and change geo-raster/geo-vector entries (preserve welllog/WP04); web/package.json,web/package-lock.json add ol OpenLayers dependency only. Before changing package files append their ownership for this task to geo/integration-boundaries.json (tiny own entry; parent will integrate). No other edits; no separate report. Parent owns contracts/routes and manifest schema.
Implement usable interactive OpenLayers map (no external basemap required) with layers overlay (user add sandbox relative path; optionally list via sandbox tree if easy), visibility/order/opacity, GPKG layer picker from /geo/inspect, band and variable choice, categorical colors/legend, source/display CRS separate, nodata distinct from low values, extent/sampling/window dimensions. Open primary file -> inspect -> bounded requests POST /geo/vector-page and /geo/raster-window typed maps.ts. Requests use apiFetch projectId. Moveend updates bbox + width/height capped256 (raster values), vector cap500 page offset; visible table and pagination, select feature -> show properties; raster click shows returned sampled pixel value clearly. Missing CRS native view (no placement guess, block overlay with declared CRS). Ordinary tiff fallback to existing inspection/imaging viewer. Display default EPSG3857 for known sources, native for unknown; no arbitrary projection registration necessary. Source stays unchanged. Race cancellation/project-switch stale data handled.
Area panel selecting vector class field, explicit method geodesic or projected with user entered area EPSG; no default Web Mercator area. POST /geo/area-table returns full-layer numerical table always alongside map; download CSV and map PNG (download browser artifacts, label figure rendered subset). Full analysis distinction obvious. No backend write/export requested. Add map manifest .geomap.json category own registration + filename detection if appropriate; POST /geo/result {path} gives MapManifestResponse; initialize multiple layers/settings, expose table/script artifact paths or fetch table via existing sandbox read. Parent validates manifest. Geo-result kind map-layer schema defined in maps.ts.
Visible strings isolated in map/strings.ts (Korean-first using current geo i18n pattern, English second, WP07 later owns overall wording). Tests meaningful with mocked OpenLayers if canvas needed: layer selection/request params, source/display info, bounds/area, stale project switch etc. Need real browser evidence later parent handles; provide ready instructions. Keep existing contracts (propose additive changes to parent, don't edit them). Finish child after own targeted tests; parent task complete integrates, then full scripts/check.

## Current state
- Resumed in the original CLI-returned worktree on 2026-10-11. Read AGENTS, parent task, map/inspection contracts and plan sections 3.2–3.3 / 4.5–4.6.
- Existing geo viewers are lazy/self-fetching through apiFetch with project scope. Codegraph is unavailable for this exact worktree; using bounded native source reads.
- Implemented `ol` 10.11.0 lazy map viewer, isolated native-CRS views, overlay path entry, visibility/order/opacity, GPKG layer picker, band/variable entry, categorical colors/legend, feature/pixel inspection, viewport paging and sampled metadata.
- Explicit full-layer area panel (geodesic or user-entered projected EPSG; blocks EPSG:3857/4326), numerical table, browser CSV and PNG downloads. PNG includes bounded-subset label, display extent/CRS, layer source CRS and legend. No backend writes or basemap/network resources.
- `.geomap.json` maps to `geo-map`; POST /geo/result initializes multiple sources and presents analysis table/script paths + limitations. Ordinary TIFF delegates to the existing inspection/imaging viewer; LAS registry line is unchanged.
- Final targeted checks passed: `npm --prefix web test -- src/geo/viewers/map src/geo/viewers/inspection-viewer.test.tsx src/lib/use-sandbox.test.ts` (4 files, 38 tests); `cd web && npx tsc --noEmit --incremental false`; `cd web && npx eslint src/geo/viewers/map src/geo/viewers/registry.ts` (zero errors/warnings); `git diff --check` clean.
## Next steps
<!-- task:closed -->
Closed 2026-10-11T05:01:05Z: ready; the parent gaid-maps integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First resume attempts hit another task's transaction lock; waited for that process to exit and resumed successfully without changing ownership/worktree.
- Copy policy files `design/copy/{gaid-writing.md,terminology.csv,copy-policy.json}` are absent (HTTP 404) at skill_hub main and absent from the pinned archive. Applied plan 4.5–4.6 and current defineGeoStrings pattern; no external model lookup.
- First frontend typecheck found optional OpenLayers `getViewport()` return in PNG export. Fixed with explicit viewport/size/context checks; subsequent typecheck passed.
## Notes and decisions
- Sequential implementation (single child writer; no nested children): establish request/CRS utilities, then OpenLayers adapter, then React layer/area controls, then targeted tests.
- Owned files and integration order remain exactly as the Goal. No contract edits; no independent report.
- Unknown/conflicting source CRS uses an isolated native view; declared layers default to EPSG:3857. Analytical area is a separate full-layer request and never derives from the display subset.
- The inspection contract has no variable inventory: raster variable choice is explicit name entry, while band and GPKG inventories use inspected selectors. No contract changes were made.
- Built-in display CRS support is EPSG:3857/4326 (manifest first-layer setting), with one common display CRS stable across layer ordering. Other artifact display CRS settings are transformed to the common display CRS and labelled; source declaration is preserved.
- New user-visible strings are isolated in map/strings.ts (all new IDs, no prior strings changed), with complete Korean/English pairs for loading/errors, preview/area limits and controls.
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

## Parent browser verification (not yet run by this child)
1. In the integrated app with synthetic fixtures in the task sandbox, open a declared GeoTIFF. Confirm render, band switch, pan/zoom requests with bbox and <=256 dimensions, returned extent/resolution, and click zero versus nodata samples.
2. Open a declared vector/GPKG. Choose each vector layer, inspect feature properties via map and table, next/previous pages (500 cap), and add a second declared sandbox path. Verify visibility/order/opacity and categorical field colors + matching legend.
3. Calculate geodesic and a suitable projected-area CRS on a known-area polygon fixture. Confirm full-layer rows/total/count beside the bounded map; pan or page and confirm area result remains full-layer. Save CSV and PNG; inspect CSV precision/units and PNG subset label/CRS/legend.
4. Open a missing-CRS shapefile alone; confirm native placement label, area disabled, overlay refused. Verify ordinary TIFF still uses imaging and a single-point vector fits visibly.
5. Open a `.geomap.json` artifact; confirm multiple layers and referenced table/script/limitations. Switch projects while inspect/window/area requests are pending and confirm no prior-project metadata, features or tables appear.
