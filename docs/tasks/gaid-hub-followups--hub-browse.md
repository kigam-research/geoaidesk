---
format: 1
status: waiting
updated: 2026-10-18T04:43:24Z
writer: {"host":"seongin3","reserved":"2df86b15744ca28cbee2c16419a110bf67b00f4a71a8d124f2ca31e90ac1332d"}
branch: task/gaid-hub-followups--hub-browse
target: task/gaid-hub-followups
parent: gaid-hub-followups
---
# gaid-hub-followups--hub-browse

## Goal and done criteria
Request from the starter:

# Child unit: gaid-hub-followups--hub-browse (GeoAIDesk)

Parent: gaid-hub-followups (Claude writer). User request, verbatim (2026-10-18): "gaid-hub-integration와 gaid-hub의 작업 및 개선 작업에 대해 권장 옵션으로 작업 진행하자." then "시작하자."
Your package = open item gaid-hub#3: "허브 첫 화면에 다른 연구자가 등록한 방법 목록(폴더·검색) 추가"
(reports/2026-10-16-gaid-hub/index.md section 5: the first-time researcher could not browse methods other researchers
registered, by folder and search, from the hub home).

Network note: the KIGAM network blocks raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"`.

## Context
- Hub home: web/src/geo/hub/hub-home.tsx (recommended cards on top; "나의 스킬 · Workflow" = the researcher's own authoring
  projects in folders below). Shared hub client web/src/geo/hub/shared-api.ts (folders, entries(folder), entry, register,
  star, comment, install, recommended); server server/src/geo/hub-shared/routes.ts (GET /geo/hub/entries already accepts
  `folder` and `q`), store.ts; contract web/src/geo/contracts/hub-shared.ts. Registered method page:
  web/src/geo/hub/shared-entry.tsx. Design: docs/design/hub-authoring-service.md and AGENTS.md "GAID hub".
- Screen rules: docs/design/ui-guide.md — read sections 1 and 9, then G (lists/cards: G1–G4, search G3), N, F3 (empty
  state), W5 budget. Copy: AGENTS.md "UI copy and locales"; strings under web/src/geo/locales/hub/{ko,en}.json; add your keys
  under a new `home.browse.*` prefix (the parent edits other hub keys).

## Goal (done)
On the hub home, a "허브에 등록된 방법" section (or tab next to "나의 스킬 · Workflow" — choose by P1/P3/W5; one primary
action per view) lists entries every researcher registered: topic folders (with counts) + one search box (title, tagline,
author, taxonomy labels), result cards per G4 (title, one-line tagline, author, star count, folder), empty/no-result states
per F3, click opens the existing registered-method page. Search runs server-side via `q` (extend the server match if it
does not cover tagline/author/taxonomy) with a small debounce. Sorted by stars then recency; folder "전체" default.
Tests: server route test for q/folder filtering; a web test for the list (search + folder switch + empty state).

## Rules
- Work only in your printed worktree. Own: web/src/geo/hub/hub-home.tsx, web/src/geo/hub/shared-api.ts,
  server/src/geo/hub-shared/**, web/src/geo/contracts/hub-shared.ts, new files under web/src/geo/hub/ for the list, the
  `home.browse.*` locale keys. Do not touch other web/src/geo/hub files, server/src/geo/authoring/**, or chat/workspace files
  (parent and sibling own them). If you need a change there, note it in your task document and tell the parent.
- Checks: targeted vitest + `cd server && npm run typecheck`, `cd web && npx tsc --noEmit`, `node geo/ui/check-ui.mjs`,
  `node geo/copy/validate-copy.mjs web/src/geo/locales`; full scripts/check once before task finish.
- Visual: Korean screenshots 1440x900 and 1280x800 with at least 3 registered entries in 2 folders (seed them through the
  app's own API on your dev instance; data under ~/data/geoaidesk/work/gaid-hub-followups--hub-browse/, ports 3350/18350,
  launched with `systemd-run --user` and file logs; never inside the repo; playwright-cli skill). Small PNGs under
  ~/data/geoaidesk/work/gaid-hub-followups/figures/hub-browse/ and a Korean section text for the parent's report (rule ids,
  string ids with ko/en) in your task document's Current state. No report of your own.
- Finish with `task finish`.

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
