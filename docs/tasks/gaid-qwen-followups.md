---
format: 1
status: active
updated: 2026-10-14T12:12:34Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"fbead749-8243-46b1-80b0-f0fcb3855d07","pid":371150,"provider":"claude","session":"e61fac4b-e55f-422d-9768-8ca73a767600","start":"44547984","token":"acc2f6e1a2eedb1f911909f9faae8f5ba572260b726036e607ba7f18c6b6ba3e"}
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
- Plan settled (see Notes). Package A (skills on project create) in progress by the orchestrator; package B delegated
  to child unit `gaid-qwen-followups--gaid-qwen-reasoning` (writer f950c83f, workspace wks_f2ee75fc2036fa9c, worktree ~/worktrees/geoaidesk/gaid-qwen-followups--gaid-qwen-reasoning; started 2026-10-14).
## Next steps
1. A: provision geo catalogue in `POST /projects` (geo mode) + fix unprefixed `/sandbox/init`; tests.
2. Start child B; while it runs, extend route-trial record with installed-skill evidence and run the local re-trial.
3. After B merges into this branch: KIGAM re-trial with thinking "high" (sent as medium), update compatibility docs,
   report, `scripts/check`.
## Failed approaches
## Notes and decisions
- Finding (2026-10-14): the UI New project dialog already calls `POST /projects/:id/sandbox/init` after create
  (`web/src/lib/use-projects.ts`), which runs `provisionProjectSkills`; the trial report's "web code does not call it"
  was wrong. The gap is `POST /projects` itself (route-trial and any API client get no skills until restart) and the
  unprefixed `POST /sandbox/init` (calls upstream `seedProjectSkills`, bypassing the geo catalogue). Verify the UI path
  on a live instance anyway.
- Decision A: in geo catalogue mode `POST /projects` provisions the pinned catalogue synchronously before replying;
  non-geo mode keeps upstream behaviour (UI calls sandbox/init). Unprefixed `/sandbox/init` uses `provisionProjectSkills`.
- Decision B: accepted reasoning levels are a per-custom-server setting written into Pi `models.json` as each
  reasoning model's `thinkingLevelMap` (Pi 1.0 field), so the lead, subagent children and one-shot calls all send the
  same mapped value. Rule: an accepted level maps to itself; an unaccepted level maps to the nearest lower accepted
  level, else the nearest higher one; no accepted level -> null (unsupported). KIGAM {low, medium, xhigh}: minimal->low,
  high->medium, xhigh->xhigh (fixes today's xhigh->high clamp). Pi's own clamp would send high->xhigh, hence an explicit
  map rather than null entries. The UI shows the substitution in the thinking selector. Existing saved providers are
  not rewritten; the review instance's `kigam-qwen` gets the setting from the hub after merge.
- Packages: A (orchestrator) owns `server/src/api/projects.ts`, `server/src/api/skills.ts`, `server/src/geo/provision.ts`,
  `geo/release-proof/*`, trials, compatibility docs, report. B (child) owns `server/src/agent/custom-models.ts`,
  `server/src/api/custom-models*`, `web/src/lib/custom-models.ts`, `web/src/components/custom-models-card.tsx`,
  `web/src/components/thinking-selector.tsx`, `chat-tab.tsx`/`defaults-panel.tsx` wiring, `web/src/geo/locales/app/*`.
  Shared: `geo/integration-boundaries.json`, AGENTS.md (each edits its own lines). Integration order: A commits on this
  branch; B merges via `task complete`; then KIGAM re-trial.
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
- /home/seongin3/data/geoaidesk/runs/gaid-qwen-followups-20261014T121210.303517Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-qwen-followups-20261014T121233.638014Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
