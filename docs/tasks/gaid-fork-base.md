---
format: 1
status: active
updated: 2026-10-11T01:51:08Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"0c2ee874-5ddb-4118-9f20-209b6d8b615a","pid":3424104,"provider":"claude","session":"53669a44-52c3-4de7-84fd-3986e964ef40","start":"14946049","token":"204294a4c7b769cb17cdc00690c68a91f04cb61b74c54d3c345e6470c46afaf0"}
branch: task/gaid-fork-base
target: main
parent: 
---
# gaid-fork-base

## Goal and done criteria
Request from the starter:

# Writer brief: WP02 `gaid-fork-base` (geoaidesk)

This unit answers forwarded goal 96013b310a2c from the skill_hub project hub. The full forwarded request,
including the user's verbatim words, is in /home/seongin3/data/geoaidesk/work/hub/96013b310a2c.md — read it
first; it is the authoritative scope. Summary only:

- User decisions (verbatim): "2번 GeoAIDesk(약칭 GAID), 나머지는 권장방식으로 하자." and "구현 시작하자."
  Product name GeoAIDesk, short GAID; this repo (kigam-research/geoaidesk) is the separate public fork.
- Package WP02 `gaid-fork-base` (geo-byok-plan.md in kigam-research/skill_hub main d5b8d86):
  Goal: independently installable, attributed, release-oriented fork.
  Owns: fork registration/rules, `geo/distribution.json`, `geo/upstream.lock.json`,
  `geo/integration-boundaries.json`, launch wrappers, production-start seam, notices, release workflow,
  initial shared locks, app check wrapper.
  Done: clean installation opens the research workspace; production start/stop/restart preserves a project;
  excluded document extras are not auto-fetched; upstream checks are retained; user-data locations are
  distinct from the source checkout.
- Inputs: upstream base 44c52cee8e9fdc343c6132909769f49accf14a82 (main already has the backbone bootstrap
  commit 58389b87 on top); WP01 contracts in skill_hub main: docs/specs/gaid-{product,interfaces,migration}.md
  and schemas. Read the plan and contracts with
  `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
  (raw.githubusercontent.com is blocked on the KIGAM network; pass this to any worker using the network).
  Relevant plan sections: "Main-session amendments", 2.1-2.7, 4.1-4.6, 7.1, WP02. Korean report:
  skill_hub reports/2026-10-11-geo-byok-plan/index.md.
- WP00 (design tokens + copy rules, skill_hub) is still running; its artifacts arrive later, so do not block
  on them.
- No paid model runs unless the user asks.
- Checks: `scripts/check` (see AGENTS.md). App data for task work goes under
  ~/data/geoaidesk/work/gaid-fork-base/, never inside the repo.
- When the unit completes, its outcome returns to the skill_hub hub automatically through the goal link
  (so WP03 can be sent next).

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
