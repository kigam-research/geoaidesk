---
format: 1
status: active
updated: 2026-10-24T02:58:32Z
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
- v5 final: job 2 (`job-geoaidesk-gaid-promo-video-v5-2`, source 528f09e8) exit 0: 93.00 s, 2,790 frames, silent,
  video sha256 0e5126b8…05ff, manifest cd2a2e82…e3f1; out `~/data/geoaidesk/runs/gaid-promo-video-v5-20261024T021454.162971Z/out`.
  Layout: narrative column + one window (user feedback), 16 shot uses (PGI 9, Yilgarn 7), 27 whole-region frames
  (PGI 13 re-derived, Yilgarn 14 DOM-measured). Job 1 (first layout, lifted detail windows) exit 0, not used.
- day45 final: job 4 (`job-geoaidesk-gaid-promo-video-v5-4`, source f69be169) exit 0: 45.00 s, 1,350 frames, H.264 + AAC
  48 kHz stereo, decoded peak −0.85 dBFS, RMS −15.6 dBFS, 483 sound events all on the 16th grid (soundtrack.py check),
  poster = hub frame 31.4 s; video sha256 b550272a…d5fb, manifest 0879a90b…9c1a. Job 3 (first day45 render) exit 0, not
  used (off-grid effects). Sound checked by measurement only, not by listening.
- Report `reports/2026-10-24-gaid-promo-video-v5/index.md` (figures 01-demo, 02-boxcheck, 03-day45 from the final files /
  capture frames), humanizer pass done. Registry: `gaid-promo-video-v5` (review, supersedes v4; v4 report marked
  superseded) and `gaid-promo-video-v5-day45` (review).
- Capture child `gaid-promo-video-v5--capture`: captures delivered (capture.json sha256 a4503407…9841, unchanged at
  11:45 KST). Its first `task finish` stopped: scripts/check had 4 frontend tests time out at 5000 ms under PC load
  (unrelated to its files); local Finish commit 669311f7 unpushed. Asked the child (agent 7b6c0c70) to rerun `task finish`.
- Review app: hub told before (d7fb43947212) and after (1ac626ae9bf6) use. Checks: no automated checks for the film
  sources (scripts/check not run by this unit; the child runs it in its finish).
## Next steps
1. When the child finishes: `task complete gaid-promo-video-v5--capture`, confirm capture.json hash unchanged.
2. Then `task finish` (report review copy already made).
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

### User feedback during v5 (2026-10-24, verbatim)
> 똑같이 만들 필요는 없지만 7a3e05f2-d0b7-4b67-8d3a-6702b12a9d7d 세션의 102초 영상 처럼 꼭 허브와 시스템을 설명하는 창이 영상 전체를 차지할 필요가 없고 모션 그래픽의 한 요소로 배치되는 것이 처음 보는 독자의 입장에서는 더 이해하기 쉽다. 사용자의 피드백이다

(The session is the writer of `gaid-promo-video-v4-lemo`, its 102 s "Dark Tech Keynote" cut.) Applied: the demo now has a
narrative column on the left (part plate, purpose in 50 px, the chapter's outcome rows; the current row is blue and a
leader line runs to the whole-region frame on the window) and one 1180 px window on the right. The lifted detail windows
of the first v5 layout were dropped (one focus per moment for a first-time viewer); the pair step shows the two examples
as two staggered 690 px windows. v5's light 계측 style, example mix and whole-region rects stay. Y3's three beats share one
rect (whole start window), so they became two rows. Job 1 (render of the first layout) is superseded by job 2.

### Added scope: 45 s product film (user request 2026-10-24, verbatim)
> 좋다. 해당 렌더와 함께 추가 영상을 제작하고 싶다. 현재 방식은 기능 설명 홍보 영상에 가깝다. 제품 홍보영상으로서는 너무 기능 위주의 설명이 가득하고 처음 보는 이용자의 입장에서는 한번에 기능을 2~3초만에 이해할 수 없다. 이러한 관점에서 제품 홍보 영상으로는 중요 메시지를 코드만 사용하는 모션 그래픽으로 잘 설명하여 그림만으로도 홍보하려는 도구의 강점을 파악하고 구매하거나 이용하고 싶게 만들어야 한다. 그리고 분량은 45초 정도로 구성해야한다. 현재 설치된 brag스킬을 활용하면 소리도 생성 가능할 것으로 기대한다. 어떻게 연출해야할지 논의하여 생성해보자.

Proposal discussed in the tab (one message per scene, no feature names, code-only motion graphics, cuts on a 96 BPM bar
grid = 18 bars × 2.5 s = 45 s, music + effects synthesised, no narration, internal review). User choices (AskUserQuestion):
structure "한 연구자의 하루형", tone "밝은 계측 + 블루 전환 (권장)", music "경쾌한 미니멀 (권장)". The v5 film continues
unchanged. Made by me (tightly coupled to this discussion; brag-slim is built for Opus 5.5). Sources `geo/promo/day45/`,
outputs outside Git; it sits beside v5 in the report and registry (`review`, does not supersede anything).

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
Report: reports/2026-10-24-gaid-promo-video-v5/index.md
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v5-20261024T021150.866300Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v5-20261024T021454.162971Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v5-20261024T023353.091711Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v5-20261024T023841.916242Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
