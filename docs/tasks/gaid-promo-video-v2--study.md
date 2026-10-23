---
format: 1
status: active
updated: 2026-10-23T03:48:44Z
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
- Ready for parent integration: capture-v2 has 14 shots, 1,950 frames (65 s), 2880x1620 at 30 fps. All 31 beat rectangles were drawn on midpoint frames at scale 2.25 and visually checked; proofs in capture-v2/beat-checks/. A3 retaken below the fixed header.
- Completed neutral-name M1, clean real-working R2, new Western Australia figure, and new N1/N2 note/decision takes. capture.json, study.json, contact sheet and CAPTURE.md finalized under ~/data/geoaidesk/work/gaid-promo-video-v2/.
- New paper li-9c9d1be4e0ca (ahn2026), folder lc-0a58cae5488a, draft ap-33965983-5f2 (revision 2 check passed), registered entry entry-ap-33965983-5f2 revision 1, project yilgarn-cd7814, session 01a166b1-256d-71f4-b5e3-53298806a36d, note 2026-10-23-yilgarn-priority. New decision sent and reflected.
- No training. Existing zone results reused; EPSG:3857 is parent-directed display assignment. R1/chat use older Workflow entry-ap-a135f290-1c4 revision 2; H1/H2 show new entry. R2's live citation-check segment is editorially combined with the earlier finished figure.
- Checks: syntax, all frame dimensions/files and beat constraints passed; 27 existing local domain/index records unchanged. Remote unrelated star change remains unattributed and disclosed. No app source or service change; app suite not run.
## Next steps
- Capture controller job exited 0; review app and hub left running. Save reviewed helpers/docs and task finish; parent integrates the film.
## Failed approaches
- Default authoring twice failed: OpenRouter not configured. Parent authorized per-action connected subscription picker; no defaults changed.
- One provider-overload draft attempt failed; retry and normal UI revision succeeded. Missing-file examples removed; draft 2 check passed with no findings.
- An ineffective direct edit to own cached authoring record was restored byte-for-byte, then normal UI revision used.
- Capture Chrome exited before final A3; replaced only the capture browser inside the existing recorded job. Normal token gate used; app/hub not restarted.
## Notes and decisions
- User direction (verbatim): "baggingPU까지 실행할 필요 없다. 홍보영상을 만드는 것이며, 실제 분석결과까지 모두 다 가져오는 모습을 보일 필요 없다. 필요하다면 유사한 기 작업 결과를 가져와도 되므로 모든 과정을 돌리지 말아라. 특히 BaggingPU는 계산이 오래걸린다." Also: "정직한 영상을 원하는 것이 아니라 홍보용 영상을 원하는 것이다."
- Parent subsequently authorized EPSG:3857 and promotional staging, requested neutral names, new map/figure/note/R2 takes and every beat's midpoint-frame rect QA. All applied. No BaggingPU or other training ran.
- Sequential decisions and ownership: reuse immutable prior results, stage own outputs, record real decision/citation work, then validate frames and callouts. Only capture*.py, CAPTURE.md and this task doc owned. No workers; live UI/capture state is tightly coupled.
- Models: authoring openai-codex/gpt-6.1-sol (medium), chat openai/gpt-6.1-sol (OAuth subscription; 제공사의 구독 한도 적용). Same underlying model, different refs. Final chat: 3,904,532 subscription tokens, charged USD 0, compute USD 0; list-price equivalent USD 0.8187376. Settings/credentials unchanged.
- Evidence: 27 old local domain/index files unchanged; automatic collection/link/sync bookkeeping changed. Existing trial count +1 expected. Unrelated remote entry-ap-3b21b377-454 star 1→0 was never opened/mutated by study commands; attribution unknown, parent notified, no restoration.
- Remaining format badge is decision-format after the answered decision becomes prose; bibliography resolves ahn2026. Parent accepted the badge. All current staging deviations and superseded takes are documented in CAPTURE.md/study.json.
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
