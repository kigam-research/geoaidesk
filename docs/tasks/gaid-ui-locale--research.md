---
format: 1
status: active
updated: 2026-10-12T22:24:43Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"34dfdfe5-4370-41a2-aa9d-087d58daaee3","pid":158996,"provider":"codex","session":"01a13070-f6e5-7f13-b322-8d8d7f222e12","start":"28007253","token":"06960dbddd7b357f4f70330ac04ab223ed2e636fefb00ebc485286f900d3e23f"}
branch: task/gaid-ui-locale--research
target: task/gaid-ui-locale
parent: gaid-ui-locale
---
# gaid-ui-locale--research

## Goal and done criteria
Request from the starter:

# Child writer: gaid-ui-locale--research (geoaidesk)

Namespace: `research` (`web/src/geo/locales/research/{ko,en}.json`, already registered and empty).

Area: the notebook research dialogs: frozen analysis plans, robustness (stress-test finding), What next? proposals and cards, research memory, evidence packages. These are long dialogs with many limit/caveat sentences: keep every limitation (not external preregistration, estimates, unverified, etc.) in Korean.

Owned files:
- `web/src/components/notebook-robustness-dialog.tsx`
- `web/src/components/notebook-plan-dialog.tsx`
- `web/src/components/next-experiments-dialog.tsx`
- `web/src/components/next-experiment-cards.tsx`
- `web/src/components/evidence-package-dialog.tsx`
- `web/src/components/notebook-memory-dialog.tsx`

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
Implemented locale-aware research UI in all six owned components and added 480 matching ko/en messages under `web/src/geo/locales/research/`. Includes form/accessibility labels, notices, errors, status enums, source/plan fields, counts and locale-aware dates. Scientific caveats remain explicit. English wording is unchanged; no other upstream files, shared protocols, namespace registration or boundaries were edited.

Verified: `npm ci`; `npx tsc --noEmit`; full web suite (145 files, 972 tests passed); copy validator (16 catalogues, 0 errors, 19 warnings, including 16 reviewed research warnings); scanner; `git diff --check`. All 960 ko/en ICU messages also formatted successfully. No model runs, browser screenshots or deployment were performed; integrated application checks belong to the parent.

Intentionally untranslated: user/model-authored research content, raw server diagnostics/qualifiers and source excerpts, code/JSON, paths/hashes/IDs, model names, units, exported/copy-for-chat protocol text and the default planning-model constraint. Scanner hits are only `--spec JSON_PATH --output RESULT_PATH` and `python3 -I verify.py`, both executable command syntax.

Checkpoint pushed as `883423ebde4c`. Final checked changes are ready for save/finish and parent integration with `task complete gaid-ui-locale--research`.
## Next steps
1. Save the reviewed final files and run `task finish`.
2. Parent integrates the child and performs integrated application verification; no child deployment is required.
## Failed approaches
- Initial full web suite found a missing literal `$` in the model-usage error notice. Restored the original currency notation; full suite then passed without test changes.
- Typecheck after parameterizing the SVG tooltip required an assertion for the estimate already guaranteed by the plotted-attempt filter. Added the type-only assertion; typecheck passed.
- A provider capacity failure interrupted the session. Continued in place and pushed a checkpoint before further work; no jobs or edits were discarded.
## Notes and decisions
Sequential decisions: preserve English UI and protocol values; translate presentation only; keep all scientific limitations. Owned interface: research namespace plus the six listed components. Work is tightly coupled and needed no delegated workers or nested units. Integration belongs to the parent.

The copy validator's 16 research warnings were reviewed: automatic inclusion is implemented and bounded; sensitive content is explicitly not automatically redacted; wording about validated predictions/manuscripts is negative limitation text, not a claim; the ZIP-removal question is a real confirmation. Existing English question labels and em-dash wording are preserved as required by the English-compatibility contract. No copy errors remain.

Copy change ledger: before this task the research namespace was empty and Korean mode showed the components' inline English. Every id's previous English text is retained in `web/src/geo/locales/research/en.json`; its Korean replacement is at the same id in `ko.json`. English before/after is identical, with ICU escaping and parameters preserving rendered text. Representative changes:

| String id | Korean before | Korean after | English before / after |
| --- | --- | --- | --- |
| `research.robustness.stress_test_finding` | Stress-test finding | 결과 강건성 시험 | Stress-test finding |
| `research.plan.analysis_plan` | Analysis plan | 분석 계획 | Analysis plan |
| `research.next_experiments.what_next` | What next? | 후속 실험 제안 | What next? |
| `research.memory.project_research_memory` | Project research memory | 프로젝트 연구 메모리 | Project research memory |
| `research.evidence_package.not_reproduced` | Not reproduced. | 재현하지 않음. | Not reproduced. |

Safe re-verification from this worktree: `cd web && npx tsc --noEmit && npm run test`; then from root run `node geo/copy/validate-copy.mjs web/src/geo/locales` and `node ~/data/geoaidesk/work/gaid-ui-locale/tools/scan.mjs web/src --list`. Logs are under `~/data/geoaidesk/work/gaid-ui-locale--research/` (`web-tests.log`, `copy.log`, `scan.json`). No extra tests were added for wording.
## Open items
None.
## Report
Child implementation result is recorded above for the parent's canonical report; no separate child report.
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
