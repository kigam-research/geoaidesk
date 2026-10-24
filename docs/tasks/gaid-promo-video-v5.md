---
format: 1
status: active
updated: 2026-10-24T02:14:45Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"da0f8189-d65f-4333-a4a4-2417e324fc5e","pid":1147050,"provider":"claude","session":"0d2db664-c41d-4de7-9a1b-3e6669655de8","start":"69420486","token":"c8c20319620da0999781644a90cc81b9cf57d815ece33d3e3953b030303d683e"}
branch: task/gaid-promo-video-v5
target: main
parent: 
---
# gaid-promo-video-v5

## Goal and done criteria
Request from the starter:

# Goal: gaid-promo-video-v5 — a more marketable promo: balanced examples, clean highlight frames, real screens as windows in the motion design

## User feedback (verbatim, 2026-10-24, on v4)

> 현재 v4 영상은 PGI예제로 치우쳐져있다. 그리고 기능을 소개할때 사각형도 영역을 중간에 어색하게 잘리게 지정하는 경우도 빈번해서 수정이 필요하다. 예제도 yilgarn예제와 PGI예제를 둘다써도되고 꼭 모든 워크플로우가 하나의 예제만 보이는것이 아니라 적합한것을 사용하고 촬영 에셋이 영상 전 영역을 차지하지 않고, 해당 기능을 소개하는 모션그래픽속의 창요소처럼 보여도되므로 상품성 높은 홍보영상이 될수 있게 v5로 개선하자.

## Done (user's outcome)

1. Start from v4 (report `reports/2026-10-24-gaid-promo-video-v4/index.md`, sources `geo/promo/`, video
   `pc74:~/data/geoaidesk/runs/gaid-promo-video-v4-20261024T005812.015692Z/out/gaid-promo-v4.mp4`): keep its structure and messages
   (background motion graphics, purpose line per part, outcome tags instead of feature names).
2. Examples: not only the Pocheon PGI example — use the Yilgarn nickel MPM example and the PGI example (and others in the review app if
   they fit), choosing per scene what shows the feature best; the research cycle need not follow one example end to end.
3. Highlight boxes must frame whole UI regions — never cut a panel, card or text mid-way; check every box against its frame.
4. Real-screen takes may appear as window elements inside the motion design (framed, scaled, placed with motion), not always full-frame;
   aim for a marketable promotional film while keeping GAID's identity (brand blue, Pretendard, UI guide v2 tokens; no gradients/glass/
   image filters/AI icons/emoji/proprietary assets; original pixels inside the windows, no filters on them).
5. Same terms: silent, internal review only, 1920×1080 30 fps, about 90–105 s (record if different). Report with small PNG key frames
   (including box checks), video locator + sha256, registry entry `review` superseding v4.

## Notes

- Review app (PC74, main 7650e012, loopback-only http://127.0.0.1:3000; hub server 7703739a): the Yilgarn projects/notes and the PGI
  study records are there. Tell the hub before and after use; no settings change. New captures: example analyses coarse/loose, ≤10 min
  per run, method kept whole, at most one real run.
- Running in parallel: gaid-promo-video-v4-brag and gaid-promo-video-v4-lemo (based on v4; they own their own folders), gaid-cite-open-pdf,
  gaid-note-bundle-export, gaid-uiux-skills-scan. Keep your edits in `geo/promo/`.
- Visible names "AI agent"/"GAID"; no invented numbers; KIGAM logo internal only; no "개념도"-style corner labels. Tools: `media-craft`,
  `playwright-cli`; KIGAM network blocks raw.githubusercontent.com. Outputs outside Git. Outside check: none. The hub uploads the finished
  video to Google Drive (user rule).

## Current state
- Analysis of v4 and Direction v5 written (below); capture contract `geo/promo/CONTRACT.md` (v5, Yilgarn shot list Y1–Y7).
- Capture child `gaid-promo-video-v5--capture` started 2026-10-24 (profile "general work"); it owns `capture_v5*.py`,
  the v5 section of `CAPTURE.md` and `~/data/geoaidesk/work/gaid-promo-video-v5/capture-v5/`.
- Scene reworked (`scene.js` v5 window stage: `CHAPTERS_DEF` steps, `V3` whole-region rects, `mkWin`/`mkDetail` lifts,
  pair step Y5+M1); `render.py` merges `--capture v3=… --capture v5=…`; `frame_check.py` for box checks.
  Previews with v3 only (Y shots as placeholders): `~/data/geoaidesk/work/gaid-promo-video-v5/prev1`, `prev2` (95 s).
- V3 rects checked on drawn/zoomed frames (`~/data/geoaidesk/work/gaid-promo-video-v5/rects/`): edges lie in gaps between
  whole elements or on panel borders. Rejected v3 regions: L1 side panel (runs past the viewport), H1 shared-file list
  (scrolls; the whole dialog is framed instead), N1 figure (clipped by the pane), L4 uses list (runs past the viewport).
- Review app: hub told before use (request d7fb43947212); my exploration blocked workspace-state PUTs; Yilgarn
  workspace-state.json mtime unchanged (2026-10-23 13:24:46 KST).
## Next steps
1. When the child finishes: `task complete gaid-promo-video-v5--capture`, render stills with both captures, check every
   beat (stills `NN-<shot>-<k>`), tune Y beats/labels/timing.
2. Tell the hub the review app is free (after the child's captures).
3. Final render job, report `reports/2026-10-24-gaid-promo-video-v5/index.md` with key frames incl. box checks, registry.
## Failed approaches
## Notes and decisions

### Analysis of v4 (2026-10-24)
- Examples: all 15 demo takes are the Pocheon PGI study (capture-v3). The review app also holds the Yilgarn nickel MPM
  example: hub folder 광상 부존 가능성(MPM) (5 entries) and the recommended card "PU-컨포멀 탐사 우선순위 존 분류" with a concept
  picture (`entry-ap-a135f290-1c4`, version 0.1.1), project `yilgarn-cd7814` (Workflow "PU-컨포멀 탐사 존 분류 (새 지역)",
  chat with the run, priority-zone map `outputs/yilgarn_priority_zones.{gpkg,geomap.json}` over OSM, research note
  `연구노트/2026-10-23-yilgarn-priority` with a map figure and an answered decision), paper `ahn2026` in 서재.
- Highlight boxes: the v3 beat rects were hand-drawn per state and often end inside a region. In
  `capture-v3/beat-checks/` e.g. L1 beat 2 ends mid side panel ("내 연구에서 쓰인 곳" list cut at the bottom), A1 beat 2 cuts
  between two source rows, A3 beat 2 cuts the step-detail column mid-list, A4 beats cut cards, and v4 additionally used
  `UNION` of two partial rects. Rule for v5: a frame is the bounds of whole DOM elements (v5 takes: measured in the
  capture; v3 takes: re-derived from the frames along visible panel/card edges and checked on drawn frames).
- Layout: every demo step showed the app full-frame (1696 px) with a dim; the motion design stopped at the header.

### Direction v5
- Keep v4's structure and messages: opening → background motion graphics → research cycle (GAID 허브/시스템) → six demo
  chapters with purpose line, part plate, mini ring and one outcome tag per step → KIGAM Second brain → closing.
- Demo as a window stage: the real screen is a framed window (GAID chrome bar with an example chip such as
  "포천 자철석 PGI" / "Yilgarn 니켈 MPM") placed and moved inside the motion design, not full-frame. A step's feature is
  framed on the window (whole region) and lifted out as an enlarged detail window of the same original pixels, joined by
  projection lines, with the outcome tag as large type beside it. Some steps pair two windows (PGI and Yilgarn side by
  side: maps, notes). No filters on the footage; tokens, Pretendard, brand blue; no gradients/glass/AI icons/emoji.
- Example per chapter (best fit, not one example end to end): 내 서재 = PGI (L1, L2); Workflow 만들기 = PGI live authoring
  (A1, A2) + Workflow stages; 허브 공유 = PGI version register (H1) + Yilgarn hub card/MPM folder/entry (Y1, Y2); 연구 분석 =
  Yilgarn start window (Y3) + PGI AI agent run (R3) + map pair Yilgarn/PGI (Y5, M1); 연구노트 = Yilgarn note (Y6) + PGI page
  citations (N1); 다시 서재로 = paper uses and connection map (L4/Y7, L5). Target 95–103 s.

### Work packages and integration order
1. Capture child `gaid-promo-video-v5--capture` ("general work"): owns `geo/promo/capture_v5*.py`, the v5 section of
   `geo/promo/CAPTURE.md`, `~/data/geoaidesk/work/gaid-promo-video-v5/capture-v5/`. Interface: `CONTRACT.md` v5.
2. Parent (me): `scene/`, `render.py` (multi-capture input), README, rects for v3 takes, render, report, registry.
3. Integration: complete the child → previews with both captures → box checks on key frames → final render job → report.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
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
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v5-20261024T021150.866300Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
