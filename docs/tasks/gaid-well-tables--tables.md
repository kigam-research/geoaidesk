---
format: 1
status: waiting
updated: 2026-10-11T04:44:25Z
writer: {"host":"seongin3","reserved":"aacbe3632ec09bb9cd0ed2462c01dea0ad31b942c1b541b060656a312c578629"}
branch: task/gaid-well-tables--tables
target: task/gaid-well-tables
parent: gaid-well-tables
---
# gaid-well-tables--tables

## Goal and done criteria
Request from the starter:

Implement the independent drillhole/assay table milestone of parent gaid-well-tables. User scope: CSV/TSV/XLSX semantic role mapping and interval/join checks; preserve original columns and censored values, no implicit desurveying or units conversion. Goal: usable UI proposing roles only when relevant, explicit editable mapping, overlap/gap, unmatched joins, duplicate IDs and declared-unit inconsistencies with exact 1-based data-row/file references.
Own ONLY new files server/src/geo/tables/**, server/src/geo/routes/tables.ts, web/src/geo/viewers/tables/**, web/src/geo/contracts/tables.ts, server/test/geo-tables*.test.ts, plus your child task doc. Python helper may be under server/src/geo/tables/ (use existing helper venv via runHelperScript; openpyxl/pandas installed). Do not edit shared glue, dependency locks, or parent report. Parent will integrate exported registerGeoTableRoutes(app) in server/src/geo/routes.ts and add table UI entry. Export default TableRolesViewer with ViewerProps; it will be offered as an explicit optional geo-table action in existing CSV/TSV/XLSX previews (parent handles glue), not replace generic table editing. Return a concise integration/evidence note for parent report. Use defineGeoStrings for Korean/English copy. Route project context activePaths/currentProjectId and resolveGeoPath sandbox validation; bounded source file/data/response limits and explicit partial/unassessed status. Roles: hole_id, sample_id, from_depth, to_depth, depth_unit, coordinates/CRS, survey fields, analyte/value/unit, detection limit, qualifier. No analytical interpretation.
Read parent task doc and skill_hub plan section 3.4 (/home/seongin3/data/geoaidesk/work/gaid-well-tables/inputs/plan.md) and AGENTS. KIGAM blocks raw.githubusercontent.com: do not try it; use gh api contents or codeload. No paid model runs. No need to add dependencies. Use relevant focused tests plus mandatory scripts/check as task workflow requires; record jobs with task job run, outputs external. Main parent owns final whole-app checks and browser verification. Finish your task with task finish; parent will task complete. Do not expand required scope. Keep precise limits and evidence.

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
