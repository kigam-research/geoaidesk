---
format: 1
status: active
updated: 2026-10-12T23:09:44Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"5decd7e4-f38e-4e73-a0dd-0e3d9f8ff510","pid":138333,"provider":"claude","session":"4574dad1-b0b9-4bc4-828c-8e6e886cedc3","start":"27965222","token":"0e8b581b958a7ebbf30b6df3c417d49e0b22188df0413047437d5fda4f04f3ef"}
branch: task/gaid-ui-locale
target: main
parent: 
---
# gaid-ui-locale

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-ui-locale` (geoaidesk) — consistent Korean/English UI across the whole app

## User request (verbatim, Korean, 2026-10-12, geoaidesk hub)
> "GAID 시스템에서 워크플로우에서 geoscience 레시피만 한글이다. 시스템에 일관성이 있어야한다. 시스템을 한글모드로 할지 영어
> 모드로 할지도 검토되어야한다. 두 모드를 다 지원하는것도 고려해볼수 있을것이다."

The hub offered: 가) complete both modes (translate the upstream K-Dense UI too, so the existing language setting applies
app-wide), 나) English default with Korean only in GAID parts, 다) Korean only; and asked whether the agent's reply
language should follow the UI language. The user decided (verbatim):
> "1은 가이고, 2는 시스템언어와 독립적으로 사용자 지침이나 요청언어에 따르게해야한다."

## Scope (add no other required items)
1. Both UI modes complete and consistent: every visible string of the app (upstream K-Dense screens as well as GAID parts)
   follows the one language setting. Do the primary paths first and record what remains: chat window/composer and tabs,
   workflow panel (upstream categories and rows), file tree/preview panel, Settings, project screens; then the rest.
2. Agent reply language is independent of the UI language: it follows the user's instructions or the language of the
   request. Do not inject the UI locale into prompts; check GAID/upstream system prompts, GEO_INSTRUCTIONS, seeded
   sandbox AGENTS.md and catalogue prompts for anything that forces a reply language, and make them follow this rule.

## Verified facts from the hub
- GAID strings already live in `web/src/geo/locales/<namespace>/{ko,en}.json`, read with `t()` from `web/src/geo/i18n.ts`;
  locale = saved choice (`gaid:locale`, Settings → Appearance, `web/src/components/settings/appearance-panel.tsx`) else the
  browser language, Korean default; changing it reloads the page. The WP00 copy kit (`geo/copy/`: gaid-writing.md,
  terminology.csv, copy-policy.json, validator) runs in `scripts/check`.
- Catalogue data is bilingual (e.g. pinned geo-catalogue 0.2.1 `workflows.json` has `title/description/prompt/boundary`
  with `ko` and `en`), so Geoscience recipes can follow the setting.
- Upstream K-Dense UI strings are hard-coded English in components (e.g. `web/src/components/workflows-panel.tsx`), which is
  why Korean mode is mixed and English mode is nearly consistent.
- Hub suggestion (your design call): keep upstream diffs small for future upstream syncs (docs/upstream-sync.md), e.g. a
  lookup keyed by the upstream English source text with Korean translations, applied at a few choke points, rather than
  rewriting every upstream component; register any upstream file you touch in geo/integration-boundaries.json. Do not
  translate user data, file names, model names or raw data values. Korean text follows geo/copy rules and terminology.csv.
- Review instance the user is using: unit `gaid-review` from ~/deploy/geoaidesk, ports 3000/18000, data ~/.geoaidesk. Do not
  stop or modify it; run your own instance on other ports.
- Writer setup: you are the Claude top-level orchestrator; child writers/workers use the Paseo profile "general work"
  (gpt-6.1-sol high) at normal speed. No paid model runs unless the user asks (reply-language checks can use tests or a
  local model).
- Evidence: screenshots of the primary screens in Korean and English mode (small PNGs in the report folder), the remaining
  untranslated list, and the reply-language rule demonstrated. Checks: `scripts/check`. App data under
  ~/data/geoaidesk/work/gaid-ui-locale/. After your last check remove regenerable build caches and any app-written `.env`
  from the worktree (server/node_modules, server/src/helpers/.venv, web/node_modules, web/.next, web/next-env.d.ts,
  web/tsconfig.tsbuildinfo, __pycache__; prefer KADY_ENV_FILE outside the worktree so no `.env` is written) so the unit
  can close.

## Current state
Result (2026-10-13): one language setting now switches the whole app. All six child packages are integrated and
closed: 3,863 new ko/en message pairs (workflows 1,197 incl. 326 upstream workflow names/descriptions/484 input labels/
22 categories; work 736 incl. 229 database descriptions; settings 721; research 480; files 465; notebook 264) across 92
upstream files (all registered in geo/integration-boundaries.json, owner gaid-ui-locale). English mode is unchanged except
three validator-driven English rewordings (comparative-genomics description, services Gemini note, plaid database
description). Agent reply language: REPLY_LANGUAGE_RULE in GEO_INSTRUCTIONS (user-named language, else the latest
request's language); the UI locale never reaches the server; verified with local qwen3 30B and MiniMax-M3 (ko→ko,
en→en, ko+"답은 영어로"→en). Remaining English (report §5): upstream workflow prompts (open decision), server-generated
messages, file/catalogue-authored content (skill descriptions, seeded templates/specialists), embedded LibreOffice
dialogs, product/command names. Scanner: 1,191 → 21 hits (all commands/product names). Report:
reports/2026-10-13-gaid-ui-locale/index.md. Interim results reached main through task complete (PRs #22–#27).

Details:
- Shared setup done (writer): namespaces `settings`, `notebook`, `research`, `files`, `work`, `workflows` registered in
  `web/src/geo/locales/index.ts` (empty `{}` catalogues); one boundaries seam per package in
  `geo/integration-boundaries.json` (owner `gaid-ui-locale`, added to `geo/tests/distribution.test.mjs` owners).
- Reply language (scope 2) done: `REPLY_LANGUAGE_RULE` in `server/src/geo/instructions.ts` (GEO_INSTRUCTIONS);
  `server/test/geo-reply-language.test.ts` checks the rule and that no server source fixes a reply language or reads
  `gaid:locale`. Survey: no upstream/GAID system prompt, seeded sandbox AGENTS.md (`server/src/sandbox-seed.ts`) or
  catalogue 0.2.1 file forced a reply language; the server never receives the UI locale. Task drafts
  (`workspace.setup.draft`, `workspace.skill.draft`) are composer prefills the user sees and sends, so they are the
  request, not an injected locale.
- Reply-language demo (local model qwen3 30B gaid-64k via Ollama, own app on 3091/18091, no paid model):
  Korean request → Korean reply; English request → English reply; Korean request + "답은 영어로 쓰세요" → English reply.
  Same three requests with minimax/MiniMax-M3 (hosted, via the app): Korean → Korean, English → English, Korean +
  "답은 영어로" → English. Reply language only; content accuracy not judged (one Korean reply misnamed LAS).
  Raw SSE + script: ~/data/geoaidesk/work/gaid-ui-locale/reply/ (run.sh, MODEL=..., 0?-*/1?-*.sse). Ollama model unloaded.
- Own app instance: systemd user unit `gaid-ui-locale-app` (~/data/geoaidesk/work/gaid-ui-locale/app/run.sh, dev mode
  from this worktree, data in that folder, log app.log). Screenshot script: ~/data/geoaidesk/work/gaid-ui-locale/browser/
  shots.mjs (baseline/ = before children). Stop the unit before finish.
- Integrated gaid-ui-locale--workflows (3fd524c, closed): 1,197 messages (326 names, 326 descriptions, 484 input labels,
  22 categories, 39 controls); en generated from web/src/data/workflows.json (generate-en.mjs), parity test
  web/src/geo/workflows-locale.test.tsx; one upstream English description reworded (comparative-genomics, registered).
  Two failed child test jobs disposed as superseded by job 20261012T142512 (978 web tests passed).
- Integrated gaid-ui-locale--notebook (closed): 264 messages; lab notebook, evidence summary, result links, provenance
  panel, scientific result card; plus web/src/lib/notebook-filters.ts and notebook-timeline.ts (registered). Child jobs:
  2 succeeded (972 web tests).
- Integrated gaid-ui-locale--files (closed): 465 messages; file preview, viewers, LaTeX, PDF, Office (app-owned ribbon;
  the embedded LibreOffice engine's own dialogs stay vendor text); plus 5 lib helpers (registered). Child jobs: 1
  superseded, 1 succeeded (972 web tests).
- Integrated gaid-ui-locale--settings (closed): 721 messages (incl. 134 app-authored provider/MCP metadata); one English
  string reworded ("unlocks" → "enables", validator). No extra upstream files. Child ran the web suite (972) outside a job.
- Integrated gaid-ui-locale--research (closed): 480 messages in the plan, robustness, next-experiments, memory and
  evidence-package dialogs; English unchanged; scientific caveats kept. Child ran the web suite (972) outside a job.
- Baseline scan (`~/data/geoaidesk/work/gaid-ui-locale/tools/scan.mjs web/src`): 1191 English literals in 79 upstream
  files; 326 upstream workflows (22 categories) with English name/description/placeholder labels.

## Next steps
1. `task finish` (runs scripts/check); afterwards remove build caches (server/node_modules, server/src/helpers/.venv,
   web/node_modules, web/.next, web/next-env.d.ts, web/tsconfig.tsbuildinfo, __pycache__) if close reports them.
   Own app unit `gaid-ui-locale-app` is stopped.

## Children (started 2026-10-12, profile "general work", prompts in ~/data/geoaidesk/work/gaid-ui-locale/prompts/)
- gaid-ui-locale--workflows: agent 7c5ad9b2-35a5-488e-ad56-4d3d0008f9bb — completed and closed
- gaid-ui-locale--work: agent a21bc230-636f-4990-93a2-4ec585bd7fd4
- gaid-ui-locale--files: agent e2cc47a6-cd2c-4eb2-911c-522a86045e22 — completed and closed
- gaid-ui-locale--settings: agent 597a1537-b69e-4291-b5f7-44e6e6807109 — completed and closed
- gaid-ui-locale--notebook: agent 334bb7bf-c7ab-4250-b73e-1471a312e37f — completed and closed
- gaid-ui-locale--research: agent 34dfdfe5-4370-41a2-aa9d-087d58daaee3 — completed and closed

## Work plan (orchestration)
Sequential decisions (settled by the writer):
- Keep the established GAID pattern (gaid-korean-workspace): upstream components call `geoText("<ns>")` / `t()` with
  ids `<namespace>.<area>.<snake_of_english>`; English catalogue text = the upstream string verbatim (English mode and
  upstream tests unchanged; vitest jsdom runs in en-US), Korean per geo/copy. Chosen over a DOM/English-text lookup:
  the copy validator and the existing 26 converted files already use ids, and a text-keyed runtime lookup would miss
  composed strings. Upstream diffs stay one-line substitutions.
- Upstream workflow rows: name/description/placeholder labels translated in `web/src/geo/locales/workflows/` keyed by
  workflow id; `web/src/data/workflows.json` stays the English source and the fallback for ids without a translation.
  Prompts (420K chars) stay as shipped (English) — listed as remaining.
- Not translated: user data, file names, model/provider names, raw values, server-generated error texts (listed as
  remaining).
Independent packages (one child each, own namespace dir + listed files; nobody else edits `locales/index.ts` or
`geo/integration-boundaries.json`):
- `settings` → locales/settings; Settings dialog and panels, skills/prompts/specialists/connectors/custom models,
  sign-in dialogs, token gate.
- `notebook` → locales/notebook; lab notebook view/cards/timeline, evidence summary, result links, provenance panel,
  scientific result card.
- `research` → locales/research; plan, robustness, next-experiments, memory, evidence-package dialogs.
- `files` → locales/files; file preview panel, sandbox panel, viewers, LaTeX, PDF, Office.
- `work` → locales/work; chat tab/composer/tabs, tool activity, automation, Modal jobs, fleet, cost pill, pickers,
  project screens, ui primitives, page.tsx remainder.
- `workflows` → locales/workflows; workflows panel categories/rows, workflow inputs, 326 workflow translations.
Integration order: workflows, work, files, settings, notebook, research (each `task complete`), then reconcile
boundaries against `git diff --name-only origin/main`, rescan, browser screenshots (ko/en), report, `scripts/check`.

## Failed approaches
- 2026-10-12: five of six children (work, files, settings, notebook, research) stopped right after start with Paseo
  "[System Error] Selected model is at capacity" (gpt-6.1-sol), before `task resume`. Not a code problem; resent the
  same start prompt once with `paseo send <id> --prompt-file` (prompts saved in /tmp/gaid-retry/); all five running.
- 2026-10-13: work and research stopped again mid-work with the same capacity error (uncommitted work kept in their
  worktrees: work 27 files, research 9). Sent /tmp/gaid-retry/continue.md (save progress first, then finish). If it
  recurs, consider a different worker profile for these two.

- 2026-10-13: removed the work child's build caches while its `task finish` check was still running (status was
  `ready`, finish commit pushed, but no completion record yet) → its check failed on missing vitest files. Told the child;
  it reruns finish. Lesson: clean a child's caches only after `task complete` succeeds.

## Notes and decisions
- User (2026-10-12, verbatim): "그리고 이미 minimax api 연동되어 있을것이다." MINIMAX_API_KEY is in the review instance's
  ~/.geoaidesk/config.env; the own instance's run.sh loads only `MINIMAX_*` from it (value never printed). Used for the
  hosted-model reply-language check in addition to the local model.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
- [결정] K-Dense workflow 프롬프트 본문(326개)을 한국어로도 둘지 — 가) 영어 유지, 한국어 답은 요청에 지시를 덧붙임 — 나) 한국어 프롬프트를 추가해 한국어 모드에서 한국어 요청으로 넣음(별도 작업, 약 42만 자) — 권장: 가) 번역량이 크고 프롬프트는 화면 문구가 아닌 요청 내용이며 응답 언어 규칙이 지시를 따름 — 막힌 일: 없음 — 근거: reports/2026-10-13-gaid-ui-locale#6-결정할-일
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-13-gaid-ui-locale/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
