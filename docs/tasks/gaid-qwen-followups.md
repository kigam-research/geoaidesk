---
format: 1
status: waiting
updated: 2026-10-14T12:04:29Z
writer: {"host":"seongin3","reserved":"acc2f6e1a2eedb1f911909f9faae8f5ba572260b726036e607ba7f18c6b6ba3e"}
branch: task/gaid-qwen-followups
target: main
parent: 
---
# gaid-qwen-followups

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-qwen-followups` (geoaidesk) — fixes from the KIGAM Qwen trial, then re-trial

## User answer (verbatim, Korean, 2026-10-14, geoaidesk hub)
> "1번은 가로하고 2번은 가로 하면서 높음을 지정하면 보통으로 보내지게 하자."
Items (docs/open-items/gaid-kigam-qwen-trial.md; evidence reports/2026-10-14-gaid-kigam-qwen-trial/index.md §5–6):
- gaid-kigam-qwen-trial#1 가): make geo catalogue skills install into a new project right away (today a project created
  in the UI gets them only after an app restart), then re-run the local-model and institutional-server trials with the
  skills present.
- gaid-kigam-qwen-trial#2 가) with the user's addition: per custom model server, configure which reasoning levels it
  accepts and never send an unaccepted value; when "높음" (high) is selected for the KIGAM server, send "보통" (medium).
  Make the downgrade visible to the user (e.g. in the thinking selector or a note), not silent.

## Verified facts
- KIGAM server: `http://10.13.15.67:8000/v1` (vLLM 0.30.0), models `qwen3.8-flash-next`, `/models/Qwen3.8-27B`,
  `/models/Qwen3.6-27B`; the trial found "high" rejected, "off/low/medium" work. Local route: `gaid-local` (Ollama), see
  WP10 report reports/2026-10-11-gaid-release-proof/index.md. Reuse the trial harnesses and inputs from
  ~/data/geoaidesk/work/gaid-kigam-qwen-trial/ and ~/data/geoaidesk/work/gaid-release-proof/.
- Thinking level is applied in `server/src/agent/thinking.ts` after `setModel`; custom servers live in
  `server/src/agent/custom-models.ts` (Pi models.json; `modelThinkingLevels` is not exposed today — see AGENTS.md).
  Provisioning: `server/src/geo/provision.ts`, `skills-sync.ts`.
- The user's review instance (unit `gaid-review`, ~/deploy/geoaidesk, ports 3000/18000, data ~/.geoaidesk) has the KIGAM
  server registered as custom provider `kigam-qwen`. Do not change that instance; the hub updates it after merge. Run
  your own instance on other ports with its own GAID_HOME under ~/data/geoaidesk/work/gaid-qwen-followups/.
- Shared server: one trial at a time; record wall-times. No paid model runs.
- Writer setup: you are the Claude top-level orchestrator; child writers/workers use the Paseo profile "general work"
  (gpt-6.1-sol high) at normal speed.
- Runs to keep through `task job run`. Update geo/compatibility.json and docs/geo/compatibility.md with the re-trial.
  Checks: `scripts/check`. After your last check remove regenerable build caches and any app-written `.env` from the
  worktree so the unit can close.

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
