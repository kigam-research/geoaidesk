---
format: 1
status: done
updated: 2026-10-24T01:07:54Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"9041d1a3-7e91-4078-bcd9-c922396931bf","pid":756157,"provider":"claude","session":"3069c8ee-f8d2-4558-9415-78ea443ef91b","start":"69075424","token":"20327401a56788b2a02c2d0c9f6ab09686a1e58eb736400cc9099e9218ac6d15"}
branch: task/gaid-promo-video-v4
target: main
parent: 
---
# gaid-promo-video-v4

## Goal and done criteria
Request from the starter:

# Goal: gaid-promo-video-v4 — rework the background part and the purpose-led storytelling of the GAID promo video

## User feedback (verbatim, 2026-10-24, on v3)

> 홍보영상과 관련하여 피드백이다. 현재 장면구성등은 비교적 적절하다. 오히려 배경 설명 파트에서 글자만 떠있는시간이 오래걸리고 그래픽없이 글만 있는것 같다.또한 오른쪽 상단에 개념도 텍스트와 같은 ai슬롭형 잔재도 남아있다. 지질자원연구자들이 자료를 조사하고 문헌을 분석하고 코드를 작성하는것과 유용한 지구 과학 스킬이나 에이전트 도구들이 흩어져있어 이용하기 어려운 현황이 그래픽적으로 잘드러나게 연출할필요가 있다. 두번째 피드백으로 허브와 시스템 연출은 좋지만 너무 좁은기능 설명 위주로 표현된다. 현재프로젝트와 GAID 허브와 시스템의 주요목적이 잘 드러나면서 중간중간 기능들이 같이 설명되어야하는데 현재 연출은 세부적인기능 나열소개식 연출에 가깝다. 현황 분석 후 어떻게 연출할지 검토하고 수정할필요가 있다.

## Done (user's outcome)

1. Analyse v3 first (report `reports/2026-10-24-gaid-promo-video-v3/index.md`, sources `geo/promo/`, video
   `pc74:~/data/geoaidesk/runs/gaid-promo-video-v3-20261023T174817.846561Z/out/gaid-promo-v3.mp4`, contact sheet next to it):
   where text sits alone too long, where the demo turns into a feature list. Write the analysis and the proposed direction
   (structure, scene-by-scene intent, what each demo scene says about the purpose) in the task document and show it to the user in
   the writer tab before re-rendering. Keep the scene structure the user found adequate.
2. Background part: show graphically, with little text, how geoscience researchers survey data, analyse literature and write code,
   and how useful geoscience skills and agent tools are scattered and hard to use — motion graphics, not floating text.
3. Remove AI-slop remnants such as the "개념도" text in the top-right corner. (It was a v2 honesty label for illustrative scenes; keep
   honesty another way — no invented numbers, and state in the report which scenes are illustrative.)
4. Hub and system part: lead with the project's and the GAID hub/system's main purpose (researcher-support platform; the research
   cycle that turns papers and analyses into shared, improving Workflows for the geoscience AI ecosystem); features appear along the way
   to serve that story, not as a list of narrow functions.
5. Same delivery terms: silent, internal review only, 1920×1080 30 fps, about 90–105 s (record if different). Reuse v3's real-system takes
   where they fit; recapture only if the new story needs it. Report with small PNG key frames, video locator + sha256, registry entry
   `review` superseding v3.

## Notes

- Review app (PC74, main 7650e012, loopback-only http://127.0.0.1:3000; institute hub server 7703739a): tell the hub before and after
  any use; no settings change. Example analyses (if any): coarse/loose, ≤10 min per run, method kept whole, at most one real run.
- Visible names "AI agent"/"GAID"; K-Dense shown as the upstream source where shown; no proprietary assets/fonts; KIGAM logo internal only.
- Tools: `media-craft` (no ffmpeg/ImageMagick/sox installed), `playwright-cli`; KIGAM network blocks raw.githubusercontent.com.
- Outputs outside Git. Workers via `task start --parent` / `task reader`. Outside check: none. After completion the hub offers the
  private Drive upload like v2/v3.


## Analysis of v3 (2026-10-24)

Sources read: report `reports/2026-10-24-gaid-promo-video-v3/index.md`, `geo/promo/scene/scene.js`, capture-v3 `capture.json`
(16 shots, 36 beats), contact sheet of the final render.

Where text sits alone (feedback 1):
- Background 4–16 s (12 s): three full-sentence headlines (~4.8 s each) over six cards that are themselves text (title +
  name chips) and a GAID panel of five text rows. Nothing shows a researcher working; the only motion is cards sliding
  and tilting. It reads as slides of text.
- "개념도" note tag at (1700, 100) in the background and second-brain scenes: an honesty label from v2, read as AI-slop.
- Cycle 16–22 s and second brain are graphic and fine; the cycle headline is the only place the purpose is said.

Where the demo becomes a feature list (feedback 2):
- Chapter titles name actions (내 서재, 논문에서 Workflow 만들기, …) and 36 beat tags change every 1.5–2.5 s, each naming
  a narrow UI feature (서재 옆에서 PDF 읽기, 필요한 쪽을 바로 보기, 출처와 이용 조건도 공유 …). Nothing says why a chapter
  matters, and GAID 시스템 (the researcher's workspace) vs GAID 허브 (shared, improving Workflows) is never named.

## Direction v4 (structure kept; shown to the user before re-rendering)

Scene structure kept: opening → background → research cycle → six demo chapters → KIGAM Second brain → closing.
Real-system takes reused from capture-v3 (no recapture). Target ~103 s.

1. Opening (4 s): subtitle "지구과학 연구자를 위한 AI agent 연구 지원 플랫폼".
2. Background (~15 s), motion graphics with one short caption per phase:
   - 2a 연구자의 일: a researcher mark in the middle and three animated work vignettes around it — 자료 조사 (map tile with
     survey points appearing, a well-log curve drawing, table rows filling), 문헌 분석 (paper pages stacking, a highlight
     sweeping lines, a quote pulled out), 코드 작성 (an editor typing lines, a run bar, a failing line and a retry). A dotted
     path runs back and forth between them. Labels only under each vignette. Caption: "자료를 찾고, 논문을 읽고, 코드를 짭니다".
   - 2b 흩어진 도구: the vignettes shrink; skill/tool cards appear far apart across the frame (real names: K-Dense AI 과학
     스킬 chips, KIGAM 지구과학 스킬, GitHub 저장소 스킬, 논문 부록 코드 .py, 기관 자료, 개인 폴더 스크립트, agent 도구) in
     different shapes; reaching lines from the researcher stop short or break. Caption: "쓸 만한 스킬과 도구는 곳곳에 흩어져 있습니다".
   - 2c GAID로 모으기: the GAID mark appears; cards fly in along curves and dock as icons on GAID's shelves; one solid line
     joins the researcher to GAID. Caption: "GAID가 한곳에 모아 연구를 돕습니다".
   No counts or invented numbers; no "개념도" tag.
3. Research cycle (~8 s), purpose stated: the ring with its two halves named — GAID 시스템 (내 연구: 서재, 연구 분석,
   연구노트) and GAID 허브 (함께 쓰는 Workflow: Workflow 만들기, 허브 공유); version 0.1.0 → 0.1.1 as before. Headline:
   "논문과 분석이 공유된 Workflow가 되고, 쓰일수록 나아집니다".
4. Demo (~65 s): the header carries a purpose line per chapter with a GAID 시스템 / GAID 허브 plate; a small cycle ring at
   the top right replaces the linear strip. One outcome tag per shot (16 instead of 36), held for most of the shot.
   | chapter | part | purpose line | shots (tag) |
   |---|---|---|---|
   | 내 서재 | 시스템 | 연구는 내 서재의 논문에서 시작합니다 | L1 주제별로 모은 논문, L2 논문을 곁에 두고 읽기 |
   | Workflow 만들기 | 허브 | 논문 속 방법을 AI agent가 따르는 Workflow로 만듭니다 | A1 논문·코드·자료를 함께, A2 원문 근거를 보며 결정, A3 단계로 정리된 분석 절차 |
   | 허브 공유 | 허브 | 만든 Workflow는 GAID 허브에서 함께 쓰고 고쳐 갑니다 | H1 다음 version으로 등록, H2 허브에서 가져다 쓰기 |
   | 연구 분석 | 시스템 | 공유된 Workflow로 내 자료를 분석합니다 | R1 근거 논문과 함께 시작, R2 단계마다 자료와 조건, R3 AI agent가 Workflow대로 분석, M1 결과를 원본 좌표 그대로 |
   | 연구노트 | 시스템 | 결과와 판단은 연구노트에 남습니다 | N1 결과부터 쓴 연구노트 → 판단은 연구자가 |
   | 다시 서재로 | 시스템 | 연구가 서재로 돌아와 다음 연구로 이어집니다 | L3 노트도 서재에, L4 논문에서 이어진 연구 이력, L5 논문·Workflow·노트의 연결 |
   Trims to fit: A4 dropped (example data still shown in H1 and R2), L2/R2/L3/M1 shortened by 0.5–1 s.
5. Second brain (~7.5 s): kept, tag removed. 6. Closing (4 s): kept, same subtitle as the opening.

Honesty without the tag: no invented numbers; the report names the illustrative scenes (background, cycle, second brain).

Decisions: all film work is tightly coupled in `geo/promo/scene/scene.js`; the writer does it alone (no child writers).

## Current state
- Analysis + direction v4 written above and shown to the user in the writer tab (2026-10-24) before rendering.
- `geo/promo/scene/scene.js` v4: new background (S2, local clock 0–15.3), cycle zones (GAID 허브 / GAID 시스템), demo
  header (part plate + purpose line + mini ring), `TAGS` (22 outcome tags), `USE` trims, A4 dropped, 개념도 tags removed,
  subtitle "지구과학 연구자를 위한 AI agent 연구 지원 플랫폼". Length 103 s (DURATION from the page).
- Previews (stills only): `~/data/geoaidesk/work/gaid-promo-video-v4/prev1..prev4t`. Fixed: panel z-order over flying
  cards, researcher overlapping the panel (moved left before the panel appears; left-hand tools fly first).
- Final render job `job-geoaidesk-gaid-promo-video-v4-1` from f66c4f89 (receipt
  `~/data/geoaidesk/runs/gaid-promo-video-v4-20261024T005812.015692Z/receipt.json`).
- Job exited 0. Video verified by re-reading: 103.00 s, 3,090 frames, 1920×1080, 30 fps, H.264, no audio; sha256
  5f6d50ca02a4364363b01ca2f430c1e9796ff6969020950692e472d3da40f098 (manifest 18f89777…f824342). Transition frames checked
  (`~/data/geoaidesk/work/gaid-promo-video-v4/qa-v4/qa-transitions.png`).
- Report `reports/2026-10-24-gaid-promo-video-v4/index.md` complete with figures from the final MP4; humanizer pass (no
  changes needed); v3 report marked superseded; registry `gaid-promo-video-v4` (review, supersedes v3; v3 entry state left
  `review` like v2, the registry has no superseded state).
- Review app not used; no recapture.
## Next steps
<!-- task:closed -->
Closed 2026-10-24T01:07:54Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-24-gaid-promo-video-v4/index.md

(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-20261024T005812.015692Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
