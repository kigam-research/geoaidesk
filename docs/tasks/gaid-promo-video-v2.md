---
format: 1
status: waiting
updated: 2026-10-23T02:13:42Z
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
