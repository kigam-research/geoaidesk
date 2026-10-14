---
format: 1
status: done
updated: 2026-10-14T06:35:15Z
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
- Job 3 (well-log-qc, record sha256 27a48ee7…dd1b): connection passed 1.6 s; task partial after 1518 s: all 5 files
  present and checked against the LAS (las-reference.json in ~/data/geoaidesk/work/gaid-kigam-qwen-trial/): 16132
  rows, first/last 80.15/2532.062, STOP-last 0.1128 kept as a finding, NULL counts of all 23 curves exact; quicklook
  shows 1400–1800 depth-down with unit-separated tracks. The run stalled at a data-guard destructive-command prompt
  (`rm -rf scratch/check_out`) no one answered; undici ended the silent stream ("terminated"). 56 turns, 59 tool
  calls, 3 recovered tool errors, context peak 170,236 (64.9%), ledger $0.
- Harness-only correction: runChat answers permission prompts (`--permission deny` default, recorded in
  `permissionRequests`); test added (6 pass). One repeat of well-log-qc as job 4 (WP10 rule: at most one repeat
  after a harness-only correction).
- Job 4 (well-log-qc, record sha256 1d73cbe9…e16d): connection passed 1.7 s; task passed in 633 s, no permission
  prompts, 43 turns, 47 tool calls, 2 recovered tool errors, context peak 108,676 (41.5%), ledger $0. Values exact
  (23 NULL counts, rows, first/last, STOP residual -0.1128 reported). Quicklook: 1400–1800 window but depth axis
  increases upward (job 3's was correct). The model searched the host for the exposed skill it could not find in
  the sandbox and read an old copy in ~/data/geoaidesk/work/gaid-runtime/skill_hub-0228785/ (outside the sandbox).
- Finding (app): catalogue skills reach a project only via `npm run prep` at launch or POST
  /projects/:id/sandbox/init, which no web code calls; projects created while the app runs (all trial projects,
  WP10 too) have no geo skills while their exposure record lists them. WP10's "never read the workflow skill" is
  confounded by this. Out of scope here: open item.
- Records written: geo/compatibility.json route `kigam-qwen-vllm-262k` (compatibility test passes),
  docs/geo/compatibility.md row + thinking-level and skills notes, WP10 local-route limits annotated; report
  reports/2026-10-14-gaid-kigam-qwen-trial/index.md (humanizer pass done).
- Job 5 `scripts/check` on 9f9daee: exit 0 (backend 1671 pass / 11 skipped, web 981, geo 41, production smoke PASS).
  Later commits change only the report and this document. Worktree has no ignored/untracked files.
## Next steps
<!-- task:closed -->
Closed 2026-10-14T06:35:15Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: open items carried to docs/open-items/gaid-kigam-qwen-trial.md.

## Failed approaches
## Notes and decisions
- gaid-release-proof#1 (paid/subscription route trials incl. the 67 server) stays open: only its 67-server part is
  done here; the hub may narrow it.
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
- [결정 gaid-kigam-qwen-trial#1] 새 프로젝트에 지질 스킬이 바로 설치되도록 앱을 고칠지 — 가) 별도 작업으로 고치고 로컬·기관 서버 과제를 스킬이 있는 상태로 재시험 — 나) 그대로 두고 "새 프로젝트는 재시작 후 스킬 설치"만 안내 — 권장: 가) 화면에서 만든 새 프로젝트도 재시작 전까지 워크플로를 쓸 수 없고 지금 기록은 스킬 없이 낸 결과 — 막힌 일: 스킬 노출 효과 평가 — 조건: 없음 — 근거: reports/2026-10-14-gaid-kigam-qwen-trial#6-결정할-일
- [결정 gaid-kigam-qwen-trial#2] 기관 서버에서 기본 추론량 "높음"이 실패하는 문제를 앱에서 막을지 — 가) 별도 작업으로 사용자 지정 서버별 허용 추론량을 설정하고 받지 않는 값은 보내지 않게 수정 — 나) 앱은 그대로 두고 "사용 안 함·낮음·보통" 안내만 유지 — 권장: 가) 기본 설정으로 첫 대화가 실패하면 원인을 알기 어려움 — 막힌 일: 기관 서버 기본 설정 사용 — 조건: 없음 — 근거: reports/2026-10-14-gaid-kigam-qwen-trial#6-결정할-일
## Report
Report: reports/2026-10-14-gaid-kigam-qwen-trial/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-kigam-qwen-trial-20261014T050117.036909Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-kigam-qwen-trial-20261014T051459.845388Z/receipt.json
  - disposition: {"evidence":[],"reason":"lost: PC74 root disk full (ENOSPC) at 14:22 KST; rerun as job 3","recorded":"2026-10-14T05:41:24Z","replacement":"/home/seongin3/data/geoaidesk/runs/gaid-kigam-qwen-trial-20261014T054107.553208Z/receipt.json","state":"superseded"}
- /home/seongin3/data/geoaidesk/runs/gaid-kigam-qwen-trial-20261014T054107.553208Z/receipt.json
  - disposition: {"evidence":[],"reason":"exit 1 = partial record (kept as evidence); stalled at an unanswered data-guard prompt; repeated once after harness-only correction","recorded":"2026-10-14T06:10:38Z","replacement":"/home/seongin3/data/geoaidesk/runs/gaid-kigam-qwen-trial-20261014T061028.499209Z/receipt.json","state":"superseded"}
- /home/seongin3/data/geoaidesk/runs/gaid-kigam-qwen-trial-20261014T061028.499209Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-kigam-qwen-trial-20261014T062705.955719Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
