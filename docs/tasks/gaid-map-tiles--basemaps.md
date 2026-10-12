---
format: 1
status: active
updated: 2026-10-12T05:04:10Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"63644923-72c4-4ae1-aefb-0cbc8717e8d7","pid":2820421,"provider":"codex","session":"01a12e6c-c929-7f03-bfca-c71178e2c0f5","start":"24624387","token":"02d799b29d0f275afe13fb5e2e3fb3da10f64846764f3520d9c8d2ff2115d67f"}
branch: task/gaid-map-tiles--basemaps
target: task/gaid-map-tiles
parent: gaid-map-tiles
---
# gaid-map-tiles--basemaps

## Goal and done criteria
Request from the starter:

# Child writer brief: `gaid-map-tiles--basemaps` (slug `basemaps` under parent gaid-map-tiles) (geoaidesk)

Parent unit: `gaid-map-tiles` (writer: Claude orchestrator). Read the parent task document
`docs/tasks/gaid-map-tiles.md` (Goal, "Verified facts from the hub", "Notes and decisions") and AGENTS.md first.

## Goal (from the user's decision, verbatim)
> "3번은 둘다 지원. 특히 71pc 의 seoul_geomodel 프로젝트의 vtk 시스템을 참조해서 관련된 배경지도맵 api 정보들이 있으므로 해당
> 환경파일을 사용자가 승인하므로 74pc에 복사해 와서 사용하자."

"둘다" = no basemap AND online basemaps, selectable in the GAID map viewer. Offline / no-key use must keep working
(None is the default and always works).

## Decided provider set (from the parent's oracle research; do not add others)
- `none` (default).
- `osm`: OpenStreetMap standard tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, loaded **directly by the
  browser** (OSM tile usage policy discourages proxies; requires visible attribution "© OpenStreetMap contributors"
  linking to https://www.openstreetmap.org/copyright; no bulk/offline prefetch). No backend proxy for OSM.
- `ngii-base`, `ngii-satellite`, `ngii-white`: NGII 바로e맵 WMTS via a backend adapter (keys stay server-side).
  Upstream: `https://map.ngii.go.kr/openapi/Gettile.do?apikey=…&service=WMTS&request=GetTile&version=1.0.0&layer=<korean_map|satellite_map|white_map>&style=korean&format=image/png&tilematrixset=korean&tilematrix=L<zz>&tilerow=<row>&tilecol=<col>`.
  Matrix set "korean" is EPSG:5179 (`+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`),
  top-left origin (-200000, 4000000), tile 256, zoom 5..18 with resolution 2088.96 / 2^(z-5), world span x
  32024123.62 (square matrix; matrix size ceil(span / (res*256))). Headers: `Referer` = the user's registered
  활용URL from the key file (never invent one; if missing the provider is unavailable with reason
  `missing-referer`), a browser-like User-Agent. Attribution: "© 국토지리정보원(NGII) 바로e맵" (copy per geo/copy rules).
- `kigam-geology` overlay (checkbox, independent of the base): KIGAM 1:50,000 geological map **WMS GetMap only**
  (KIGAM states WFS is not offered; do not port the reference's WFS legend call):
  `https://data.kigam.re.kr/openapi/wms?key=…&service=WMS&REQUEST=GetMap&version=1.1.1&layers=L_50K_Geology_Map&srs=EPSG:5186&bbox=<minx,miny,maxx,maxy>&width=<w>&height=<h>&FORMAT=image/png`
  (add `TRANSPARENT=TRUE` if the service accepts it; verify with one real request). EPSG:5186 =
  `+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`.
  Attribution: "한국지질자원연구원(KIGAM) 1:5만 지질도".
- Excluded (document why in docs/geo/basemaps.md): Naver (no verified raw-tile/proxy permission; its SDK exposes the
  client id; the reference used the Static Map API, not tiles), VWorld and Google (no keys provided; terms unverified).
  Proxy/caching permission for NGII/KIGAM was not verified by the research: keys are per user and never shipped,
  no persistent disk cache of their imagery (a small in-memory LRU of recent responses for the running process is
  fine), attribution always visible while shown.

## Keys (never print, log, commit, or send values to the browser)
Reference (read-only, `ssh pc71`): `~/repos/seoul_geomodel/src/forgeo_seoul/viz/web3d/basemap_proxy.py` (KEY_ALIASES,
env-line parser, URL redaction, NGII matrix validation, upstream host/path allowlist). Port what is needed into GAID
TypeScript; do not depend on that checkout.
Resolution order for each key name: `process.env` (this includes the GAID managed `config.env`), then the first
existing file of: `GAID_MAP_KEYS_FILE`, `<GAID_HOME>/map-keys.env` (only when GAID_HOME is set),
`~/.config/map_env/map-keys.env`. Aliases (first non-empty wins): NGII key `GAID_NGII_API_KEY, NGII_API_KEY, NGII_KEY`;
NGII referer `GAID_NGII_REFERER, NGII_REFERER, 활용URL`; KIGAM `GAID_KIGAM_API_KEY, KIGAM_API_KEY, KIGAM_KEY`.
On PC74 the file `~/.config/map_env/map-keys.env` exists (mode 600) with NGII_API_KEY, 활용URL, KIGAM_API_KEY (and
Naver/other names you must ignore). Read only names when you inspect it (e.g. `cut -d= -f1`). Re-read the file when its
mtime changes so a user can add keys without restart.

## Interfaces (fixed by the parent; the parent integrates them into the viewer)
Server (`server/src/geo/basemaps/`, register from `server/src/geo/routes.ts` with one import + one call — the only edit
outside your files):
- `GET /geo/basemaps` → `{ providers: { id: "none"|"osm"|"ngii-base"|"ngii-satellite"|"ngii-white"|"kigam-geology";
  kind: "base"|"overlay"; available: boolean; reason?: "missing-key"|"missing-referer"; attribution: string;
  attributionUrl?: string; crs: "EPSG:3857"|"EPSG:5179"|"EPSG:5186"; minZoom?: number; maxZoom?: number }[] }`.
  No key values, no upstream URLs.
- `GET /geo/basemap/ngii/:layer/:z/:row/:col` (layer ∈ korean_map|satellite_map|white_map) → image bytes with the
  upstream content type (validated PNG/JPEG magic), `Cache-Control: private, max-age=86400`; 404 when unconfigured;
  400 on invalid z/row/col (validate against the matrix size); 502 on upstream failure with a short detail.
- `GET /geo/basemap/kigam?bbox=minx,miny,maxx,maxy&width=&height=` (EPSG:5186 bbox; width/height 1..1024; bbox span
  ≤ 60 km per side or a similarly bounded rule you justify) → PNG; same error mapping.
- Upstream fetch only to the allowlisted host/path pairs; injectable fetch for tests; 20 s timeout; response size cap;
  logs redact `apikey`/`key` query values. Use the global fetch (the app installs the HTTP proxy dispatcher).
- These GETs are loaded by OpenLayers as images: the browser adds the `kady_token` query (via `withApiToken`) and the
  project query is not needed (no project data). Make sure the existing request guard/auth accept them like
  `/sandbox/raw` image loads (CORS with `crossOrigin: "anonymous"` so PNG export of the map canvas is not tainted).
Web (`web/src/geo/viewers/map/basemaps.ts` + `basemaps-picker.tsx`):
- `registerBasemapProjections(): void` — idempotent proj4 + `ol/proj/proj4` `register` of EPSG:5179 and EPSG:5186
  (proj4 2.22.0 is already in web/package.json).
- `useBasemapCatalog(): { providers: BasemapProvider[]; error?: string }` (fetch `/geo/basemaps` with `apiFetch`).
- `basemapLayers(selection: { base: BaseId; overlays: OverlayId[] }, providers: BasemapProvider[]): BaseLayer[]` —
  OpenLayers layers (base zIndex -200, overlays -100 so project data stays on top), each with its source projection set
  (OSM 3857 XYZ; NGII `ol/source/WMTS` or `TileImage` with an explicit `TileGrid` in EPSG:5179; KIGAM `TileWMS`/
  `TileImage` in EPSG:5186 with a bounded tile grid around Korea) so OpenLayers reprojects them into any view CRS.
  `crossOrigin: "anonymous"`; backend URLs through `API_BASE` + `withApiToken`. Attributions set on the sources.
- `BasemapPicker` props `{ providers; value: { base; overlays }; onChange(value); disabled: boolean }` — a select for the
  base (None first), a checkbox per overlay, unavailable entries disabled with their reason, the active attribution
  line(s) visible, and when `disabled` (pixel/native view) a short note that basemaps need a declared CRS.
- Strings: new namespace `web/src/geo/locales/basemap/{ko,en}.json` (+ two import lines and one map entry in
  `web/src/geo/locales/index.ts`), following AGENTS.md "UI copy and locales" and `geo/copy/` (run the validator).

## Owned files (edit nothing else; ask the parent via your tab if you must)
server/src/geo/basemaps/**, server/test/geo-basemaps*.test.ts, the one registration line in server/src/geo/routes.ts,
web/src/geo/viewers/map/basemaps.ts, web/src/geo/viewers/map/basemaps-picker.tsx, web/src/geo/viewers/map/basemaps*.test.ts(x),
web/src/geo/locales/basemap/**, the namespace lines in web/src/geo/locales/index.ts, docs/geo/basemaps.md (providers,
key file, terms/attribution/exclusions and their sources: OSM tile policy https://operations.osmfoundation.org/policies/tiles/,
NGII https://www.data.go.kr/data/15059358/openapi.do, KIGAM https://data.kigam.re.kr/guide/openapi?lang=ko and
https://data.kigam.re.kr/share/requests/60493, Naver https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html).
Do not touch index.tsx, map-canvas.tsx, model.ts, the map locale namespace, helper.py or maps routes (parent's files).

## Evidence
- Unit tests: key resolution order/aliases (temp files, fake env), status output never contains values, NGII matrix
  validation, KIGAM bbox/size validation, allowlist, redaction, upstream error mapping with an injected fetch;
  web tests for `basemapLayers` (layer count/zIndex/projection per selection) and the picker (disabled reasons, None).
- One live check on PC74 with the real key file: `GET /geo/basemaps` (names/availability only) and one NGII tile + one
  KIGAM GetMap through a local backend on a free port (not 8000/18000/3000; use 181xx), recording only status/content
  type/byte size in your task doc (no URLs with keys).
- `cd server && npx vitest run test/geo-basemaps*.test.ts && npm run typecheck`; `cd web && npx vitest run src/geo/viewers/map && npx tsc --noEmit`;
  `node geo/copy/validate-copy.mjs web/src/geo/locales`. Full `scripts/check` is the parent's job.
- Network: KIGAM network blocks raw.githubusercontent.com; use `gh api` for GitHub content.
Finish with `task finish`; the parent integrates.

## Current state
- Resumed in the printed worktree. Read the child contract, parent decisions, AGENTS.md, writer procedures and copy rules.
- Codegraph has no index for this exact worktree; using bounded native source reads. PC71 reference read without key values.
- Delivered key resolver, safe catalogue and NGII/KIGAM image routes under server/src/geo/basemaps/, registered through the allowed seam. Server keys remain private, files refresh on change, all upstream fetches are allowlisted, bounded, redirect-refusing and sanitized.
- Delivered independent basemapLayers/registerBasemapProjections/useBasemapCatalog APIs and BasemapPicker with default None, unavailable reasons, CRS-disabled state, independent geological overlay and visible linked source credits. Korean/English strings and before/after copy inventory are in docs/geo/basemaps.md.
- Focused checks passed on 2026-10-12: server geo-basemaps.test.ts (10 tests) and npm run typecheck; web src/geo/viewers/map (5 files, 26 tests including 7 new basemap tests) and npx tsc --noEmit. Copy validator: 0 errors, 1 existing app/en warning at result.structured_agent_output_not_independently_verified.
- Live local backend check on PC74 port 18123 (then closed): catalogue HTTP 200, all six entries available; NGII HTTP 200, image/png, 33,769 bytes; KIGAM with TRANSPARENT=TRUE HTTP 200, image/png, 6,611 bytes. Only safe metadata was printed. Existing review instance/data unchanged.
- Live evidence (external, no key values): ~/data/geoaidesk/work/gaid-map-tiles--basemaps/live-metadata.json and live-basemaps.mts. Images are local evidence, not bundled imagery.
- Dependency preparation job #1 succeeded (exit 0); its receipt is recorded below. No server process remains from the live check.
- On the delayed job-exit notice, re-read job #1's log and exit: both dependency installs completed, exit 0, executable dependencies present. No job restart is needed. Fetched parent tip 175f17cd62ff; markdown-images.ts still contains the three direct path.relative calls, so the finish prerequisite has not changed. Existing hub request bb9452a0e9dc carries the verified blocker; no duplicate request or knowingly failing check rerun.
- task finish merged parent tip 7461bc03969e and ran full scripts/check on 12511cf2435d. It stopped at the backend suite: 154 files passed, 1 skipped, 1 failed; 1,647 tests passed, 11 skipped, 1 failed. The sole failure is the parent's geo/markdown-images.ts using path.relative directly, caught by win-portability.test.ts:151. No basemap failure. Finish has not succeeded or notified the parent as ready.
- Full-check failure log: /home/seongin3/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-l0fs7sj8.log; external output directory ~/data/geoaidesk/work/checks/12511cf2435d-20261012T045545.976346Z. mzML tests were visibly skipped by the existing network probe; unrelated to the failure.
## Next steps
1. Parent must fix or authorize the path-normalization change in its owned server/src/geo/markdown-images.ts, then save the parent tip. The hub receives this task-local blocker for routing, because no Paseo messaging MCP is callable here. Do not edit the parent's owned file or bypass the check.
2. After the parent's fix is saved, rerun task finish in this worktree (no task resume needed after failed finish). The CLI enforces the repository-wide suite despite the brief assigning integrated checks to the parent.
3. Parent integrates with task complete gaid-map-tiles--basemaps, wires the viewer, keeps attribution visible including exported online imagery, and performs browser checks. Use docs/geo/basemaps.md and evidence above for the parent report; no separate child report.

## Failed approaches
- Literal copyright marks in the new locale catalogues matched the shared Extended_Pictographic emoji rule. Stored the standard &copy; entity and decode it for display; rendered attribution stays exact, with no shared-policy edit.
- Initial web typecheck rejected tests reading a protected OpenLayers source property. Tests now check the actual image element's anonymous CORS setting; typecheck passes.
- First task finish failed only on the inherited parent Markdown-image path conformance check. Requires the parent's apiRelative/toApiPath normalization fix; no speculative changes made to basemap code.
## Notes and decisions
- Sequential plan: settle fixed interfaces first; server adapter and web factory are tightly coupled and will be implemented by this single child writer (no nested units). Owned paths remain those listed above; parent integrates index.tsx/map-canvas.tsx last.
- Existing auth accepts query tokens on all routes; existing CORS/request guard already accepts anonymous cross-origin image loads from allowed UI origins. Verify in focused route tests without changing upstream guard/auth files.
- No server imagery disk cache or background prefetch will be added. NGII and KIGAM use bounded on-demand fetches only.
- State semantics: catalogue available means configured, not an external health guarantee; current live requests separately verified PNG responses. Window focus refreshes the catalogue, so added keys require no backend restart. Known native projected views support basemaps; unknown/pixel views do not.
- The shared guard/auth/CORS tests passed with a query access token and allowed UI Origin. No upstream security/auth file changed. All changes stay in owned paths plus the two expressly allowed registration/namespace seams.
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
- /home/seongin3/data/geoaidesk/runs/gaid-map-tiles--basemaps-20261012T044904.219800Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
