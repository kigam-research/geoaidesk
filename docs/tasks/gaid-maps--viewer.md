---
format: 1
status: waiting
updated: 2026-10-11T04:44:57Z
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
