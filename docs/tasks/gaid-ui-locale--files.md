---
format: 1
status: active
updated: 2026-10-12T14:42:20Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"e2cc47a6-cd2c-4eb2-911c-522a86045e22","pid":152477,"provider":"codex","session":"01a13070-75c8-77a1-a5c2-ca68669a3ef0","start":"28003948","token":"69ab13e691a305143f67d8563026fb4180aee339a81920be8fd79e309661e036"}
branch: task/gaid-ui-locale--files
target: task/gaid-ui-locale
parent: gaid-ui-locale
---
# gaid-ui-locale--files

## Goal and done criteria
Request from the starter:

# Child writer: gaid-ui-locale--files (geoaidesk)

Namespace: `files` (`web/src/geo/locales/files/{ko,en}.json`, already registered and empty).

Area: the file tree / sandbox panel, file preview panel (partly converted already; keep existing ids), scientific viewers (web/src/components/viewers/*), LaTeX editor, PDF viewer and annotations, Office workspace/toolbar/viewer, CSV viewer, code views. Office toolbar command names follow LibreOffice Korean UI terms where they exist.

Owned files:
- `web/src/components/file-preview-panel.tsx`
- `web/src/components/sandbox-panel.tsx`
- `web/src/components/csv-viewer.tsx`
- `web/src/components/code-views.tsx`
- `web/src/components/office-workspace.tsx`
- `web/src/components/office-toolbar.tsx`
- `web/src/components/viewers/alignment-viewer.tsx`
- `web/src/components/viewers/arraydata-viewer.tsx`
- `web/src/components/viewers/data-plots.tsx`
- `web/src/components/viewers/data-table.tsx`
- `web/src/components/viewers/imaging-viewer.tsx`
- `web/src/components/viewers/molecule-viewer.tsx`
- `web/src/components/viewers/office-viewer.tsx`
- `web/src/components/viewers/phylo-viewer.tsx`
- `web/src/components/viewers/spectrum-viewer.tsx`
- `web/src/components/viewers/structure-viewer.tsx`
- `web/src/components/latex/ai-edit-popover.tsx`
- `web/src/components/latex/latex-editor.tsx`
- `web/src/components/latex/latex-pdf-pane.tsx`
- `web/src/components/latex/latex-toolbar.tsx`
- `web/src/components/latex/log-panel.tsx`
- `web/src/components/latex/outline-panel.tsx`
- `web/src/components/pdf-viewer/annotation-sidebar.tsx`
- `web/src/components/pdf-viewer/note-popover.tsx`
- `web/src/components/pdf-viewer/pdf-viewer.tsx`
- `web/src/app/office/page.tsx`
- `web/src/lib/use-sandbox.ts`

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
Implementation complete for the owned UI: 465 bilingual messages in the files namespace, including count/limit/error states, Office commands, PDF annotations and CodeMirror built-in search/folding/review UI. Existing app ids and all server/model inputs are unchanged. npm ci completed. TypeScript passes; copy validator has 0 errors (4 files-namespace warnings: three unchanged English Saved! strings and the implemented compile-on-save behaviour). All 465 message pairs format in both locales for count samples 0/1/2/1234. All 545 literal filesText references resolve. Full web suite is running as job-geoaidesk-gaid-ui-locale--files-2.

Additional upstream files (parent must register boundaries): web/src/lib/sci-fetch.ts and web/src/lib/latex/{api,completions,outline,spellcheck}.ts. They contain user-visible timeout, fallback, autocomplete and spelling text. No other namespaces or shared boundaries file edited.

Intentional exclusions: user/source data, scientific units and schema names, code/environment names, keyboard shortcuts, HTTP/engine diagnostics, notebook In/Out markers, product/font names. The parent scanner only finds In/Out execution markers and Kady Office in owned files. Raw server-generated errors are unchanged per the parent contract. The embedded third-party LibreOffice engine chrome/dialogs still come from its pinned vendor assets, not these app catalogues; the app-owned command ribbon and known host failures are localized.

English source text is unchanged; composed messages use ICU with the same words, values and plural rules. Korean statuses omit upstream Saved! punctuation. Full translation inventory: files/en.json records the upstream before and unchanged English after; files/ko.json records the Korean after (Korean before was upstream English), keyed by identical message ids.
## Next steps
1. Wait for the recorded web-test job result (relay notification; do not restart).
2. Fix any relevant failures, record final evidence, save, then task finish.
## Failed approaches
- The first isolated web-test job exited 127 before tests: snapshot excludes node_modules, so vitest was absent. Replacement job will explicitly install the lockfile dependencies before running tests.
## Notes and decisions
- Sequential plan: settle existing locale seams, convert static messages, then complete dynamic/count messages and audit data/protocol exclusions. All owned files stay with this writer; no nested writers. Parent owns integration and browser checks.
- English wording is preserved. Technical source values, file names, units, code snippets, server/model inputs, and protocol identities remain untranslated.

(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
None; parent owns final integration and cross-app browser verification.
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-ui-locale--files-20261012T143941.200515Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/runs/gaid-ui-locale--files-20261012T143941.200515Z/log"],"reason":"Snapshot omitted node_modules; replacement installs dependencies before the suite.","recorded":"2026-10-12T14:41:32Z","replacement":"/home/seongin3/data/geoaidesk/runs/gaid-ui-locale--files-20261012T144116.133604Z/receipt.json","state":"superseded"}
- /home/seongin3/data/geoaidesk/runs/gaid-ui-locale--files-20261012T144116.133604Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

## Declared checks
- `cd web && npm ci` (once).
- `cd web && npx tsc --noEmit --incremental false`.
- Full web suite: `npm --prefix web test`.
- `node geo/copy/validate-copy.mjs web/src/geo/locales`.
- `node ~/data/geoaidesk/work/gaid-ui-locale/tools/scan.mjs web/src --list`.
- Runtime-format all files catalogue messages in both locales and audit catalogue references.

## Copy examples for parent report
All ids below are relative to files.; before in both locales was upstream English; English after is unchanged. The paired catalogues are the complete inventory.

| Id | English before / after | Korean after |
| --- | --- | --- |
| office_toolbar.undo | Undo | 실행 취소 |
| office_toolbar.format_cells | Format cells | 셀 서식 |
| latex_editor.ai_review | AI edit applied — review the highlighted chunks | AI 수정을 적용했습니다. 강조한 부분을 검토하세요 |
| file_preview_panel.output_count | {count} output(s) | 출력 {count}개 |
| data_table.preview_scope | Showing the first {rows} rows and {columns} columns. Search, sorting, and plots use this preview only. | 처음 {rows}행과 {columns}열을 표시합니다. 검색, 정렬, 그래프는 미리보기 자료만 사용합니다. |
| scientific_fetch.timeout | Preview timed out after {seconds}s — the file may be too large. | 미리보기 요청이 {seconds}초 후 시간 초과되었습니다. 파일이 너무 클 수 있습니다. |
