---
format: 1
status: active
updated: 2026-10-12T22:56:21Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"a21bc230-636f-4990-93a2-4ec585bd7fd4","pid":150523,"provider":"codex","session":"01a13070-4ae9-70a0-bd1a-952595f36a03","start":"28002851","token":"87f683810b5cdf3f2e70864a3e7c1dc5338b044f1e4d6447a1c05a77c93a71a0"}
branch: task/gaid-ui-locale--work
target: task/gaid-ui-locale
parent: gaid-ui-locale
---
# gaid-ui-locale--work

## Goal and done criteria
Request from the starter:

# Child writer: gaid-ui-locale--work (geoaidesk)

Namespace: `work` (`web/src/geo/locales/work/{ko,en}.json`, already registered and empty).

Area: chat window, composer (ai-elements/prompt-input, message), chat tabs, tool activity, permission/system/interview cards, automation panel, Modal jobs panel and job detail, specialist fleet panel, session cost pill, delegate/research/database/skills pickers, resource monitor, citation badge, project screens (project view, switcher, create dialog), page.tsx remainder and the shared ui primitives (dialog close label etc.). Many of these files are partly converted with geoText("app"); keep those ids, put new ones in the work namespace.

Owned files:
- `web/src/components/automation-panel.tsx`
- `web/src/components/modal-jobs-panel.tsx`
- `web/src/components/modal-job-detail.tsx`
- `web/src/components/subagent-fleet-panel.tsx`
- `web/src/components/session-cost-pill.tsx`
- `web/src/components/delegate-picker.tsx`
- `web/src/components/interview-form.tsx`
- `web/src/components/permission-card.tsx`
- `web/src/components/system-card.tsx`
- `web/src/components/research-picker.tsx`
- `web/src/components/database-selector.tsx`
- `web/src/components/resource-monitor.tsx`
- `web/src/components/skills-selector.tsx`
- `web/src/components/citation-badge.tsx`
- `web/src/components/ai-elements/message.tsx`
- `web/src/components/ai-elements/prompt-input.tsx`
- `web/src/components/ui/carousel.tsx`
- `web/src/components/ui/dialog.tsx`
- `web/src/components/ui/spinner.tsx`
- `web/src/components/chat-tab.tsx`
- `web/src/components/tool-activity.tsx`
- `web/src/components/model-selector.tsx`
- `web/src/components/project-switcher.tsx`
- `web/src/components/lazy-surfaces.tsx`
- `web/src/components/compute-selector.tsx`
- `web/src/components/thinking-selector.tsx`
- `web/src/components/context-chips.tsx`
- `web/src/components/add-context-menu.tsx`
- `web/src/components/chat-tabs-bar.tsx`
- `web/src/components/connect-model-card.tsx`
- `web/src/components/project-view.tsx`
- `web/src/components/project-create-dialog.tsx`
- `web/src/app/page.tsx`

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
- Ready for parent integration: TypeScript passed, full web suite passed (146 files / 975 tests), copy validator 0 errors, scanner only exempt command/product-name hits. No deployment or parent integration claimed.
- Implemented work-area localization in 27 owned upstream component files; existing app namespace ids remain unchanged. Added 736 paired work messages and GAID-only display adapters in web/src/geo/work-labels.ts with a 3-test regression suite.
- Includes 229 database descriptions and 18 categories, translated at display time only (original database objects and model/server prompt payloads are unchanged). Known status/outcome/source codes, counts, accessibility labels, dates and relative times follow gaid:locale.
- Checks: final TypeScript passed; full-web job 3 passed 146 files / 975 tests at 91bb93d8cfa2. Final explicit-agent-name preservation change passed a focused rerun (modal panel + display adapters: 2 files / 7 tests). Copy: 0 errors / 15 warnings (12 work warnings reviewed below); no missing literal workText ids. Previous focused rerun also passed 23 tests across system card/session cost/display adapters.
- Rough scanner remaining owned-file hits: model-selector.tsx: `ollama pull qwen3.6` (command), `Openrouter Fusion` (product name); tool-activity.tsx: `Modal ·` (product name plus punctuation). All intentionally unchanged under do-not-translate rules.
- Also intentionally unchanged: user/model-authored chat/record/skill/specialist names and bodies, file paths and URLs, tool logs/results, protocol identifiers, CSS, keyboard keys, model/provider/hardware names and units. App-generated labels surrounding those values are localized.
- No other upstream files touched. New files are GAID-only work-labels.ts and work-labels.test.ts. Already-localized owned files with no new literals need no code change (page/project screens, selectors and menus retain their existing app ids).
- English copy exception: work.database.description.plaid changes “Bank account connectivity, transaction data, and financial insights” to “Bank account connectivity, transaction data, and financial analytics” because the copy validator rejects “insights”. Korean remains “은행 계좌 연결, 거래 자료, 금융 분석 정보를 제공합니다.” All other English wording is preserved (ICU interpolation/plurals replace source composition).

## Next steps
<!-- task:closed -->
Closed 2026-10-12T22:50:09Z: ready; the parent gaid-ui-locale integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Reinstalled finish check passed backend/frontend tests, geo tests, copy and environment smokes, then production smoke caught an import before the semicolonless use-client directive in shared dialog. Fixed directive ordering in dialog and carousel (same extraction case); run production build then retry finish in place.
- Parent writer confirmed removal of this worktree’s server/node_modules, web/node_modules, .venv and .next at about 22:33Z while the first task finish check was active. This explains the missing Vitest preload file, not a change/install defect. Stopped that check and reran task finish once; scripts/check reinstalls its own dependencies. No further investigation.
- Full-web job 2 ran all 975 tests and found one whitespace regression: Exit code and its value lost their separator. Replaced the entire label/value with an ICU message (and fixed the parallel byte counter); tests are rerun without changing assertions.
- Initial full-web job job-geoaidesk-gaid-ui-locale--work-1 failed before tests: isolated snapshot had no web/node_modules, so vitest was not found. The worktree's npm ci was successful; the next snapshot job installs its own dependencies before running tests.
- Extraction script initially detected overlapping edits; fixed before proceeding. Early TypeScript run caught duplicate geoText imports; removed them and reran successfully.
- Provider capacity errors interrupted the writer/translation reader; preserved checkpoint 3b18ed6 and resumed without discarding edits.

## Notes and decisions
- Edited upstream files (owned): `web/src/components/ai-elements/message.tsx`, `web/src/components/ai-elements/prompt-input.tsx`, `web/src/components/automation-panel.tsx`, `web/src/components/chat-tab.tsx`, `web/src/components/chat-tabs-bar.tsx`, `web/src/components/citation-badge.tsx`, `web/src/components/compute-selector.tsx`, `web/src/components/context-chips.tsx`, `web/src/components/database-selector.tsx`, `web/src/components/delegate-picker.tsx`, `web/src/components/interview-form.tsx`, `web/src/components/lazy-surfaces.tsx`, `web/src/components/modal-job-detail.tsx`, `web/src/components/modal-jobs-panel.tsx`, `web/src/components/model-selector.tsx`, `web/src/components/permission-card.tsx`, `web/src/components/project-switcher.tsx`, `web/src/components/research-picker.tsx`, `web/src/components/resource-monitor.tsx`, `web/src/components/session-cost-pill.tsx`, `web/src/components/skills-selector.tsx`, `web/src/components/subagent-fleet-panel.tsx`, `web/src/components/system-card.tsx`, `web/src/components/tool-activity.tsx`, `web/src/components/ui/carousel.tsx`, `web/src/components/ui/dialog.tsx`, `web/src/components/ui/spinner.tsx`.
- Single writer; no nested task units. Readers /root/database_copy and /root/locale_audit did no checkout edits. Database reader produced an outside-Git translation artifact (229/229 descriptions and 18/18 categories, numeric scope preserved). Read-only audit identified lifecycle, source, outcome, slash kind and database-tooltip gaps; all fixed.
- Display-only GAID adapters avoid edits to shared upstream lib modules (modal-jobs/automation/composer-context). Unknown values and custom metadata fall back unchanged.
- Copy warnings reviewed: automation automatic pause/resume and mission creation describe implemented scheduler behavior; citation “verified” refers only to deterministic resolver checks, not scientific correctness; nutritionix “verified” is carried-over upstream database metadata, not a new verification claim. Two English question-copy warnings preserve existing upstream error/placeholder text. Three other warnings belong to unchanged app/skillHub catalogues.
- Copy change examples (all work ids are fully enumerated in paired work JSON catalogues; prior Korean was missing, prior English was inline):

| String id | Korean before → after | English before → after |
| --- | --- | --- |
| work.automation_panel.automation | missing → 자동화 | Automation → Automation |
| work.modal_job_detail.estimated_spent | missing → 추정 지출 | Estimated spent → Estimated spent |
| work.permission_card.allow_once | missing → 한 번 허용 | Allow once → Allow once |
| work.chat_tab.copy | missing → 응답 복사 | Copy → Copy |
| work.database.description.plaid | missing → 은행 계좌 연결, 거래 자료, 금융 분석 정보를 제공합니다. | financial insights → financial analytics (validator) |

## Open items
None.

## Report
Child result is recorded here for the parent's canonical report; no separate child report.

## Verification commands
- `cd web && npm ci` completed in the worktree.
- `cd web && npx tsc --noEmit` passed on final code.
- `task job run -- bash -c 'npm --prefix web ci && npm --prefix web run test'`: job-geoaidesk-gaid-ui-locale--work-3, exit 0; receipt /home/seongin3/data/geoaidesk/runs/gaid-ui-locale--work-20261012T223024.344067Z/receipt.json.
- `npm --prefix web run test -- src/components/modal-jobs-panel.test.tsx src/geo/work-labels.test.ts`: 7 passed after the final owner-label fix.
- `node geo/copy/validate-copy.mjs web/src/geo/locales`: 0 errors / 15 warnings.
- `node ~/data/geoaidesk/work/gaid-ui-locale/tools/scan.mjs web/src --list`: owned hits only the three documented exemptions.
- `git diff --check`: passed.

## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-ui-locale--work-20261012T222158.203823Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-ui-locale--work-20261012T222738.829157Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-ui-locale--work-20261012T223024.344067Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
