---
format: 1
status: active
updated: 2026-10-22T01:58:24Z
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
