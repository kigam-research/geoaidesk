---
format: 1
status: ready
updated: 2026-10-12T14:53:37Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"597a1537-b69e-4291-b5f7-44e6e6807109","pid":154306,"provider":"codex","session":"01a13070-9f74-7430-b1e9-19ce450fc69d","start":"28005015","token":"71c6622f569a3e1b601fe963d7e1a285fd1c492855206a32e60dad763b06162b"}
branch: task/gaid-ui-locale--settings
target: task/gaid-ui-locale
parent: gaid-ui-locale
---
# gaid-ui-locale--settings

## Goal and done criteria
Request from the starter:

# Child writer: gaid-ui-locale--settings (geoaidesk)

Namespace: `settings` (`web/src/geo/locales/settings/{ko,en}.json`, already registered and empty).

Area: the Settings dialog (Models: Providers, Defaults, Fusion; Project: General, Skills, Prompt templates, Specialists, Connectors; Workspace: Services, Appearance), custom model servers card, OAuth sign-in dialogs, provider auth panel and the API token gate. Some of these files already use geoText("app") for parts; keep those ids and convert the rest into the settings namespace.

Owned files:
- `web/src/components/settings/project-settings-panel.tsx`
- `web/src/components/settings/services-panel.tsx`
- `web/src/components/settings/fusion-panel.tsx`
- `web/src/components/settings/providers-panel.tsx`
- `web/src/components/settings/defaults-panel.tsx`
- `web/src/components/settings/key-row.tsx`
- `web/src/components/settings/model-field.tsx`
- `web/src/components/settings/primitives.tsx`
- `web/src/components/custom-models-card.tsx`
- `web/src/components/skills-panel.tsx`
- `web/src/components/prompts-panel.tsx`
- `web/src/components/subagents-panel.tsx`
- `web/src/components/connectors-panel.tsx`
- `web/src/components/oauth-login-dialog.tsx`
- `web/src/components/provider-auth-panel.tsx`
- `web/src/components/api-token-gate.tsx`
- `web/src/components/settings-dialog.tsx`

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
Delivered Settings/authentication localization in the existing shared locale mechanism: 721 messages in each settings catalogue (including 134 finite app-authored provider/MCP metadata messages). Existing app IDs remain unchanged. All edits are within the owned files; no other upstream files or integration boundaries were touched.

Edited components: settings/{project-settings-panel,services-panel,fusion-panel,providers-panel,model-field,primitives}.tsx and {custom-models-card,skills-panel,prompts-panel,subagents-panel,connectors-panel,oauth-login-dialog,provider-auth-panel,api-token-gate}.tsx. Also settings/{ko,en}.json and this task document. Defaults, key-row and settings-dialog already used app IDs and needed no changes.

Checks passed: npm ci; npx tsc --noEmit; full web suite 145 files / 972 tests; copy validator 0 errors; git diff --check; scanner reviewed (11 intentional hits); actual ICU formatter exercised all 1,442 bilingual messages and Korean/English rich placeholders with preserved links/code. No browser or model runs; parent owns browser QA and scripts/check.

English text is preserved except settings.services.search_fallback_plus_youtube_and_video_understanding_for_fetched_links_it_is_the_same_gemi: “unlocks” → “enables”, required by empty-capability validation. Intentionally retained: product names, command/path/model/env identifiers, user-authored skill/template/agent content, raw configuration data and unknown provider/runtime diagnostics. Detailed exceptions and copy evidence follow below.

## Next steps
<!-- task:closed -->
Closed 2026-10-12T14:53:37Z: ready; the parent gaid-ui-locale integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Initial literal extraction did not cover finite provider metadata or whole count phrases; added an exact known-source adapter and complete ICU count messages.
- First full web test run exposed a React code node passed as a string placeholder (2 service tests failed). SettingsMessage now preserves React links/code and permits Korean word order; all 972 tests passed after the fix.
- Intermediate type checks caught optional source text and the login title field; fixed in place. Enter keyboard values remain literal protocol values.
## Notes and decisions
- Sequential decisions: preserve all English text except validator-required edits; never translate protocol values, commands, user files, or provider names.
- Owned interfaces: only listed components and settings locale JSON; existing app IDs stay unchanged. Integration order: catalogue substitutions, dynamic UI adapters, checks, child finish.
- Read-only readers: native translate_reader (skills/prompts/specialists copy and coverage) and connectors_reader (connectors copy and provider metadata). The single writer owns every edit.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
None.
## Report
No separate child report. Parent gaid-ui-locale owns the canonical user report. The Current state and copy evidence below are the child result to incorporate.

## Copy changes and retained strings
- Complete id-level before/after evidence is the settings catalogue pair: before, each new id was an inline upstream English string with no Korean entry; after, en.json preserves that text and ko.json contains the Korean equivalent. ICU apostrophe quoting is syntax only, not an English wording change.
- Representative changes (namespace settings):

| ID | Before ko/en | After ko | After en |
| --- | --- | --- | --- |
| project_settings.general_budget | General & budget | 일반 및 예산 | General & budget |
| fusion.fusion_configurations | Fusion configurations | Fusion 설정 | Fusion configurations |
| custom_models.save_servers | Save servers | 서버 저장 | Save servers |
| connectors.authentication | Authentication | 인증 | Authentication |
| api_token_gate.access_token_required | Access token required | 접근 토큰 필요 | Access token required |
| source.google_cloud_api_key_optional | Google Cloud API key (optional) | Google Cloud API 키(선택) | Google Cloud API key (optional) |

- English exception: services.search_fallback_plus_youtube_and_video_understanding_for_fetched_links_it_is_the_same_gemi changes “that unlocks Google Gemini models” to “that enables Google Gemini models”. Korean: “제공사 설정에서 Google Gemini 모델을 활성화하는 GEMINI_API_KEY와 같은 키입니다.” The copy validator blocks “unlocks”. No action, condition or support claim changed.
- Scanner retained hits: connectors-panel command example `-y @modelcontextprotocol/server-github`; custom-models-card server-name example `Lab vLLM`; prompts-panel `/name args`, `/qc user_data/a.csv`, `K-Dense`; providers-panel `Ollama`; skills-panel `/SKILL.md`; subagents-panel `Watchdog` (twice), `.pi/WATCHDOG.md`, `read, grep, find, ls, bash`. These are products/features, commands or file/tool identifiers, not untranslated prose.
- Raw external/provider errors, runtime authentication prompts and user-provided descriptions remain verbatim unless they exactly match a finite known app-authored metadata message. Provider values, commands, keys, tool inputs, prompt bodies and stored configuration are unchanged.
- Copy warnings reviewed: 11 settings warnings plus 3 existing warnings elsewhere, 0 errors. Automatic instruction upgrades, compaction, OAuth detection and AWS role lookup describe existing behavior. “OpenAI 플랫폼” is a glossary substring false positive for the OpenAI platform, not GAID framing. “No key?” is preserved upstream English help wording (warning only).
- No additional upstream files, tests, dependency manifests or lockfiles changed.

## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
