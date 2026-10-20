---
format: 1
status: ready
updated: 2026-10-20T08:52:32Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"5c402641-eeba-4c12-a6be-b069a47e1c65","pid":2591591,"provider":"codex","session":"01a15878-02e3-7323-bd65-a0ecc4e205b2","start":"37356139","token":"c6605471e5500279f067b0899e0c46ac29e0916207a150fc5b23163d3f308bf6"}
branch: task/gaid-hub-editing--concept-pictures
target: task/gaid-hub-editing
parent: gaid-hub-editing
---
# gaid-hub-editing--concept-pictures

## Goal and done criteria
Request from the starter:

# Child unit concept-pictures (parent gaid-hub-editing, geoaidesk)

Goal (user request, verbatim part): "각 방법 초안에서 개념 그림도 어떻게 생성되는지 안내도 없으며, 기능도 보이지 않는다.
사용자가 해당 개념이 마음에 들지 않으면 수정하지도 못하는 것으로 보인다."
Confirmed scope (item 5): explain how concept pictures are made and show the feature (today visible only with the OpenAI
Codex (legacy) login); let the researcher regenerate or revise a picture they do not like (by instruction).

Current behaviour (parent's step 0, pc74:~/data/geoaidesk/work/gaid-hub-editing/before/03-draft.png): the draft step
(`web/src/geo/hub/draft-step.tsx`) shows a disabled "개념 그림 만들기" and a small grey line "그림 생성 계정이 연결되지
않았습니다. 설정의 제공사에서 연결하세요." No explanation, no connect link, no per-picture action. Server:
`server/src/geo/authoring/visuals.ts` (startVisuals: one batch = cover + up to 6 step/output pictures, prompts from
`conceptPrompt`), `codex-images.ts` (ChatGPT Codex backend `codex/images/generations`, gpt-image-2, OpenAI Codex (legacy)
login only, no fallback; user directions 2026-10-16 in AGENTS.md "GAID hub"), route
`POST /geo/authoring/projects/:id/drafts/:rev/visuals` in `server/src/geo/authoring/routes.ts`. Pictures are stored per key
in `project.visuals` (newest wins per key); registration copies them into the hub entry.

Design to implement:
1. A "개념 그림" explanation visible in the draft step whatever the login state: what they are (concept illustrations of
   the method, not data or results), how they are made (the picture model gpt-image-2 through the researcher's OpenAI Codex
   (legacy) login, only when asked, uses that subscription's image quota, no other source), where they appear (draft, hub
   registration). When not connected: say what to connect and offer a button that opens Settings → Providers
   (`openSettings({ tab: "providers" })`, `web/src/lib/settings-nav.ts`); the make action stays visible.
2. Per picture (cover, each step picture, each output picture): "다시 만들기" and "고쳐 만들기" (a short instruction from the
   researcher, e.g. "블록을 더 크게, 색은 단색으로"). Server: extend `GenerateVisualsBody` (contract
   `web/src/geo/contracts/authoring.ts`) with optional `keys` (any of `cover`, step ids, `output:<id>`; at most 6) and
   optional `instruction` (≤ 500 chars, kept verbatim in the operation record and appended to the prompt as the
   researcher's revision request, still under the style/safety rules of `conceptPrompt`). Check
   (openai/codex source via `gh api repos/openai/codex/contents/...`, raw.githubusercontent.com is blocked) whether the
   ChatGPT Codex backend accepts an image edit with the previous picture as input; use it for "고쳐 만들기" only if
   confirmed, otherwise regenerate with the instruction and say so in the report. A single-picture redo must not replace
   other pictures; the old file stays on disk (history), the newest is shown. Same opId idempotency, same usage-limit
   notice, same ledgering.
3. Keep the batch "개념 그림 만들기" action.
Ownership: you own `server/src/geo/authoring/{visuals,codex-images}.ts`, the visuals route body handling in
`server/src/geo/authoring/routes.ts` (only that route), `GenerateVisualsBody`/`VisualOperation` in the authoring contract,
the picture UI in `web/src/geo/hub/draft-step.tsx` and `web/src/geo/hub/method-flow.tsx`, and hub locale keys under
`visuals.*` in `web/src/geo/locales/hub/{ko,en}.json`. The parent edits `hub-screen.tsx`, `question-step.tsx`,
`shared-*.tsx` and `server/src/geo/hub-shared/` at the same time: keep your `hub-screen.tsx` change to the
`makeVisuals`/`visualAction` wiring and say exactly what you changed there.

Rules: read AGENTS.md (UI guide `docs/design/ui-guide.md` sections 1, 9 and the components you touch; copy rules
`geo/copy/gaid-writing.md`, `terminology.csv`; never claim a picture is evidence; all visible strings in locale catalogues,
Korean first). Tests: vitest for the new body validation (keys, instruction), single-key redo keeping other pictures, and
the UI states (not connected → explanation + settings button; per-picture actions). Run server typecheck + your tests, web
`npx tsc --noEmit` + your tests, `node geo/copy/validate-copy.mjs web/src/geo/locales`, `node geo/ui/check-ui.mjs`.
No real image generation is required for tests (use the injectable generator); one real generation on the trial app is
optional and only if an OpenAI Codex (legacy) login exists there — do not log in yourself.
Screenshots: Korean 1440x900 and 1280x800 of the draft step picture area (not connected; and with pictures, using a
synthetic picture written through the injectable path or a fixture) on your own trial app (systemd-run --user, own ports e.g.
3382/18382, GAID_HOME a copy of pc74:~/data/geoaidesk/work/gaid-hub-editing/home under
~/data/geoaidesk/work/gaid-hub-editing--concept-pictures/; never ~/.geoaidesk, never inside the repo; playwright-cli
skill; localStorage `gaid:hub-user`, `gaid:locale`=ko; method draft `#hub/ap-04567077-100`). Deliver: commits via
`task save`, then `task finish`; in your task document's Current state list the string ids added/changed (ko/en), UI rule
ids, screenshot paths (small PNGs also copied to reports/2026-10-20-gaid-hub-editing/figures/ as p2-*.png), whether image
edit input was confirmed, and a short Korean section text for the parent's report.

## Current state
Implemented the requested concept-picture explanation, provider-settings link, batch generation, and per-picture redo/edit for cover, procedure nodes and output ports. Edit requests send the previous picture to Codex images/edits; redo sends no prior picture. A request targets 1–6 unique valid keys; an instruction is nonblank and at most 500 UTF-16 code units, kept verbatim in the operation and prompt. An instruction requires existing selected pictures. Old files and unrelated keys remain unchanged. Existing opId idempotency, quota stop/notice and subscription ledger are retained.

Checks passed: server typecheck; 31 Vitest tests in geo-authoring-extra + geo-codex-images; web tsc --noEmit; 10 Vitest tests in concept-pictures + hub; copy validator (0 errors); UI validator (0 errors, 89 unchanged accepted debt); git diff --check. The parent owns the full integrated scripts/check run; this child ran the explicit checks in its goal.

Browser checks: own trial app ports 3382/18382, copied authoring/projects only (no credentials/config copied), Korean 1440×900 and 1280×800. Disconnected explanation/settings action visible; selected step redo/edit and 500-character form exercised. A browser-intercepted POST captured keys=[input-validate] and the exact instruction. A fixture was written through startVisuals with an injected synthetic generator (no paid calls). Final browser console check had 0 errors; connection-refused messages earlier came from the intentional backend stop for fixture seeding. Dark picture controls checked; new controls use outline buttons for legibility. No live subscription generation/edit or real login was performed.

Safe re-verification: use the test/typecheck commands below; never start a real image call for these checks. Trial services and browser are stopped before publication.

- In server: `npm run typecheck`; `npm test -- --run test/geo-authoring-extra.test.ts test/geo-codex-images.test.ts`.
- In web: `npx tsc --noEmit`; `npm test -- src/geo/hub/concept-pictures.test.tsx src/geo/hub/hub.test.tsx`.
- From the worktree: `node geo/copy/validate-copy.mjs web/src/geo/locales`; `node geo/ui/check-ui.mjs`; `git diff --check`.

UI rules: P2/P3/P4 (picture-local actions, disclosure for source details and cover), B1/B2/B3, S5/S6, Q6, T1/T4, A1/A2, R2/R4. Explicit task requirement names the login in the connection recovery message; model identity is otherwise behind the generation-method disclosure (visuals.source.record). No UI baseline changes.

hub-screen.tsx edits are limited to imports for auth/settings-close events, the visual-source refresh effect (initial/focus/provider-auth/capabilities changes, no polling, concurrent calls deduplicated), makeVisuals optional keys/instruction, cover prop, has-cover detection and onMake forwarding. The actual visuals route already forwards the complete body and needed no source edit.

Official source confirms previous-image editing (not merely regeneration): https://github.com/openai/codex/blob/e18a20d6eb6f5ede32a69fb56e3fe276d5e9d914/codex-rs/codex-api/src/endpoint/images.rs and the ImageEditRequest schema in codex-rs/codex-api/src/images.rs. The transport uses JSON images:[{image_url:data:...}], same auth/model/quota handling, with no fallback. This is source/transport-contract verification, not a live account test.

Screenshots: reports/2026-10-20-gaid-hub-editing/figures/p2-disconnected-{1440,1280}.png; p2-revise-{1440,1280}.png; p2-generation-info-1280.png; p2-dark-1440.png. Full originals and trial logs are at pc74:~/data/geoaidesk/work/gaid-hub-editing--concept-pictures/. The pictures in screenshots are synthetic UI fixtures, not AI-generated method content.

Korean section for the parent's canonical report (humanizer file-mode prose review completed):

### 개념 그림 안내와 수정

초안에 개념 그림의 용도와 생성 방식을 안내했습니다. 연결된 계정이 없어도 안내와 만들기 버튼이 보이며, 제공사 설정을 바로 열 수 있습니다. 그림은 방법을 설명하는 삽화이며 분석 자료나 결과가 아니라는 점을 표시합니다.

대표 그림, 단계 그림, 결과 그림마다 다시 만들기와 고쳐 만들기를 제공합니다. 고쳐 만들기는 기존 그림과 최대 500자의 수정 요청을 함께 보냅니다. 선택한 그림만 교체하며 이전 파일은 남깁니다. 전체 그림 만들기, 구독 사용량 한도 알림과 실행 기록도 유지합니다.

서버 시험 31개와 화면 시험 10개, 양쪽 타입 검사와 문구·UI 검사를 통과했습니다. 한국어 화면을 1440×900과 1280×800에서 확인했습니다. 화면의 그림은 합성 시험 자료이며, 실제 구독으로 그림을 생성하거나 편집하는 시험은 하지 않았습니다.
## Next steps
<!-- task:closed -->
Closed 2026-10-20T08:52:32Z: ready; the parent gaid-hub-editing integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Initial server typecheck found a local parameter/result variable name collision; renamed the input to priorImage.
- Initial UI test selected the native details group instead of the labelled picture group; narrowed the selector to picture action names.
- UI copy-length check found the Korean source explanation 5 characters over budget; shortened it without dropping a condition.
- A stopped transient systemd trial unit is removed; relaunched it from the recorded external start-server.sh, not via systemctl start.
## Notes and decisions
Sequential decisions: settle the keys/instruction contract, then runtime prior-image editing, then UI wiring and tests.
Owned files are the visuals runtime/transport, authoring contract, visual API method, draft/flow picture UI and visuals locale keys.
The actual route is `server/src/geo/routes/authoring-extra.ts`; it already passes the complete body through.
Parent owns other hub-screen edits; change only makeVisuals arguments and visualAction/cover wiring there.
Parent additionally authorized the bounded visual-source refresh effect in its 2026-10-20 message. It listens to focus,
provider-auth changes and capabilities changes (Settings close), with no timer.
No independent work packages or child writers: this is a tightly coupled child unit. Integration order is contract → backend → UI → checks/screenshots.
Codegraph has no index for this worktree; native bounded source reads are used.
API evidence: openai/codex main e18a20d6eb6f5ede32a69fb56e3fe276d5e9d914,
`codex-rs/codex-api/src/endpoint/images.rs` (edit endpoint and JSON body test), `codex-rs/codex-api/src/images.rs` (ImageEditRequest).
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
### Locale changes (exact before/after)

| String id | Locale | Before | After |
|---|---|---|---|
| hub.visuals.note | ko | 구독 사용량으로 만듭니다 | 개념 그림이며 분석 자료나 결과가 아닙니다 |
| hub.visuals.title | ko | (new) | 개념 그림 |
| hub.visuals.explanation | ko | (new) | 방법을 설명하는 그림입니다. 분석 자료나 결과가 아니며, 초안과 hub 등록 화면에 표시됩니다. |
| hub.visuals.how | ko | (new) | 생성 방식 보기 |
| hub.visuals.source.record | ko | (new) | 만들기를 누를 때만 OpenAI Codex (legacy) 로그인의 gpt-image-2로 생성합니다. 해당 구독의 그림 생성 한도를 사용하며, 다른 소스는 쓰지 않습니다. Sign in with ChatGPT 로그인은 그림 생성을 지원하지 않습니다. |
| hub.visuals.connect.action | ko | (new) | 제공사 설정 열기 |
| hub.visuals.checking | ko | (new) | 그림 생성 연결을 확인하고 있습니다. |
| hub.visuals.cover | ko | (new) | 대표 그림 |
| hub.visuals.actions | ko | (new) | {name} 개념 그림 동작 |
| hub.visuals.redo | ko | (new) | 다시 만들기 |
| hub.visuals.revise | ko | (new) | 고쳐 만들기 |
| hub.visuals.makeOne | ko | (new) | 그림 만들기 |
| hub.visuals.instruction | ko | (new) | 그림 수정 요청 |
| hub.visuals.placeholder | ko | (new) | 예: 블록을 더 크게, 색은 단색으로 |
| hub.visuals.editHint | ko | (new) | 기존 그림과 수정 요청을 함께 보냅니다. 최대 500자입니다. |
| hub.visuals.apply | ko | (new) | 수정 요청으로 만들기 |
| hub.visuals.cancel | ko | (new) | 수정 취소 |
| hub.visuals.needLogin | ko | 그림 생성 계정이 연결되지 않았습니다. 설정의 제공사에서 연결하세요. | 그림 생성 계정이 연결되지 않았습니다. 제공사 설정에서 OpenAI Codex (legacy)로 로그인하세요. |
| hub.visuals.note | en | Uses the subscription quota | Concept illustration, not analysis data or results |
| hub.visuals.title | en | (new) | Concept pictures |
| hub.visuals.explanation | en | (new) | Illustrations of the method, not analysis data or results. They appear in the draft and hub registration. |
| hub.visuals.how | en | (new) | View generation method |
| hub.visuals.source.record | en | (new) | Pictures are generated with gpt-image-2 through your OpenAI Codex (legacy) login only when you request them. They use that subscription's image quota, with no other picture source as a fallback. Sign in with ChatGPT does not support picture generation. |
| hub.visuals.connect.action | en | (new) | Open provider settings |
| hub.visuals.checking | en | (new) | Checking the picture connection. |
| hub.visuals.cover | en | (new) | Cover picture |
| hub.visuals.actions | en | (new) | {name} concept picture actions |
| hub.visuals.redo | en | (new) | Remake picture |
| hub.visuals.revise | en | (new) | Revise picture |
| hub.visuals.makeOne | en | (new) | Make picture |
| hub.visuals.instruction | en | (new) | Picture revision request |
| hub.visuals.placeholder | en | (new) | e.g. larger blocks, a single colour |
| hub.visuals.editHint | en | (new) | Sends the existing picture with your revision request. Up to 500 characters. |
| hub.visuals.apply | en | (new) | Make revised picture |
| hub.visuals.cancel | en | (new) | Cancel revision |
| hub.visuals.needLogin | en | No picture account is connected. Connect one in Settings → Providers. | No picture account is connected. Sign in with OpenAI Codex (legacy) in provider settings. |

## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-20-gaid-hub-editing/index.md
Parent owns the canonical report; this child supplies the section above and p2-* figures, not a separate report.
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
