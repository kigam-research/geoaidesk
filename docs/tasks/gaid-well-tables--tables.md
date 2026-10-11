---
format: 1
status: active
updated: 2026-10-11T04:54:53Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"8b4d426a-82dc-444e-9347-60354a8ffce4","pid":3988444,"provider":"codex","session":"01a12946-e997-71b3-80cd-cd78dd1a4c97","start":"15987572","token":"aacbe3632ec09bb9cd0ed2462c01dea0ad31b942c1b541b060656a312c578629"}
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
- Delivered the owned read-only table package: CSV/TSV/XLSX parser, explicit role overlay, declarations, two-file key checks, localized UI and sandbox/project-scoped API. No shared glue/dependencies/report edited.
- Focused verification: `npm --prefix server test -- test/geo-tables.test.ts test/geo-tables-routes.test.ts`: 2 files / 13 tests passed. Backend `npm --prefix server run typecheck` and frontend `cd web && npx tsc --noEmit --incremental false`: passed.
- Mandatory whole-repo `scripts/check` will run in `task finish`; the recorded job launcher is blocked before creating any receipt by an inherited forbidden `.env.example` path. No forbidden file was read or edited. Task CLI declared checks retain their own external failure logs.
- No paid models, browser verification or deployment performed. Parent owns shared entry-point integration and integrated browser verification.
## Next steps
1. Finish this checked child snapshot with `task finish`; fix any in-scope failures in place and rerun finish.
2. Parent runs `task complete gaid-well-tables--tables`, appends the API/UI entries, and performs its final whole-app/browser checks. This child must not archive itself.
## Failed approaches
- Initial `task job run -- scripts/check` refused dirty source. After reviewed `task save`, launch was still refused: `job snapshot blocked: forbidden path .env.example`. No receipt, running job or source snapshot exists. Do not retry without an environment/policy change; do not edit inherited sensitive paths or bypass task publication.
## Notes and decisions
- Integration contract: import `registerGeoTableRoutes` from `server/src/geo/routes/tables.ts`; POST `/geo/tables/inspect` with `{path, sheet?, mapping?, declarations?, join?}`. Import default `TableRolesViewer` from `web/src/geo/viewers/tables/table-roles-viewer.tsx` with standard `ViewerProps`, as the explicitly selected optional CSV/TSV/XLSX action. It self-fetches; generic editing stays unchanged.
- `web/src/geo/contracts/tables.ts` is the shared schema. Role mapping column indices are zero-based; every finding includes sandbox-relative file path, optional sheet, one-based data row and one-based physical source row (CSV record-start line; XLSX worksheet row). First row is the header. Duplicate/blank header labels are retained.
- Checks count observations, not all interval-pair combinations: sorted intervals compare against the furthest prior endpoint. Repeated hole IDs are expected in interval/survey/assay data; unique sample IDs are checked per explicitly mapped analyte (or declared analyte), or hole IDs in collar-style tables. Join reference-key duplicates are reported independently. Join equality is exact original string equality.
- Numerical interval comparisons require known, consistent declared depth units within each hole; invalid/censored/non-finite interval endpoints remain raw and are flagged. Assay values/qualifiers/detection limits are preserved, not interpreted. Unit checks compare declarations within hole/depth or analyte/value domains; no unit conversion or inferred units/CRS.
- Parser scope: comma-separated UTF-8 CSV, tab-separated UTF-8 TSV (BOM accepted), selected XLSX worksheet with first-row header and unevaluated formulas. Unsupported encoding/container/header/response limits fail explicitly, not as empty success. Partial row/cell/byte limits retain assessed prefix only. Missing keys cannot be inferred from a partial opposite table; gaps cannot be inferred from a partial source or a hole with uncertain rows.
## Open items
None. Job snapshot policy limitation is recorded above for the parent/hub; it does not require a user decision or a source-code workaround in this child.
## Report
No separate child report. Parent integration/evidence note: delivered explicit role mapping with source-preserving interval, ID, declared-unit and join checks; 13 focused tests plus server/frontend type checks passed. The task finish result supplies the whole-repo check status. Whole-app/browser integration remains parent-owned.
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

### Implementation checkpoint
- Sequential decisions: one explicit read-only role overlay, no automatic mapping application; index-based mappings preserve duplicate/original column names. CSV/TSV are UTF-8 (BOM accepted), XLSX uses selected worksheet, formulas remain unevaluated text.
- Scope and ownership unchanged; no child writers or shared glue edits. Parent integrates exported registerGeoTableRoutes and TableRolesViewer.
- Source/data bounds: 16 MiB source, 64 MiB expanded XLSX, 50 sheets, 64 columns, 20k rows, 200k cells, 4 MiB parsed data, 12 preview rows, 200 findings. Partial/unassessed states are separate from no findings.
- Implementation and focused verification completed in owned files. Native codegraph lookup reports this exact worktree unindexed; source files read directly. Parent retains whole-app/browser integration ownership.
- Pre-check review: gap findings are suppressed if the source is partial or a hole contains uncertain/invalid rows; unmatched-key absence is not inferred from a partial opposite table. Positive overlaps/duplicates remain reportable on read rows.
- First check launch refused before execution because the source was dirty (`job source dirty; save first`). Save the reviewed snapshot, then start the recorded job; no job receipt was created.
