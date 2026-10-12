---
format: 1
status: waiting
updated: 2026-10-12T14:07:11Z
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
