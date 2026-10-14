---
format: 1
status: active
updated: 2026-10-14T05:41:08Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"eb12b4ec-744d-443d-ae5e-1f4d6cb5e93a","pid":2414350,"provider":"claude","session":"22045fc9-fe24-46c6-a477-28774ad3a964","start":"41986201","token":"2e679572e64c04a061b1ba8a728b7c93825bb5531f6ac582b96a513ab7656176"}
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
- 2026-10-14: server reachable from PC74; `/v1/models` lists `qwen3.8-flash-next`, `/models/Qwen3.8-27B`,
  `/models/Qwen3.6-27B`, all with `root: /models/Qwen3.8-Flash-Next-FP8` (aliases of one weight set per the server).
- Direct curl: `reasoning_effort` `high` and `minimal` -> HTTP 400 ("Supported types are xhigh (default), medium, and
  low"); `low`/`medium`/`xhigh`/absent -> OK with reasoning. Pi's openai-completions sends the tab's level verbatim as
  `reasoning_effort` (off -> field omitted), and the chat default level is `high`: expected app failure, to be
  confirmed in the trial's thinking probe.
- Harness: `geo/release-proof/route-trial.mjs --route custom-server` (registers via PUT /custom-models, $0 accounting,
  `--thinking`, `--thinking-probe`, `--also-connect`); `node --test geo/release-proof/route-tests.mjs` passes (5).
- Job 1 (geo-map-and-crs, record sha256 2bfe9cca…6e0f): connection passed 9.3 s; probes in app: off/low/medium
  pass, minimal/high fail 400, xhigh fails 400 (Pi clamps xhigh to high for this model); both 27B ids connect. Task
  passed in 646 s: all files, areas exact, ledger $0 (payg), 54 turns, 57 tool calls, 14 recovered tool errors,
  context peak 101,560 (38.7%). Map figure defects: empty "area CRS" inset, extent text mislabelled. Did not read the
  workflow skill (read pi-subagents SKILL.md). Figure: reports/2026-10-14-gaid-kigam-qwen-trial/figures/01-kigam-qwen-map.png.
- Job 2 (well-log-qc, 05:14Z) lost after 7.6 min: PC74 root disk full (ENOSPC host-wide at 14:22 KST; other
  projects' data, not this unit); run.sh died on printf I/O error, record.json stayed at task start. Kept as failed
  evidence (runs/gaid-kigam-qwen-trial-20261014T051459.845388Z). Rerun as job 3 with ~15 GB free (environment
  failure, not a model outcome).
## Next steps
1. When job 2 exits: inspect its record/outputs against the LAS (WP10 reference checks), then update
   geo/compatibility.json + docs/geo/compatibility.md (route + thinking-level limit), write the report, scripts/check.
## Failed approaches
## Notes and decisions
- Orchestration: small, tightly coupled work (harness extension, two serial jobs on a shared server, record/docs
  update, report); done by the writer, no child units.
- Trial model: `qwen3.8-flash-next` for both tasks (other ids share its root; they get connection probes only).
  Context 262144 (server max_model_len, same as the user's review registration), maxTokens 16384, reasoning true,
  cost 0. Task thinking level `off` (WP10 parity; Pi then omits `reasoning_effort` and the server reasons at its
  default xhigh). Timeout 45 min. Order: geo-map-and-crs (with probes) -> well-log-qc, one at a time.
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
- /home/seongin3/data/geoaidesk/runs/gaid-kigam-qwen-trial-20261014T050117.036909Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-kigam-qwen-trial-20261014T051459.845388Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-kigam-qwen-trial-20261014T054107.553208Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
