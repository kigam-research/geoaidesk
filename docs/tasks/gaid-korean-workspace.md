---
format: 1
status: waiting
updated: 2026-10-11T06:32:53Z
writer: {"host":"seongin3","reserved":"1a4386f654d16d2945fa89db25384d9bf52e4732defb4b77b0f0281efd272b96"}
branch: task/gaid-korean-workspace
target: main
parent: 
---
# gaid-korean-workspace

## Goal and done criteria
Request from the starter:

# Writer brief: WP07 `gaid-korean-workspace` (geoaidesk)

This unit answers forwarded goal b619ca2ff749 from the skill_hub project hub. The full forwarded request, including the
user's verbatim words, package text, status and inputs, is in /home/seongin3/data/geoaidesk/work/hub/b619ca2ff749.md —
read it first; it is the authoritative scope (goal, owned files, done criteria, order). Do not add required items.

Verified facts from the hub (2026-10-11):
- geoaidesk main (57527b4 or later) contains WP02 gaid-fork-base, WP03 gaid-runtime + gaid-runtime-followups,
  WP04 gaid-well-tables (950786a) and WP05 gaid-maps (fe1fd72); reports under reports/2026-10-11-*/index.md.
  No other geoaidesk unit is running, so WP07 owns the shared frontend seams (viewer registry, file-preview dispatch,
  use-sandbox, suggestion seam) including non-additive changes.
- Writer setup by the user's choice ("현재 수행중인 작업까지만 astra fast로 작업 후 다시 기존대로 opus 5.5 오케스트레이터에
  gpt 6.1 sol high 워커로 작업하는 방식으로 진행하자."): you are the Claude top-level orchestrator; child writers and
  delegated workers use the Paseo profile "general work" (gpt-6.1-sol high) at normal speed (no fast/priority).
- skill_hub inputs: read with
  `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
  (raw.githubusercontent.com is blocked on the KIGAM network; pass this to any worker using the network).
  WP00 (design tokens, design/copy/gaid-writing.md, terminology.csv, copy-policy.json, copy validator) is finishing on
  skill_hub branch task/gaid-design-copy and lands on main shortly; use main once it is there (the skill_hub hub tells
  the geoaidesk hub if it is delayed; ask the geoaidesk hub if you are blocked on it).
- Catalogue release 0.2.1 (sha256 e9f50606…f55f5) exists in skill_hub; pinning it in geoaidesk is WP10, not this unit.
- The backbone task CLI fix that exempts `.env.example` from the job snapshot check is live on PC74 (backbone 0031581),
  so `task job run` works in this repo again.
- No paid model runs unless the user asks.
- Checks: `scripts/check` (see AGENTS.md). App data for task work goes under ~/data/geoaidesk/work/gaid-korean-workspace/,
  never inside the repo. After your last check, remove regenerable build caches from the worktree (server/node_modules,
  server/src/helpers/.venv, web/node_modules, web/.next, web/next-env.d.ts, web/tsconfig.tsbuildinfo, __pycache__)
  so the unit can close.
- When the unit completes, its outcome returns to the skill_hub hub automatically through the goal link.

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
