---
format: 1
status: active
updated: 2026-10-22T04:55:03Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"8f82cfb2-00f2-45e9-91ba-749409af3f73","pid":3688556,"provider":"claude","session":"fbc80162-8e2c-43a2-aba1-43d2cd5d6e9e","start":"53159755","token":"b7e5efffe0138698575ee4f7dd6df664b1673ecc971be7f3c8c9b2c81e437435"}
branch: task/gaid-workflow-strip
target: main
parent: 
---
# gaid-workflow-strip

## Goal and done criteria
Request from the starter:

# Request: gaid-workflow-strip

User decision (verbatim, 2026-10-22): "gaid-ui-v2-debts의 경우 권장 방식으로 결정하겠다." — answers gaid-ui-v2-debts#1 with option 가):
when a file that needs height (maps, tables) is open, collapse the 'Workflow 제안' strip above it (~155 px) to a one-line summary
with an expand control; expanded, it looks as it does now (reports/2026-10-22-gaid-ui-v2-debts/index.md §6: at 1280×800 the map
gains about 120 px and starting a Workflow takes one more click).
Done: implemented per docs/design/ui-guide.md v2 (tokens only, keyboard accessible, state per browser if remembered), reviewed in
2 styles × 2 themes at 1440×900 and 1280×800, check-ui and scripts/check pass; brief report. Small unit: no other changes.
Own GAID_HOME under ~/data/geoaidesk/work/gaid-workflow-strip/; do not modify ~/.geoaidesk. Outside check: no outside check.

## Current state
- Small unit, no children. Implemented in `web/src/geo/workspace/file-actions.tsx`: `fileNeedsHeight(path)` (geo-vector/raster/map,
  geo-welllog/depth-result, csv, biotable, datatable, arraydata, .xlsx) starts the suggestion strip as one 40 px disclosure button
  (`aria-expanded`/`aria-controls`, summary `workspace.files.summary` + `펼치기`/`접기`); other files keep the open strip with
  its heading and no toggle. Choice kept per browser in localStorage `gaid:workflow-strip` (`open`/`line`, default collapsed).
  New locale ids `workspace.files.{summary,expand,collapse}` (ko/en). No upstream file edited (no boundaries change).
- Tests: file-actions.test.tsx +2 (collapsed start, keyboard expand, persistence across files; non-tall file has no toggle);
  workspace.test.tsx starts with the strip open. `npx vitest run src/geo/workspace/` 33/33, `npx tsc --noEmit` clean,
  check-ui 0 errors, copy validator 0 errors.
- Real app (dev, ports 18380/3380, home ~/data/geoaidesk/work/gaid-workflow-strip/home = Default project copy, no credentials):
  22 screenshots in .../shots (manifest.sha256): map collapsed 2 styles x 2 themes x 1440/1280, expanded x4 at 1280 + 1440,
  table collapsed x4 at 1280; keyboard Enter/Space toggles with focus kept. Measured at 1280x800: strip 41 vs 168 px,
  map+table body 534 vs 407 px. Dev app stopped.
- scripts/check: running as user unit gaid-workflow-strip-check (log .../logs/check.log).
## Next steps
1. Read the scripts/check result, fill section 4 of the report, save, review-copy, finish.
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
Closes: gaid-ui-v2-debts#1
- Tall files share one remembered choice (not per file type); expanded strip is 13 px taller than before because the heading
  is now a 32 px button (G1 row height, A3 target).
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
Report: reports/2026-10-22-gaid-workflow-strip/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
