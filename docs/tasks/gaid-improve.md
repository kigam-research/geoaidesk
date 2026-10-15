---
format: 1
status: waiting
updated: 2026-10-15T05:59:57Z
writer: {"host":"seongin3","reserved":"6331bb98ad7a5d6a212beb6348c7759bb7f33b032b95f02ab23b0254d2b27553"}
branch: task/gaid-improve
target: main
parent: 
---
# gaid-improve

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-improve` (geoaidesk) — standing session for GAID improvements

## User words (verbatim, Korean, 2026-10-15, geoaidesk hub)
> "GAID개선 작업을 수행하려고 한다. 우선 현재까지 최신 현황을 파악해두고 사용자의 지시를 기다리는 작업트리 세션을 생성해두자.
> 해당 세션은 gpt 6 astra ultrahigh fast 모드로 켜두자."
Writer setup chosen by the user: Codex gpt-6-astra, thinking "ultra" (the user picked "ultra" when asked what "ultrahigh"
means), fast mode (service_tier priority). Keep fast and this thinking level through resume and handoff.

## What to do now
1. Get the current state of GAID and record it briefly in docs/tasks/gaid-improve.md (no report, no code changes):
   - geoaidesk main (latest commit), merged work packages and units: reports/*/index.md (newest:
     reports/2026-10-14-gaid-qwen-followups, 2026-10-14-gaid-kigam-qwen-trial, 2026-10-13-gaid-ui-locale,
     2026-10-12-gaid-workflow-catalog, 2026-10-12-gaid-map-table-ux, 2026-10-12-gaid-map-tiles, 2026-10-11-*), AGENTS.md
     GeoAIDesk section, docs/open-items/ (currently no open items), geo/compatibility.json, docs/geo/.
   - Known external states (hub-verified): skill_hub new GAID site has "GAID에서 설치" pages but public publication waits
     for institutional brand approval (skill_hub report reports/2026-10-12-gaid-site-cutover); app release geo-v0.1.0 is a
     GitHub draft for the same reason. KIGAM internal Qwen server http://10.13.15.67:8000/v1 works (see the trial reports).
   - The user's review instance: unit `gaid-review` from ~/deploy/geoaidesk (main 81b620b), ports 3000/18000, data
     ~/.geoaidesk, custom provider `kigam-qwen` registered (reasoning levels low/medium/xhigh). The user uses it from PC71
     through `ssh -N -L 3000:localhost:3000 -L 18000:localhost:18000 pc74`. Read-only for you: do not stop or modify it;
     the hub updates it after merges.
2. Then wait for the user's instructions in this tab. Summarize the state to the user in Korean (합니다체) in a few lines
   and ask what to improve. Do not start changes before the user says so.

## Rules
- Follow the worktree's AGENTS.md. Child writers/workers, if needed later, use the "general work" profile at normal speed
  unless the user says otherwise. No paid model runs unless the user asks. Checks: scripts/check when code changes.
- Unrelated new goals go to the hub with `task hub --send`.

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
