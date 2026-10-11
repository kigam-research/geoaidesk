---
format: 1
status: waiting
updated: 2026-10-11T08:00:04Z
writer: {"host":"seongin3","reserved":"755162dc1445543293b14cc570ff1c499e9d6d77636aaecc6688a83b01392fa6"}
branch: task/gaid-release-proof
target: main
parent: 
---
# gaid-release-proof

## Goal and done criteria
Request from the starter:

# Writer brief: WP10 `gaid-release-proof` (geoaidesk)

This unit answers forwarded goal 74dde3d16e8f from the skill_hub project hub. The full forwarded request, including the
user's verbatim words, package text, inputs and approval boundaries, is in
/home/seongin3/data/geoaidesk/work/hub/74dde3d16e8f.md — read it first; it is the authoritative scope (goal, owned files,
done criteria, order). Do not add required items.

Verified facts from the hub (2026-10-11):
- geoaidesk main (882cd56 or later) contains WP02, WP03 + gaid-runtime-followups, WP04, WP05 and WP07 (6d2d290); reports
  under reports/2026-10-11-*/index.md. No other geoaidesk unit is running.
- Answered items that this unit carries (geoaidesk docs/open-items/closed/gaid-runtime.md):
  gaid-runtime#1 가) — test 64K and 98K local contexts on real tasks; gaid-runtime#2 가) — publish the catalogue archive on
  the geoaidesk GitHub Release and let the app download it pinned by hash. Pin skill_hub catalogue 0.2.1
  (sha256 e9f506068a4cb2e0b2f207ccc2db760db7641e624fa08ba729604421c6ef55f5; artifact
  pc74:~/data/skill_hub/work/gaid-catalogue-proof/0.2.1/; register it as an asset per AGENTS.md / configs/inputs.toml).
- WP07 noted that the vendored GAID brand assets (geo/brand/README) still lack institutional branding clearance for public
  release. Raise it with the user in the writer tab before any public release; do not decide it yourself.
- Approval boundaries from the request: ask the user in your tab before any paid/subscription model run (personal API,
  ChatGPT sign-in) and before publishing a public GitHub Release.
- skill_hub WP09 gaid-contributions and WP08 are still running; import WP09 public intake templates when they land on
  skill_hub main (ask the geoaidesk hub if blocked on them).
- Writer setup by the user's choice ("현재 수행중인 작업까지만 astra fast로 작업 후 다시 기존대로 opus 5.5 오케스트레이터에
  gpt 6.1 sol high 워커로 작업하는 방식으로 진행하자."): you are the Claude top-level orchestrator; child writers and
  delegated workers use the Paseo profile "general work" (gpt-6.1-sol high) at normal speed.
- skill_hub files: `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
  (raw.githubusercontent.com is blocked on the KIGAM network; pass this to any worker using the network).
- `task job run` works in this repo (backbone 0031581 exempts `.env.example`); use it for runs to keep (install/update
  trials, model-route runs).
- Other hosts: `ssh pc71` (PC71 WSL), `ssh pc71-win` (PC71 Windows), `ssh pc70`; use them only as needed for the advertised
  environments (Linux/WSL first, Windows native P1, macOS untested).
- Checks: `scripts/check`. App data under ~/data/geoaidesk/work/gaid-release-proof/, never inside the repo. After your last
  check, remove regenerable build caches from the worktree (server/node_modules, server/src/helpers/.venv,
  web/node_modules, web/.next, web/next-env.d.ts, web/tsconfig.tsbuildinfo, __pycache__) so the unit can close.
- When the unit completes, its outcome returns to the skill_hub hub automatically through the goal link (WP11 follows).

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
