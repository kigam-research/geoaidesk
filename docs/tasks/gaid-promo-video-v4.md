---
format: 1
status: active
updated: 2026-10-24T00:47:36Z
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
