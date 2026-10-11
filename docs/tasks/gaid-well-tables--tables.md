---
format: 1
status: active
updated: 2026-10-11T05:16:09Z
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
- Third whole-repo check: all 1592 backend tests passed (11 skipped); frontend had 900 passed and one existing `file-preview-panel` draft-retention test hit its 5000ms deadline. The unchanged file passed all 4 tests when run alone (`npm --prefix web test -- src/components/file-preview-panel.test.tsx`). Preserve log: /home/seongin3/data/geoaidesk/work/gaid-well-tables--tables/full-check-final.log. Installed Vitest config resolution explicitly supports `VITEST_MAX_WORKERS`; retry with `VITEST_MAX_WORKERS=4` to reduce worker contention, without assertion/test/deadline changes. Next check log: /home/seongin3/data/geoaidesk/work/gaid-well-tables--tables/full-check-workers4.log.
- Current retry evidence: parent fixes merged at b5b148b, `node --test geo/tests/well.test.mjs` passed. Second whole-repo check stopped on an unrelated existing MCP fixture assertion (`mcp__echo__echo` absent from callable tools), with 1591 backend tests passed / 11 skipped. Exact failing MCP test passed in isolation with no source changes (`npm --prefix server test -- test/mcp.test.ts -t 'connects configured servers through Pi and exposes their tools'`: 1 passed). No assertion weakening or MCP edits. Retry whole check against latest parent; preserve second log at /home/seongin3/data/geoaidesk/work/gaid-well-tables--tables/full-check-current.log.
- First mandatory `scripts/check` via task finish: backend 147 files / 1592 tests passed (11 skipped), frontend 135 files / 901 tests passed; distribution checks stopped on 2 parent-owned LAS Python assertions at parent revision 76b8384 (wrapped source-row count and missing-depth/gap flags). Parent has already pushed the fixes in 45229f3 and b5b148b; retry task finish to merge them and check the current tree. Full log: /home/seongin3/data/geoaidesk/work/gaid-well-tables--tables/full-check.log. No forbidden file read/edited. The hub-confirmed temporary procedure allows direct checks; task job snapshot is blocked before receipt creation by inherited .env.example.
- No paid models, browser verification or deployment performed. Parent owns shared entry-point integration and integrated browser verification.
## Next steps
<!-- task:closed -->
Closed 2026-10-11T05:09:36Z: ready; the parent gaid-well-tables integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Third task finish: existing UI test timeout; isolated file passed 4/4. Reduce worker concurrency through supported environment setting before retrying, not source edits.
- Second task finish: unrelated MCP callable-tool assertion failed, then passed isolated without code changes; cause not established.
- First task finish returned a check failure on stale parent LAS code, not the table package. Latest parent commits fix the exact failing assertions; no parent-owned source edits made here.
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
- Source/data bounds: 16 MiB source, 64 MiB expanded XLSX, 50 sheets, 64 columns, 20k rows, 200k cells, 4 MiB parsed data, 4096 characters/cell, 256 characters/header, 12 preview rows (256 characters/cell), 200 findings, 1 MiB response, 15-second helper timeout. Partial/unassessed states are separate from no findings.
- Implementation and focused verification completed in owned files. Native codegraph lookup reports this exact worktree unindexed; source files read directly. Parent retains whole-app/browser integration ownership.
- Pre-check review: gap findings are suppressed if the source is partial or a hole contains uncertain/invalid rows; unmatched-key absence is not inferred from a partial opposite table. Positive overlaps/duplicates remain reportable on read rows.
- First check launch refused before execution because the source was dirty (`job source dirty; save first`). Save the reviewed snapshot, then start the recorded job; no job receipt was created.
- Received routed hub request `env-sample-jobs-gaid-well-tables--tables`: user's confirmed decision authorizes direct worktree checks while backbone fixes inherited `.env.example` snapshot classification. No env sample edits. Existing focused/typecheck commands comply; mandatory `scripts/check` remains owned by task finish.
