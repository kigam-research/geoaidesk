---
format: 1
status: waiting
updated: 2026-10-23T02:27:03Z
writer: {"host":"seongin3","reserved":"7042b64b9f79c0eca93642c203a3d8ce58be59b44dd8e29c7c39be2aeb522c25"}
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
