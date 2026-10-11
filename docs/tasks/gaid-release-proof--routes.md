---
format: 1
status: ready
updated: 2026-10-11T10:06:31Z
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
- All four required GPU-serialized local trials are terminal and recorded: all connections passed; 64K LAS, 64K map and 98K LAS tasks partial; 98K map passed the declared file-presence/known-area engineering acceptance. All started services stopped and trial variants unloaded. No paid/subscription calls or repeats.
- The requested test matrix and reusable scripts are delivered, not a general local-model qualification: neither LAS task is accepted scientific QC, and only one synthetic map task met bounded engineering acceptance. No workflow skill activation/read was observed in any trial despite workflow-specific exposure and an explicit instruction to read the skill.
- Bounded first-98K allocation check: app/configured/loaded context=98304, Ollama CPU/GPU=18%/82%. The managed variant suffix is -gaid-96k (98304/1024); this is the requested 98,304-token trial, not an unintended smaller allocation.
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

### Local 64K map plus area table (job 2, terminal)
- Job: job-geoaidesk-gaid-release-proof--routes-2; receipt: /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082310.944398Z/receipt.json; exit 1.
- Record: /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082310.944398Z/out/record.json; sha256: 7451474fbacd29dd2d125ef2bd5fb2c9567bf0befc4dfc8a60698f9a98e4b0ea. Source SHA a97bf28265bd (full SHA in record), version 0.1.0.
- Route: gaid-local/qwen3:30b-a3b-instruct-2507-q4_K_M-gaid-64k; app/loaded context=65536, CPU/GPU=7%/93%. Connection passed in 20165 ms, input/output=26827/5 tokens, one turn and no tools, local/$0.
- Task partial in 185720 ms, completed and settled: 9 turns, 11 tools, 0 retries, 0 detected dependency repairs, context peak 43689 (66.6641%). Ledger input/output=16461/13834, cached=295211, total=325506, local/$0.
- area-table.csv exists (59 bytes), sha256 b0d541c81eaedb0736b2203dceb05789df1335e9a41cf319af02f49e339226ea; independent area check passed exactly: A=30000/B=20000 m2, 60%/40%. Missing: map.png, crs-inventory.json, crs-inventory.csv, run.json. Session/provenance/notebook paths and hashes are in the record. serviceStopped=true.
- Failure evidence: generated script omitted matplotlib.pyplot import (NameError: plt), then three exact-text edit failures; no workflow skill read was observed. This is not a map-plus-table acceptance pass even though the table agrees. Environment observation for parent: a find tool returned "fd is not available and could not be downloaded"; subsequent ls found the input. No app edits or environment tuning were made to make the trial pass.

### Local 98K LAS (job 3, terminal)
- Job: job-geoaidesk-gaid-release-proof--routes-3; receipt: /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082337.131367Z/receipt.json; exit 1.
- Record: /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082337.131367Z/out/record.json; sha256: 820b4717dda634539bc86e5d16c9d8a90f94af1c617f45c45689da6640fc6f42. App SHA 15f70edf37c42c76aeadfb3883516d11150e7937, version 0.1.0.
- Route: gaid-local/qwen3:30b-a3b-instruct-2507-q4_K_M-gaid-96k; app/configured/loaded context=98304, CPU/GPU=18%/82% (VRAM allocation 81.9362%). Connection passed in 29674 ms, input/output=26827/5 tokens, one turn/no tools, local/$0.
- Task partial after 2700078 ms (45-minute cap), 348 turns/tools, 0 provider retries, 0 detected dependency repairs, context peak=82343 (83.7636%). All required files nonempty: inventory.csv (317 bytes), qc.json (2203), flagged.csv (2281542), quicklook.png (96113), raw.csv (3119371); hashes/session/provenance/notebook locators are in the record. File presence passed; the run did not finish normally. It was explicitly aborted, server settled and serviceStopped=true.
- Failure evidence: after initial NumPy JSON-serialization and pandas Series.isinf errors were worked around by the model, it made 168 invalid scientific_result calls using overall prose or completed on an artifact-list card. Source schema permits overall only pass/warn/fail for qc-report, and artifact-list requires items; this is a model argument/recovery failure, not a demonstrated app schema defect. No workflow skill read was observed.
- Streamed input/output=892418/62661 excludes compaction/aborted usage. Authoritative preserved ledger: promptTokens=982026, completionTokens=70309, cachedTokens=20801645, totalTokens=21853980, local/$0.
- Output QA: qc.json correctly preserves header STOP=2532.1748047 versus actual 2532.062, but falsely counts every curve's NULLs as zero (direct source scan has 111889 declared -999.25 values), uses m as depth_basis, and applies spike counts to explicitly unconfirmed-unit curves. inventory.csv is one metadata row rather than a per-curve inventory. Visually inspected quicklook.png is not the requested same-window multi-track plot: despite title 1400–1800 m it shows the full depth range, increasing upward, and mixes distinct units on one shared value axis. It also contains a fabricated 2024 analysis timestamp. These outputs are not validated scientific QC.

### Local 98K map plus area table (job 4, terminal)
- Job: job-geoaidesk-gaid-release-proof--routes-4; receipt: /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082356.800064Z/receipt.json; exit 0.
- Record: /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082356.800064Z/out/record.json; sha256: f20d17534095c9049246354451db3211df10c60e025c2941716fd1f5c0a84e21. App SHA 14572664c6de9798ed807190be67add3bf3e3c76, version 0.1.0.
- Route: gaid-local/qwen3:30b-a3b-instruct-2507-q4_K_M-gaid-96k; app/configured/loaded context=98304, CPU/GPU=18%/82%. Connection passed in 27762 ms, input/output=26819/5, one turn/no tools, local/$0.
- Task passed declared engineering acceptance in 75984 ms, 18 turns/17 tools, 0 retries/0 detected dependency repairs, context peak=33747 (34.3292%). Ledger input/output=6152/3015, cached=552593, total=561760, local/$0. Recovered matplotlib kwargs, exact-text edit and CSV extra-field errors are preserved; the run completed and settled normally.
- All expected files nonempty: crs-inventory.json (197 bytes), crs-inventory.csv (145), map.png (85325), area-table.csv (58), run.json (420); all hashes/session/provenance/notebook locators are in the record. Independent areas match exactly A=30000/B=20000 m2, 60%/40%. serviceStopped=true.
- Visually inspected map.png: the three source rectangles, categorical colours/legend and projected coordinates match the supplied recipe. Limited output QA caveat: crs-inventory lacks the requested full extent/attribute inventory, run.json lacks commands/input hashes/environment versions, and both contain a fabricated inventory_date=2026-04-26T12:34:56Z. The record's passed status is only the brief's nonempty-artifact plus known-area check, not full workflow/provenance/scientific validation. The actual run timestamp and provenance are harness-owned in the evidence.

### Matrix summary for the parent
| App context | Task | Connection | Task outcome | Duration ms | Context peak | CPU/GPU |
|---|---|---|---|---:|---:|---|
| 65536 | LAS | passed | partial; missing figure, timeout | 2700401 | 66808 (101.9409%, app-reported) | 7%/93% |
| 65536 | map+table | passed | partial; area correct, map missing | 185720 | 43689 (66.6641%) | 7%/93% |
| 98304 | LAS | passed | partial; all files, tool loop timeout, QC defects | 2700078 | 82343 (83.7636%) | 18%/82% |
| 98304 | map+table | passed | passed bounded engineering check; QA caveats above | 75984 | 33747 (34.3292%) | 18%/82% |

Paid/API and ChatGPT sign-in implementation/credential setup/cost-order note: geo/release-proof/route-usage.md. Both are intentionally untested and gated by --allow-paid (never passed here). Parent owns any separately approved paid trials and its canonical report. No new required work is added by this child.

## Next steps
<!-- task:closed -->
Closed 2026-10-11T10:06:31Z: ready; the parent gaid-release-proof integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Two additional job launches were refused because the previous job added a dirty task jobs block. Saved each reviewed jobs-block update before the next launch; no failed/refused call created a job.
## Notes and decisions
- After job 1 exposed compaction/aborted-usage differences, the final harness now records ledger token totals as authoritative and preserves streamed totals separately. All four already-launched trials use the original snapshot; their immutable records retain both streamed fields and the full ledger, and per-run notes identify authoritative values. No model rerun for this record-presentation fix. Paid picker pricing is USD/million tokens, corrected in the design note and field name before any paid use.
- Sequential phases: settle catalogue/API interface → implement harness → record four isolated local jobs → inspect evidence → declared checks/finish. This is a child unit with tightly coupled owned scripts; no nested writers and no independent reader package needed.
- Owned files: geo/release-proof/route-trial.mjs, route-metrics.mjs, route-tests.mjs, route-usage.md and route-tasks/tasks.mjs. Shared instance.mjs and app code are read-only. Parent integrates with task complete.
- Map input is reconstructed from the permitted MIT example rectangle-spec.json (the archive has recipe/output evidence, not the binary source); A=30000/B=20000 m2 in EPSG:5186. No known output files are uploaded.
- Local project spend cap is zero; prompt forbids delegation, other models, paid tools and replacement downloads. Paid routes only attach after user Settings setup and require --allow-paid; see geo/release-proof/route-usage.md for cost-order assumptions and route design.
## Open items
None for this child. Paid-route decisions and any follow-up scientific-quality work belong to the parent; no new required scope.
## Report
No separate child report; parent incorporates this task evidence and geo/release-proof/route-usage.md.
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082232.988087Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082310.944398Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082337.131367Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-release-proof--routes-20261011T082356.800064Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
