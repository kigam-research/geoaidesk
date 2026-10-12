---
format: 1
status: waiting
updated: 2026-10-12T04:31:07Z
writer: {"host":"seongin3","reserved":"1185ae0ff1a4a7bad0597128501551e71d89b1b4e62647f6e68f7b287c527be9"}
branch: task/gaid-map-tiles
target: main
parent: 
---
# gaid-map-tiles

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-map-tiles` (geoaidesk) — interactive tiled maps, basemaps, Markdown image guard

## User request (verbatim, Korean, 2026-10-12, geoaidesk hub)
Context: the user is reviewing GAID hands-on from PC71 (browser) against the app on PC74 via an SSH tunnel.

> "첨부한 이미지 처럼 현재 71PC에서 검토중인데 md 파일에서 그림이 깨져서 보인다. 그리고 두번째 첨부한 이미지처럼 tif, shp를 비롯한
> 맵과 gis 자료를 읽을 수 있는 것은 좋은데 사용자가 71pc로 포트를 두번 타서 그런지 확대 축소에 따른 표시 딜레이가 있으며, 오히려 맵 형
> 데이터는 cesium이나 leaflet과 같은 형태로 인터랙티브하게 볼 수 있게 하는 것은 어떤지 논의 후 구현해볼 필요가 있다."

The hub proposed options (가) keep OpenLayers + tile-based delivery (recommended), 나) MapLibre GL, 다) Leaflet, 라) Cesium 3D
view later; basemap none / online / both; Markdown image fix in this unit. The user decided (verbatim):

> "1 지도 방식은 oracle search를 통해 검색하고 해당 내용까지 반영하여 여전히(가)안이 유력한지 확인 후 (가)+oracle search 의견 반영해서
> 진행하자. 2번은 나중에 별도 작업, 3번은 둘다 지원. 특히 71pc 의 seoul_geomodel 프로젝트의 vtk 시스템을 참조해서 관련된 배경지도맵 api
> 정보들이 있으므로 해당 환경파일을 사용자가 승인하므로 74pc에 복사해 와서 사용하자. 4번은 md 그림문제와 관련하여 GAID에서 실수하지 않게
> 프로그램 지침으로 md파일에서 그림파일이 깨지지 않게 하기 위한 간단한 프로그램 지침을 포함해두어 에이전트에 상관없이 실수하지 않게 해두자."

## Scope (from the decisions; add no other required items)
1. **Map approach.** First run the `oracle-search` skill (Extra High) on how a local, offline-capable research app should show
   GeoTIFF/raster and shapefile/GPKG/GeoJSON layers interactively (OpenLayers with tiles vs MapLibre GL vs Leaflet; tile
   generation/caching such as COG overviews or rio-tiler/TiTiler-style XYZ; client-side vector rendering such as GeoJSON or
   FlatGeobuf; projected CRS such as EPSG:5186). Record the findings in the task document and confirm whether (가) is still
   the stronger option. If yes, implement (가) with the research's recommendations. If the research clearly favours another
   option, stop and ask the user in your tab before switching.
2. **Basemaps: support both** — no basemap and online basemaps, selectable in the map viewer (offline/no-key use must keep
   working).
3. **Cesium 3D is out of scope** (later, separate unit).
4. **Markdown images:** a simple program-level rule so that images in Markdown files written in GAID do not break,
   regardless of which agent/model writes them (e.g. guidance the app gives every agent, plus a lightweight deterministic
   check if useful). Keep it simple.

## Verified facts from the hub
- Map viewer is GAID's own (WP05 `gaid-maps`, `web/src/geo/viewers/map/`, OpenLayers `ol` 10.11.0); upstream BYOK had no map
  library (GeoTIFF went to the imaging viewer). See docs/geo-maps.md and reports/2026-10-11-gaid-maps/index.md.
- Measured on the review instance (backend log): `/geo/raster-window` median ~1.3 s, p90 ~1.6 s server time per request. Each
  OpenLayers `moveend` (`map-canvas.tsx:84`, `index.tsx:89`) requests one 256×256 window, and `server/src/geo/maps/process.ts`
  spawns a new `uv run ... python` helper per request. The SSH tunnel adds only tens of ms. So the delay is the delivery
  design, not the tunnel.
- Broken Markdown images: `results/Jo_et_al_SinGAN_ES_MDA_paper_summary_ko_with_figs.md` (written by the in-app agent) links
  `figures/paper_figures/*.png`, which resolves relative to `results/`; the files are at sandbox-root `figures/paper_figures/`.
  The viewer resolved correctly (13 × 404 on `/sandbox/raw`). The fault is the agent-written path.
- Basemap keys: per the user's approval the hub copied PC71 `~/.config/map_env/map-keys.env` to PC74
  `~/.config/map_env/map-keys.env` (mode 600, sha256 matches). Variable names present: `KIGAM_API_KEY`, `NGII_API_KEY`,
  `활용URL` (NGII referer), `Application_이름`, `Client_ID`, `Client_Secret` (Naver). No Google key. Never print, log, copy into
  the repo, or send key values to the browser; read only names if you need them. Keys must stay server-side (proxy).
- Reference implementation (read-only, PC71 via `ssh pc71`): `~/repos/seoul_geomodel/src/forgeo_seoul/viz/web3d/basemap_proxy.py`
  (providers OSM without key, NGII korean/satellite/white map with key + referer, Naver with client id/secret, Google, KIGAM
  1:50K geology WFS; key file resolution order; URL redaction) and reports `reports/2026-10-08-vtk-review-basemap-i18n-fix`,
  `reports/2026-10-04-vtk-review-viewer`. Do not make GAID depend on that checkout; port what is needed. Check each provider's
  terms/attribution (oracle-search) since GAID is a public fork; keys are per user and never shipped.
- A review instance is running for the user: unit `gaid-review` from `~/deploy/geoaidesk` (tag geo-v0.1.0), ports 3000 (UI)
  and 18000 (backend), data home `~/.geoaidesk`. Do not stop or modify it or its data; use other ports for your own runs
  (and avoid 8000 on PC71 for tunnel tests). The hub updates the review instance after integration on the user's request.
  To reproduce the user's condition, tunnel from PC71: `ssh pc71` then `ssh -L <ui>:localhost:<ui> -L <api>:localhost:<api> pc74`.
- Copy and visible strings follow AGENTS.md "UI copy and locales" (`web/src/geo/locales/`, `geo/copy/` validator).
- Writer setup: you are the Claude top-level orchestrator; child writers/workers use the Paseo profile "general work"
  (gpt-6.1-sol high) at normal speed. No paid model runs unless the user asks.
- Evidence: before/after zoom/pan latency under the PC71 tunnel condition, browser checks of raster + vector + basemap
  toggle, and the Markdown image rule demonstrated. Checks: `scripts/check`. App data under
  ~/data/geoaidesk/work/gaid-map-tiles/. After your last check remove regenerable build caches from the worktree
  (server/node_modules, server/src/helpers/.venv, web/node_modules, web/.next, web/next-env.d.ts, web/tsconfig.tsbuildinfo,
  __pycache__) so the unit can close.

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
