---
format: 1
status: active
updated: 2026-10-23T02:52:18Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"f4cd2575-3fed-45e7-936c-0a07c06a866f","pid":3212762,"provider":"claude","session":"66de04a7-5405-43d1-9619-f33293fd5834","start":"60956824","token":"9c6762835f05577c7bc99cd26f9e701ba9a2efc8547e7c6ac6ccccf622f1397f"}
branch: task/gaid-promo-video-v2
target: main
parent: 
---
# gaid-promo-video-v2

## Goal and done criteria
Request from the starter:

# Goal: gaid-promo-video-v2 — restructure and revise the GAID promotional video

## User feedback and request (verbatim, 2026-10-23)

> 홍보영상과 관련한 피드백이다. 모션그래픽은 좋은데 실제 허브와 시스템을 담고 시연하는 과정에서 확대하고 스크롤을 하다보니 사람 시청자 입장에서는 어떤 내용을 설명하는지 눈에 들어오지 않는다. 또한, 사용자의 피드백에 따라 순서 상관없이 추가하다보니 내용 순서가 체계적이지 못하다. 그리고 연구자가 본인의 연구를 에이전트와 수행하고 논문을 수집하고 논문으로부터 지구과학 AI 생태계 활성화를 위한 워크플로우를 생성하여 공유하고 발전해나가는 내용이 중심으로 다뤄져야하며, 현재 프로토타임의 스킬이나 워크플로우수를 억지로 통계로 나타낼 필요는 없이 기존 K-dense-AI를 비롯하여 Geoscience의 스킬 생태계를 소개하면서 분산된 정보들을 모아서 연구자 친화적인 플랫폼을 만들어갈 수 있게 하는 배경도 설명되어야 한다. 실제 시연 과정에서는 기능들을 설명할 때 무리한 확대나 스크롤보다 seoul_geomodel의 가시화시스템 설명처럼 기능별로 설명할 수 있게 하여야 하고, 내서재에서 부터 논문 및 서지 관리하고 해당 논문에서 워크플로우를 생성하고 공유하고, 워크플로우를 이용해 GAID 시스템에서 연구분석을 수행(수행하는 과정에 MAPViewer나 작업 화면을 보여줄 필요가 있다.)하고 분석된 내용을 연구노트로 관리하고 해당 노트를 다시 내서재에 가져오면서 연구 선순환의 고리를 보여줄 필요가 있다. 전체적인 체계를 다시 먼저 잡고 홍보영상을 수정하는 작업을 진행하자. 이제는 기존대로 opus 5.5 high writer로 작업하고 워커도 paseo 에이전트를 활용하는 것이다. 홍보영상은 writer가 직접 수정하고 작업해도 된다.

## What the user asked for (done criteria)

1. Set the overall structure first (written in the task document and shown to the user in the writer tab), then revise
   the video to it. Keep the parts the user liked: the motion graphics.
2. Centre: a researcher does their own research with the AI agent, collects papers, creates Workflows from papers to
   activate the geoscience AI ecosystem, shares them and improves them over time.
3. Background: introduce the existing skill ecosystem (K-Dense-AI's scientific skills and geoscience skills) and why
   scattered information is gathered into a researcher-friendly platform. Do NOT force prototype counts of skills or
   Workflows into statistics charts.
4. Real-system demo explained feature by feature, like the seoul_geomodel visualisation system video
   (`~/repos/seoul_geomodel/reports/2026-10-21-viewer-v2-video`, `2026-10-13-intro-video-30s`, read-only), without
   heavy zooming or scrolling that viewers cannot follow.
5. The demo shows the research cycle in order: 내 서재 (papers and bibliography management) → create a Workflow from a
   paper → share it (GAID hub) → run a research analysis with the Workflow in GAID (show the map viewer or the work
   screen while it runs) → manage the analysis as a research note → bring the note back into 내 서재, closing the loop.
6. Same delivery terms as v1 (user decisions 2026-10-22): silent, internal review only, about 90 s unless the new
   structure needs otherwise (record it), 1920×1080 30 fps as before.

## Starting point (v1, gaid-promo-video, closed)

- Sources in the repo: `geo/promo/` (CONTRACT.md, CAPTURE.md, capture*.py, prepare_data.py, render.py, scene/).
  The writer may edit the video sources directly.
- v1 video: `pc74:~/data/geoaidesk/runs/gaid-promo-video-20261022T155452.185441Z/out/gaid-promo-v1.mp4`
  (sha256 8cbb2d57…fcdc7), report `reports/2026-10-23-gaid-promo-video/index.md`, registry id `gaid-promo-video-v1`
  (state review; v2 supersedes it).
- The review app (PC74 :3000/:18000, ~/.geoaidesk) now runs main ad9399d1 with the hub server, feeds and ORCID phase 1.
  Do not capture in or change the review app; use an own GAID instance and data under `~/data/geoaidesk/work/<slug>/`
  (copy what you need), as v1 did.

## Workers

The user wants Paseo agents as workers ("워커도 paseo 에이전트를 활용"): child writers via `task start --parent`, readers via
`task reader` with a profile from the list. Use them for independent packages (e.g. capture scripts, scene work,
independent review of the cut); the writer integrates.

Outside check: none (not a research goal). Constraints from v1's request file still apply (claims only what GAID does,
no proprietary assets/fonts, visible names "AI agent"/"GAID", K-Dense shown as the upstream source where shown,
media-craft for video tools, outputs outside Git, small PNG key frames in the report, results registry as `review`).

## Current state
- 2026-10-23: read v1 sources/report and the seoul_geomodel reference (full app frame at constant scale, one feature
  tag + highlight box per beat, pointer moves, no zoom). Structure draft v2 below.
- Scenes v2 written (`scene/scene.js`): background (real skill names, no counts, 개념도), cycle ring, demo chrome
  (chapter title + cycle strip, whole frame at k=1.325, highlight + dim + Korean tag placed outside the box), second
  brain (개념도), closing; `render.py` 105 s, `gaid-promo-v2.mp4`, capture schema v2, data optional. Previews
  `~/data/geoaidesk/work/gaid-promo-video-v2/preview-0{1..4}` (preview-03/04 use v1 frames as stand-ins via
  `fake-capture/`, preview only).
- v1 copy (`~/data/geoaidesk/work/gaid-promo-video/home`) holds records from different studies: library = 3 spatial
  validation papers (Ploton, Meyer, Valavi/blockCV) in folder 공간 검증; hub Workflow `entry-ap-a135f290-1c4`
  "PU-컨포멀 탐사 우선순위 존 분류" (판 2) authored from the user's NRR paper (Yilgarn Ni, PU + conformal); a Yilgarn chat
  started from it (only `outputs/variogram_fit.png`); notes in `proj-ca300f` (spatial CV, cite library papers);
  Seoul 1:250K litho shp note in `review-notebook`. The review app `~/.geoaidesk` holds the same records.

### Structure draft v2 (to show the user)
Centre: one researcher's research cycle with the AI agent; Workflows from papers are shared and improved (판).
Demo style: whole app frame at one scale (1280×720 CSS → 1920×1080), a cycle strip on top marking the current
step, per feature one tag + highlight box + pointer; no zoom/scroll inside a beat.

| # | s (target) | Part | Content |
|---|---|---|---|
| 0 | 0–5 | Opening | logo motion (kept from v1) |
| 1 | 5–20 | Background (motion) | existing skill ecosystems: K-Dense scientific agent skills (upstream source), geoscience skills on GitHub, methods in papers, data at institutes, notes in personal folders → scattered; GAID gathers them into one researcher-friendly place. No count charts. |
| 2 | 20–28 | The cycle (motion) | ring: 내 서재 → Workflow 만들기 → GAID 허브 공유 → 연구 분석 → 연구노트 → 내 서재; researcher + AI agent at the centre; 판 1→2 shows improvement |
| 3a | 28–38 | Demo: 내 서재 | folders, paper with bibliography/PDF, Zotero/ORCID import, attach a folder to a project |
| 3b | 38–50 | Demo: Workflow from a paper | hub authoring: paper source → one question at a time (recommended option) → draft flow diagram → check |
| 3c | 50–58 | Demo: 공유 | register (preview) → hub entry with 판, stars/comments → another researcher installs it |
| 3d | 58–74 | Demo: 연구 분석 | Workflow start settings → chat with the AI agent working (Workflow card, tool steps) → map viewer / work screen with the result |
| 3e | 74–84 | Demo: 연구노트 | note list → note with result figure and a decision → 답변 보내기 |
| 3f | 84–92 | Demo: back to 내 서재 | paper → 내 연구에서 쓰인 곳 (note, pages) → 연결 지도: the loop closes |
| 3g | 92–100 | Ecosystem → KIGAM second brain (motion, 개념도 tag) | user request 2026-10-23 (verbatim below): many researchers' cycles join through the GAID hub; papers, Workflows (판) and notes link into one growing network = KIGAM's second brain, conceptual |
| 4 | 100–106 | Closing (motion) | ring turns once more (판 grows), logo, 내부 검토용 |

Feature map (explorer, 2026-10-23): the library paper detail has "Workflow 만들기" (needs a stored PDF; creates the
authoring project with the PDF as first source and links it under 쓰인 곳); authoring 자료 → 질문 → 초안 → 허브 등록;
hub entry "내 프로젝트에서 시험" → input prep → TaskSetup "시작 초안 만들기"; chat `WorkflowBlockCard`; MapViewer for
.shp/.gpkg/.geojson/.tif/.geomap.json; notes tab with decisions "답변 보내기", "연결 지도 열기", 참고문헌. Step 3f is shown
through what exists: a note citing `[@key]` appears under the paper's "내 연구에서 쓰인 곳" and in 연결 지도 (paper →
Workflow → project → note). No feature adds a note itself as a library item; the film must not claim one.

Length ≈ 105 s (over the 90 s default: six demo steps plus the second-brain scene; trim 1–2 s where possible).

User 2026-10-23: "가와 관련해서 검토용 앱으로 하면 매번 인증을 다시 할 이유가 없지 않나? 답변먼저 하자. 그리고 마무리 절 전에 해당 순환을 통해 지구과학 에이전트 생태계가 활성화되면서 개념적인 KIGAM의 Second brain화 되는 모션 그래픽이 추가되었으면 한다."
Answer given: the review app avoids re-login; it was excluded only by the v1 rule (keep review data unchanged). Using it
leaves the study records in `~/.geoaidesk`, and since the review app is connected to the institute hub server (PC74
:8700), registering the Workflow is a real shared registration. User answer 2026-10-23: "검토용 앱에서 연구를 진행하고 Workflow를 기관 허브 서버에 등록해도 된다."

## Next steps
1. Child `gaid-promo-video-v2--study` (writer b0548dfd, worktree ~/worktrees/geoaidesk/gaid-promo-video-v2--study,
   started 2026-10-23) runs the study in the review app and records capture-v2 (contract
   `geo/promo/CONTRACT.md` v2). Parent meanwhile rebuilds `scene/` (background, cycle, demo chrome with cycle strip
   and feature tags, second brain, closing) and `render.py` (~105 s).
2. Integrate capture-v2 beats into the demo segments, stills review, render job, report.
## Failed approaches
## Notes and decisions
- Packages: (P) parent owns scene/, render.py, prepare_data.py, README, report, integration; (C) child
  `--study` owns the review-app study, capture*.py, CAPTURE.md, capture-v2 data. Interface: `capture.json` v2 beats
  (rect + Korean tag label per feature). Integration order: scenes with placeholders → capture-v2 → beats wired → render.
- User 2026-10-23: "모션그래픽 영상 작업은 writer가 직접 모두 수행하자. 워커는 자료 수집 정도로만 활용하자." → the writer does
  all film work (scenes, tags, timing, render); the child only runs the study and records raw takes (its beat labels are
  suggestions).
- 2026-10-23: the review app's default model (OpenRouter) is not configured; authoring failed twice. Parent told the
  child to pick an already connected model in the per-action picker (prefer a subscription login), same model for the
  whole study, no settings change (within the user's approval to run the study in the review app).
- User 2026-10-23: "baggingPU까지 실행할 필요 없다. 홍보영상을 만드는 것이며, 실제 분석결과까지 모두 다 가져오는 모습을 보일
  필요 없다. 필요하다면 유사한 기 작업 결과를 가져와도 되므로 모든 과정을 돌리지 말아라. 특히 BaggingPU는 계산이 오래걸린다." and
  "정직한 영상을 원하는 것이 아니라 홍보용 영상을 원하는 것이다." → promotional film, staging allowed; no training run. The
  child copies the paper's prior OOF zone assignments (`~/pc71-projects/narr/mpm_nested_cv/outputs/test_evaluation_oof/
  baggingpu_xgboost/outer_fold_*/zone_assignments.csv`) into project `yilgarn-cd7814`; the AI agent only turns them into a
  map file, a figure and the research note citing the paper (short real run).
- User 2026-10-23: "홍보 영상 체계에 적절한 결과들 위주로 보여줘야하는 것이다. 이전 영상에서는 적절한 자료들을 사용했지만 연출과
  구성이 적절하지 않았을 뿐이다. 정직하려고 하면 오히려 퀄리티가 떨어진다." → choose shots for visual quality; v1 takes
  (Seoul shp map + basemap, area table, LAS, note decision, citations, connection map) may be reused in the demo where
  they look better; the child writes the Yilgarn zone map as EPSG:3857 (grid values match Web Mercator over WA) on a
  basemap.
- User 2026-10-23: "면적표와 LAS검층은 불필요 하다." → no area table, no LAS depth viewer in v2.
- Review app risk: the hub plans one more review-app update after gaid-orcid phase 2; the child waits and continues if
  it restarts mid-run.
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
