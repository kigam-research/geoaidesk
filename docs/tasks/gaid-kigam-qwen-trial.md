---
format: 1
status: waiting
updated: 2026-10-14T04:57:27Z
writer: {"host":"seongin3","reserved":"2e679572e64c04a061b1ba8a728b7c93825bb5531f6ac582b96a513ab7656176"}
branch: task/gaid-kigam-qwen-trial
target: main
parent: 
---
# gaid-kigam-qwen-trial

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-kigam-qwen-trial` (geoaidesk) — real-task trial of the KIGAM internal Qwen server

## User words (verbatim, Korean, 2026-10-14, geoaidesk hub)
> "현재 67ip llm 서버가 복구되었다. 사용가능한지 확인해보자."
The hub checked it and offered 가) register it in the user's review app and 나) run the WP10-deferred "기관 내부 Qwen
서버" trial as a unit (well-log QC and map-plus-area-table tasks, results into the compatibility record). User: "가와 나 모두 진행하자."
Background: WP10 report reports/2026-10-11-gaid-release-proof/index.md §6 lists "기관 내부 Qwen 서버" as a pending route
trial ("2026-10-11에 연결되지 않았습니다").

## Scope (add no other required items)
Run the same real-task trials WP10 ran for the local Ollama route, on this server, record connection and task outcomes
separately, and update the compatibility record (geo/compatibility.json, docs/geo/compatibility.md) and any affected
model-route guidance. Untested combinations stay untested.

## Verified facts (hub, 2026-10-14)
- Server `http://10.13.15.67:8000` (vLLM 0.30.0, OpenAI-compatible `/v1`, no key needed from PC74). Models (all
  `max_model_len` 262144, reasoning output): `qwen3.8-flash-next`, `/models/Qwen3.8-27B`, `/models/Qwen3.6-27B`. A short
  chat completion and a single tool call (`read`) succeeded on each (0.6–1.8 s).
- In the user's review instance the hub registered it as custom provider `kigam-qwen` (openai-completions, contextWindow
  262144, maxTokens 16384, reasoning true, cost 0). Do not change that instance (unit `gaid-review`, ports 3000/18000, data
  ~/.geoaidesk); run your own instance on other ports with its own GAID_HOME under ~/data/geoaidesk/work/gaid-kigam-qwen-trial/.
- WP10 trial design, harness and inputs: see the WP10 report, docs/geo/compatibility.md and the WP10 evidence under
  ~/data/geoaidesk/work/gaid-release-proof/ (FORCE 25/9-1 well-log QC, synthetic map with known areas). Reuse them.
- Budget/billing: the server is the institution's own; it is not a paid provider run. Custom providers are billed payg
  at their declared cost (0 here) — note in the report if the route should get the `local` billing class like gaid-local.
- Shared server: keep concurrency modest (one task at a time) and record wall-times.
- Writer setup: you are the Claude top-level orchestrator; child writers/workers use the Paseo profile "general work"
  (gpt-6.1-sol high) at normal speed. No paid model runs.
- Runs to keep go through `task job run`. Checks: `scripts/check` if code/docs changed. After your last check remove
  regenerable build caches and any app-written `.env` from the worktree so the unit can close.

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
