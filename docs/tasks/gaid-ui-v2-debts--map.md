---
format: 1
status: ready
updated: 2026-10-22T02:15:50Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"4874820d-e04e-4b0a-8c95-5b14723b8837","pid":2241389,"provider":"codex","session":"01a16154-8f16-7ec1-b5d4-47eff4a5d82e","start":"52223294","token":"be246d461f2ed7bd44b287cdfd4990cbdc0b3a21c25094032face66d42c55fe1"}
branch: task/gaid-ui-v2-debts--map
target: task/gaid-ui-v2-debts
parent: gaid-ui-v2-debts
---
# gaid-ui-v2-debts--map

## Goal and done criteria
Request from the starter:

# Child unit gaid-ui-v2-debts--map: rebuild the map screen to UI guide v2 MAP1–MAP6

Parent: gaid-ui-v2-debts (writer: Claude, same repo). You are a child writer; the parent integrates your branch.

## Request (verbatim user decision, 2026-10-22)
"부채 모두 처리하자." — for open item gaid-design-identity--fresh#1, answered 가): rebuild the map screen (WP05 viewer,
`web/src/geo/viewers/map/`) to guide v2 MAP1–MAP6: short copy instead of long paragraphs, no checkerboard background,
legend and basic information visible without scrolling. Item text: docs/open-items/gaid-design-identity--fresh.md.

## Done criteria
1. The map viewer follows `docs/design/ui-guide.md` MAP1–MAP6 (read sections 1, 2, 3, 5, 9, 10, 11, 12 and MAP, X, F, B, N first):
   - MAP1: map + 320 px side panel side by side from 1024 px; panel order 레이어, 범례, 기본 정보; legend and basic info
     visible without page scroll at 1280×800 inside the workspace content pane (the panel itself may scroll); a legend that
     cannot show every class shows its count and `모두 보기`, never a silently clipped list.
   - MAP2: basic information ≤ 5 rows (source file, CRS by name + code when known, unit, feature/pixel count, extent on
     demand); projection-method-only CRS labelled `투영법만 기록됨`; display-only notes (sampling, "unchanged", hints, issues
     detail) behind `자세히`.
   - MAP3: feature popup next to the point: layer + feature id, ≤ 8 attributes, `모든 속성 보기` to the table.
   - MAP4: toolbar with display CRS and basemap as one compact labelled group, `지도 PNG 저장`, ≤ 3 visible actions
     (others in a `더 보기` menu); network note for online basemaps only when one is chosen.
   - MAP5: attribute table below the map (≥ 6 rows visible or a draggable split with keyboard alternative), X1–X5 as far as
     the existing table supports (sticky header, sort/filter per column, state line, 결측값 in `--gaid-nodata`).
   - MAP6: scale bar, cursor coordinates in the display CRS, zoom and zoom-to-layer, visible highlight on the selected feature.
   - No checkerboard (or any decorative pattern) background behind the canvas; find where it comes from (map-canvas.tsx,
     globals.css or a raster transparency style) and use a calm face/role token instead. Map pixels stay original (I6, V6).
   - Long paragraphs (the `subset`/`figureNotice` line under the header, info-section paragraphs) shortened to one line or
     moved behind a disclosure/tooltip (W5, W6, F6). Keep required limit words (추정, 미시험, 검토 전) and the honest meaning.
2. Role tokens only (`bg-gaid-*`, `text-gaid-*`, `border-gaid-*`, shadcn role vars); no hue utilities, no hard-coded colours
   except data palettes already allowed (`geo/ui/ui-rules.json` `styles.hexAllowFiles`); shared parts from
   `web/src/geo/shell/` and existing `web/src/components/ui/*` controls (Button, Select, DropdownMenu, Tooltip) instead of raw
   `rounded border` buttons; buttons 28 px in toolbars (B2). No component branches on the style (계측/도폭); globals.css draws it.
3. All visible strings in `web/src/geo/locales/map/{ko,en}.json` (Korean first, English same meaning). Before changing copy,
   read `geo/copy/gaid-writing.md`, `geo/copy/terminology.csv`. Report string ids with ko/en before → after.
4. Behaviour preserved: existing tests in `web/src/geo/viewers/map/*.test.*` pass (update tests where the DOM moved, keep what
   they assert); layer add/remove/reorder, opacity, band/layer/variable/categorical choices, area table, `.geomap.json`
   manifests (analysis + limitations section: keep, but behind a disclosure if long), raster pixel popup all still work.
   Never change server routes or the `geo-inspection`/maps contracts.
5. Checks: `cd web && npx tsc --noEmit && npx vitest run src/geo/viewers/map`, `node geo/ui/check-ui.mjs`,
   `node geo/copy/validate-copy.mjs web/src/geo/locales`. Full `scripts/check` is run by the parent at integration; run it
   yourself only if time allows.
6. Visual review: Korean screenshots of the real app at 1440×900 and 1280×800, styles 계측 and 도폭
   (`localStorage gaid:style` = `mapsheet`, applied as `<html data-style="mapsheet">`), themes light and dark (Settings →
   화면 표시, or `localStorage` theme key — find it in `web/src/geo/appearance/`). Screens: a vector layer with a popup open
   (e.g. `user_data/samples/vector/seoul_geology_250k/Seoul_Geology_250K_Litho.shp` in project `review-notebook` or
   `review-note-style`) and a raster (`user_data/samples/raster/kambalda_tmi_40m.tif` in project `default`). Check each
   against guide §12. Save PNGs under `/home/seongin3/data/geoaidesk/work/gaid-ui-v2-debts/map-shots/` named
   `map-<vector|raster>-<instrument|mapsheet>-<light|dark>-<1440|1280>.png`, plus up to 2 composed figures (≤ 1600 px wide,
   small PNG) for the parent's report in the same folder.

## Running the app for screenshots
- Data home: copy the parent's prepared home: `rsync -a /home/seongin3/data/geoaidesk/work/gaid-ui-v2-debts/home/
  /home/seongin3/data/geoaidesk/work/gaid-ui-v2-debts--map/home/` (8 GB, contains the sample projects). Never modify
  `~/.geoaidesk` or the parent's home.
- Launch the dev app from YOUR worktree with `systemd-run --user` and absolute paths, e.g.
  `systemd-run --user --unit gaid-ui-debts-map -E GAID_HOME=<home> -E KADY_PROJECTS_ROOT=<home>/projects
  -E KADY_PI_AGENT_DIR=<home>/pi-agent -E KADY_ENV_FILE=/dev/null -E KADY_PORT=18360 -E KADY_FRONTEND_PORT=3360
  --working-directory=<worktree> /usr/bin/env bash <worktree>/start.sh` (check start.mjs for the exact env names it reads;
  the previous design unit used ports 18350/3350, the parent uses 18370/3370). Stop the unit when done.
- Screenshots: playwright-cli skill (login-free, headless). The workspace hash/project selection: open the project from the
  project list, open the file from the file tree.

## Scope and ownership
- Owned: `web/src/geo/viewers/map/**`, `web/src/geo/locales/map/**`, map-only CSS you add to `web/src/app/globals.css` (one
  clearly commented block; the parent also edits globals.css in a different block, so keep yours self-contained), and
  `geo/ui/ui-baseline.json` entries for map files only (remove resolved ones; add none without a reason).
- Do not edit: `web/src/app/page.tsx`, `web/src/geo/shell/**`, `web/src/geo/notes/**`, `web/src/geo/library/**` (parent),
  files of other active units (gaid-research-visuals, gaid-library-next, gaid-concept-pictures).
- If the map viewer needs a shared part that does not exist, build it inside `viewers/map/` and say so in your result.
- Design stance (user rule, verbatim): "디자인은 항상 impeccable과 taste와 브랜딩 가이드 전문가 입장에서 디자인해야한다."
- Network: KIGAM network blocks raw.githubusercontent.com; use `gh api` if you need GitHub content.

## Result
Record in your task document (Current state): what changed per MAP rule, rule ids followed/broken with reasons, string ids
ko/en before → after, check output, screenshot paths. No report of your own; the parent adds a section to its report. Then
`task finish`.

## Current state

Implemented MAP1–MAP6 in the map viewer without changing server routes, data contracts or source data. TypeScript, all 34 map tests (6 files), UI and copy checks pass. The 16 real-app Korean screenshots cover vector + raster, both identities, both themes and both required sizes. Parent integration and its full `scripts/check` remain separate from this child result.

### Delivered behavior and rule evidence

- MAP1 / L7 / P3: height-bounded viewer with a 320 px inspector from viewport width 1024 px. Its order is layers, legend, basic information. Layer addition opens a local popover; the layer list scrolls independently. Legends show their total count, two preview entries and explicit Show all for longer lists. In the 1280×800 vector captures the inspector is 320 px wide, legend bottom is 621 px and basic-info bottom is 796 px; no page overflow. Raster information also fits.
- MAP2 / W5 / W6 / F6: basic information has four rows (source, named CRS + authority when known, value unit, feature/pixel count). Extent, coordinate units, CRS status, sampling, source-resolution/display hints, preview/PNG scope notices and issues remain available behind Details. Projection-method-only names such as `Transverse_Mercator` are explicitly labelled `투영법만 기록됨`. Original limitations were moved, not removed or softened.
- MAP3 / D4: layer + source feature id, maximum eight attributes, independently scrolling popup body, fixed View all attributes footer, close button/Escape (including focus on the canvas). Position and height are constrained to the map on resize without panning viewport data merely to fit the popup. View all attributes clears table filters/sort, exposes all fields, reveals the selected page and focuses the table; the selected feature stays highlighted.
- MAP4 / B2 / N / F5: compact labelled CRS/basemap group; PNG and More in the header, reload in More; canvas zoom/fit controls. Shared shadcn Button/Select/DropdownMenu/Popover, with map-local 28 px wrappers in `controls.tsx`. Network copy appears only for an active online provider; native-coordinate view keeps its CRS requirement. Known actionable map errors stay visible; unknown technical errors are disclosed.
- MAP5 / X1–X5 / A3: table below the canvas, pointer splitter plus ArrowUp/ArrowDown/Home/End keyboard alternative (default 240 px, requested range 184–520 px, constrained by canvas space). This uses MAP5's resizable-split alternative rather than claiming six rows at every size. Sticky sort/filter headers, one state line with scope tooltip, default eight columns with column picker, native CSS column resizing, 36 px rows, right-aligned numeric/tabular values and explicit missing-value colour. No changes to filtering scope, paging or area calculations.
- MAP6 / I6 / V6: scale line for declared CRS, cursor coordinates in display CRS, zoom/zoom-to-layer and unchanged selected-feature highlight. No fabricated metric scale for native/unknown CRS. The checkerboard came from `map-canvas.tsx`'s repeating-conic-gradient and was replaced by `bg-gaid-face-2`. Raster data palettes, nearest-neighbour tiles, source-pixel reads, vector styles and analysis inputs are unchanged; no image filters or theme-specific component branches.
- S1 / I7–I15 / G6 / V1–V8: selected layer uses the shared `.gaid-index` marker (instrument pointer / mapsheet frame); role tokens only for chrome, local map CSS is one isolated block at the end of `globals.css`. Removed the resolved map tiny-text baseline item; no new accepted debt. No intentional rule breaks. The existing outer file Workflow suggestions consume space but are outside this unit's scope; screenshots retain them and hide chat with the existing app-bar action.

### Verification

- `cd web && npx tsc --noEmit`: exit 0. Log: `/home/seongin3/data/geoaidesk/work/gaid-ui-v2-debts--map/typecheck.log`.
- `cd web && npx vitest run src/geo/viewers/map`: 6 files, 34 tests passed. Includes existing request/scope, layer order/opacity/visibility, manifest, fallback, source band, basemap and area behavior; one added regression covers a filtered-out feature on page 2, eight-column default/eight-attribute popup and complete-record link. Log: same work folder `map-tests.log`.
- `node geo/ui/check-ui.mjs`: 12,630 strings, 0 errors, 111 accepted pre-existing debt entries, no new exceptions.
- `node geo/copy/validate-copy.mjs web/src/geo/locales`: 28 catalogues, 0 errors, 61 pre-existing warnings. Log: same work folder `copy-check.log`.
- Impeccable's one final detector pass returned `[]`; log: same work folder `impeccable-detect.json`.
- Real app used this worktree and a separate rsync copy of the parent's prepared home, ports 18360/3360. No model actions or user-home writes. The screenshot browser and temporary dev service are stopped after capture. Browser console error query returned zero errors. Raster source read returned row 436 / col 590 / -219.20448303222656, and PNG download completed with no failure (`raster-export.png`). Actual vector View all attributes changed 8 → 22 columns and focused the table while preserving selection; Show all displayed all 5 legend classes.
- All 16 screenshots were visually read against guide §12. The final captures include the shared layer index marker. Browser assertions also checked 320 px inspector, no page overflow, visible legend/info, bounded popup and no patterned map background at every combination. Vector screenshots use the keyboard splitter's 184 px table setting; the table remains resizable. Raster source name/code is visible (`GEOCENTRIC DATUM of AUSTRALIA (EPSG:4283)`).

### Screenshot handoff to parent

Folder: `/home/seongin3/data/geoaidesk/work/gaid-ui-v2-debts/map-shots/`.

Files: `map-<vector|raster>-<instrument|mapsheet>-<light|dark>-<1440|1280>.png` (16 captures). Supporting `vector-evidence.log`, `raster-evidence.log` and `manifest.json` contain measured layout and SHA-256 values. Useful unmodified report figures are `map-vector-instrument-light-1280.png` and `map-raster-mapsheet-dark-1280.png` (already ≤1600 px wide). No separate child report or composed figure is needed; the parent owns the canonical report and review copy.

### Copy changes (Korean first; existing strings retain their exact text)

All additions below are new ids (no previous value). Existing `subset`, `figureNotice`, sampling/hint/limit text and table scope copy moved behind disclosures/tooltips without wording changes. Existing basemap catalogue strings are reused unchanged; the new concise notices live in the map catalogue.

| Id | Korean before → after | English before → after |
|---|---|---|
| `map.legendCount` | — → 범례 {count}개 | — → Legend: {count} classes |
| `map.showAll` | — → 모두 보기 | — → Show all |
| `map.projectionOnly` | — → 투영법만 기록됨 | — → Projection method only |
| `map.details` | — → 자세히 | — → Details |
| `map.pixelCount` | — → 픽셀 수 | — → Pixel count |
| `map.missing` | — → 결측값 | — → Missing value |
| `map.allAttributes` | — → 모든 속성 보기 | — → View all attributes |
| `map.featureIdentity` | — → {layer} · 피처 {id} | — → {layer} · feature {id} |
| `map.more` | — → 더 보기 | — → More actions |
| `map.mapDisplay` | — → 지도 표시 | — → Map display |
| `map.cursorCoordinates` | — → 커서 좌표 | — → Cursor coordinates |
| `map.coordinateReadout` | — → {crs} · {x}, {y} | — → {crs} · {x}, {y} |
| `map.coordinateHint` | — → {crs} · 지도 위에서 좌표 확인 | — → {crs} · move over map for coordinates |
| `map.nativeShort` | — → 원본 좌표 | — → Native coordinates |
| `map.columns` | — → 표시할 열 | — → Choose columns |
| `map.areaDetails` | — → 면적 계산 기준 보기 | — → View area calculation rules |
| `map.onlineBasemap` | — → 온라인 배경지도 사용 중 | — → Online basemap in use |
| `map.basemapCrsLimit` | — → 배경지도: 원본 CRS 필요 | — → Basemap: source CRS required |
| `map.basemapStatus` | — → 배경지도 상태 보기 | — → View basemap status |
| `map.technical` | — → 기술 정보 | — → Technical details |
| `map.tableResize` | — → 지도와 속성표 높이 조절 | — → Resize map and attribute table |

## Next steps
<!-- task:closed -->
Closed 2026-10-22T02:15:50Z: ready; the parent gaid-ui-v2-debts integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches

- Initial dependency job was refused because source was dirty; saved the implementation and controls, then launched the one recorded npm-ci job. It completed with exit 0. No stopped-before-start job was restarted manually.
- Initial rsync destination lacked its parent directory; created the task-owned directory and repeated the copy successfully.
- Old tests assumed native select DOM and always-open sections. Updated them to use shared Select options and the real disclosure paths while retaining request and behavior assertions. Follow-up assertions assumed the label `None`; reread the catalogue (`No basemap`) before correcting them. The added focus regression waits for Radix's menu-close focus restoration before the next user action.
- Hot refresh briefly detached an OpenLayers popup node; included popup node identity in the map lifecycle dependency and verified a fresh mount plus viewport resize. No backend changes were used as workarounds.

## Notes and decisions

- The work is tightly coupled; no nested child writer or reader was needed. Ownership and integration order were recorded before implementation.
- The exact-worktree codegraph was unindexed, so source was read directly. Impeccable Operate/distill guidance applied; design-taste-frontend explicitly excludes data-table/product-operation surfaces, so no marketing styling was introduced. The adopted UI guide and brand assets are the brand authority.
- No new requirements, decisions or debt are proposed. No source data or `.geomap.json` manifest format was modified.

## Open items

None for this child. Parent integration/full check is the parent's existing responsibility, not a new open item.

## Report

No separate child report. The parent owns the canonical `gaid-ui-v2-debts` report and embeds the map result there.

## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-ui-v2-debts--map-20261022T020123.965959Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
