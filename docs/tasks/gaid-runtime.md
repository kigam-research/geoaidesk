---
format: 1
status: active
updated: 2026-10-11T02:38:01Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"b82d61f9-5a6a-4f75-927c-8fa251f33d2c","pid":3628209,"provider":"claude","session":"bb619be9-c3b3-4f12-a95f-244d4d2f2c38","start":"15227338","token":"4f8fd5c979bc3f8cf27ceb58e285e3aee5e10c1aae29218d216f1df7838df552"}
branch: task/gaid-runtime
target: main
parent: 
---
# gaid-runtime

## Goal and done criteria
Request from the starter:

# Writer brief: WP03 `gaid-runtime` (geoaidesk)

This unit answers forwarded goal 29a3428c445f from the skill_hub project hub. The full forwarded request,
including the user's verbatim words, is in /home/seongin3/data/geoaidesk/work/hub/29a3428c445f.md — read it
first; it is the authoritative scope. Summary only:

- User decisions (verbatim): "2번 GeoAIDesk(약칭 GAID), 나머지는 권장방식으로 하자." and "구현 시작하자."
- Package WP03 `gaid-runtime` (geo-byok-plan.md in kigam-research/skill_hub main 0228785):
  Goal: prepared environments, exact catalogue provisioning, useful file summaries, and workable local-model setup.
  Owns: environment/profile loaders; catalogue staging adapter; shared inspection contract/dispatch;
  `server/src/geo/{context,tools,read-hints}.ts`; session/seed/config/backend registration seams; local-model
  setup component.
  Done: both helper and analysis environments have required packages; selected model/context persists; initial
  prompt budget is visible; task exposure does not corrupt source packages; unsuitable large-file reads return a
  bounded next action. Deterministic tests cover these behaviors and existing-project preservation.
  Publishes stable interfaces for WP04/WP05/WP07 (see "Frontend registry seam" in plan 2.1 Review amendments).
- Inputs and status:
  - WP02 gaid-fork-base is merged on geoaidesk main (report reports/2026-10-11-gaid-fork-base/index.md, be24bb1).
  - WP01 contracts/export on skill_hub main: docs/specs/gaid-{product,interfaces,migration}.md, schemas,
    web/scripts/export-byok.ts. WP06 gaid-workflows (skill_hub) finished: release 0.2.0 (13 skills incl.
    kigam/geo-map-and-crs, 7 workflows) under registry/byok/; use the latest release on skill_hub main.
  - WP00 design/copy is still running in skill_hub; its artifacts arrive later — do not block on them.
  - Read skill_hub files with
    `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
    (raw.githubusercontent.com is blocked on the KIGAM network; pass this to any worker using the network).
- No paid model runs unless the user asks.
- Checks: `scripts/check` (see AGENTS.md). App data for task work goes under
  ~/data/geoaidesk/work/gaid-runtime/, never inside the repo.
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
