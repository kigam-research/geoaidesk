---
format: 1
status: active
updated: 2026-10-23T02:49:00Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"b0548dfd-27be-4dcf-ba69-b63776942d00","pid":3358183,"provider":"codex","session":"01a16695-6d46-7443-aaf0-ecd221dc6b01","start":"61037027","token":"7042b64b9f79c0eca93642c203a3d8ce58be59b44dd8e29c7c39be2aeb522c25"}
branch: task/gaid-promo-video-v2--study
target: task/gaid-promo-video-v2
parent: gaid-promo-video-v2
---
# gaid-promo-video-v2--study

## Goal and done criteria
Request from the starter:

# Child unit gaid-promo-video-v2--study: run the GAID research cycle in the review app and record capture-v2

Parent: gaid-promo-video-v2 (writer integrates the film). Read `geo/promo/CONTRACT.md` (v2) in your worktree first;
it is the full contract (study steps, rules, capture interface `capture-v2`, shot list v3). Also read v1's
`geo/promo/CAPTURE.md` and `geo/promo/capture.py` (drawn pointer, click ripple, frame writing) and reuse them.

## Goal
Do one coherent research cycle for real in the user's review app and record the real-system takes for the promo film:
서재 (add the user's paper) → Workflow 만들기 from that paper → register on the institute hub server → run the
analysis in a new project with the Workflow (Yilgarn data) → the AI agent's research note, a decision answered →
back in 서재 the paper shows the note under "내 연구에서 쓰인 곳" and in the connection map.

User request (verbatim, 2026-10-23): "내서재에서 부터 논문 및 서지 관리하고 해당 논문에서 워크플로우를 생성하고 공유하고,
워크플로우를 이용해 GAID 시스템에서 연구분석을 수행(수행하는 과정에 MAPViewer나 작업 화면을 보여줄 필요가 있다.)하고 분석된
내용을 연구노트로 관리하고 해당 노트를 다시 내서재에 가져오면서 연구 선순환의 고리를 보여줄 필요가 있다." Also: "실제 시연
과정에서는 기능들을 설명할 때 무리한 확대나 스크롤보다 ... 기능별로 설명할 수 있게 하여야 하고".
User decision (verbatim): "검토용 앱에서 연구를 진행하고 Workflow를 기관 허브 서버에 등록해도 된다."

## Facts
- Review app: PC74 UI http://127.0.0.1:3000, backend :18000, systemd user unit `gaid-review`, checkout
  `~/deploy/geoaidesk` at ad9399d1, data `~/.geoaidesk`. Signed in to models and to the institute hub server
  (http://10.13.15.74:8700, admin account of the user). The UI may require the API token flow; use the app as a
  browser user would.
- Inputs: paper `~/assets/gaid-authoring-preview/20261015/author-manuscript.pdf` (author R3 manuscript of DOI
  10.1007/s11053-026-10778-w; sha256 in configs/inputs.toml `authoring_preview_paper`), data
  `~/assets/yilgarn-gis-db/20260911/Yilgarn_GIS_DB.csv` (TMX/TMY grid, 5 km; CRS not declared in the CSV — do not
  invent one).
- The KIGAM network blocks raw.githubusercontent.com; use gh api or codeload if you need GitHub content.
- Python: `uv run --no-project --with playwright==1.63.0 --with pillow==12.3.0 python ...`; Chrome at /usr/bin/google-chrome.

## Scope and allowed actions
- Allowed: create exactly the study records (one library folder, one paper, one authoring draft, one hub entry on the
  institute hub server, one project, its chats/notes), send the real messages, answer the real questions, register.
- Not allowed: deleting/renaming/editing other records; reading or copying auth.json, config.env, mcp-auth.json,
  hub-server/connection.json; restarting or reconfiguring gaid-review or the hub server; DOM edits that change
  meaning. If the review app restarts under you (another unit may update it), wait and continue.
- Model use: whatever the review app's default model is; keep the analysis at the quick trial scale. If a step fails
  twice for an outside cause (model quota, login), stop and report it to the parent instead of working around it.
- Edit only `geo/promo/capture*.py` and `geo/promo/CAPTURE.md` in Git (plus your task document). Outputs go to
  `~/data/geoaidesk/work/gaid-promo-video-v2/` (`capture-v2/`, `study.json`, logs, before/after evidence).

## Evidence to return
`capture-v2/capture.json` (schema gaid-promo-capture-v2 with `beats` per shot), all shots, `study.json` (ids, model,
cost readings, timings, cuts), before/after evidence that other records are unchanged, a contact sheet, and CAPTURE.md
updated for v2 (reproduce steps, deviations). Report deviations from the shot list honestly (e.g. a feature that did
not appear). Then task save / task finish your unit.

## Current state
- Resumed on PC74 in the printed worktree; read contract v2 and v1 capture helpers.
- Interface settled: capture-v2 at 2880x1620, 30 fps; reuse v1 pointer and click interpolation without its status masking or mutation guard.
- Sequential work: preserve before evidence; create library paper/folder; author and register Workflow; create project and run quick trial; answer note; revisit library and capture stored states.
- Owned files: capture*.py, CAPTURE.md, this task document. No workers needed: live UI state and recording are tightly coupled.
## Next steps
1. Continue authoring ap-33965983-5f2 when draft retry completes; capture A3 and registration. If the retry fails for provider availability again, stop model steps and notify parent.
2. Keep using capture controller http://127.0.0.1:18329 (recorded job, do not relaunch). Browser globals: page/authorpage, libpage, study, api_get.
3. Register, create one project, quick trial, note decision, library return; record IDs in external study.json.
- Created paper li-9c9d1be4e0ca (ahn2026), folder lc-0a58cae5488a (광상 부존 가능성), draft ap-33965983-5f2. External study.json records them.
- A1, A2, L1 and L1b captured (120, 135, 180 and 120 frames). Initial gate take discarded outside shots; entered the launcher's normal startup URL through UI (never read credential files).
- Parent authorized already connected subscription model via per-action picker after two default-model failures. Selected openai-codex/gpt-6.1-sol for authoring; analysis accepted (25,645 input / 6,776 output, costUsd 0); four answers submitted. First draft attempt failed on provider overload after one validation repair; retry running with same model. No Settings change.
- Created project yilgarn-cd7814; uploaded user_data/Yilgarn_GIS_DB.csv via UI and attached only new library folder. Selected GPT-6.1 Sol subscription row (제공사의 구독 한도 적용) in chat. No chat request sent yet.
## Failed approaches
- Default authoring model twice failed with OpenRouter not configured. Stopped and escalated before choosing a model; parent sent explicit authorization.
- Initial task job launch refused dirty source; saved once, then launched recorded job 1.
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
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v2--study-20261023T023311.018639Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
