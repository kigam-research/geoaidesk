---
format: 1
status: active
updated: 2026-10-11T09:13:04Z
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
- Four GPU jobs launched (see Running jobs). Job 1 is terminal partial; job 2 map is now running, jobs 3–4 remain GPU-queued. No paid calls and no repeat planned: job 1 failed due model-generated code and incomplete artifacts, not a harness configuration defect.
- `node --test 'geo/tests/*.test.mjs'` passed 26/26 in 39.260 s; log: /home/seongin3/data/geoaidesk/work/gaid-release-proof--routes/geo-tests.log. Worktree helper environment and generated __pycache__ are removed after this check (job snapshots are separate).
- Implemented the reusable route harness, pinned workflow/input preparation, independent artifact/area checks, SSE/ledger/context/offload observations, and paid-route refusal/attach design. No server/web/shared-instance edits.
- Read the WP10 plan, local/model API contracts, map and well docs, and catalogue 0.2.1 workflow contracts. The exact worktree is not codegraph-indexed, so relevant native source was read.
- Harness checks: `node --test geo/release-proof/route-tests.mjs` passed (4 tests). Both real input preparations passed; FORCE sha256 matches configs/inputs.toml.
- Declared checks for this child: `node --test geo/release-proof/route-tests.mjs` and `node --test 'geo/tests/*.test.mjs'` plus the four recorded real local trials. The task CLI also runs repository scripts/check at finish; parent checks its integrated snapshot separately.

### Local 64K LAS (job 1, terminal)
- Job: job-geoaidesk-gaid-release-proof--routes-1; receipt: /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082232.988087Z/receipt.json; exit 1.
- Record: /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082232.988087Z/out/record.json; sha256: 74a55d69636af62c0fe64d62876af796149ff6d714acc34ac91cdd38dc2746d9. App SHA fe18a954c6615c85700c546f08ff58f70877c9d4, version 0.1.0.
- Route: gaid-local/qwen3:30b-a3b-instruct-2507-q4_K_M-gaid-64k, app/loaded context 65536; CPU/GPU 7%/93% (VRAM allocation 92.8054%). Connection passed in 28743 ms, 26827 input + 5 output tokens, 1 turn, 0 tools, local/$0.
- Task partial after 2700401 ms (45-minute cap), 71 turns/tools, 0 provider retries and 0 detected dependency repairs. inventory.csv, qc.json, flagged.csv and raw.csv exist; quicklook.png is missing. Artifact hashes and session/provenance/notebook locators are in the record.
- Failure evidence: generated script NameError (dup_depth), repeated exact-text edit failures and pandas selection failure; final notebook admits the quicklook failed because DEPT was an index rather than a DataFrame column. The model did not activate/read the exposed workflow skill. No terminal provider overflow error was seen; the app context_usage peak was 66808/65536 (101.9409%), so this is a reported/estimated peak, not proof of an accepted over-limit request. SSE was explicitly aborted at timeout; server settled and serviceStopped=true.
- Token accounting caveat: task.inputTokens/outputTokens (2392093/18496) tally streamed turn_end frames, not compaction/aborted usage. Use the preserved ledger for the complete run: promptTokens=2490256, completionTokens=67781, cachedTokens=1487399, totalTokens=4045436, costUsd=0, billingMode=local.
- Scientific-quality caution: model qc.json leaves depth start/stop/step null and its notebook asserts duplicate depths incorrectly. A direct source ASCII scan confirms 16132 unique samples, first 80.15, last 2532.062; header STOP=2532.1748047 m differs by 0.1128047 m. The known header finding was not correctly captured by this model output; do not treat the surviving tables as validated QC.

## Next steps
1. On job-exit notification, read this task document and the matching receipt/exit/out/record.json before acting; do not replay launched jobs. Four trials are already registered and host-GPU serialized.
2. Inspect terminal records, preserve failures and report app defects to parent; repeat once only for a harness correction.
3. Record per-job evidence/hash/outcomes, finish with the CLI repository checks, then remove any caches recreated by finish. Never pass --allow-paid.
## Failed approaches
- Two additional job launches were refused because the previous job added a dirty task jobs block. Saved each reviewed jobs-block update before the next launch; no failed/refused call created a job.
## Notes and decisions
- After job 1 exposed compaction/aborted-usage differences, the final harness now records ledger token totals as authoritative and preserves streamed totals separately. All four already-launched trials use the original snapshot; their immutable records retain both streamed fields and the full ledger, and per-run notes identify authoritative values. No model rerun for this record-presentation fix. Paid picker pricing is USD/million tokens, corrected in the design note and field name before any paid use.
- Sequential phases: settle catalogue/API interface → implement harness → record four isolated local jobs → inspect evidence → declared checks/finish. This is a child unit with tightly coupled owned scripts; no nested writers and no independent reader package needed.
- Owned files: geo/release-proof/route-trial.mjs, route-metrics.mjs, route-tests.mjs, route-usage.md and route-tasks/tasks.mjs. Shared instance.mjs and app code are read-only. Parent integrates with task complete.
- Map input is reconstructed from the permitted MIT example rectangle-spec.json (the archive has recipe/output evidence, not the binary source); A=30000/B=20000 m2 in EPSG:5186. No known output files are uploaded.
- Local project spend cap is zero; prompt forbids delegation, other models, paid tools and replacement downloads. Paid routes only attach after user Settings setup and require --allow-paid; see geo/release-proof/route-usage.md for cost-order assumptions and route design.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
No separate child report; parent incorporates this task evidence and geo/release-proof/route-usage.md.

(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082232.988087Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082310.944398Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082337.131367Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082356.800064Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
