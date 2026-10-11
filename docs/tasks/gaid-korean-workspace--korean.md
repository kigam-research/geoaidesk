---
format: 1
status: active
updated: 2026-10-11T07:14:35Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"95c18540-98e5-43b9-a8b5-0d904e284979","pid":449523,"provider":"codex","session":"01a129b9-f186-77a1-ae42-9253040f3f74","start":"16741475","token":"ec255bab0a5fc65b75b65f6aeb3722d4f293311e4cecceb860ef9f810f3b27e0"}
branch: task/gaid-korean-workspace--korean
target: task/gaid-korean-workspace
parent: gaid-korean-workspace
---
# gaid-korean-workspace--korean

## Goal and done criteria
Request from the starter:

# Child writer brief: `gaid-korean-workspace--korean` (geoaidesk, WP07 Korean primary path and branding)

You are a child writer of top-level unit `gaid-korean-workspace` (WP07 of the GeoAIDesk plan). Run `task resume` for
your slug first, read the returned worktree's AGENTS.md, and work only there. Base: parent branch at ba1a71b.

## Goal (from the package text; do not add required items)
WP07 owns "geo branding/locales" and "Korean primary UI": "All visible strings go into web/src/geo/locales"; done
criterion "Primary-path Korean, keyboard, narrow-layout, and actual-screen checks are recorded" (the parent records the
browser checks; you make the primary path Korean and keyboard/narrow-safe). Product name decided by the user:
GeoAIDesk (short GAID): "GeoAIDesk" in titles and first mentions, "GAID" in compact chrome.

## Already settled by the parent (read first; do not change)
- `web/src/geo/i18n.ts`: `t("<namespace>.<key>", values)`, `geoText(ns)`, `geoLocale()`, `setGeoLocaleSetting()`
  (`gaid:locale`, a change reloads the page). ICU formatter `web/src/geo/icu.ts`.
- Catalogues `web/src/geo/locales/<namespace>/{ko,en}.json`, aggregated by `web/src/geo/locales/index.ts` (namespaces
  already registered: app, workspace, viewers, depth, map, tables, context, localModel). The copy validator
  `node geo/copy/validate-copy.mjs web/src/geo/locales` runs in `scripts/check`.
- Copy rules: `geo/copy/gaid-writing.md`, `geo/copy/terminology.csv` (e.g. `workflow`, `AI agent`, `스킬`, `Geoscience
  자료` stay in that form), `geo/copy/approved/{ko,en}.json` (user-approved general states you may reuse verbatim), and
  the agent prompt block in AGENTS.md ("UI copy and locales"). Design tokens: `geo/copy/gaid-app.css` (WP00, approved).

## Owned files
- Locale namespaces `app`, `viewers`, `depth`, `map`, `tables`, `context`, `localModel` (not `workspace`, which the
  sibling `gaid-korean-workspace--tasks` owns, and not `web/src/geo/workspace/**`).
- The existing geo module dictionaries: move `web/src/geo/{context,local-model}/strings.ts`,
  `web/src/geo/viewers/strings.ts`, `web/src/geo/viewers/{depth,map,tables}/strings.ts` and the inline
  `defineGeoStrings` in `viewers/tables/table-option.tsx` into their catalogues, keeping keys and call sites working
  (e.g. the exported lookups become thin `geoText("<ns>")` wrappers). Convert `{name}` placeholders as needed (ICU
  uses the same form). Remove `defineGeoStrings` from i18n.ts only if nothing uses it any more.
- Upstream files on the primary path (below), `web/src/app/layout.tsx`, `web/src/app/globals.css`, `web/public/`
  brand assets, `web/src/components/settings/appearance-panel.tsx`, and their tests where a visible string changes.
- `geo/integration-boundaries.json`: add or extend one entry per upstream file you edit (owner `gaid-korean-workspace`),
  and `THIRD_PARTY_NOTICES.md` for any font you add.

## Primary path (translate these; everything else stays upstream English and is listed in your task document)
Open the app → project switcher / projects screen → file tree (upload, new file/folder, empty state) → file preview
toolbar and empty/loading/error states → chat tabs bar → chat composer (placeholder, send/stop, attach/+ menu
top-level items, model/thinking/compute selectors, context chips) → tool activity and run status lines → model setup
(connect-model card, Settings dialog navigation, Providers panel headings/row actions, Defaults panel, the local model
card) → result cards (scientific-result-card labels) → Settings → Appearance (language). Use namespace `app` for
upstream strings, ids by surface (`app.header.*`, `app.files.*`, `app.chat.composer.*`, `app.settings.providers.*`, …).

Rules for upstream strings:
- English catalogue values keep the upstream English text unless a copy rule or the brand requires a change (then
  update the affected upstream tests and say so in your task document). Upstream tests run with an English
  `navigator.language`, so unchanged English keeps them passing.
- Brand: replace visible "Kady", "K-Dense BYOK" product naming with GeoAIDesk/GAID or with a neutral role
  (`AI agent`, per terminology). Keep upstream attribution visible once (e.g. version tooltip or Settings: "K-Dense
  BYOK 기반 (MIT)") and keep LICENSE/NOTICE untouched. Code identifiers, storage keys, env vars, event names and API
  paths stay as they are (no functional rebranding, plan §6).
- No question titles, hype adjectives, emoji, celebration; execution state is never shown as verified.

## Branding and theme
- `layout.tsx`: title "GeoAIDesk", Korean description (from the approved strings where one fits), `lang` that
  follows `geoLocale()` on the client (server render stays valid).
- Header: GAID wordmark (text) + "GeoAIDesk" where space allows. The GAID logo is still being made in skill_hub
  (child gaid-design-copy--assets); do not invent a logo image. Replace the K-Dense logo usage in the header; keep the
  files if other code references them.
- Theme: apply the WP00 app tokens (`geo/copy/gaid-app.css` values: brand #1f5eff, ink/body/muted, borders, radius
  10px, status colours) to the light theme in `globals.css`; keep dark mode working (upstream dark values may stay).
  Fonts: Pretendard Variable for UI text and a Hangul-capable monospace for code/paths if you can add them under OFL
  with notices (self-hosted files in `web/public/fonts/` or an npm package; one dependency change at most, recorded in
  the boundaries file); otherwise keep the CSS font stack from the token file with system fallbacks and say so.
  `word-break: keep-all` for Korean text.
- Settings → Appearance: a 언어 / Language control: 자동(브라우저 언어) / 한국어 / English → `setGeoLocaleSetting` + reload.

## Accessibility and layout
Translated controls keep their accessible names in the active language (aria-label/title via `t()`); no layout break
at 375 px for header, file tree toggle and composer toolbar with Korean text (wrap or truncate with a title).

## Checks (yours)
`cd web && npx tsc --noEmit && npm test && node ../geo/copy/validate-copy.mjs src/geo/locales` (full web suite,
because upstream tests assert strings) plus `npx eslint` on files you touched (pre-existing errors in untouched lines
may stay). The parent runs `scripts/check` and the browser checks. No paid model runs. The KIGAM network blocks
raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"` for GitHub files.

## Coordination
The sibling child edits only `web/src/geo/workspace/**` and `locales/workspace`. The parent may edit mount lines in
`app/page.tsx`, `chat-tab.tsx`, `file-preview-panel.tsx` and `scientific-result-card.tsx` (lines mentioning
`Geo…` components); leave those lines as they are and translate around them. Run `task sync` before finishing if the
parent tells you it changed shared files.

## Finish
Keep your task document current: list string ids with Korean and English text (before/after for changed English),
edited upstream files, and the surfaces left in English. `task save` reviewed files, then `task finish`.

## Current state
Primary-path catalogue extraction and Korean translation implemented, including dynamic counts, accessible control names, branding, light-theme tokens and Appearance language control. Geo dictionaries moved into catalogues with thin wrappers; old defineGeoStrings removed. Final checked source: 056ac5924b22 (job 4, exit 0). Typecheck and copy validation passed; all 927 tests in 141 files passed. Raw ESLint reports 10 errors and 4 warnings, exactly matching ba1a71b by file/rule/severity; no new diagnostics. Dependency install job 1 exited 0; its npm-ci node_modules copied into this worktree (no lockfile changes).
## Next steps
1. Child result ready: task finish notifies the parent writer; parent integrates via task complete.
2. Parent records full scripts/check plus actual-screen/keyboard/narrow-layout evidence. No deployments or paid model runs performed by this child.
## Failed approaches

- First full web check (job 2): typecheck/copy passed; 922/927 tests passed. Five assertions failed: three glossary expectations, one Kady product-name expectation and a fixed/dynamic status id collision. Fixed the copies/tests and audited all literal appText calls for missing ids/unbound parameters (0 remain).
- A duplicate appText declaration found by typecheck during extraction was removed before the first full check. No authentication, network or model-run workaround was added.
## Notes and decisions

- Sequential implementation: register upstream seams, migrate geo dictionaries, translate primary path, then theme/language and checks. Owned: app/viewers/depth/map/tables/context/localModel catalogues and primary-path upstream files; workspace namespace and Geo mount lines stay untouched. No child writers (nested units unsupported); tightly coupled catalogue edits stay with this single writer. Parent owns browser/full scripts/check evidence.
- Font fallback choice: use the approved system/Hangul-capable stack without fetching a new font or adding a dependency. No new font notice is needed.

## Open items

None within this child scope. Parent-owned browser and full scripts/check evidence remains with the parent unit.

## Report

Child unit: no separate report. Integration-ready copy ledger and verification notes below feed the parent WP07 report.

## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-korean-workspace--korean-20261011T065143.526607Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-korean-workspace--korean-20261011T070615.876831Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-korean-workspace--korean-20261011T070939.407647Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-korean-workspace--korean-20261011T071232.084510Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

## Implementation and integration notes

- Branding: header uses text GAID + GeoAIDesk (full name hidden on compact header); title/description come from the app catalogue. K-Dense BYOK (MIT) attribution remains visible. No invented logo asset; no LICENSE/NOTICE changes.
- Locale: Appearance offers auto/Korean/English; saves gaid:locale and reloads. GeoLocaleRoot waits for browser locale before showing the localized app, avoiding server/browser language hydration mismatch; document lang then follows geoLocale().
- Keyboard/narrow safeguards: translated aria-label/title/placeholder; semantic language select and unchanged keyboard handlers; compute option focus no longer selects by an English aria-label; composer left toolbar wraps below its 30rem container breakpoint; model/context popovers cap to viewport; Settings sidebar shrinks/wraps at small widths. Actual 375px/keyboard screenshots remain parent-owned, not claimed here.
- English retained deliberately outside the agreed primary path: workflow implementation/detail screens, notebook/provenance panels, compute dashboard and automation/fleet panels, history payloads and model/server errors, scientific viewer internals (notebook/sequence/AnnData etc.), OAuth login details, custom-model advanced editor, Settings Services/Project/Fusion/Skills/Prompts/Specialists/Connectors internals, deeper context-menu pickers and externally supplied provider billing/auth metadata, resource monitor and cost-pill details. Their navigation/top-level entry controls on the primary path are translated. Technical file formats, commands, model/provider names, user data and tool outputs remain verbatim.
- Font fallback: no self-hosted font was fetched. WP00 Pretendard Variable/system Korean UI stack and D2Coding/Nanum Gothic Coding/system monospace stack are configured; installed system fonts determine the actual face.
- Modified upstream files (each registered in geo/integration-boundaries.json before edits):
  - web/src/app/globals.css
  - web/src/app/layout.tsx
  - web/src/app/page.tsx
  - web/src/components/add-context-menu.tsx
  - web/src/components/chat-tab.tsx
  - web/src/components/chat-tabs-bar.tsx
  - web/src/components/compute-selector.tsx
  - web/src/components/connect-model-card.tsx
  - web/src/components/context-chips.tsx
  - web/src/components/context-usage-indicator.tsx
  - web/src/components/file-preview-panel.tsx
  - web/src/components/model-selector.tsx
  - web/src/components/project-create-dialog.tsx
  - web/src/components/project-switcher.tsx
  - web/src/components/project-view.tsx
  - web/src/components/sandbox-panel.tsx
  - web/src/components/scientific-result-card.tsx
  - web/src/components/settings-dialog.tsx
  - web/src/components/settings/appearance-panel.tsx
  - web/src/components/settings/defaults-panel.test.tsx
  - web/src/components/settings/defaults-panel.tsx
  - web/src/components/settings/key-row.tsx
  - web/src/components/settings/model-field.tsx
  - web/src/components/settings/primitives.tsx
  - web/src/components/settings/providers-panel.tsx
  - web/src/components/thinking-selector.tsx
  - web/src/components/tool-activity.tsx

## Verification

- Job 1 (dependency installation): exit 0.
- Job 2 (initial full web checks): exit 1; five copy/id-related test failures (922/927 passing) and existing ESLint diagnostics. Fixed before job 3.
- Job 3 (corrected full web checks): exit 1 only because raw ESLint returns nonzero for the pre-existing diagnostics; typecheck, 927 tests/141 files and copy validation passed. This is a superseded intermediate check, not an outstanding failure.
- Job 4 (final checked source 056ac5924b22): exit 0. Commands: npm --prefix web ci; cd web && npx tsc --noEmit; npm test; node ../geo/copy/validate-copy.mjs src/geo/locales; npx eslint on every touched TS/TSX file (including new locale-root and updated tests). A separate ESLint API comparison linted the same files against ba1a71b: 10 errors/4 warnings before and after, newProblems=0. Raw lint remains nonzero; accepted by the explicit child check policy allowing pre-existing errors in untouched lines.
- Copy validation: 8 catalogues, 0 errors, 2 warnings. The negative independently-verified statement retains its limitation despite the heuristic warning; the map displayFallback demonstrative warning is preserved migrated copy.
- All 1,908 flat catalogue messages formatted with representative arguments without an ICU exception. All literal appText calls audited: no missing ids or parameterless messages with unbound arguments.
- Final check receipt: /home/seongin3/data/geoaidesk/runs/gaid-korean-workspace--korean-20261011T071232.084510Z/receipt.json; log and exit are siblings. Check harnesses and baseline input sources are under /home/seongin3/data/geoaidesk/work/gaid-korean-workspace--korean/ (not app assets; no runtime dependency).
- Parent-owned pending checks: scripts/check, production/browser render, actual Korean primary-path keyboard/375px checks. Not claimed by this child.

## Copy ledger

Every id below is now catalogue-backed. A dash means Korean did not previously exist on the upstream surface. Migrated geo copy shows its prior Korean/English text when changed; unchanged migration retains both languages verbatim. New app ids are extracted upstream copy or primary-path messages. English changes are limited to branding, copy policy (no question heading/unqualified claims), correct configuration-file wording, and complete ICU messages with equivalent conditions.

### app

| String id | Korean (before → after if changed) | English (before → after if changed) |
|---|---|---|
| app.chat.chips.applies_to_the_next_message_only | — → 다음 요청에만 적용합니다. | Applies to the next message only. |
| app.chat.chips.attached_to_the_next_message_the_agent | — → 다음 요청에 첨부합니다. AI agent가 작업 폴더에서 파일을 직접 읽을 수 있습니다. | Attached to the next message. The agent can read this file directly from the sandbox. |
| app.chat.chips.delegateName | — → 위임 · {name} | Delegate · {name} |
| app.chat.chips.delegate_kady_chooses | — → 위임 · AI agent가 선택 | Delegate · Kady chooses → Delegate · AI agent chooses |
| app.chat.chips.earlier_chat | — → 이전 대화 | Earlier chat |
| app.chat.chips.kady_briefs_this_specialist_and_checks_its | — → AI agent가 전문 AI agent에 작업을 설명하고 전달받은 결과를 확인한 뒤 응답합니다. | Kady briefs this specialist and checks its handoff before replying. → AI agent briefs this specialist and checks its handoff before replying. |
| app.chat.chips.kady_follows_this_skill_s_instructions_on | — → 스킬을 해제할 때까지 AI agent가 모든 요청에서 스킬의 지침을 따릅니다. | Kady follows this skill's instructions on every message until you remove it. → AI agent follows this skill's instructions on every message until you remove it. |
| app.chat.chips.kady_reads_a_compact_snapshot_of_this | — → 요청을 보낼 때 저장한 대화 요약본을 AI agent가 읽습니다. | Kady reads a compact snapshot of this chat, taken when the message is sent. → AI agent reads a compact snapshot of this chat, taken when the message is sent. |
| app.chat.chips.kady_reads_this_record_with_notebook_search | — → AI agent가 notebook_search로 기록을 읽은 뒤 참고합니다. | Kady reads this record with notebook_search before relying on it. → AI agent reads this record with notebook_search before relying on it. |
| app.chat.chips.kady_splits_the_work_and_hands_parts | — → AI agent가 작업을 나누고 역할 설명에 맞는 전문 AI agent에 위임합니다. | Kady splits the work and hands parts to specialists picked by their descriptions. → AI agent splits the work and hands parts to specialists picked by their descriptions. |
| app.chat.chips.record.decision | — → 결정 | Decision |
| app.chat.chips.record.deviation | — → 계획 변경 | Deviation |
| app.chat.chips.record.experiment | — → 실험 | Experiment |
| app.chat.chips.record.finding | — → 발견 | Finding |
| app.chat.chips.record.hypothesis | — → 가설 | Hypothesis |
| app.chat.chips.record.method | — → 방법 | Method |
| app.chat.chips.record.note | — → 메모 | Note |
| app.chat.chips.record.observation | — → 관찰 | Observation |
| app.chat.chips.record.plan | — → 확정한 계획 | Frozen plan |
| app.chat.chips.record.result | — → 결과 | Result |
| app.chat.chips.record.summary | — → 요약 | Summary |
| app.chat.chips.record.user-note | — → 사용자 메모 | User note |
| app.chat.chips.removeDelegate | — → {name} 위임 해제 | Don't delegate to {name} |
| app.chat.chips.removeFile | — → {name} 첨부 해제 | Remove {name} |
| app.chat.chips.removeReference | — → {name} 참조 해제 | Remove {name} |
| app.chat.chips.removeSkill | — → {name} 스킬 해제 | Remove {name} |
| app.chat.chips.removeSource | — → {name} 출처 해제 | Remove {name} |
| app.chat.chips.remove_verification_gate | — → 검토 조건 해제 | Remove verification gate |
| app.chat.chips.skillName | — → 스킬 · {name} | Skill · {name} |
| app.chat.chips.skillSource | — → 출처: {source} | by {source} |
| app.chat.chips.specialists_kady_picks | — → 전문 AI agent: 자동 선택 | Specialists: Kady picks → Specialists: AI agent picks |
| app.chat.chips.stop_letting_kady_choose_specialists | — → 전문 AI agent 자동 선택 해제 | Stop letting Kady choose specialists → Stop letting the AI agent choose specialists |
| app.chat.chips.the_best_suited_verifier_specialist_reviews_the | — → 적합한 검토용 AI agent가 결과의 문제를 찾습니다. 검토를 통과해야 AI agent가 결과를 수락합니다. | The best-suited verifier specialist reviews the result adversarially; Kady accepts it only if the review passes. → The best-suited verifier specialist reviews the result adversarially; AI agent accepts it only if the review passes. |
| app.chat.chips.verification_gate | — → 검토 통과 후 수락 | Verification gate |
| app.chat.chips.verify_before_accepting | — → 검토 통과 후 수락 | Verify before accepting |
| app.chat.composer.add_a_short_note_to_send_with | — → 이미지와 함께 보낼 요청을 입력하세요. | Add a short note to send with the image. |
| app.chat.composer.after_this_turn_kady_continues | — → 현재 실행 뒤 AI agent가 계속 실행 | After this turn — Kady continues → After this turn — AI agent continues |
| app.chat.composer.ask_kady_anything_for_files_for_commands | — → 요청을 입력하세요… (@ 파일, / 명령, + 참고 자료) | Ask Kady anything… (@ for files, / for commands, + to add context) → Ask AI agent anything… (@ for files, / for commands, + to add context) |
| app.chat.composer.attach_file | — → 파일 첨부 | Attach file |
| app.chat.composer.attached_image | — → 첨부 이미지 | attached image |
| app.chat.composer.budgetBlocked | — → 프로젝트 지출 한도에 도달했습니다 ({amount}). 새 실행은 차단됩니다. | Project spend limit reached ({amount}). New runs are blocked. |
| app.chat.composer.budgetTooltip | — → 프로젝트 지출 한도에 도달했습니다 ({amount}). 계속하려면 설정 → 프로젝트 → 일반에서 한도를 바꾸세요. | Project has hit its spend limit ({amount}). Raise the limit in Settings → Project → General to continue. |
| app.chat.composer.budgetWarning | — → 프로젝트 지출 한도의 80 %를 넘었습니다 ({amount}). | Approaching spend limit ({amount}). You're over 80% of the project's cap. |
| app.chat.composer.cancel | — → 취소 | Cancel |
| app.chat.composer.cancel_the_current_turn_steers_it_instead | — → 현재 실행을 중단합니다. 전달하지 못한 지시는 입력창으로 돌아오고 대기 요청은 재개할 때까지 멈춥니다. 이미 만든 파일은 유지됩니다. ⏎는 실행을 중단하지 않고 지시를 전달합니다. | Cancel the current turn (⏎ steers it instead). Undelivered steering messages return to the composer, queued prompts pause until you resume them, and files the agent already wrote stay in the sandbox. |
| app.chat.composer.checking_dictation_support | — → 음성 입력 지원 여부를 확인하는 중입니다. | Checking dictation support… |
| app.chat.composer.checking_model_provider | — → 모델 제공사 확인 중 | Checking model provider |
| app.chat.composer.commands | — → 명령 | Commands |
| app.chat.composer.compacted | — → 대화를 요약했습니다: {before} 토큰{after, select, none {} other { → 약 {after} 토큰}}{cost, select, none {} other { · {cost}}} | Context compacted: {before} tokens{after, select, none {} other { → about {after}}}{cost, select, none {} other { · {cost}}} |
| app.chat.composer.compaction_failed | — → 대화를 요약하지 못했습니다. | Compaction failed. |
| app.chat.composer.cost_of_this_reply | — → 응답 비용 | Cost of this reply |
| app.chat.composer.couldn_t_deliver_the_steering_message_your | — → 실행 중 지시를 전달하지 못했습니다. 입력한 내용을 복원했습니다. | Couldn't deliver the steering message — your text was restored. |
| app.chat.composer.delegateNames | — → 위임: {names} | Delegate: {names} |
| app.chat.composer.delegate_kady_picks | — → 위임: AI agent가 선택 | Delegate: Kady picks → Delegate: AI agent picks |
| app.chat.composer.dictate | — → 음성 입력 | Dictate |
| app.chat.composer.dictationFailed | — → 음성을 텍스트로 변환하지 못했습니다 ({status}). | Dictation could not be transcribed ({status}). |
| app.chat.composer.drop_to_attach | — → 파일을 놓아 첨부하세요. | Drop to attach |
| app.chat.composer.edit_queued_message | — → 대기 중인 요청 수정 | Edit queued message |
| app.chat.composer.fileMatches | — → 검색 결과 {count}개 | {count, plural, one {# match} other {# matches}} |
| app.chat.composer.files | — → 파일 | Files |
| app.chat.composer.held_while_editing | — → 요청 수정 중 대기 | Held while editing |
| app.chat.composer.hold_to_dictate_using_this_browser_s | — → 버튼을 누른 채 말하세요. 브라우저의 음성 인식을 사용합니다. | Hold to dictate using this browser's speech recognition. |
| app.chat.composer.hold_to_record_audio_is_sent_to | — → 버튼을 누른 채 녹음하세요. 음성을 OpenRouter로 보내 텍스트로 변환합니다. | Hold to record. Audio is sent to OpenRouter for transcription. |
| app.chat.composer.i_can_research_topics_write_code_and | — → 자료 조사, 코드 작성, 자료 분석을 요청하세요. | I can research topics, write code, and analyze data. |
| app.chat.composer.imageAlt | — → 첨부 이미지 {index} | Attached image {index} |
| app.chat.composer.image_is_too_large_20mb_max | — → 이미지 크기가 한도를 넘었습니다. 20 MB 이하로 줄이세요. | Image is too large (20MB max). |
| app.chat.composer.kady_will_search_the_full_chat_log | — → AI agent가 전체 대화 기록에서 검색합니다. | Kady will search the full chat log instead. → AI agent will search the full chat log instead. |
| app.chat.composer.listPrice | — →  · 정가 기준 {price} (프로젝트 지출 아님) |  · {price} list-price reference (not project spend) |
| app.chat.composer.maxImages | — → 요청마다 이미지를 최대 {count}개 첨부할 수 있습니다. | At most {count} images per message. |
| app.chat.composer.metered_extra_usage | — → 추가 종량제 사용량 | Metered extra usage |
| app.chat.composer.model_provider_disconnected | — → 모델 제공사 연결 안 됨 | Model provider disconnected |
| app.chat.composer.model_provider_status_is_still_loading_try | — → 모델 제공사의 상태를 불러오는 중입니다. 잠시 뒤 다시 시도하세요. | Model provider status is still loading. Try again in a moment. |
| app.chat.composer.nothing_to_compact_yet | — → 요약할 대화가 없습니다. | Nothing to compact yet. |
| app.chat.composer.nothing_to_compact_yet_the_conversation_still | — → 대화가 최근 context 범위 안에 있어 아직 요약할 내용이 없습니다. | Nothing to compact yet: the conversation still fits in the recent-context window. |
| app.chat.composer.only_png_jpeg_webp_or_gif_attach | — → 메시지에는 PNG, JPEG, WebP, GIF만 첨부할 수 있습니다. 다른 파일은 + 메뉴로 작업 폴더에 추가하세요. | Only PNG, JPEG, WebP, or GIF attach to the message — use + to add other files to the sandbox. |
| app.chat.composer.open_settings | — → 설정 열기 | Open Settings |
| app.chat.composer.paused_stopped | — → 실행 중단으로 대기 | Paused — stopped |
| app.chat.composer.project_spend_limit_reached | — → 프로젝트 지출 한도에 도달했습니다. | Project spend limit reached. |
| app.chat.composer.provider | — → 제공사 | Provider |
| app.chat.composer.providerQuota | — → {provider}에서 요금과 사용 한도를 관리합니다. | {provider} manages billing and quota |
| app.chat.composer.queueDown | — → 대기 요청 {index} 아래로 이동 | Move queued message {index} down |
| app.chat.composer.queueEdit | — → 대기 요청 {index} 수정 | Edit queued message {index} |
| app.chat.composer.queueFull | — → 대기 요청이 가득 찼습니다 ({count}/{count}). | Queue full ({count}/{count}) |
| app.chat.composer.queueRemove | — → 대기 요청 {index} 삭제 | Remove queued message {index} |
| app.chat.composer.queueUp | — → 대기 요청 {index} 위로 이동 | Move queued message {index} up |
| app.chat.composer.queueWait | — → 대기 요청이 가득 찼습니다 ({count}/{count}). AI agent가 처리할 때까지 기다리세요. | Queue is full ({count}/{count}). Wait for the agent to work through it. |
| app.chat.composer.queue_is_full | — → 대기 요청이 가득 찼습니다. | Queue is full |
| app.chat.composer.raiseBudget | — → 프로젝트 설정에서 한도 변경 | Raise the limit in project settings to continue. |
| app.chat.composer.reconnect_it_in_settings_providers_or_choose | — → 설정 → 제공사에서 다시 연결하거나 다른 모델을 선택하세요. | Reconnect it in Settings → Providers or choose another model. |
| app.chat.composer.reconnect_this_model_provider_in_settings_before | — → 요청을 보내기 전에 설정에서 모델 제공사를 다시 연결하세요. | Reconnect this model provider in Settings before launching. → Reconnect this model provider in Settings before sending. |
| app.chat.composer.reconnect_this_model_provider_in_settings_before_2 | — → 실행하기 전에 설정에서 모델 제공사를 다시 연결하세요. | Reconnect this model provider in Settings before launching. |
| app.chat.composer.reconnecting_to_this_run | — → 실행에 다시 연결하는 중입니다. | Reconnecting to this run… |
| app.chat.composer.removeImage | — → {name} 첨부 해제 | Remove {name} |
| app.chat.composer.replyTokens | — →  · {count} 토큰 |  · {count} tokens |
| app.chat.composer.researchCount | — → 연구 기록 {count}개 | {count, plural, one {# research reference} other {# research references}} |
| app.chat.composer.restoring_this_conversation_retrying_if_the_server | — → 대화를 복원하는 중입니다. 서버에 연결하지 못하면 다시 시도합니다. | Restoring this conversation… Retrying if the server is unavailable. |
| app.chat.composer.resume | — → 대기 요청 실행 재개 | Resume |
| app.chat.composer.run_after | — → 실행 뒤 요청 | Run after |
| app.chat.composer.save | — → 저장 | Save |
| app.chat.composer.save_esc_cancel | — → ⌘⏎ 저장 · Esc 취소 | ⌘⏎ save · Esc cancel |
| app.chat.composer.sendHelp | — → ↵로 요청을 보내고 ⇧↵로 줄을 바꿉니다. 실행 중에 보낸 요청은 현재 실행에 지시를 전달합니다. ⌥⏎는 현재 실행 뒤 새 실행을 예약합니다. | Press ↵ to send, ⇧+↵ for a new line. Prompts sent while the agent is busy steer the live run; ⌥⏎ queues a new run instead. |
| app.chat.composer.send_message | — → 요청 보내기 | Send message |
| app.chat.composer.slashMatches | — → 검색 결과 {count}개 | {count, plural, one {# match} other {# matches}} |
| app.chat.composer.snapshotFailed | — → 대화 {count, plural, one {“{name}”의} other {#개의}} 요약본을 저장하지 못했습니다. | Couldn't snapshot {count, plural, one {"{name}"} other {# chats}} |
| app.chat.composer.spend_limit_reached | — → 지출 한도에 도달했습니다. | Spend limit reached |
| app.chat.composer.steerPending | — → 실행 중 지시 입력… (대기 {count}개 · ⌥↵ 현재 실행 뒤 실행) | Steer the run… ({count} pending · ⌥↵ to run after this turn) |
| app.chat.composer.steer_the_run_to_run_after_this | — → 실행 중 지시 입력… (⌥↵ 현재 실행 뒤 새 요청 실행) | Steer the run… (⌥↵ to run after this turn) |
| app.chat.composer.steering_delivers_mid_run | — → 실행 중 지시 전달 | Steering — delivers mid-run |
| app.chat.composer.stop | — → 실행 중단 | Stop |
| app.chat.composer.submit | — → 요청 보내기 | Submit |
| app.chat.composer.subscriptionTokens | — → 구독 · {count} 토큰 | subscription · {count} tok |
| app.chat.composer.subscription_usage | — → 구독 사용량 | Subscription usage |
| app.chat.composer.that_conversation_is_no_longer_available_starting | — → 대화가 더 이상 존재하지 않아 새 대화를 시작합니다. | That conversation is no longer available — starting a new one. |
| app.chat.composer.the_transcription_provider_returned_no_text | — → 음성 변환 제공사가 텍스트를 반환하지 않았습니다. | The transcription provider returned no text. |
| app.chat.composer.thinking | — → 응답을 준비하는 중입니다. | Thinking → Thinking... |
| app.chat.composer.this_browser_cannot_record_audio_for_dictation | — → 브라우저가 음성 입력용 녹음을 지원하지 않습니다. | This browser cannot record audio for dictation. |
| app.chat.composer.this_model_provider_is_disconnected_reconnect_it | — → 모델 제공사가 연결되지 않았습니다. 설정 → 제공사에서 다시 연결하거나 다른 모델을 선택하세요. | This model provider is disconnected. Reconnect it in Settings or choose another model. → This model provider is disconnected. Reconnect it in Settings → Providers or choose another model. |
| app.chat.composer.this_model_provider_is_disconnected_reconnect_it_2 | — → 모델 제공사가 연결되지 않았습니다. 설정에서 다시 연결하거나 다른 모델을 선택하세요. | This model provider is disconnected. Reconnect it in Settings or choose another model. |
| app.chat.composer.this_turn_ended_without_a_closing_message | — → 마무리 응답 없이 실행이 끝났습니다. 위 도구 결과를 확인하거나 요약을 요청하세요. | This turn ended without a closing message. Review the tool results above before continuing, or ask a follow-up for a summary. |
| app.chat.composer.verification_gate | — → 검토 통과 후 수락 | Verification gate |
| app.chat.composer.verify | — → 검토 | verify |
| app.chat.composer.wait_a_moment_for_provider_status_to | — → 제공사 상태를 불러올 때까지 기다리세요. | Wait a moment for provider status to load. |
| app.chat.composer.wait_for_the_agent_to_finish_before | — → AI agent가 요청을 처리한 뒤 새 요청을 추가하세요. | Wait for the agent to finish before adding more prompts. |
| app.chat.composer.wait_for_the_current_run_to_finish | — → 현재 실행이 끝난 뒤 대화를 요약하세요. | Wait for the current run to finish before compacting. |
| app.chat.composer.what_can_i_help_you_with | — → 분석 요청 | What can I help you with? → Analysis request |
| app.chat.compute.cache | — → 캐시 | Cache |
| app.chat.compute.cacheTarget | — → 캐시 {cache} | cache {cache} |
| app.chat.compute.compute | — → 연산 환경 | Compute |
| app.chat.compute.compute_target | — → 연산 환경 | Compute target |
| app.chat.compute.connect_modal_in_settings_services_to_enable | — → 원격 연산을 사용하려면 설정 → 서비스에서 Modal을 연결하세요. | Connect Modal in Settings → Services to enable remote compute |
| app.chat.compute.could_not_refresh_compute_options | — → 연산 환경 목록을 다시 읽지 못했습니다. | Could not refresh compute options: |
| app.chat.compute.create_a_modal_token | — → Modal 토큰 만들기 | Create a Modal token |
| app.chat.compute.current | — → 연산 환경: {name} | Current → Compute target: {name} |
| app.chat.compute.default_sandbox_environment | — → 기본 작업 환경 | Default sandbox environment |
| app.chat.compute.estimate_unavailable | — → 비용 추정 불가 | Estimate unavailable |
| app.chat.compute.fallback | — → 대체 환경 | Fallback |
| app.chat.compute.fallbackTarget | — → 대체 환경 {target} | fallback {target} |
| app.chat.compute.fallback_compute | — → 대체 연산 환경 | Fallback compute |
| app.chat.compute.free | — → 무료 | Free |
| app.chat.compute.gpuCount | — → GPU {count}개 | {count} GPUs |
| app.chat.compute.gpu_count | — → GPU 수 | GPU count |
| app.chat.compute.loading_server_compute_catalog | — → 서버의 연산 환경 목록을 불러오는 중입니다. | Loading server compute catalog… |
| app.chat.compute.local | — → 로컬 | Local |
| app.chat.compute.maxGpus | — → GPU 최대 {count}개 | up to {count} GPUs |
| app.chat.compute.modal_cache | — → Modal 캐시 | Modal cache |
| app.chat.compute.modal_compute | — → Modal 연산 | Modal Compute |
| app.chat.compute.modal_is_not_connected | — → Modal이 연결되지 않았습니다. | Modal is not connected. |
| app.chat.compute.none | — → 없음 | None |
| app.chat.compute.price | — → 시간당 {price} USD (추정) | ${price}/hr est. |
| app.chat.compute.project | — → 프로젝트 | Project |
| app.chat.compute.remote_modal_sandbox | — → 원격 Modal 작업 환경 | Remote Modal sandbox |
| app.chat.compute.retry | — → 다시 읽기 | Retry |
| app.chat.compute.run_code_in_the_built_in_sandbox | — → 내장 작업 환경에서 코드를 실행합니다. Modal 연산은 사용하지 않습니다. | Run code in the built-in sandbox — no Modal compute needed. |
| app.chat.compute.sandbox | — → 작업 폴더 | Sandbox |
| app.chat.compute.save_a_token_id_and_secret_together | — → 다음 설정에서 토큰 ID와 비밀값을 함께 저장하세요. | Save a token ID and secret together in |
| app.chat.compute.saved | — → 저장됨 | saved |
| app.chat.compute.server_default | — → 서버 기본값 | Server default: |
| app.chat.compute.settings_services | — → 설정 → 서비스 | Settings → Services |
| app.chat.compute.the_server_did_not_return_any_modal | — → 서버가 Modal 연산 환경을 반환하지 않았습니다. | The server did not return any Modal compute options. |
| app.chat.connect.add_an_api_key | — → API 키 추가 | Add an API key |
| app.chat.connect.connect_a_model_to_get_started | — → 모델 연결 | Connect a model to get started |
| app.chat.connect.kady_brings_your_own_model_access_sign | — → 보유한 구독으로 로그인하거나 API 키를 추가하거나 로컬 모델을 연결하세요. 인증 정보는 실행 중인 컴퓨터에 저장됩니다. | Kady brings your own model access. Sign in with a subscription you already have, paste an API key, or run a model locally — credentials stay on this machine. → AI agent brings your own model access. Sign in with a subscription you already have, paste an API key, or run a model locally — credentials stay on this machine. |
| app.chat.connect.sign_in_with_a_subscription | — → 구독 계정으로 로그인 | Sign in with a subscription |
| app.chat.connect.use_a_local_model | — → 로컬 모델 연결 | Use a local model |
| app.chat.context.automatic_compaction_and_how_much_recent_context | — → 프로젝트의 모든 대화에 적용할 자동 요약과 최근 context 유지량을 설정합니다. | Automatic compaction and how much recent context it keeps, for every chat in this project. |
| app.chat.context.available_after_the_first_model_response_and | — → 첫 응답 뒤 표시하며 대화 요약 직후에는 잠시 표시하지 않습니다. | Available after the first model response and temporarily unavailable after compaction. |
| app.chat.context.available_once_the_current_run_finishes | — → 현재 실행이 끝나면 사용할 수 있습니다. |  Available once the current run finishes. |
| app.chat.context.compact_context_now | — → 대화 요약 실행 | Compact context now |
| app.chat.context.compact_now | — → 대화 요약 실행 | Compact now |
| app.chat.context.compaction_settings | — → 대화 요약 설정 | Compaction settings |
| app.chat.context.model_context | — → 모델 context | Model context |
| app.chat.context.pi_estimates_how_much_of_the_selected | — → Pi가 대화에서 사용하는 모델 context의 양을 추정합니다. | Pi estimates how much of the selected model's context window this conversation currently uses. |
| app.chat.context.summarize_older_messages_to_free_context_kady | — → 이전 요청을 요약해 context 여유를 확보합니다. 요약 앞에 계획, 연구 노트, 결과 ID, 실행 환경을 보관합니다. | Summarize older messages to free context. Kady keeps a state block (plan, notebook entries, result ids, environment) ahead of the summary. → Summarize older messages to free context. AI agent keeps a state block (plan, notebook entries, result ids, environment) ahead of the summary. |
| app.chat.context.usage | — → {total} 토큰 중 {used} 토큰 ({percent} %) | {used} of {total} tokens ({percent}%) |
| app.chat.context.usageAria | — → 모델 context {percent} %, 전체 {total} 토큰 중 {used} 토큰 | Model context {percent} percent, {used} of {total} tokens |
| app.chat.context.waiting | — → 제공사 측정 대기 · context 길이 {total} 토큰 | Awaiting provider measurement · {total} token window |
| app.chat.context.waitingAria | — → 모델 context 사용량 측정 대기, context 길이 {total} 토큰 | Model context usage awaiting provider measurement, {total} token window |
| app.chat.contextMenu.add_context | — → 참고 자료 추가 | Add context |
| app.chat.contextMenu.add_context_sections | — → 참고 자료 종류 | Add context sections |
| app.chat.contextMenu.attach_files_reference_earlier_research_delegate_to | — → 파일과 이전 연구 기록을 첨부하거나 전문 AI agent, 스킬, 자료 출처를 선택하세요. | Attach files, reference earlier research, delegate to specialists, or enable skills and data sources for the next message. |
| app.chat.contextMenu.data | — → 자료 출처 | Data |
| app.chat.contextMenu.data_sources | — → 자료 출처 | Data sources |
| app.chat.contextMenu.delegate | — → 전문 AI agent에 위임 | Delegate |
| app.chat.contextMenu.fileHelp | — → 자료, 그림, 원고, 코드를 업로드하세요. 작업 폴더에 저장되며 @로 파일을 지정할 수 있습니다. | Upload data, figures, manuscripts, or code. Everything lands in the sandbox and can be referenced with @. |
| app.chat.contextMenu.files | — → 파일 | Files |
| app.chat.contextMenu.hand_this_message_to_specific_specialists_let | — → 전문 AI agent를 지정하거나 AI agent가 선택하도록 합니다. 결과를 수락하기 전에 검토를 요청할 수도 있습니다. 다음 요청에만 적용합니다. | Hand this message to specific specialists, let Kady choose, or ask for a verification gate before a result is accepted. Applies to the next message only. → Hand this message to specific specialists, let AI agent choose, or ask for a verification gate before a result is accepted. Applies to the next message only. |
| app.chat.contextMenu.point_kady_at_notebook_entries_frozen_plans | — → 연구 노트, 확정한 계획, 메모, 이전 대화를 지정하세요. AI agent가 도구로 읽고 응답합니다. 다음 요청에만 적용합니다. | Point Kady at notebook entries, frozen plans, notes, or an earlier chat. It reads them with its own tools before answering. Applies to the next message only. → Point AI agent at notebook entries, frozen plans, notes, or an earlier chat. It reads them with its own tools before answering. Applies to the next message only. |
| app.chat.contextMenu.point_kady_at_public_scientific_apis_pubmed | — → PubMed, UniProt, Ensembl 등 공개 API를 지정하세요. 이름과 URL을 요청에 추가하면 AI agent가 조회하고 인용할 수 있습니다. | Point Kady at public scientific APIs (PubMed, UniProt, Ensembl, etc.). Their names and URLs are added to your message so Kady can query and cite them. → Point AI agent at public scientific APIs (PubMed, UniProt, Ensembl, etc.). Their names and URLs are added to your message so AI agent can query and cite them. |
| app.chat.contextMenu.research | — → 연구 기록 | Research |
| app.chat.contextMenu.research_context | — → 참고할 연구 기록 | Research context |
| app.chat.contextMenu.skills | — → 스킬 | Skills |
| app.chat.contextMenu.skillsHelp | — → scanpy, literature-review, modal 등 작업별 스킬을 선택하세요. 해제할 때까지 모든 요청에 적용합니다. | Opt-in playbooks for specific tasks (e.g. scanpy, literature-review, modal). Kady follows pinned skills on every message until you remove them. → Opt-in playbooks for specific tasks (e.g. scanpy, literature-review, modal). The AI agent follows pinned skills on every message until you remove them. |
| app.chat.contextMenu.uploadHelp | — → 입력창에 끌어 놓아도 첨부할 수 있습니다. @로 작업 폴더의 파일을 지정하세요. | Or drag & drop onto the input. Type @ to mention tracked files. |
| app.chat.contextMenu.upload_a_folder | — → 폴더 업로드 | Upload a folder |
| app.chat.contextMenu.upload_files | — → 파일 업로드 | Upload files |
| app.chat.models.0_available | — → 사용 가능한 모델 없음 | 0 available |
| app.chat.models.billed_to_your_provider_plan_or_credits | — → 제공사의 요금제나 크레딧으로 청구 · 앱에서 비용을 집계하지 않음 | Billed to your provider plan or credits · not metered by Kady → Billed to your provider plan or credits · not metered by AI agent |
| app.chat.models.billed_via_nvidia_api_credits_not_metered | — → NVIDIA API 크레딧으로 청구 · 앱에서 비용을 집계하지 않음 | Billed via NVIDIA API credits · not metered by Kady → Billed via NVIDIA API credits · not metered by AI agent |
| app.chat.models.checking | — → 확인 중… | checking… |
| app.chat.models.compatibleAvailable | — → 사용 가능 {count}개 | {count} available |
| app.chat.models.connect | — → 모델 연결… | Connect → Connect… |
| app.chat.models.disconnected | — → 연결 안 됨 | disconnected |
| app.chat.models.extraPrice | — → 100만 토큰당 입력 {input} / 출력 {output} USD · 추가 사용량 | ${input} in / ${output} out per 1M tok · extra usage |
| app.chat.models.local_ollama | — → 로컬 (Ollama) | Local (Ollama) |
| app.chat.models.local_openai_compatible | — → 로컬 (OpenAI 호환) | Local (OpenAI-compatible) |
| app.chat.models.manage_providers | — → 제공사 설정 열기 | Manage providers |
| app.chat.models.modelCount | — → 모델 {count}개 | {count, plural, one {# model} other {# models}} |
| app.chat.models.models | — → 모델 | Models |
| app.chat.models.noMatch | — → “{query}”에 맞는 모델이 없습니다. | No models match “{query}”. |
| app.chat.models.not_running | — → 실행 안 됨 | not running |
| app.chat.models.ollamaAvailable | — → 사용 가능 {count}개 | {count} available |
| app.chat.models.ollama_is_running_but_no_models_are | — → Ollama가 실행 중이지만 모델이 없습니다. 다음 명령으로 모델을 받으세요. | Ollama is running but no models are pulled. Run |
| app.chat.models.option | — → {provider}의 {model} | {model} by {provider} |
| app.chat.models.price | — → 100만 토큰당 입력 {input} / 출력 {output} USD | ${input} in / ${output} out per 1M tok |
| app.chat.models.providerDisconnected | — → {model} 제공사가 연결되지 않았습니다. | {model}'s provider is not connected. |
| app.chat.models.recommended | — → 추천 | recommended |
| app.chat.models.runs_locally_no_api_cost | — → 로컬 실행 · API 비용 없음 | Runs locally · no API cost |
| app.chat.models.search_models | — → 모델 검색… | Search models... |
| app.chat.models.selectChecking | — → 모델 선택, {model} 제공사 확인 중 | Select model, checking {model} provider |
| app.chat.models.selectCurrent | — → 모델 선택, 현재 {model} | Select model, current {model} |
| app.chat.models.selectDisconnected | — → 모델 선택, 현재 {model} 연결 안 됨 | Select model, current {model} is disconnected |
| app.chat.models.serverHelp | — → OPENAI_COMPATIBLE_BASE_URL에 지정한 서버가 응답하지 않습니다. 설정 → 제공사 → 로컬 모델 서버를 확인하고 LM Studio, vLLM 또는 OpenAI 호환 서버를 시작한 뒤 메뉴를 다시 여세요. | No server answered at OPENAI_COMPATIBLE_BASE_URL (Settings → Providers → Local model servers). Start LM Studio, vLLM, or another OpenAI-compatible server and reopen this menu. |
| app.chat.models.start_ollama_to_use_local_models_then | — → Ollama를 시작하고 모델을 받은 뒤 메뉴를 다시 여세요. | Start Ollama to use local models, then pull a model and reopen this menu. |
| app.chat.models.the_server_is_up_but_serving_no | — → 서버가 실행 중이지만 제공하는 모델이 없습니다. 모델을 불러온 뒤 메뉴를 다시 여세요. | The server is up but serving no models. Load one and reopen this menu. |
| app.chat.models.uses_provider_managed_subscription_limits | — → 제공사의 구독 한도 적용 | Uses provider-managed subscription limits |
| app.chat.tabs.chat_history | — → 대화 기록 | Chat history |
| app.chat.tabs.close | — → {name} 닫기 | Close {name} |
| app.chat.tabs.close_tab | — → 탭 닫기 | Close tab |
| app.chat.tabs.close_tab_this_will_cancel_the_running | — → 탭 닫기 (현재 실행 중단) | Close tab (this will cancel the running turn) |
| app.chat.tabs.days | — → {count}일 전 | {count}d ago |
| app.chat.tabs.download_a_reproducible_record_of_this_chat | — → AI agent가 실행한 명령을 셸 스크립트로 받거나 전체 대화를 연구 노트로 받습니다. | Download a reproducible record of this chat — a runnable shell script of every command the agent ran, or a full lab notebook. |
| app.chat.tabs.every_command_in_order | — → 실행 순서대로 모든 명령 포함 | Every command, in order |
| app.chat.tabs.export | — → 내보내기 | Export |
| app.chat.tabs.export_session | — → 대화 내보내기 | Export session |
| app.chat.tabs.historySummary | — → {time} · 메시지 {count}개 | {time} · {count, plural, one {# message} other {# messages}} |
| app.chat.tabs.hours | — → {count}시간 전 | {count}h ago |
| app.chat.tabs.just_now | — → 방금 | just now |
| app.chat.tabs.lab_notebook_md | — → 연구 노트 (.md) | Lab notebook (.md) |
| app.chat.tabs.loading | — → 불러오는 중입니다. | Loading… |
| app.chat.tabs.maxTabs | — → 대화 탭을 최대 {count}개까지 열 수 있습니다. 새 대화를 열려면 탭 하나를 닫으세요. | You can have up to {count} chat tabs running at once. Close one to open a new one. |
| app.chat.tabs.messageCount | — → 메시지 {count}개 | {count, plural, one {# message} other {# messages}} |
| app.chat.tabs.minutes | — → {count}분 전 | {count}m ago |
| app.chat.tabs.new_chat_tab | — → 새 대화 열기 | New chat tab |
| app.chat.tabs.no_previous_chats_in_this_project_yet | — → 프로젝트에 이전 대화가 없습니다. | No previous chats in this project yet. |
| app.chat.tabs.numbered | — → 대화 {count} | Chat {count} |
| app.chat.tabs.open_another_chat_in_the_same_project | — → 같은 프로젝트에서 새 대화를 엽니다. 작업 파일은 공유하고 대화 기록은 따로 보관합니다. | Open another chat in the same project. All tabs share the same sandbox files but have independent message history. |
| app.chat.tabs.pre_built_scientific_pipelines_e_g_rna | — → 미리 구성된 분석 workflow입니다. 템플릿과 입력 자료를 선택하면 현재 대화에서 실행합니다. | Pre-built scientific pipelines (e.g. RNA-seq, literature review). Pick a template, attach inputs, and launch — they run in the active chat tab. |
| app.chat.tabs.previous_chats | — → 이전 대화 | Previous chats |
| app.chat.tabs.prompts_commands_outputs | — → 요청, 명령, 출력 포함 | Prompts, commands & outputs |
| app.chat.tabs.rename | — → {name} 이름 바꾸기 | Rename {name} |
| app.chat.tabs.renameHint | — → {name} · 두 번 클릭해 이름 바꾸기 | {name} — double-click to rename |
| app.chat.tabs.rename_tab | — → 탭 이름 바꾸기 | Rename tab |
| app.chat.tabs.reopen_a_previous_chat_from_this_project | — → 프로젝트의 이전 대화를 다시 엽니다. 전체 기록을 복원하고 대화를 이어갈 수 있습니다. | Reopen a previous chat from this project — the full transcript is restored and you can continue the conversation. |
| app.chat.tabs.reproducibility_export | — → 재실행용 기록 내보내기 | Reproducibility export |
| app.chat.tabs.shell_script_sh | — → 셸 스크립트 (.sh) | Shell script (.sh) |
| app.chat.tabs.tab_limit_reached | — → 탭 수 한도에 도달했습니다. | Tab limit reached |
| app.chat.tabs.untitled_chat | — → 제목 없는 대화 | Untitled chat |
| app.chat.tabs.workflows | — → workflow | Workflows |
| app.chat.thinking.balanced_reasoning_effort_and_cost | — → 추론량과 비용을 함께 고려합니다. | Balanced reasoning effort and cost. |
| app.chat.thinking.bare_minimum_reasoning_for_models_that_require | — → 추론이 필요한 모델에서 최소한의 추론을 사용합니다. | Bare-minimum reasoning for models that require some. |
| app.chat.thinking.brief_reasoning_for_straightforward_tasks | — → 단순한 작업에 짧은 추론을 사용합니다. | Brief reasoning for straightforward tasks. |
| app.chat.thinking.deep_reasoning_for_hard_problems | — → 어려운 문제에 깊은 추론을 사용합니다. | Deep reasoning for hard problems. |
| app.chat.thinking.high | — → 높음 | High |
| app.chat.thinking.low | — → 낮음 | Low |
| app.chat.thinking.maximum_effort_slowest_most_thorough_most_tokens | — → 최대 추론량을 사용합니다. 시간과 토큰 사용량이 늘어날 수 있습니다. | Maximum effort — slowest, most thorough, most tokens. → Maximum reasoning effort; time and token usage may increase. |
| app.chat.thinking.medium | — → 보통 | Medium |
| app.chat.thinking.minimal | — → 최소 | Minimal |
| app.chat.thinking.no_extended_reasoning_fastest_and_cheapest | — → 확장 추론을 사용하지 않습니다. | No extended reasoning — fastest and cheapest. → No extended reasoning. |
| app.chat.thinking.off | — → 사용 안 함 | Off |
| app.chat.thinking.thinking | — → 추론량 | Thinking |
| app.chat.thinking.this_model_doesn_t_support_adjustable_thinking | — → 모델이 추론량 조절을 지원하지 않습니다. | This model doesn't support adjustable thinking |
| app.chat.thinking.xhigh | — → 매우 높음 | XHigh |
| app.chat.tools.check_subagent_status | — → 하위 AI agent 상태 조회 | check subagent status |
| app.chat.tools.command | — → 명령 | Command |
| app.chat.tools.durable_compute_activity | — → 연산 작업 활동 | Durable compute activity |
| app.chat.tools.entry | — → 기록 | Entry |
| app.chat.tools.error | — → 오류 | Error |
| app.chat.tools.input | — → 입력 | Input |
| app.chat.tools.interrupt_subagent | — → 하위 AI agent 실행 중단 | interrupt subagent |
| app.chat.tools.list_agents | — → AI agent 목록 조회 | list agents |
| app.chat.tools.notebookTitle | — → 연구 노트 · {title} | Notebook · {title} |
| app.chat.tools.notebookType | — → 연구 노트 · {type} | Notebook · {type} |
| app.chat.tools.open_compute | — → 연산 환경 열기 | Open Compute |
| app.chat.tools.output | — → 출력 | Output |
| app.chat.tools.reasoning | — → 추론 | Reasoning |
| app.chat.tools.submitting_durable_compute | — → 연산 작업을 제출하는 중입니다. | Submitting durable compute… |
| app.chat.tools.view_in_notebook | — → 연구 노트에서 보기 | View in notebook |
| app.chat.tools.view_job | — → 연산 작업 보기 | View job |
| app.chat.tools.wait_for_subagents | — → 하위 AI agent 대기 | wait for subagents |
| app.chat.tools.workflow_script | — → workflow 스크립트 | workflow script |
| app.description | — → AI agent를 Geoscience 자료, 분야별 스킬, 분석 workflow와 연결하는 오픈소스 프레임워크입니다. | Multi-agent research assistant → An open source framework that connects AI agents to geoscience data, domain skills and analysis workflows. |
| app.files.add_data_to_the_sandbox_folders_preserve | — → 작업 폴더에 자료를 추가합니다. 폴더 구조를 유지하며, 패널에 끌어 놓아도 업로드됩니다. | Add data to the sandbox. Folders preserve their structure. Drag-and-drop anywhere in this panel also works. |
| app.files.ask_the_agent_to_tidy_the_sandbox | — → AI agent에 파일 정리를 요청합니다. 원본 자료, 그림, 연구 노트, 결과별로 폴더를 만들며 파일은 삭제하지 않습니다. | Ask the agent to tidy the sandbox — group related files into folders (raw data, figures, notebooks, results). Does not delete anything. |
| app.files.auto_organize_files | — → AI agent로 파일 정리 | Auto-organize files |
| app.files.cancel | — → 취소 | Cancel |
| app.files.close_sandbox_panel | — → 작업 폴더 패널 닫기 | Close sandbox panel |
| app.files.create_a_subdirectory_at_the_sandbox_root | — → 작업 폴더의 최상위에 하위 폴더를 만듭니다. 파일을 폴더 사이로 끌어 옮길 수도 있습니다. | Create a subdirectory at the sandbox root. You can also drag files between folders to organize them. |
| app.files.delete | — → {name} 삭제 | Delete → Delete {name} |
| app.files.download | — → {name} 받기 | Download → Download {name} |
| app.files.downloadZip | — → {name} ZIP 받기 | Download {name} as zip |
| app.files.download_all_as_zip | — → 전체 파일 ZIP 받기 | Download all as zip |
| app.files.drop_files_or_folders_here_or_use | — → 파일이나 폴더를 놓거나 업로드 버튼으로 추가하세요. | Drop files or folders here, or use the upload button |
| app.files.drop_files_or_folders_to_upload | — → 파일이나 폴더를 놓아 업로드하세요. | Drop files or folders to upload |
| app.files.files | — → 파일 | Files |
| app.files.folder_name | — → 폴더 이름 | Folder name |
| app.files.hide_the_sandbox_panel | — → 작업 폴더 패널 숨기기 | Hide the sandbox panel |
| app.files.new_folder | — → 폴더 만들기 | New folder |
| app.files.new_folder_inside | — → 하위 폴더 만들기 | New folder inside |
| app.files.no_files_yet | — → 파일이 없습니다. | No files yet |
| app.files.organize_files | — → 파일 정리 실행 | Organize files |
| app.files.organize_the_sandbox_with_kady | — → AI agent로 파일 정리 | Organize the sandbox with Kady? → Organize files with the AI agent |
| app.files.refresh | — → 파일 목록 새로 읽기 | Refresh |
| app.files.reload_the_file_tree_from_disk_useful | — → 디스크에서 파일 목록을 다시 읽습니다. 앱 밖에서 파일을 수정했을 때 사용하세요. | Reload the file tree from disk. Useful if you edited files outside of Kady. → Reload the file tree from disk. Useful if you edited files outside of AI agent. |
| app.files.rename | — → {name} 이름 바꾸기 | Rename {name} |
| app.files.sandbox | — → 작업 폴더 | Sandbox |
| app.files.sandbox_files | — → 작업 폴더의 파일 | Sandbox files |
| app.files.shared_working_directory_the_agent_can_read | — → AI agent가 파일을 읽고 쓰는 프로젝트의 작업 폴더입니다. 파일이나 폴더를 놓거나 업로드하세요. 대화가 끝나도 파일은 유지됩니다. | Shared working directory the agent can read from and write to. Drop files/folders here or upload — they persist across turns in this project. |
| app.files.starts_a_run_in_the_active_chat | — → 현재 대화의 모델로 실행을 시작합니다. AI agent가 폴더 구성을 제안하고 파일을 옮긴 뒤 스크립트와 연구 노트의 참조 경로를 수정합니다. 파일은 삭제하지 않습니다. | Starts a run in the active chat with its current model. Kady proposes a folder layout, moves files into it (nothing is deleted), and updates paths in scripts and notebooks that referenced the moved files. → Starts a run in the active chat with its current model. AI agent proposes a folder layout, moves files into it (nothing is deleted), and updates paths in scripts and notebooks that referenced the moved files. |
| app.files.upload_files | — → 파일 업로드 | Upload files |
| app.files.upload_files_or_folder | — → 파일·폴더 업로드 | Upload files or folder |
| app.files.upload_folder | — → 폴더 업로드 | Upload folder |
| app.files.zipHelp | — → 작업 폴더 전체를 ZIP으로 묶어 보관하거나 공동 연구자와 공유할 수 있습니다. | Package the entire sandbox into a .zip for archiving, sharing with collaborators, or your lab notebook. |
| app.header.a_newer_version_is_available_on_github | — → GitHub에 새 버전이 있습니다. 릴리스 페이지를 여세요. | A newer version is available on GitHub. Click to open the release page. |
| app.header.attribution | — → K-Dense BYOK 기반 (MIT) | Brought to you by K-Dense, Inc. → Based on K-Dense BYOK (MIT) |
| app.header.back_to_projects | — → 프로젝트 목록 열기 | Back to projects |
| app.header.checking_compute_jobs | — → 연산 작업을 확인하는 중입니다. | Checking compute jobs |
| app.header.collapse_the_left_file_tree_to_widen | — → 왼쪽 파일 목록을 접어 편집기와 미리보기 영역을 넓힙니다. | Collapse the left file tree to widen the editor and preview. |
| app.header.collapse_the_right_chat_panel_to_widen | — → 오른쪽 대화를 접어 편집기와 미리보기 영역을 넓힙니다. | Collapse the right chat panel to widen the editor and preview. |
| app.header.computeRunning | — → Modal 연산 작업 {count}개가 실행 중입니다. 연산 환경에서 실시간 출력을 확인하세요. | {count, plural, one {# Modal compute job is} other {# Modal compute jobs are}} still running. Open Compute to inspect live logs. |
| app.header.couldn_t_find_this_entry_in_the | — → 대화에서 해당 기록을 찾지 못했습니다. | Couldn't find this entry in the chat transcript. |
| app.header.hide_chat | — → 대화 숨기기 | Hide chat |
| app.header.hide_file_browser | — → 파일 목록 숨기기 | Hide file browser |
| app.header.model_providers_and_defaults_this_project_s | — → 모델 제공사와 기본값, 프로젝트 예산, 스킬과 전문 AI agent, 웹 검색과 Modal 서비스를 설정합니다. | Model providers and defaults, this project's budget, skills and specialists, and services like web search and Modal. |
| app.header.openCompute | — → 연산 환경 열기, 실행 중 {count}개 | Open Compute, {count} active jobs |
| app.header.open_settings | — → 설정 열기 | Open Settings → Open settings |
| app.header.productName | — → GeoAIDesk | K-Dense BYOK → GeoAIDesk |
| app.header.settings | — → 설정 | Settings |
| app.header.shortName | — → GAID | BYOK → GAID |
| app.header.show_chat | — → 대화 표시 | Show chat |
| app.header.show_file_browser | — → 파일 목록 표시 | Show file browser |
| app.header.switch_to_dark_mode | — → 어두운 테마로 변경 | Switch to dark mode |
| app.header.switch_to_light_mode | — → 밝은 테마로 변경 | Switch to light mode |
| app.header.update_available | — → 새 버전 있음 | Update available |
| app.header.version | — → GeoAIDesk v{version} | K-Dense BYOK v{version} → GeoAIDesk v{version} |
| app.loading | — → GeoAIDesk를 불러오는 중입니다. | Loading… → Loading GeoAIDesk. |
| app.preview.annotate | — → 주석 | Annotate |
| app.preview.annotate_with_red_marker | — → 빨간 펜으로 표시 | Annotate with red marker |
| app.preview.automation | — → 자동 실행 | Automation |
| app.preview.cancel | — → 취소 | Cancel |
| app.preview.clear | — → 값 지우기 | Clear |
| app.preview.click_a_file_in_the_sidebar_to | — → 파일 목록에서 열 파일을 선택하세요. | Click a file in the sidebar to open it |
| app.preview.close_tab | — → 탭 닫기 | Close tab |
| app.preview.compute | — → 연산 환경 | Compute |
| app.preview.confirm.discard | — → {name} 파일의 저장하지 않은 변경을 버립니까? | Discard → Discard unsaved changes to {name}? |
| app.preview.could_not_load_file | — → 파일을 불러오지 못했습니다. | Could not load file |
| app.preview.download | — → 파일 받기 | Download |
| app.preview.edit | — → 편집 | Edit |
| app.preview.edit_file | — → 파일 편집 | Edit file |
| app.preview.in_edit_mode | — → 편집 중 | In edit mode |
| app.preview.lab_notebook | — → 연구 노트 | Lab Notebook |
| app.preview.loading | — → 불러오는 중입니다. | Loading… |
| app.preview.loading_editor | — → 편집기를 불러오는 중입니다. | Loading editor… |
| app.preview.loading_latex_editor | — → LaTeX 편집기를 불러오는 중입니다. | Loading LaTeX editor… |
| app.preview.modal_compute | — → Modal 연산 | Modal Compute |
| app.preview.no_file_selected | — → 선택한 파일이 없습니다. | No file selected |
| app.preview.provenance | — → 생성 기록 | Provenance |
| app.preview.retry | — → 다시 읽기 | Retry |
| app.preview.save | — → 저장 | Save |
| app.preview.saving | — → 저장 중… | Saving… |
| app.preview.schedules_and_missions | — → 예약 실행과 장기 작업 | Schedules and missions |
| app.preview.unknown_error | — → 원인을 확인하지 못한 오류 | Unknown error |
| app.preview.where_this_file_came_from | — → 파일의 생성 과정 보기 | Where this file came from |
| app.projects.actions | — → {name} 프로젝트 동작 | Project actions for {name} |
| app.projects.all_project_data_stays_on_this_machine | — → 프로젝트 자료는 실행 중인 컴퓨터에 저장됩니다. | All project data stays on this machine. |
| app.projects.archive | — → 프로젝트 보관 | Archive |
| app.projects.archived | — → 보관한 프로젝트 | Archived |
| app.projects.archivedToggle | — → 보관한 프로젝트 {count}개 {state, select, hide {숨기기} other {표시}} | {state, select, hide {Hide} other {Show}} archived projects ({count}) |
| app.projects.blocked | — → 실행 차단 | Blocked |
| app.projects.blockedCount | — → 실행 차단 {count}개 | {count} blocked |
| app.projects.budget | — → 지출 한도 {amount} | {amount} budget |
| app.projects.choose_a_project | — → 프로젝트 선택 | Choose a project |
| app.projects.clear_project_search | — → 프로젝트 검색어 지우기 | Clear project search |
| app.projects.confirm.delete | — → “{name}” 프로젝트를 삭제합니까? | Delete → Delete "{name}"? |
| app.projects.could_not_delete_project | — → 프로젝트를 삭제하지 못했습니다. | Could not delete project |
| app.projects.could_not_update_project | — → 프로젝트를 수정하지 못했습니다. | Could not update project |
| app.projects.create.cancel | — → 취소 | Cancel |
| app.projects.create.comma_separated | — → 쉼표로 구분 | (comma separated) |
| app.projects.create.create_failed | — → 프로젝트를 만들지 못했습니다. | Create failed |
| app.projects.create.create_project | — → 프로젝트 만들기 | Create project |
| app.projects.create.creating | — → 프로젝트를 만드는 중… | Creating… |
| app.projects.create.description | — → 설명 | Description |
| app.projects.create.each_project_has_its_own_sandbox_chat | — → 프로젝트마다 작업 폴더, 대화 기록, 설정을 따로 보관합니다. 설정 → 프로젝트에서 나중에 바꿀 수 있습니다. | Each project has its own sandbox, chat history and settings. You can change everything later in Settings → Project. |
| app.projects.create.genomics_proteomics | — → 시추공, 지화학 | genomics, proteomics |
| app.projects.create.leave_empty_for_no_limit | — → 한도가 없으면 비워 두세요. | Leave empty for no limit |
| app.projects.create.name | — → 이름 | Name |
| app.projects.create.name_is_required | — → 프로젝트 이름을 입력하세요. | Name is required |
| app.projects.create.new_project | — → 프로젝트 만들기 | New project |
| app.projects.create.optional_one_line_summary | — → 한 줄 설명을 입력하세요. 비워 두어도 됩니다. | Optional one-line summary. |
| app.projects.create.rna_seq_pilot | — → 시추공 자료 분석 | RNA-seq pilot |
| app.projects.create.spend_limit | — → 지출 한도 | Spend limit |
| app.projects.create.spend_limit_must_be_a_non_negative | — → 지출 한도에 0 이상의 숫자를 입력하세요. 한도가 없으면 비워 두세요. | Spend limit must be a non-negative number (or empty) |
| app.projects.create.tags | — → 태그 | Tags |
| app.projects.create.usd_optional | — → USD, 선택 사항 | (USD, optional) |
| app.projects.createNamed | — → “{name}” 프로젝트 만들기 | Create “{name}” |
| app.projects.create_your_first_project_to_start_researching | — → 분석할 자료를 보관할 프로젝트를 만드세요. | Create your first project to start researching. |
| app.projects.current | — → 현재 프로젝트 | Current |
| app.projects.currentName | — → 프로젝트: {name} | Project: {name} |
| app.projects.delete | — → 삭제 | Delete |
| app.projects.delete_project | — → 프로젝트 삭제 | Delete project |
| app.projects.done | — → 실행 완료 | Done |
| app.projects.each_project_keeps_its_files_chats_notebook | — → 프로젝트별로 파일, 대화, 연구 노트, 연구 설정을 따로 보관합니다. | Each project keeps its files, chats, notebook, and research settings separate. |
| app.projects.error | — → 오류 | Error |
| app.projects.errors | — → 오류 {count}개 | {count} errors |
| app.projects.its_sandbox_files_and_chats_will_be | — → 프로젝트의 파일과 대화를 영구 삭제합니다. 삭제한 자료는 복구할 수 없습니다. | Its sandbox files and chats will be permanently removed. This cannot be undone. |
| app.projects.loading_projects | — → 프로젝트를 불러오는 중입니다. | Loading projects… |
| app.projects.needsInput | — → 입력 필요 {count}개 | {count} need your input |
| app.projects.needs_attention | — → 확인이 필요한 프로젝트 | Needs attention |
| app.projects.needs_your_input | — → 입력 필요 | Needs your input |
| app.projects.new_project | — → 프로젝트 만들기 | New project |
| app.projects.no_active_projects_match_your_search | — → 검색 조건에 맞는 활성 프로젝트가 없습니다. | No active projects match your search. |
| app.projects.no_description_yet | — → 설명이 없습니다. | No description yet. |
| app.projects.no_projects | — → 프로젝트가 없습니다. | No projects. |
| app.projects.no_recent_activity | — → 최근 활동 없음 | No recent activity |
| app.projects.open | — → 프로젝트 열기 | Open |
| app.projects.openNamed | — → {name} 프로젝트 열기 | Open project {name} |
| app.projects.open_settings | — → 설정 열기 | Open Settings → Open settings |
| app.projects.project_activity | — → 프로젝트 활동 | Project activity |
| app.projects.project_name | — → 프로젝트 이름 | Project name |
| app.projects.project_settings | — → 프로젝트 설정… | Project settings… |
| app.projects.projects | — → 프로젝트 | Projects |
| app.projects.projects_could_not_be_loaded | — → 프로젝트를 불러오지 못했습니다. | Projects could not be loaded |
| app.projects.recent_activity | — → 최근 활동 | Recent activity |
| app.projects.running | — → 실행 중 | Running |
| app.projects.runningCount | — → 실행 중 {count}개 | {count} running |
| app.projects.search_projects | — → 프로젝트 검색 | Search projects… → Search projects |
| app.projects.search_projects_2 | — → 프로젝트 검색… | Search projects… |
| app.projects.settingsFor | — → {name} 프로젝트 설정 | Settings for {name} |
| app.projects.sort_projects | — → 프로젝트 정렬 | Sort projects |
| app.projects.switch_to_dark_mode | — → 어두운 테마로 변경 | Switch to dark mode |
| app.projects.switch_to_light_mode | — → 밝은 테마로 변경 | Switch to light mode |
| app.projects.switcher.archive | — → 프로젝트 보관 | Archive |
| app.projects.switcher.delete_project | — → 프로젝트 삭제 | Delete project |
| app.projects.switcher.its_sandbox_files_and_chats_will_be | — → 프로젝트의 파일과 대화를 영구 삭제합니다. 삭제한 자료는 복구할 수 없습니다. | Its sandbox files and chats will be permanently removed. This cannot be undone. |
| app.projects.switcher.new_project | — → 프로젝트 만들기… | New project → New project… |
| app.projects.switcher.no_projects_found | — → 조건에 맞는 프로젝트가 없습니다. | No projects found. |
| app.projects.switcher.project_settings | — → 프로젝트 설정 | Project settings… → Project settings |
| app.projects.switcher.projects_isolate_sandbox_files_and_chat_history | — → 프로젝트별로 작업 파일과 대화 기록을 분리합니다. 다른 연구를 시작할 때 프로젝트를 바꾸세요. | Projects isolate sandbox files and chat history. Switch projects to work on a different experiment without crosstalk. |
| app.projects.switcher.search_or_name_a_new_project | — → 프로젝트 검색 또는 새 이름 입력… | Search or name a new project… |
| app.projects.switcher.switch_project | — → 프로젝트 전환 | Switch project |
| app.projects.switcher.unarchive | — → 프로젝트 보관 해제 | Unarchive |
| app.projects.switcher.view_all_projects | — → 모든 프로젝트 보기 | View all projects |
| app.projects.try_again | — → 다시 불러오기 | Try again |
| app.projects.unarchive | — → 프로젝트 보관 해제 | Unarchive |
| app.projects.updatedDate | — → {date} 수정 | Updated {date} |
| app.projects.updatedDays | — → {count}일 전 수정 | Updated {count} days ago |
| app.projects.updated_today | — → 오늘 수정 | Updated today |
| app.projects.updated_yesterday | — → 어제 수정 | Updated yesterday |
| app.result.adjusted_p | — → 보정 p-value | Adjusted p |
| app.result.artifacts | — → 결과 파일 | Artifacts |
| app.result.atoms | — → 원자 수 | Atoms |
| app.result.bonds | — → 결합 수 | Bonds |
| app.result.citations | — → 인용 문헌 | Citations |
| app.result.columns | — → {count}열 | {count} columns |
| app.result.dataset_schema | — → 자료 구조 | Dataset schema |
| app.result.df | — → 자유도 | df |
| app.result.effect_size | — → 효과 크기 | Effect size |
| app.result.estimate | — → 추정값 | Estimate |
| app.result.expected | — →  · 기준값 {value} |  · expected {value} |
| app.result.fail | — → 실패 | Fail |
| app.result.field | — → 필드 | Field |
| app.result.formula | — → 분자식 | Formula |
| app.result.image | — → 도구 결과 이미지 {index} | Tool result image {index} |
| app.result.imagesOmitted | — → 표시 한도로 이미지 {count}개를 생략했습니다. | {count, plural, one {# image} other {# images}} omitted by display limits. |
| app.result.missing | — → 결측값 | Missing |
| app.result.molecular_weight | — → 분자량 | Molecular weight |
| app.result.molecule | — → 분자 | Molecule |
| app.result.molecule_structure | — → 분자 구조 | Molecule structure |
| app.result.openArtifact | — → {path} 열기 | Open {path} |
| app.result.openCitation | — → 인용 문헌 {id} 열기 | Open citation {id} |
| app.result.p_value | — → p-value | p-value |
| app.result.pass | — → 통과 | Pass |
| app.result.plot | — → 그래프 | Plot |
| app.result.qc_report | — → QC 결과 | QC report |
| app.result.raw_tool_details | — → 원본 도구 상세 | Raw tool details |
| app.result.related_files | — → 관련 파일 | Related files |
| app.result.rows | — → {count}행 | {count} rows |
| app.result.shownRows | — → 전체 {total}행 중 {shown}행 표시 | Showing {shown} of {total} rows. |
| app.result.statistic | — → 통계량 | Statistic |
| app.result.statistical_test | — → 통계 검정 | Statistical test |
| app.result.structured_agent_output_not_independently_verified | — → AI agent의 구조화된 출력 · 독립 검토 전 | Structured agent output · not independently verified |
| app.result.table | — → 표 | Table |
| app.result.type | — → 형식 | Type |
| app.result.unique | — → 고유값 | Unique |
| app.result.unit | — → 단위 | Unit |
| app.result.warning | — → 확인 필요 | Warning |
| app.settings.appearance | — → 화면 표시 | Appearance |
| app.settings.appearance.appearance | — → 화면 표시 | Appearance |
| app.settings.appearance.auto | — → 자동 (브라우저 언어) | Automatic (browser language) |
| app.settings.appearance.choose_how_k_dense_byok_looks_system | — → GeoAIDesk의 테마를 선택하세요. 시스템 테마는 운영체제 설정을 따릅니다. 브라우저에 저장합니다. | Choose how K-Dense BYOK looks. System follows your operating system's theme. Saved in this browser. → Choose how GeoAIDesk looks. System follows your operating system's theme. Saved in this browser. |
| app.settings.appearance.dark | — → 어두운 테마 | Dark |
| app.settings.appearance.english | — → English | English |
| app.settings.appearance.korean | — → 한국어 | 한국어 |
| app.settings.appearance.language | — → 언어 / Language | Language / 언어 |
| app.settings.appearance.light | — → 밝은 테마 | Light |
| app.settings.appearance.system | — → 시스템 테마 | System |
| app.settings.connectors | — → 커넥터 | Connectors |
| app.settings.credentials.clear | — → 값 지우기 | Clear |
| app.settings.credentials.clearField | — → {label} 지우기 | Clear {label} |
| app.settings.credentials.confirm.remove | — → {label}을 삭제합니까? | Remove → Remove the {label}? |
| app.settings.credentials.failed_to_load_credentials | — → 인증 정보를 불러오지 못했습니다. | Failed to load credentials |
| app.settings.credentials.get_a_key | — → API 키 발급 | Get a key |
| app.settings.credentials.key_set | — → 키 저장됨 | Key set |
| app.settings.credentials.loadFailed | — → 불러오지 못했습니다 ({status}). | Failed to load ({status}) |
| app.settings.credentials.new_requests_that_rely_on_it_will | — → 키를 다시 추가할 때까지 해당 키를 사용하는 새 요청은 실행되지 않습니다. | New requests that rely on it will fail until you add a key again. |
| app.settings.credentials.opensHost | — → 새 탭에서 {host} 열기 | Opens {host} in a new tab |
| app.settings.credentials.opensService | — → {host}의 {label}{service, select, none {} other { ({service})}}, 새 탭에서 열기 | {label}{service, select, none {} other { ({service})}} at {host}, opens in a new tab |
| app.settings.credentials.remove | — → 키 삭제 | Remove |
| app.settings.credentials.replace | — → {kind, select, key {키} other {값}} 교체{example, select, none {} other { ({example})}} | Replace {kind}{example, select, none {} other { ({example})}} |
| app.settings.credentials.save | — → 저장 | Save |
| app.settings.credentials.saveFailed | — → 저장하지 못했습니다 ({status}). | Save failed ({status}) |
| app.settings.credentials.save_failed | — → 설정을 저장하지 못했습니다. | Save failed |
| app.settings.credentials.saved_new_runs_use_it_immediately_no | — → 저장했습니다. 다시 시작하지 않아도 새 실행부터 적용합니다. | Saved. New runs use it immediately — no restart needed. |
| app.settings.credentials.saving | — → 저장 중… | Saving… |
| app.settings.credentials.set | — → 저장됨 | Set |
| app.settings.defaults | — → 기본값 | Defaults |
| app.settings.defaults.applies_to | — → 적용 대상: | Applies to: |
| app.settings.defaults.built_in_order | — → 내장 순서 | built-in order |
| app.settings.defaults.compute | — → 연산 환경 | Compute |
| app.settings.defaults.connected | — → 연결됨 | Connected |
| app.settings.defaults.default_image_model | — → 기본 이미지 모델 | Default image model |
| app.settings.defaults.default_model | — → 기본 모델 | Default model |
| app.settings.defaults.defaults_for_new_chats | — → 새 대화 기본값 | Defaults for new chats |
| app.settings.defaults.discard | — → 변경 취소 | Discard |
| app.settings.defaults.failed_to_load_defaults | — → 기본값을 불러오지 못했습니다. | Failed to load defaults |
| app.settings.defaults.failed_to_load_image_models | — → 이미지 모델을 불러오지 못했습니다. | Failed to load image models |
| app.settings.defaults.imageDisconnected | — → 모델 제공사가 연결되지 않아 앱 기본 모델을 사용합니다. 제공사를 연결하면 선택한 모델을 사용합니다. | This model's provider is not connected, so the app uses its built-in default until you connect it. |
| app.settings.defaults.imageFallback | — → 지정 안 함 · 앱 기본값 ({model}) | Not set — Kady's default ({model}) → Not set — app default ({model}) |
| app.settings.defaults.imageFallbackOrder | — → 지정 안 함 · 앱 기본값{models, select, none {} other { ({models})}} | Not set — Kady's default ({models}) → Not set — app default{models, select, none {} other { ({models})}} |
| app.settings.defaults.imagePrice | — → 100만 토큰당 입력 {input} · 출력 {output}{editing, select, yes { · 이미지 편집 지원} other {}} | {input} in · {output} out per M tokens{editing, select, yes { · edits images} other {}} |
| app.settings.defaults.image_generation | — → 이미지 생성 | Image generation |
| app.settings.defaults.image_model | — → 이미지 모델 | Image model |
| app.settings.defaults.intro | — → 프로젝트의 첫 대화에 적용할 기본값입니다. 기존 대화 옆에 연 새 대화는 기존 대화의 설정을 복사합니다. 예약 실행과 시스템 실행은 프로젝트의 최근 대화 모델을 사용하며, 없으면 기본값을 사용합니다. 전문 AI agent의 기본값은 별도 설정에서 지정합니다. | Defaults for a project's first chat. A tab opened next to an existing one copies that tab's choices. Scheduled and system runs use the project's latest chat model, falling back to these defaults. Specialists have separate settings. |
| app.settings.defaults.loading | — → 불러오는 중입니다. | Loading… |
| app.settings.defaults.model | — → 모델 | Model |
| app.settings.defaults.modelFallback | — → 지정 안 함 · 앱 기본값 (환경 설정의 DEFAULT_MODEL_* 또는 {model}) | Not set — Kady's default ({model} unless DEFAULT_MODEL_* is set in .env) → Not set — app default ({model} unless DEFAULT_MODEL_* is set in the environment configuration file) |
| app.settings.defaults.new_chat | — → 새 대화 | New chat |
| app.settings.defaults.not_connected | — → 연결 안 됨 | Not connected |
| app.settings.defaults.not_set_verifiers_run_on_the_same | — → 지정 안 함 · 다른 전문 AI agent와 같은 모델 사용 | Not set — verifiers run on the same model as other specialists |
| app.settings.defaults.pick_a_model_you_have_access_to | — → 사용 가능한 모델을 선택하세요. 연결하지 않은 모델을 기본값으로 선택하면 새 프로젝트에서 실행할 수 없습니다. | Pick a model you have access to — a disconnected default makes every new project start on a model that cannot run. |
| app.settings.defaults.providers | — → 제공사 | Providers |
| app.settings.defaults.remoteHelp | — → 원격 연산에는 Modal 연결이 필요합니다. 연결하지 않으면 로컬 작업 환경을 사용합니다. | Remote targets need Modal connected; runs fall back to the local sandbox otherwise. |
| app.settings.defaults.save_defaults | — → 기본값 저장 | Save defaults |
| app.settings.defaults.save_failed | — → 설정을 저장하지 못했습니다. | Save failed |
| app.settings.defaults.saved_a_project_s_next_first_chat | — → 저장했습니다. 프로젝트의 첫 대화에 적용하며 이미지 모델과 검토 모델은 바로 적용합니다. | Saved. A project's next first chat starts with these; the image and verifier models apply right away. |
| app.settings.defaults.saving | — → 저장 중… | Saving… |
| app.settings.defaults.services | — → 서비스 | Services |
| app.settings.defaults.specialists | — → 전문 AI agent | Specialists |
| app.settings.defaults.specialists_that_check_work_run_on_this | — → 작업을 검토하는 전문 AI agent가 사용할 모델입니다. 모델을 직접 지정한 전문 AI agent는 기존 모델을 유지합니다. 열린 대화에서도 다음 위임부터 적용합니다. 검토 실행 비용도 프로젝트 지출 한도에 포함합니다. | Specialists that check work run on this model, so a result is reviewed by a different model than the one that produced it. A specialist that pins its own model keeps it. Applies to the next delegation, including in open chats; verifier runs count toward the project spend cap like any other. → The specialists that check work use this model. Specialists that pin their own model keep it. Applies to the next delegation, including in open chats; verifier runs count toward the project spend cap like any other. |
| app.settings.defaults.thinking_level | — → 추론량 | Thinking level |
| app.settings.defaults.used_when_kady_generates_figures_and_schematics | — → 대화에서 다른 모델을 요청하지 않으면 그림과 도식을 생성할 때 사용합니다. 토큰 단위 요금 모델만 표시하며 이미지 생성 비용은 프로젝트 지출 한도에 포함합니다. 열린 대화에도 바로 적용합니다. | Used when Kady generates figures and schematics, unless you ask for another model in chat. Only models priced per token are listed, so every image counts toward the project spend cap. Applies right away, including to open chats. → Used when AI agent generates figures and schematics, unless you ask for another model in chat. Only models priced per token are listed, so every image counts toward the project spend cap. Applies right away, including to open chats. |
| app.settings.defaults.verification | — → 검토 | Verification |
| app.settings.defaults.verifierDisconnected | — → 모델 제공사가 연결되지 않아 검토용 AI agent는 기존 모델을 유지합니다. 제공사를 연결하면 선택한 모델을 사용합니다. | This model's provider is not connected, so verifiers keep their usual model until you connect it. |
| app.settings.defaults.verifier_model | — → 검토 모델 | Verifier model |
| app.settings.drag_to_resize_double_click_to_reset | — → 끌어서 크기 조절 · 두 번 클릭해 초기화 | Drag to resize · double-click to reset |
| app.settings.effect.immediately | — → 다시 시작하지 않아도 바로 적용합니다. | Changes apply immediately — no restart needed. |
| app.settings.effect.live-chats | — → 열린 대화에도 바로 적용합니다. | Changes apply immediately, including in open chats. |
| app.settings.effect.new-chats | — → 새 대화 탭부터 적용합니다. 열린 대화는 시작할 때의 설정을 유지합니다. | Changes apply to new chat tabs; open chats keep what they started with. |
| app.settings.fusion | — → Fusion | Fusion |
| app.settings.general | — → 일반 | General |
| app.settings.loading_settings | — → 설정을 불러오는 중입니다. | Loading settings… |
| app.settings.model.choose_a_model | — → 모델 선택 | Choose a model |
| app.settings.model.disconnected | — → 연결 안 됨 | disconnected |
| app.settings.model.typeId | — → {label} 모델 ID 입력 | Type a model id for {label} |
| app.settings.model.type_a_model_id | — → 모델 ID 직접 입력 | Type a model id |
| app.settings.models | — → 모델 | Models |
| app.settings.models_this_project_and_the_services_kady | — → 모델, 프로젝트, 연결 서비스를 설정합니다. | Models, this project, and the services Kady connects to. → Models, this project, and the services AI agent connects to. |
| app.settings.otherProject | — → 현재 프로젝트 {active}를 표시합니다. {target} 프로젝트의 스킬, 프롬프트 템플릿, 전문 AI agent, 커넥터를 수정하려면 해당 프로젝트를 여세요. | Showing the current project, {active}. Open {target} to edit its skills, prompt templates, specialists and connectors. |
| app.settings.project | — → 프로젝트 | Project |
| app.settings.prompt_templates | — → 프롬프트 템플릿 | Prompt templates |
| app.settings.providers | — → 제공사 | Providers |
| app.settings.providers.add_a_provider | — → 제공사 연결 | Add a provider |
| app.settings.providers.all | — → 전체 | All |
| app.settings.providers.api_key | — → API 키 | API key |
| app.settings.providers.base_url | — → 서버 기본 URL | Base URL |
| app.settings.providers.billingNote | — → 제공사 구독에는 별도의 사용 한도와 초과 요금 규칙이 있습니다. Anthropic이 명시한 추가 종량제 사용을 제외하면 앱은 구독 토큰을 기록하되 프로젝트 지출에는 포함하지 않습니다. | Provider subscriptions have their own quotas and overage rules. Except for Anthropic's documented metered extra usage, Kady records tokens but does not treat provider-managed subscription usage as project spend. → Provider subscriptions have their own quotas and overage rules. Except for Anthropic's documented metered extra usage, the app records tokens but does not treat provider-managed subscription usage as project spend. |
| app.settings.providers.compatibleHint | — → /v1/models를 제공하는 LM Studio, vLLM, llama.cpp server, text-generation-webui 등을 연결합니다. vLLM 기본 포트 8000은 앱 백엔드와 겹치므로 둘 중 하나의 포트를 바꾸세요. | LM Studio, vLLM, llama.cpp server, text-generation-webui — anything serving /v1/models. vLLM's default port (8000) collides with Kady's backend, so move one of them. → Connect LM Studio, vLLM, llama.cpp server, text-generation-webui, or another /v1/models server. vLLM's default port (8000) collides with the app backend; change one of them. |
| app.settings.providers.confirm.disconnect | — → {name} 연결을 해제합니까? | Disconnect → Disconnect {name}? |
| app.settings.providers.connect | — → 모델 연결 | Connect |
| app.settings.providers.connectAccount | — → {name} {state, select, reconnect {다시 연결} other {연결}} | {state, select, reconnect {Reconnect} other {Connect}} {name} |
| app.settings.providers.connectedCount | — → 연결됨 ({count}) | Connected ({count}) |
| app.settings.providers.connection_method | — → 연결 방식 | Connection method |
| app.settings.providers.disconnect | — → 연결 해제 | Disconnect |
| app.settings.providers.disconnectAccount | — → {name} 연결 해제 | Disconnect {name} |
| app.settings.providers.disconnect_failed | — → 연결을 해제하지 못했습니다. | Disconnect failed |
| app.settings.providers.every_provider_of_this_kind_is_already | — → 해당 연결 방식의 제공사가 모두 연결되어 있습니다. | Every provider of this kind is already connected. |
| app.settings.providers.existing_chats_remain_on_disk_but_new | — → 기존 대화는 유지됩니다. 다시 연결할 때까지 해당 계정으로 새 요청을 보낼 수 없습니다. | Existing chats remain on disk, but new requests through this sign-in will stop working until you reconnect. |
| app.settings.providers.failed_to_load_providers | — → 모델 제공사를 불러오지 못했습니다. | Failed to load providers |
| app.settings.providers.fieldHint | — → {hint} 환경 설정 파일의 {variable}에 저장합니다. | {hint} Stored as {variable} in .env. → {hint} Stored as {variable} in the environment configuration file. |
| app.settings.providers.fieldStored | — → 환경 설정 파일의 {variable}에 저장합니다. | Stored as {variable} in .env. → Stored as {variable} in the environment configuration file. |
| app.settings.providers.free_private_models_running_on_this_machine | — → 컴퓨터나 네트워크에서 실행하는 모델을 연결합니다. 앱이 각 서버의 연결 상태를 확인하고 사용 가능한 모델을 목록에 표시합니다. | Free, private models running on this machine or your network. Kady probes each server and lists its models in the picker while it is reachable. → Models running on this machine or your network. The app probes each server and lists its models while reachable. |
| app.settings.providers.full_catalogue | — → 전체 모델 목록 | Full catalogue |
| app.settings.providers.intro | — → 보유한 구독으로 로그인하거나 API 키를 추가하거나 로컬 서버를 연결하세요. 인증 정보는 실행 중인 컴퓨터에 보관합니다. 키는 환경 설정 파일에, 로그인 정보는 Pi 인증 저장소에 저장하며 K-Dense로 보내지 않습니다. | Kady is bring-your-own-model: sign in with a subscription you already have, paste an API key, or point it at a local server. Credentials stay on this machine (keys in .env, sign-ins in Kady's Pi credential store) — nothing is sent to K-Dense. → Bring your own model: sign in with a subscription, add an API key, or connect a local server. Credentials stay on this machine (keys in the environment configuration file, sign-ins in Pi's credential store); nothing is sent to K-Dense. |
| app.settings.providers.loadFailed | — → 모델 제공사를 불러오지 못했습니다 ({status}). | Failed to load providers ({status}) |
| app.settings.providers.loading_providers | — → 모델 제공사를 불러오는 중입니다. | Loading providers… |
| app.settings.providers.local_model_servers | — → 로컬 모델 서버 | Local model servers |
| app.settings.providers.metered_extra_usage | — → 추가 종량제 사용량 | Metered extra usage |
| app.settings.providers.modelCount | — → 모델 {count}개 | {count, plural, one {# model} other {# models}} |
| app.settings.providers.model_providers | — → 모델 제공사 | Model providers |
| app.settings.providers.no_model_provider_is_connected_yet_pick | — → 연결한 모델 제공사가 없습니다. 아래에서 제공사를 선택하거나 로컬 모델 서버를 실행하세요. | No model provider is connected yet. Pick one below, or run a local model server. |
| app.settings.providers.no_provider_matches | — → 조건에 맞는 제공사가 없습니다. | No provider matches. |
| app.settings.providers.not_connected | — → 연결 안 됨 | Not connected |
| app.settings.providers.not_reachable | — → 연결할 수 없음 | Not reachable |
| app.settings.providers.one_pay_as_you_go_account_for | — → 종량제 계정으로 여러 호스팅 모델, OpenRouter Fusion, 서버 측 음성 기능을 사용합니다. | One pay-as-you-go account for hundreds of hosted models, plus OpenRouter Fusion and server-side speech. |
| app.settings.providers.openai_compatible_server | — → OpenAI 호환 서버 | OpenAI-compatible server |
| app.settings.providers.openrouter_api_key | — → OpenRouter API 키 | OpenRouter API key |
| app.settings.providers.or_use_an_api_key | — → API 키로 연결할 수도 있습니다. | or use an API key |
| app.settings.providers.pay_as_you_go | — → 종량제 | Pay-as-you-go |
| app.settings.providers.reconnect | — → 다시 연결 | Reconnect |
| app.settings.providers.reconnect_required | — → 다시 연결 필요 | Reconnect required |
| app.settings.providers.search_model_providers | — → 모델 제공사 검색 | Search model providers |
| app.settings.providers.search_providers_name_or_env_var | — → 제공사 검색 (이름 또는 환경 변수)… | Search providers (name or env var)… |
| app.settings.providers.serverHint | — → {hint} 비워 두면 {url}을 사용합니다. 환경 설정 파일의 {variable}에 저장합니다. | {hint} Leave unset to use {url}. Stored as {variable} in .env. → {hint} Leave unset to use {url}. Stored as {variable} in the environment configuration file. |
| app.settings.providers.serverRunning | — → 실행 중 · 모델 {count}개 | Running · {count, plural, one {# model} other {# models}} |
| app.settings.providers.showAll | — → 제공사 {count}개 모두 보기 | Show all {count} providers |
| app.settings.providers.show_popular_only | — → 주요 제공사만 보기 | Show popular only |
| app.settings.providers.sign_in | — → 계정 로그인 | Sign in |
| app.settings.providers.status.api-key | — → API 키 저장됨 | API key set |
| app.settings.providers.status.external | — → 설정됨{source, select, empty {} other { ({source})}} | Configured{source, select, empty {} other { via {source}}} |
| app.settings.providers.status.signed-in | — → 로그인됨 | Signed in |
| app.settings.providers.subscription | — → 구독 | Subscription |
| app.settings.providers.subscriptions_chatgpt_claude_pro_max_copilot_sign | — → ChatGPT, Claude Pro/Max, Copilot 등 구독 계정은 제공사에서 로그인합니다. 다른 연결 방식은 API 키나 클라우드 인증 정보가 필요합니다. 연결한 제공사는 모델 선택 목록에 표시됩니다. | Subscriptions (ChatGPT, Claude Pro/Max, Copilot, …) sign in through the provider; everything else takes an API key or cloud credential. A connected provider gets its own section in the model picker. |
| app.settings.resize_settings | — → 설정 창 크기 조절 | Resize settings |
| app.settings.scope.all | — → 모든 프로젝트 | All → All projects |
| app.settings.scope.label | — → 적용 범위 | Scope |
| app.settings.scope.project | — → 현재 프로젝트 ({name}) | Project → This project ({name}) |
| app.settings.services | — → 서비스 | Services |
| app.settings.settings | — → 설정 | Settings |
| app.settings.skills | — → 스킬 | Skills |
| app.settings.specialists | — → 전문 AI agent | Specialists |
| app.settings.workspace | — → 작업 환경 | Workspace |

### context

| String id | Korean (before → after if changed) | English (before → after if changed) |
|---|---|---|
| context.chip | 시작 프롬프트 ≈{tokens} | Start prompt ≈{tokens} |
| context.chipUnknown | 시작 프롬프트 | Start prompt |
| context.contextWindow | 컨텍스트 창 → context 길이 | Context window |
| context.initialPrompt | 시작 프롬프트(추정) | Start prompt (estimate) |
| context.intro | 대화를 시작하기 전에 모델에 보내는 지시문과 도구 설명의 크기입니다. 글자 수를 4로 나눈 추정값이며, 실제 사용량은 첫 응답 뒤 오른쪽 게이지에 표시됩니다. | Size of the instructions and tool descriptions sent before any conversation. Estimated as characters / 4; measured usage appears in the gauge on the right after the first response. |
| context.loadError | 예산을 불러오지 못했습니다: {message} | Could not load the budget: {message} |
| context.mode | 이 채팅의 스킬 범위: {mode} → 현재 대화의 스킬 범위: {mode} | Skills in this chat: {mode} |
| context.modeAll | 설치된 모든 스킬 | all installed skills |
| context.modeCatalogue | GeoAIDesk 카탈로그 스킬 | GeoAIDesk catalogue skills |
| context.modeWorkflow | 작업: {title} | task: {title} |
| context.model | 모델 | Model |
| context.newChat | 새 채팅의 스킬 범위 | Skills for new chats |
| context.newChatNote | 새로 여는 채팅부터 적용됩니다. 지금 채팅의 범위와 설치된 스킬 파일은 바뀌지 않습니다. | Applies to chats opened from now on. This chat's selection and the installed skill files do not change. |
| context.noModel | 모델 정보 없음 | No model information |
| context.outputReserve | 출력 예약 | Output reserve |
| context.remaining | 대화·도구 결과에 남는 양 | Left for conversation and tool results |
| context.remainingWarn | 남는 양이 컨텍스트의 절반보다 적습니다. 스킬 범위를 줄이거나 컨텍스트가 큰 모델을 고르세요. → 남는 양이 context의 절반보다 적습니다. 스킬 범위를 줄이거나 context가 큰 모델을 고르세요. | Less than half of the context is left. Narrow the skill selection or pick a model with a larger context. |
| context.saved | 저장했습니다 | Saved |
| context.skills | 모델에 보이는 스킬 {exposed}개 / 설치 {installed}개 | {exposed} skills offered to the model / {installed} installed |
| context.title | 시작 프롬프트 예산 | Start prompt budget |
| context.tools | 도구 {count}개 | {count} tools |

### localModel

| String id | Korean (before → after if changed) | English (before → after if changed) |
|---|---|---|
| localModel.appDefault | 앱 기본 모델: {model} | App default model: {model} |
| localModel.choose | 모델을 선택하세요 | Choose a model |
| localModel.compact64 | 64K — 제안, 시험하지 않음 | 64K — proposed, not tested |
| localModel.configured | 설정한 num_ctx: {value} | Configured num_ctx: {value} |
| localModel.context | 컨텍스트 토큰 수 → context 토큰 수 | Context tokens |
| localModel.custom | 직접 입력 | Custom |
| localModel.default | 기본 모델로 사용 | Use as default model |
| localModel.defaultHelp | 선택하지 않으면 기존 기본 모델을 유지합니다. | Leave unchecked to keep the existing default model. |
| localModel.description | Ollama 모델의 컨텍스트와 최대 출력을 저장합니다. 기본 모델 변경은 새 대화에 적용됩니다. → Ollama 모델의 context와 최대 출력을 저장합니다. 기본 모델 변경은 새 대화에 적용됩니다. | Save Ollama context and output limits. Default model changes apply to new chats. |
| localModel.evidence | 기록한 시험: qwen3:30b-a3b-instruct-2507-q4_K_M, RTX 4090 24 GB, 98,304 토큰. CPU 오프로딩 약 18%, 최대 컨텍스트 사용률 89.9%였습니다. 이 설정은 성능을 보장하지 않습니다. 64K 프로필은 시험하지 않았습니다. 64K와 98,304 토큰의 실제 작업 검증은 출시 검증 단계에서 수행합니다. → 기록한 시험: qwen3:30b-a3b-instruct-2507-q4_K_M, RTX 4090 24 GB, 98,304 토큰. CPU 오프로딩 약 18%, 최대 context 사용률 89.9%였습니다. 해당 설정은 성능을 보장하지 않습니다. 64K 프로필은 시험하지 않았습니다. 64K와 98,304 토큰의 실제 작업 검증은 출시 검증 단계에서 확인합니다. | Recorded trial: qwen3:30b-a3b-instruct-2507-q4_K_M, RTX 4090 24 GB, 98,304 tokens. About 18% CPU offload; peak context 89.9%. This is not a performance guarantee. The 64K profile is not tested. Real-task validation at 64K and 98,304 tokens belongs to release validation. |
| localModel.failed | 로컬 모델 설정을 처리하지 못했습니다. | Could not process local model settings. |
| localModel.invalid | 모델과 정수 토큰 수를 입력하세요. 컨텍스트는 최소 64K(65,536 토큰)여야 합니다. 최대 출력은 컨텍스트보다 작아야 합니다. → 모델과 정수 토큰 수를 입력하세요. context는 최소 64K(65,536 토큰)여야 합니다. 최대 출력은 context보다 작아야 합니다. | Choose a model and enter integer token counts. Context must be at least 64K (65,536 tokens). Maximum output must be smaller than context. |
| localModel.loaded | 현재 로드된 컨텍스트: {value} → 현재 로드된 context: {value} | Currently loaded context: {value} |
| localModel.loading | 상태를 확인합니다… | Checking status… |
| localModel.minimum | 로컬 모델은 최소 64K(65,536 토큰)가 필요합니다. 32K는 시작 프롬프트와 작업 여유를 담기에 부족합니다. | Local models require at least 64K (65,536 tokens). 32K leaves insufficient room for the startup prompt and task work. |
| localModel.mismatch | 앱의 선언값과 Ollama 설정이 맞지 않습니다. 서버 주소, 설정한 num_ctx, 로드된 컨텍스트를 확인하세요. → 앱의 선언값과 Ollama 설정이 맞지 않습니다. 서버 주소, 설정한 num_ctx, 로드된 context를 확인하세요. | The app declaration and Ollama settings differ. Check the server URL, num_ctx and loaded context. |
| localModel.model | 모델 | Model |
| localModel.output | 최대 출력 토큰 수 | Maximum output tokens |
| localModel.persisted | 저장한 모델: {model} · 컨텍스트 {context} · 최대 출력 {output} → 저장한 모델: {model} · context {context} · 최대 출력 {output} | Saved model: {model} · context {context} · max output {output} |
| localModel.profile | 컨텍스트 프로필 → context 프로필 | Context profile |
| localModel.reachable | Ollama 연결됨 | Ollama reachable |
| localModel.recorded | 96K — 한 기기에서 기록한 시험 | 96K — recorded trial on one machine |
| localModel.refresh | 상태 새로고침 | Refresh status |
| localModel.save | 모델 설정 저장 | Save model settings |
| localModel.saved | 모델 설정을 저장했습니다. | Model settings saved. |
| localModel.saving | 저장합니다… | Saving… |
| localModel.title | 로컬 모델과 컨텍스트 → 로컬 모델과 context | Local model and context |
| localModel.trained | 학습 컨텍스트: {value} → 학습 context: {value} | Trained context: {value} |
| localModel.unknown | 확인되지 않음 | Unknown |
| localModel.unreachable | Ollama에 연결할 수 없습니다 | Ollama is not reachable |
| localModel.unverified | 실행 컨텍스트를 확인하지 못했습니다. 학습 컨텍스트만으로 실행 크기를 확인할 수 없습니다. → 실행 context를 확인하지 못했습니다. 학습 context만으로 실행 크기를 확인할 수 없습니다. | Runtime context is unverified. Trained context alone does not establish the runtime size. |
| localModel.variant | 이 컨텍스트로 파생 모델 생성 → 지정한 context로 파생 모델 생성 | Create a variant with this context |
| localModel.variantHelp | 선택하면 저장할 때만 Ollama에 num_ctx를 설정한 파생 모델을 생성합니다. 원본은 바꾸지 않습니다. 같은 이름의 파생 모델은 갱신합니다. 선택하지 않으면 앱의 선언값만 바뀝니다. | Only when saving with this checked, create an Ollama variant with num_ctx. The original stays unchanged. An existing same-name variant is updated. Otherwise only the app declaration changes. |
| localModel.verified | 선언한 컨텍스트가 확인한 실행 설정 이내입니다. 실제 메모리 할당이나 작업 성공을 보장하지 않습니다. → 선언한 context가 확인한 실행 설정 이내입니다. 실제 메모리 할당이나 작업 성공을 보장하지 않습니다. | Declared context fits the observed runtime setting. This does not guarantee memory allocation or task success. |

### viewers

| String id | Korean (before → after if changed) | English (before → after if changed) |
|---|---|---|
| viewers.bands | 밴드 | Bands |
| viewers.basis | 심도 기준 | Depth basis |
| viewers.bytes | {size} 바이트 | {size} bytes |
| viewers.columns | 열 | Columns |
| viewers.conflicting | 선언이 서로 다름 | Conflicting declarations |
| viewers.coordinateSpace | 좌표 공간 | Coordinate space |
| viewers.count | 피처 수 | Feature count |
| viewers.crs | 좌표계 | CRS |
| viewers.crsSpace | 좌표계 단위 | CRS units |
| viewers.curves | 곡선 | Curves |
| viewers.datum | 기준면 | Datum |
| viewers.declared | 파일에 선언됨 | Declared in file |
| viewers.depth | 심도 | Depth |
| viewers.description | 설명 | Description |
| viewers.dimensions | 차원 | Dimensions |
| viewers.extent | 범위 | Extent |
| viewers.failed | 파일 정보를 읽지 못했습니다 | Could not inspect file |
| viewers.fields | 필드 | Fields |
| viewers.fingerprint | 크기·수정 시각 기반 캐시 키입니다. 내용 해시가 아닙니다. | Cache key from size and modification time, not a content hash. |
| viewers.format | 형식 | Format |
| viewers.genericError | 요청을 처리하지 못했습니다. | The request could not be completed. |
| viewers.headers | 헤더 | Headers |
| viewers.imaging | 지리 참조가 없는 TIFF입니다. 영상 뷰어로 표시합니다. | TIFF has no georeference tags. Showing the imaging viewer. |
| viewers.inspector | 검사기 | Inspector |
| viewers.issues | 확인할 사항 | Issues |
| viewers.layers | 레이어 | Layers |
| viewers.loading | 파일 정보를 읽고 있습니다… | Reading file metadata… |
| viewers.method | 읽기 방법 | Read method |
| viewers.missing | 누락된 동반 파일 | Missing companions |
| viewers.native | 원본 좌표 | Native coordinates |
| viewers.no | 아니요 | No |
| viewers.nodata | 결측값 | No data |
| viewers.pixel | 픽셀 | Pixel |
| viewers.preview | 제한된 미리보기 | Bounded preview |
| viewers.retry | 다시 시도 | Retry |
| viewers.rows | 표시한 행 | Displayed rows |
| viewers.sampled | 일부 자료만 표시 | Sampled |
| viewers.size | 크기 | Size |
| viewers.sourceRows | 원본 행 수 또는 추정치 | Source rows or estimate |
| viewers.sources | 원본 파일 | Source files |
| viewers.start | 시작 | Start |
| viewers.step | 간격 | Step |
| viewers.stop | 끝 | Stop |
| viewers.truncated | 제한에 도달함 | Truncated |
| viewers.unit | 단위 | Unit |
| viewers.unknown | 알 수 없음 | Unknown |
| viewers.user-supplied | 사용자 지정 | User supplied |
| viewers.yes | 예 | Yes |

### depth

| String id | Korean (before → after if changed) | English (before → after if changed) |
|---|---|---|
| depth.allNull | 모든 값 결측 | All values missing |
| depth.apply | 범위 적용 | Apply window |
| depth.basis | 심도 기준 | Depth basis |
| depth.candidate | 후보 원인은 검토 전입니다. 원값을 변경하지 않습니다. | Flag causes have not been reviewed. Original values are unchanged. |
| depth.choose | 표시 곡선 (최대 8개) | Displayed curves (up to 8) |
| depth.code | 분석 코드 | Analysis code |
| depth.column | 열 | Column |
| depth.coverage | 유효 / 전체 행 | Finite / total rows |
| depth.curve | 곡선 | Curve |
| depth.datum | 기준면 | Datum |
| depth.decreasing | 감소 | Decreasing |
| depth.depth-duplicate | 중복 심도 | Duplicate depth |
| depth.depth-gap | 심도 누락 | Depth gap |
| depth.depth-reversal | 심도 역전 | Depth reversal |
| depth.derived | 파생 자료 | Derived |
| depth.description | 설명 | Description |
| depth.direction | 심도 방향 | Index direction |
| depth.enlargement | 공경 확대 후보 | Enlargement candidate |
| depth.exact | 행 번호는 LAS 논리 자료 행입니다. 헤더를 포함한 텍스트 줄 번호와 다릅니다. | Row IDs are LAS logical samples, not physical text lines including headers. |
| depth.failed | 검층 파일을 열지 못했습니다. | Could not open the well log. |
| depth.fileBasis | 파일의 기준 | File basis |
| depth.finite | 유효값 | Finite |
| depth.flags | 검토 표시 | Review flags |
| depth.go | 행 이동 | Go to row |
| depth.increasing | 증가 | Increasing |
| depth.invalidWindow | 최소 심도는 최대 심도보다 작거나 같아야 합니다. | Minimum depth must be less than or equal to maximum depth. |
| depth.inventory | 곡선 목록 | Inventory |
| depth.limitations | 해석 범위 | Limitations |
| depth.loading | LAS 파일을 읽는 중입니다. | Reading the LAS file. |
| depth.manifestBasis | 결과 명세의 기준 | Manifest basis |
| depth.max | 최대 심도 | Maximum depth |
| depth.metadata | 파일 정보 | Metadata |
| depth.method | 표시 방법 | Display method |
| depth.min | 최소 심도 | Minimum depth |
| depth.mismatch | 결과 명세의 열 또는 단위가 원본 파일과 다릅니다. 곡선 표시를 중단했습니다. | Manifest columns or units disagree with the data file. Track rendering stopped. |
| depth.missing | 결측 | Missing |
| depth.mixed | 혼합 | Mixed |
| depth.next | 다음 행 | Next rows |
| depth.noDepth | 유효한 심도가 없습니다. 원본 행과 파일 정보를 확인하세요. | No finite depth. Inspect source rows and metadata. |
| depth.noFlags | 검토 표시가 없습니다. 이 뷰어는 범위·급변 검사를 실행하지 않습니다. → 검토 표시가 없습니다. 뷰어는 범위·급변 검사를 실행하지 않습니다. | No review flags. This viewer does not run range or spike screening. |
| depth.null | 결측 | Missing |
| depth.previous | 이전 행 | Previous rows |
| depth.range | 범위 이탈 후보 | Range candidate |
| depth.raw | 원자료 | Raw |
| depth.readCode | 분석 코드 받기 | Download analysis code |
| depth.readSource | 자료 파일 받기 | Download data file |
| depth.reduction | 화면 축약: 구간별 최소·최대값과 결측 경계를 보존합니다. 축약 자료로 분석하지 마세요. | Display reduction preserves bucket extrema and missing boundaries. Do not analyze display samples. |
| depth.retry | 파일 다시 읽기 | Read file again |
| depth.row | 자료 행 | Data row |
| depth.rows | 원본 행 | Source rows |
| depth.run | 검층 회차 | Run |
| depth.sampling | 전체 {total}행 · 선택 구간 {matched}행 · 화면 {shown}행 | Source {total} rows · window {matched} rows · display {shown} rows |
| depth.selected | 선택 행 | Selected row |
| depth.sentinel | NULL 지정값 | NULL sentinel |
| depth.source | 자료 파일 | Data file |
| depth.spike | 급변 후보 | Spike candidate |
| depth.tracks | 검층 곡선 | Tracks |
| depth.truncated | 표시 한도에 도달해 일부만 표시합니다. 원본 행에서 이어서 확인하세요. | Display limit reached. Continue in source rows to inspect the remainder. |
| depth.unit | 단위 | Unit |
| depth.unknown | 미확인 | Unknown |
| depth.version | LAS 버전 | LAS version |
| depth.well | 시추공 | Well |

### map

| String id | Korean (before → after if changed) | English (before → after if changed) |
|---|---|---|
| map.add | 레이어 추가 | Add layer |
| map.addPath | 샌드박스 상대 경로 | Sandbox-relative path |
| map.addTiff | 지리 참조가 없는 TIFF입니다. 파일을 단독으로 열어 영상 뷰어에서 확인하세요. | This TIFF has no georeference. Open separately in the imaging viewer. |
| map.analysis | 분석 산출물 | Analysis artifacts |
| map.apply | 변수 적용 | Apply variable |
| map.area | 전체 레이어 면적표 | Full-layer area table |
| map.areaCrs | 면적 계산 CRS (EPSG 코드) | Area CRS (EPSG code) |
| map.areaError | 전체 레이어 면적표를 받지 못했습니다. | Could not retrieve the full-layer area table. |
| map.areaHint | 화면 범위나 표시 CRS로 면적을 계산하지 않습니다. 투영 방법에는 면적 분석에 적합한 CRS를 지정하세요. EPSG:3857은 사용하지 않습니다. | Area never uses the viewport or display CRS. Choose a CRS suitable for area analysis for the projected method. EPSG:3857 is not used. |
| map.areaM2 | 면적 (m²) | Area (m²) |
| map.attributes | 현재 범위의 속성표 | Viewport attribute table |
| map.band | 밴드 | Band |
| map.categorical | 범주형 색상 | Categorical colors |
| map.categoryField | 색상 분류 필드 | Color class field |
| map.chooseMethod | 계산 방법 선택 | Choose an area method |
| map.class | 분류 | Class |
| map.classField | 면적 분류 필드 | Area class field |
| map.conflicting | 선언 충돌 | Conflicting declarations |
| map.coordinateUnits | 좌표 단위 | Coordinate units |
| map.count | 피처 수 | Feature count |
| map.csvName | full-layer-area.csv | full-layer-area.csv |
| map.declared | 파일에 선언됨 | Declared in file |
| map.dimensions | 표본 크기: {width} × {height} | Sample dimensions: {width} × {height} |
| map.displayCrs | 표시 CRS | Display CRS |
| map.displayFallback | 산출물의 표시 설정을 이 지도의 공통 표시 CRS로 변환합니다. 원본 CRS는 유지합니다. | Artifact display settings are transformed to this map's common display CRS. Source CRS is preserved. |
| map.down | 레이어 아래로 | Move layer down |
| map.downloadCsv | 면적표 CSV 저장 | Save area CSV |
| map.downloadPng | 지도 PNG 저장 | Save map PNG |
| map.empty | 표시할 피처가 없습니다. | No features to display. |
| map.extent | 반환한 범위 ({crs}) | Returned extent ({crs}) |
| map.featureCount | 표시한 피처: {shown} / 전체 피처: {total} | Displayed features: {shown} / full layer: {total} |
| map.figureName | map-preview.png | map-preview.png |
| map.figureNotice | PNG에는 현재 표시한 일부 자료만 포함됩니다. 전체 분석 결과는 면적표를 확인하세요. | The PNG contains only currently rendered data. Use the area table for full-layer analysis. |
| map.figureSubset | 제한된 지도 미리보기 · 표시 CRS: {crs} | Bounded map preview · display CRS: {crs} |
| map.fit | 자료 범위 보기 | Fit data extent |
| map.fullLayer | 범위: 전체 레이어 · 계산 방법: {method} · 면적 CRS: {crs} | Scope: full layer · method: {method} · area CRS: {crs} |
| map.geodesic | 타원체 측지 면적 | Ellipsoidal geodesic area |
| map.invalidManifest | 지도 산출물의 레이어를 읽지 못했습니다. | Could not read map artifact layers. |
| map.layer | GeoPackage 레이어 | GeoPackage layer |
| map.layers | 레이어 | Layers |
| map.legend | 범례 | Legend |
| map.limitations | 해석 한계 | Limitations |
| map.loading | 지도 자료를 읽고 있습니다… | Reading map data… |
| map.map | 지도 | Map |
| map.mapError | 지도를 그리지 못했습니다. 자료 형식과 범위를 확인하세요. | Could not render the map. Check the data format and extent. |
| map.method | 면적 계산 방법 | Area method |
| map.native | 원본 좌표 (지리적 위치 미지정) | Native coordinates (no geographic placement) |
| map.nativeLimit | 원본 CRS가 없거나 충돌합니다. 지리적 위치를 추정하지 않으며 면적 계산을 실행하지 않습니다. | Source CRS is missing or conflicting. Geographic placement is not inferred and area analysis is disabled. |
| map.next | 다음 페이지 | Next page |
| map.no | 아니요 | No |
| map.noField | 필드 선택 | Choose a field |
| map.nodata | 결측값 / 마스크 | No data / mask |
| map.offset | 페이지 시작 위치: {offset} | Page offset: {offset} |
| map.opacity | 불투명도 | Opacity |
| map.outsidePixel | 클릭한 위치에 반환된 표본이 없습니다. | No returned sample at this location. |
| map.overlayBlocked | 원본 CRS가 없거나 충돌하는 자료는 다른 레이어와 겹칠 수 없습니다. 단독으로 열어 원본 좌표를 확인하세요. | Sources with missing or conflicting CRS cannot overlay other layers. Open separately to inspect native coordinates. |
| map.percent | 비율 (%) | Percentage (%) |
| map.pixelHint | 지도를 클릭하면 반환된 래스터 표본값을 표시합니다. 원본 해상도 값이 아닙니다. | Click the map to inspect returned raster samples, not original-resolution values. |
| map.pngError | PNG를 저장하지 못했습니다. | Could not save the PNG. |
| map.previous | 이전 페이지 | Previous page |
| map.projected | 투영 좌표계 면적 | Projected CRS area |
| map.properties | 선택한 피처의 속성 | Selected feature properties |
| map.remove | 레이어 제거 | Remove layer |
| map.requestError | 요청을 처리하지 못했습니다. | The request could not be completed. |
| map.resolution | 표시 해상도: {resolution} | Display resolution: {resolution} |
| map.retry | 자료 다시 읽기 | Reload data |
| map.runArea | 전체 면적 계산 | Calculate full-layer area |
| map.sampledPixel | 표본 픽셀: 행 {row}, 열 {col}, 값 {value} | Sample pixel: row {row}, column {col}, value {value} |
| map.sampling | 표시 방법: {method} · 표본 사용: {sampled} · 제한 도달: {truncated} | Display method: {method} · sampled: {sampled} · limit reached: {truncated} |
| map.scriptPath | 분석 스크립트: {path} | Analysis script: {path} |
| map.select | 레이어 선택 | Select layer |
| map.sourceCrs | 원본 CRS | Source CRS |
| map.subset | 지도와 아래 속성표는 현재 범위의 제한된 미리보기입니다. 전체 자료 분석 결과가 아닙니다. | The map and attribute table are bounded previews of the current viewport, not full-data analysis. |
| map.tablePath | 전체 분석표: {path} | Full analysis table: {path} |
| map.totalArea | 총면적: {area} m² · 전체 피처: {count} · 빈 도형: {empty} | Total area: {area} m² · full-layer features: {count} · empty geometries: {empty} |
| map.unchanged | 표시 좌표를 바꿔도 원본 자료는 변경하지 않습니다. | Display transformations do not change the source data. |
| map.unit | 값 단위 | Value unit |
| map.unknown | 알 수 없음 | Unknown |
| map.up | 레이어 위로 | Move layer up |
| map.user-supplied | 사용자 지정 | User supplied |
| map.variable | 변수 | Variable |
| map.visible | 지도에 표시 | Show on map |
| map.yes | 예 | Yes |
| map.zoomIn | 지도 확대 | Zoom in |
| map.zoomOut | 지도 축소 | Zoom out |

### tables

| String id | Korean (before → after if changed) | English (before → after if changed) |
|---|---|---|
| tables.analyte | 분석 항목 | Analyte |
| tables.analyze | 지정한 역할로 검사 | Check mapped roles |
| tables.azimuth | 방위각 | Azimuth |
| tables.checks | 검사 결과 | Assessment |
| tables.clipped | 미리보기 또는 결과를 제한해 표시합니다. | Preview or findings are bounded. |
| tables.columns | 열 역할 | Column roles |
| tables.complete | 선택한 검사 범위를 모두 확인함 | Selected assessment scope complete |
| tables.count | 읽은 데이터 행: {n} | Data rows read: {n} |
| tables.crs | 좌표계 | CRS |
| tables.data_limit | 자료 읽기 한도에 도달했습니다. | Data read limit reached. |
| tables.declarations | 명시적 선언 (선택) | Explicit declarations (optional) |
| tables.depth_unit | 심도 단위 | Depth unit |
| tables.detection_limit | 검출한계 | Detection limit |
| tables.dip | 경사각 | Dip |
| tables.duplicate_id | ID 중복 | Duplicate ID |
| tables.failed | 표를 검사하지 못했습니다 | Could not assess table |
| tables.from_depth | 시작 심도 | From depth |
| tables.gap | 구간 공백 | Interval gap |
| tables.hole_id | 시추공 ID | Hole ID |
| tables.id_mapping_required | 고유 ID 역할이 없거나 반복되는 시추공 ID입니다. | No unique ID role, or hole IDs are expected to repeat. |
| tables.ids | ID 중복·누락 | Duplicate / missing IDs |
| tables.interval_mapping_required | 시추공 ID·시작·끝 역할이 필요합니다. | Map hole ID, from and to depths. |
| tables.interval_rows_skipped | ID·구간·단위를 확인할 수 없거나 단위가 다른 행은 비교하지 않았습니다. | Rows with unknown ID, invalid intervals, unknown or conflicting depth units were not compared. |
| tables.intervals | 구간 겹침·공백 | Interval overlap / gaps |
| tables.invalid_interval | 유효하지 않은 구간 | Invalid interval |
| tables.irrelevant | 시추공·분석 표에 해당하는 열 조합을 찾지 못했습니다. 필요한 역할을 직접 지정할 수 있습니다. | No relevant drillhole / assay column combination found. You may map roles manually. |
| tables.issueCount | 발견한 항목: {n} | Findings: {n} |
| tables.join | 다른 표와 키 연결 검사 | Check keys against another table |
| tables.joinPath | 연결할 파일 경로 | Other file path |
| tables.joinSheet | 연결할 워크시트 (XLSX, 선택) | Other worksheet (XLSX, optional) |
| tables.join_data_limit | 연결할 표의 일부만 읽었습니다. | Only part of the other table was read. |
| tables.join_not_requested | 연결 검사를 선택하지 않았습니다. | Join check not requested. |
| tables.left | 현재 표의 키 역할 | Current key role |
| tables.limits | 읽기 한도: 파일 16 MiB, 20,000행, 64열, 200,000셀, 파싱 자료 4 MiB. 결과는 200개까지 표시합니다. 데이터 행은 헤더 다음부터 1로 셉니다. CSV/TSV 원본 행은 레코드가 시작하는 물리적 줄 번호입니다. | Read limits: 16 MiB/file, 20,000 rows, 64 columns, 200,000 cells, 4 MiB parsed data. First 200 findings shown. Data rows start at 1 after the header. CSV/TSV source rows are physical record-start line numbers. |
| tables.loadJoin | 연결할 열 읽기 | Read join columns |
| tables.loading | 표를 읽고 있습니다… | Reading table… |
| tables.missing_id | ID 누락 | Missing ID |
| tables.missing_units | 일부 행의 단위를 알 수 없습니다. | Some rows have unknown units. |
| tables.none | 지정하지 않음 | Not mapped |
| tables.notice | 원본은 바꾸지 않습니다. 검출한계 표기와 수식은 그대로 보존하며, 단위를 변환하거나 시추공 경로를 계산하지 않습니다. | Read-only. Censored values and formulas stay unchanged. No unit conversion or desurveying. |
| tables.option.inspect | 시추공 표 점검 | Inspect drillhole table |
| tables.option.loading | 표를 읽는 중입니다. | Reading the table. |
| tables.option.ordinary | 일반 표 보기 | Standard table view |
| tables.overlap | 구간 겹침 | Interval overlap |
| tables.partial | 일부만 검사함 | Partially assessed |
| tables.proposal | 열 이름으로 제안합니다. 검사 전에 역할을 확인하거나 수정하세요. | Suggestions use column names. Confirm or edit roles before checking. |
| tables.qualifier | 한정자 | Qualifier |
| tables.refs | 위치 | Locations |
| tables.retry | 다시 읽기 | Reload |
| tables.right | 연결할 표의 키 열 | Other key column |
| tables.row | 데이터 행 / 원본 행 | Data row / source row |
| tables.row_wider_than_header | 헤더보다 넓은 행부터 읽지 않았습니다. | Stopped before a row wider than the header. |
| tables.sample_id | 시료 ID | Sample ID |
| tables.sheet | 워크시트 | Worksheet |
| tables.source | 원본 미리보기 | Source preview |
| tables.stale | 역할과 선언을 확인하고 검사하면 결과를 표시합니다. | Confirm roles and declarations, then run checks to see results. |
| tables.suggest | 제안한 역할 채우기 | Fill suggested roles |
| tables.survey_depth | 측량 심도 | Survey depth |
| tables.title | 시추공·분석 표 검사 | Drillhole / assay table checks |
| tables.to_depth | 끝 심도 | To depth |
| tables.unassessed | 검사하지 않음 | Not assessed |
| tables.unit | 분석 단위 | Assay unit |
| tables.unit_inconsistency | 단위 선언이 서로 다름 | Inconsistent unit declarations |
| tables.unit_mapping_required | 단위 열이나 명시적 선언이 필요합니다. | Map a unit column or declare a unit. |
| tables.units | 선언된 단위 | Declared units |
| tables.unmatched_left | 연결할 표에 키가 없음 | Key absent from other table |
| tables.unmatched_right | 현재 표에 키가 없음 | Key absent from current table |
| tables.value | 분석값 | Value |
| tables.x | X / 경도 | X / longitude |
| tables.y | Y / 위도 | Y / latitude |
| tables.z | Z / 고도 | Z / elevation |
