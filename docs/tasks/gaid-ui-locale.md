---
format: 1
status: waiting
updated: 2026-10-12T14:00:44Z
writer: {"host":"seongin3","reserved":"0e8b581b958a7ebbf30b6df3c417d49e0b22188df0413047437d5fda4f04f3ef"}
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
