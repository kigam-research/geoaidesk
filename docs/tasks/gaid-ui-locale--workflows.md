---
format: 1
status: active
updated: 2026-10-12T14:25:00Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"7c5ad9b2-35a5-488e-ad56-4d3d0008f9bb","pid":149069,"provider":"codex","session":"01a13070-21c0-7213-b793-c604fbd59372","start":"28001766","token":"91c8b57b2549b46aa416b8addcca52cb4456ce31be2d5c1700757d860aa1d2f0"}
branch: task/gaid-ui-locale--workflows
target: task/gaid-ui-locale
parent: gaid-ui-locale
---
# gaid-ui-locale--workflows

## Goal and done criteria
Request from the starter:

# Child writer: gaid-ui-locale--workflows (geoaidesk)

Namespace: `workflows` (`web/src/geo/locales/workflows/{ko,en}.json`, already registered and empty).

Area: the upstream workflows panel. (1) Category pill labels (WORKFLOW_CATEGORIES) and every visible string in web/src/components/workflows-panel.tsx, web/src/components/workflow-inputs.tsx and web/src/lib/workflow-inputs.ts (only visible strings; the prompt assembly sent to the model stays as is). (2) The 326 upstream workflows in web/src/data/workflows.json: translate name, description and each placeholder label (and any other visible placeholder field) into web/src/geo/locales/workflows/ko.json, keyed by workflow id, e.g. ids `workflows.rows.<workflowId>.name`, `.description`, `.inputs.<placeholderKey>`; en.json holds the upstream English verbatim for the same ids (generate it with a small script, do not hand-copy). Do NOT translate the `prompt` field (stays English as shipped). Workflow ids must be valid flattened keys (check for dots). Rendering: show the catalogue text when the id exists (hasGeoText) else the upstream field, so a workflow added by a future upstream sync shows its English text instead of an id. Search must match the displayed (translated) name/description as well as the English one. (3) Add a vitest test under web/src/geo/ (e.g. web/src/geo/workflows-locale.test.ts) that every upstream workflow id has ko+en name/description and en equals web/src/data/workflows.json (so an upstream sync that changes English text fails visibly). Use terminology.csv; scientific domain names stay natural for Korean researchers (e.g. 논문 검토, 단일세포 RNA-seq 분석; keep established English technical terms). The GAID Geoscience rows (web/src/geo/workspace/task-catalogue.tsx) are already localized; do not change them. The launch dialog of an upstream row is also in your area.

Owned files:
- `web/src/components/workflows-panel.tsx`
- `web/src/components/workflow-inputs.tsx`
- `web/src/lib/workflow-inputs.ts`

## Contract (common to all gaid-ui-locale children)

Parent unit: `gaid-ui-locale` (geoaidesk), branch `task/gaid-ui-locale`. User goal (verbatim): "GAID 시스템에서
워크플로우에서 geoscience 레시피만 한글이다. 시스템에 일관성이 있어야한다." Decision: "1은 가" = both UI modes complete: every
visible string of the app (upstream K-Dense screens and GAID parts) follows the one language setting (Settings →
Appearance, `gaid:locale`, else browser language, Korean default).

Goal of this child: every user-visible string in your owned files goes through the GAID locale catalogues, so Korean
mode shows Korean and English mode shows exactly what it shows today.

How (follow the established pattern; see `web/src/components/chat-tabs-bar.tsx`, `web/src/components/project-view.tsx`):
- `import { geoText } from "@/geo/i18n";` then `const xText = geoText("<namespace>");` and replace each literal with
  `xText("<area>.<snake_of_english>", values?)`. Messages are ICU (`{count, plural, one {# file} other {# files}}`,
  `{name}`), see `web/src/geo/icu.ts`. Ids: `<namespace>.<area>.<key>`; nested JSON objects flatten to dotted ids.
- Put each message in BOTH `web/src/geo/locales/<namespace>/en.json` and `ko.json` (your namespace only).
  English = the current upstream string verbatim (so English mode and existing tests stay unchanged; vitest jsdom runs
  in en-US). Only change English if the copy validator reports an error, and say so in your report.
- Korean: read `geo/copy/gaid-writing.md`, `geo/copy/terminology.csv`, `geo/copy/copy-policy.json` first. AGENTS.md
  rule (verbatim): "문구는 문자열 카탈로그에 넣고 JSX에 직접 쓰지 않는다. 한국어를 먼저 쓰고 영어는 같은 동작·조건·한계로 쓴다. 버튼은
  다음 동작을 쓴다(한국어 목적어+동작, 영어 동사+목적어). 질문형 제목, 추상적 변환 문장, 과장 형용사, 장식 이모지를 쓰지 않는다. 실행
  완료를 검증 완료로 바꾸지 않는다. 추정·미시험·검토 전 같은 한계를 지우지 않는다. 확인되지 않은 기능·지원 환경·성능·비용을 쓰지 않는다."
  Keep technical terms as researchers say them (terminology.csv; e.g. Geoscience, workflow, skill, agent names as listed).
  Look at existing `web/src/geo/locales/app/ko.json` for the tone already used for upstream screens.
- Cover: JSX text, title/aria-label/placeholder/alt/label props, toast/error/confirm messages, strings in constant
  arrays/objects shown on screen (labels, option names, empty states, status words), relative-time and count strings.
  Date/number formatting that hard-codes "en-US" should use `geoLocale()` from `@/geo/i18n`.
- Do NOT translate: user data, file names, paths, model/provider/product names, raw data values, code, units, keyboard
  keys, log text, strings sent to the server or the model (prompts, tool input), test ids, CSS classes.
- Keep upstream diffs minimal: substitute literals in place; no refactors, no reformatting, no behaviour changes.
- Edit only your owned files and your namespace directory. Do not edit `web/src/geo/locales/index.ts`,
  `geo/integration-boundaries.json` or other namespaces. If you must edit another upstream file (a string you find
  outside your list that belongs to your area), you may, but list it in your report so the parent registers it.
  Tests: only update a test if it hard-codes something you had to change; prefer not to.
- Checks before finish (run from your worktree): `cd web && npm ci` (once), `npx tsc --noEmit`, `npm run test`
  (at least the tests of your files; the full web suite before finish), `node geo/copy/validate-copy.mjs
  web/src/geo/locales` (0 errors; review new warnings in your namespace), and the scanner
  `node ~/data/geoaidesk/work/gaid-ui-locale/tools/scan.mjs web/src --list` (rough; a remaining hit in your files must
  be a non-visible or do-not-translate string — list those).
- Network note: KIGAM network blocks raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"`.
- No app model runs. No browser screenshots needed (the parent does them).
- Report (in your task document's Current state, English): files edited, number of messages added, any English text
  changed and why, strings intentionally left (with reason), other upstream files touched. Then `task save` your
  changes (named paths for new files) and `task finish`.

## Current state
Implemented workflow localization: 1,197 bilingual messages (326 names, 326 descriptions, 484 row input labels, 22 category labels, 39 panel/dialog/input messages). Modified assigned panel/input components; lib/workflow-inputs.ts remains unchanged because it contains only model-facing prompt assembly. Generated en rows with namespace-local generate-en.mjs. Added six locale contract/integration tests covering complete row/input coverage, English/source parity, ICU fidelity, future-row fallback, translated+English search, and Korean launch/prompt preservation. Targeted tests pass (6 new, 22 existing); frontend TypeScript passes. Source comparison verifies all 326 prompts and placeholder definitions are unchanged. Copy validator: zero errors, seven warnings (four new reviewed below). Scanner: zero hits in assigned files. Full frontend job 2 reached all 978 tests: 975 passed, 3 failed only because geo/workspace/workspace.test.tsx expected English upstream categories/rows in its explicitly Korean locale. Updated those hard-coded assertions only; full-suite recheck pending.

Other upstream file touched: web/src/data/workflows.json, one comparative-genomics description only, required by copy-validator error. Parent must register this seam in geo/integration-boundaries.json.

## Next steps
1. Recheck updated Korean integration expectations, save them, run the full frontend suite again, then finish.
2. Parent integrates and performs whole-app scripts/check/browser checks.

## Checks
- Child: cd web && npm ci; npx tsc --noEmit; npm run test (full suite); node geo/copy/validate-copy.mjs web/src/geo/locales; node ~/data/geoaidesk/work/gaid-ui-locale/tools/scan.mjs web/src --list; git diff --check.
- Parent owns whole-app scripts/check as stated in the child contract.

## Failed approaches
- Job 2 (exit 1): 145/146 files and 975/978 tests passed. Three workspace integration tests hard-coded English labels despite setting ko-KR. Update only affected display assertions to Korean; mocked upstream source text and all tested behavior remain unchanged.
- Full frontend job 1 exited 127: immutable job snapshot excludes node_modules, so vitest was unavailable. Replace with a self-contained check job that runs npm ci before npm test; source changes are not required.
- Copy validation rejects upstream comparative-genomics description (“evolutionary insights”) as empty-capability. Under the contract’s explicit English-copy-error exception, changed only that description to “Compare genomes across species to examine evolutionary relationships”, in source JSON and generated en catalogue. No prompt changed. Parent must register web/src/data/workflows.json in integration-boundaries (child is forbidden from editing the shared boundaries file).
## Notes and decisions
- New warnings reviewed: cell-type-annotation describes automatic reference-based labelling requested by the task; podcast duration “in minutes” is a unit, not a speed claim; synthetic-accessibility describes the evaluated synthesis difficulty; risk-prediction-model describes validation as requested work, not a verified status. Preserve these factual meanings.
- Intentionally unchanged: all model prompts/execution guidance, user paths/data, icons and category ids, raw upload error messages, and GAID extension rows supplied by the already-localized host.
- Copy ids: workflows.categories.*, workflows.panel.*, workflows.dialog.*, workflows.inputs.*, workflows.rows.<id>.{name,description,inputs.<key>}. English is upstream verbatim except the comparative-genomics description noted above. Korean before: English literal; after examples: workflows.rows.review-paper.name “Review a Paper” → “논문 검토”; workflows.rows.single-cell-rnaseq.name “Single-Cell RNA-seq Pipeline” → “단일세포 RNA-seq 분석”; workflows.dialog.run “Run workflow” → “Workflow 실행”. Exact before/after for every id is available from the bilingual catalogues; source JSON remains the English reference.
- Sequential decisions: preserve upstream prompts and raw data; localize presentation only; future missing ids fall back to upstream text.
- Owned interfaces/files: the three assigned files, workflows namespace, and focused geo tests. No independent child packages (nested children unsupported); keep tightly coupled implementation here.
- Integration order: UI lookup seam → bilingual data → tests/checks → parent integration.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
None.
## Report
Child result and copy changes are recorded here for the parent’s canonical report.
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-ui-locale--workflows-20261012T142231.166023Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-ui-locale--workflows-20261012T142323.119941Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
