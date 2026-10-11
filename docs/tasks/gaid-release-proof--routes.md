---
format: 1
status: active
updated: 2026-10-11T08:16:17Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"9b44cd61-f804-4d65-90d5-69caa3d1376d","pid":1179633,"provider":"codex","session":"01a12a08-8d0f-7ca2-8a70-326e35c40d04","start":"17256638","token":"690620d2c6d8eeb81cad4c442096380d29ff243a0df2b1f51286d13d3f93ca6a"}
branch: task/gaid-release-proof--routes
target: task/gaid-release-proof
parent: gaid-release-proof
---
# gaid-release-proof--routes

## Goal and done criteria
Request from the starter:

# Child writer brief: gaid-release-proof--routes (geoaidesk, parent gaid-release-proof)

Goal: actual model-route qualification for GeoAIDesk: a reusable trial script and the local-model records that the
user decided (gaid-runtime#1 가): "test 64K and 98K local contexts on real tasks". Parent package: WP10 in skill_hub
docs/specs/geo-byok-plan.md ("requested local/API/subscription tests record connection and task outcomes separately";
"LAS and map-plus-table acceptance are demonstrated on the stated combinations"; plan §2.7 route fields, §3.8 local
model design, §6.4 first-success starter).

Base: the parent branch at d5702af or later. Read AGENTS.md (Local model, Maps, LAS sections), docs/geo/well-tables.md,
docs/geo-maps.md, geo/release-proof/README.md (record format `gaid-route-evidence/v1`) and
geo/release-proof/instance.mjs (shared harness owned by the parent: use it; minimal changes only, say so).

Owned files (create): `geo/release-proof/route-trial.mjs`, helpers `geo/release-proof/route-*`, task prompt/input
definitions under `geo/release-proof/route-tasks/`. Do not edit server/ or web/ code; app bugs you find go to the
parent with evidence (one-line obvious fixes in your own scripts are fine).

The script:
- Starts a GAID instance (instance.mjs, fresh data home under the run dir) or attaches to one; configures the route:
  `local` = the managed `gaid-local` provider (server/src/geo/local-model.ts and its routes; explicit app context,
  optional derived Ollama model with `num_ctx`) — the app context and the Ollama server allocation must match;
  `api-key` and `chatgpt-signin` routes are implemented but must refuse to run unless `--allow-paid` is given (the user
  approves paid runs in the parent's tab; you never pass it).
- Connection test: one small prompt through a new chat (`POST /sessions/...`, `/run` SSE), record outcome, latency,
  model id reported, tokens. Separate from the task.
- Task: create a project, upload inputs, start a new chat with the workflow's exposure (the catalogue workflows in the
  pinned archive 0.2.1: `well-log-qc` and `geo-map-and-crs`; their prompts, expected artifacts and required choices
  are in workflows.json — read from the staged catalogue or GET /geo/catalogue), send the prompt, stream SSE to a
  log, and wait for the run to settle (time cap per run, e.g. 45 min). Record: outcome (passed = every required
  expected artifact exists and is non-empty; partial; failed), artifacts with sha256, turns, tool calls, retries,
  dependency repairs (bash commands installing packages), context peak (tokens and ratio of the app context), input/output
  tokens, ledger cost (should be 0 for local, billing `local`), errors, and for Ollama `ollama ps` during the run
  (loaded context, CPU/GPU split = offload). Keep the session JSONL and the notebook/provenance paths in the record.
- LAS task input: FORCE 25/9-1 (`~/assets/force2020-welllogs/c8d01ee9/las/25_9-1.las`, CC BY 4.0 / NOLD 2.0, asset
  `force2020_welllogs` in configs/inputs.toml). Its known source-header discrepancy is a finding, not a failure to
  hide (plan §6.4). Map-plus-table input: the starter/example case of `geo-map-and-crs` in the examples archive
  (pc74:~/assets/geo-catalogue/0.2.1/geo-examples-0.2.1.tar.gz) if it has permitted data, else synthetic map fixtures
  with an analytically known area (geo/tests/fixtures/maps_fixture.py); the task must ask for both a map and an area
  table, and the record checks both and, for synthetic data, the area against the known value.

Runs to produce on PC74 (RTX 4090 24 GB; Ollama present with `qwen3:30b-a3b-instruct-2507-q4_K_M`; use `task job run
--gpu -- <cmd>` for each kept run): local route at 64K (65,536) and at 98K (98,304) application context with a matching
Ollama `num_ctx`, for the LAS task and the map-plus-table task: four task records plus their connection records. If a
run fails (context overflow, missing artifact, tool error), keep the record, note the cause, and you may repeat once
after a harness-only fix; never tune the app to pass. Do not run anything else on the GPU at the same time.

Constraints: no paid or subscription model calls; no publication; app data never inside a checkout; stop every service
you start. Network: raw.githubusercontent.com is blocked on the KIGAM network (use `gh api ... -H "Accept:
application/vnd.github.v3.raw"` or codeload.github.com).

Evidence back to the parent (task document and finish): per run the record path and sha256, job id, route, context,
connection and task outcome, artifacts, context peak, offload, duration, and failures with causes. Also a short
design note for the paid routes (what the script does for `api-key` with one personal provider key and for
`chatgpt-signin`, what the user must do, expected cost order) so the parent can ask the user. Before finishing run
`node --test 'geo/tests/*.test.mjs'` and remove build caches you created in your worktree (server/node_modules,
server/src/helpers/.venv, web/node_modules, web/.next, web/next-env.d.ts, web/tsconfig.tsbuildinfo, __pycache__).

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
