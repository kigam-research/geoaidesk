---
format: 1
status: active
updated: 2026-10-20T08:40:41Z
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
