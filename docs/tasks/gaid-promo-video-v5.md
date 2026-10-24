---
format: 1
status: waiting
updated: 2026-10-24T01:44:14Z
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
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
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
