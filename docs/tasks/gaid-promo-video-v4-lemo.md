---
format: 1
status: done
updated: 2026-10-24T06:41:24Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"7a3e05f2-d0b7-4b67-8d3a-6702b12a9d7d","pid":928827,"provider":"claude","session":"59746d33-e6ee-462e-8b2d-75b3d3e44afd","start":"69252382","token":"cf5c8f589e76a6dbecf6337ab862cef0503ee6d44a62675d7a617b3f37b86d07"}
branch: task/gaid-promo-video-v4-lemo
target: main
parent: 
---
# gaid-promo-video-v4-lemo

## Goal and done criteria
Request from the starter:

# Goal: gaid-promo-video-v4-lemo — the v4 promo message rebuilt with a lemo-opuscar film style, with sound

## User request (verbatim, 2026-10-24)

> V4와 병렬로 진행가능하면 brag 영상 작업시작하자. 그리고 또 별도로 https://github.com/lemomo-ai/lemo-opuscar 에서 GAID 허브 시스템 홍보에 적합한 것을 선정해 brag영상 제작작업과 동일한방식으로 lemo작업도 시작하자.

"동일한 방식" = the terms the user set for the brag version (answers "모두 권장방식대로하자"): main messages equal to v4; about
90–105 s; music and sound effects only, no narration (message carried by on-screen copy); internal review only; writer Opus 5.5 high
fast; rendered alongside v4 (not superseding it).

v4 (gaid-promo-video-v4) is rendered and reported on branch task/gaid-promo-video-v4 (not yet on main): report `reports/2026-10-24-gaid-promo-video-v4/index.md`, sources `geo/promo/` (scene.js v4), video from job `job-geoaidesk-gaid-promo-video-v4-1` (receipt `~/data/geoaidesk/runs/gaid-promo-video-v4-20261024T005812.015692Z/receipt.json`; 103.00 s, 1920×1080 30 fps, no audio, sha256 5f6d50ca02a4364363b01ca2f430c1e9796ff6969020950692e472d3da40f098). Read them from that branch (git show origin/task/gaid-promo-video-v4:<path>) or main once v4 merges.

## Verified facts (hub, 2026-10-24)

- lemomo-ai/lemo-opuscar: ~6.1k stars, pushed 2026-10-22; licence "MIT · CC BY 4.0" (check which parts are CC BY and give the required
  attribution); 59 film styles, each a style prompt plus a demo film made in code (canvas/WebGL pages rendered frame by frame, music from
  free sample libraries, TTS voice optional), "tuned for Claude Opus 5.5". Families include Evidence Films and Edit & Documentary (real
  footage, documents, data) — likely fits for a research platform, but you choose.
- Install: `claude plugin marketplace add lemomo-ai/lemo-opuscar` + `claude plugin install lemo-opuscar@lemolab` (downloads guides/tools to
  `~/lemo-opuscar`), or copy `plugin/skills/lemo-opuscar/`. Python tiers: requirements.txt (numpy, scipy, soundfile, soxr, pillow),
  requirements-music.txt (numba). On this PC use uv, never pip (`uv run --no-project` or a uv env under ~/data); Node >= 20 present.
  raw.githubusercontent.com is blocked — use `gh api` or codeload.github.com. Record the installed commit and every sample library's licence.

## Done

1. Select the style(s) that fit promoting the GAID hub/system (show 2–3 candidates with frames and reasons in the writer tab, pick one;
   the user may override there). Keep GAID's identity (brand blue, Pretendard, UI guide v2 for any UI shown).
2. Rebuild v4's storyline in that style with v4's real-system takes and assets where they fit; 1920×1080 30 fps, stereo music + effects,
   about 90–105 s. No ffmpeg/ImageMagick/sox here: use lemo's tools or the `media-craft` skill; ask before installing anything else.
3. GAID rules: visible names "AI agent"/"GAID"; no invented numbers; no proprietary assets/fonts; KIGAM logo internal only; no
   "개념도"-style corner labels.
4. Outputs outside Git; report with small PNG key frames, video locator + sha256, style/licence/attribution and soundtrack provenance,
   registry entry `review` alongside v4. Outside check: none. Tell the hub before any use of the review app (not expected).

Running in parallel: gaid-promo-video-v4 (finishing) and gaid-promo-video-v4-brag (brag skill). Do not edit `geo/promo/` files the others
own; put lemo sources in a separate folder (e.g. `geo/promo-lemo/`) or outside Git.

## Current state
- Result (2026-10-24): two lemo-opuscar (Dark Tech Keynote) GAID promo films, internal review, music + effects, no narration.
  103 s cut: job job-geoaidesk-gaid-promo-video-v4-lemo-8 (source c7f20680), film
  ~/data/geoaidesk/runs/gaid-promo-video-v4-lemo-20261024T062754.451258Z/out/gaid-promo-lemo.mp4 sha256 499c7b53…f40e,
  102.9 s, 3087 frames, 1920×1080 30 fps, -14.4 LUFS, TP -1.1 dB, no black segments; boxes follow the drawn pointer (20 boxes,
  each checked at start/end on the final file, look/tagqa8-*), 16 outcome rows (13 held >= 3 s), live AI agent run footage
  (capture-v6, AG2 3x marked 빠르게 보기), GAID 허브/시스템/내 서재 wording and colours per the user. 40 s film: child
  promo-40s job -3, sha256 52b0055d…3546, 42.0 s, -14.1 LUFS. Report reports/2026-10-24-gaid-promo-video-v4-lemo/index.md
  (§8 = 40 s), registry entries gaid-promo-video-v4-lemo and gaid-promo-video-v4-lemo-40s (review). Children promo-40s and
  agent-capture completed and closed (agent-capture's failed export job 2 disposed as superseded by job 3).
- Superseded renders of this unit: jobs -1 (102.3 s round 1), -2/-3 (round 2 picture), -4 (failed mastering attempt), -5 (round 2
  film), -6/-7 (round 3 before click-box fixes). Sound checked by measurement only, not by listening.
- lemo-opuscar 3961ddb + VCSL registered as asset `lemo_opuscar` (configs/inputs.toml). Checks: no automated checks for the
  film sources; scripts/check is run by task finish.
## Next steps
<!-- task:closed -->
Closed 2026-10-24T06:41:24Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Round 1 (job -1, 102.3 s) user feedback 2026-10-24 (verbatim): "102초판의 경우 피드백으로 사각형 박스로 영역을 표시할 때
  올바르게 표시해야한다. 현재 해당 영역을 올바르지 못하게 표시하거나 화면에서 엉뚱한 곳을 가리키거나 화면을 자르는 사각 박스가
  있는 경우도 있다. 102초판의 경우 장면 전환을 스무스하게 하고 영상을 최적화한다면 꽤 적절한 영상으로 활용가능하다고 생각한다.
  자가 검토하여 무엇이 부족했는지 진단후 개선하자."
  Self-review (per-tag frames from the final file, look/tagqa0-*.jpg; probe of the box geometry in the page):
  1. Coordinate mapping was right (probe matched capture rects × 0.922). Wrong boxes came from using a beat's rect outside its
     own capture window: p:L1 after 2.5 s (detail panel opened), p:H1 after 3.0 s (dialog closed, box on the entry page),
     p:H2 before 1.75 s, p:N1 0–1.5 s (beat 1 rect on the beat 0 screen), y:N1 after ~5.2 s (layout changed: chat panel opened).
  2. Unions of two beats (A1, A3, L4) made oversized boxes.
  3. Rects touching the window edge (y:M1 map, x = 0) put the box border on the window edge: looked like the take was cut.
  4. Chapter changes collapsed the window to a bar and left the right side empty for up to ~0.5 s; the demo ended in a 0.5 s
     near-empty frame before the second brain; ending had ~2 s of almost nothing; second-brain lines held 2.8/3.3 s.
  Fixes (round 2): tags = [beat, label] with the beat's own window only, glide between consecutive beats, box inset 6 px inside
  the window; `use` trimmed where layout changes or no beat covers (L1 0–2.6, H2 1.6–3.5, y:N1 1.5–4.8); the window stays
  through the demo and every cut (chapters too) is a 0.6 s soft light sweep with a small breath on chapter change, left column
  leaves up and rises in; the window shrinks into the mini cycle, which flies in as the first second-brain ring; second brain
  9 s (lines ~4.2 s each); put-away and logo tightened. Length 102.3 -> 96.9 s.
## Notes and decisions
- 2026-10-24 round-2 feedback (verbatim): "103초판에 대해서는 첨부한 이미지처럼 40초 구간을 보면 마우스 포인터랑 영역 선택 부분이
  일치하지 않는다. 이러한 부분이 40초 구간 뿐만 아니라 다수 존재한다. 현황 진단 후 마우스 포인터랑 영역 선택이 자연스럽게 되어야
  한다. 멈춰있는 듯한 인상을 주어서는 안된다. 또한, GAID 허브와 GAID 시스템을 구분하다보니 색상을 다르게 선택했지만 오히려
  이로인해 GAID 시스템쪽은 마치 활성화가 되지 않은 부분처럼 느껴진다. 이부분은 수정이 필요하다. 그리고 기능 설명을 병합하여
  장면을 줄이더라도 사람의 인지적 관점에서 너무 빠른 전환이나 설명은 정보량을 받아들일 수 없다. 특히 60초 이후 구간부터는
  진행이 갑자기 빨라지는 것은 너무 많은 기능을 소개하고 있어서라고 생각한다. 해당 부분들을 병합하여 설명하면 더 효과적일
  것이라고 생각한다. 그리고 57초 구간 근처에 있는 에이전트 계산 부분은 실제로 에이전트 작업되고 있는 부분들이 보였으면 한다.
  멈춰있는 사진들을 사용하는 것은 적절하지만 촬영을 통한 움직음으로 보이는 것이 적절한 것은 섞어가면서 완성도를 높였으면 한다.
  [40 s part forwarded to its writer] … GAID 허브는 지구과학 연구자들이 논문, 문헌, 연구노트 등을 기반으로 양질의 지구과학용
  워크플로우(또는 스킬)을 생성하고 공유하는 공간이고, 시스템은 해당 워크플로우를 설치하고 에이전트형 분석 작업을 수행하고 IDE와
  에이전틱 기반 작업 및 지구과학친화적 분석 시스템이 종합된 분석 프레임워크이다. 이를 모두 합친 것이 GAID이며, 서재의 경우에는
  GAID 시스템에 포함되어도 되고, 허브에 포함될 수 있지만 전체적으로 연구자 개인의 문헌 관리 공간으로 간주해야한다."
  Diagnosis: pointer inside the box for only 11 of 31 boxes (12 at 0 %): beats came from capture.json windows, the capture has no
  pointer path, so boxes ignored where the pointer acted; R3/v2 R2/v5 Y4 agent takes are cuts of finished states (v3 R3 cut
  132.29 s + 1,328.22 s), no live footage exists.
- 2026-10-24 user (writer tab, verbatim): "메시지는 동등해도 되는데 연출은 오히려 더 자유롭게 홍보성으로 만들자. 그리고 분량은 40초로하고
  코드로 된 영상 기반으로 전면 새로 만들어도 좋다. 현재 촬영자료가 있다고 너무 v4스타일로 만들필요는없다. 현재 렌더링중인것은
  계속만들고 별도로하나더 생성하자." -> two deliverables: (A) the ~103 s Dark Tech Keynote cut with real takes (this writer,
  geo/promo-lemo/), (B) a new ~40 s promotional film drawn entirely in code (child unit
  `gaid-promo-video-v4-lemo--promo-40s`, profile orchestrator = Claude Opus 5.5 high, the model the user set for this work;
  owns geo/promo-lemo-40/ and reports/<parent report>/section-40s.md + figures/40s-*.png). Prompt:
  ~/data/geoaidesk/work/gaid-promo-video-v4-lemo/prompts/child-40s.md. Writer agent 24b0e76b-628b-401e-adf8-0eca667720c5.
  Integration: `task complete gaid-promo-video-v4-lemo--promo-40s` after its finish, then merge its section into the canonical
  report and add both films to results/registry.toml.
- 2026-10-24 style: Dark Tech Keynote (`styles/dark-keynote`). Why: its native moves (generated accumulation, snap grid,
  type streams, light reveal) and its two sound families (scattered vs one in-key family) carry v4's storyline (scattered
  skills/tools -> GAID gathers them -> hub/system cycle); one accent = GAID brand blue. Deviations: real GAID takes
  appear as windows on the dark stage (the style itself avoids real apps); Pretendard replaces Inter; JetBrains Mono
  (OFL) for labels. B Swiss: too close to v4's light flat look, screenshots clash with pure 2D. C Living Screencast: needs
  an invented pixel mascot and redrawn UI, conflicts with real takes. User may override in the writer tab.
- Standing user feedback (gaid-promo-video-v2, 2026-10-23): no zoom/scroll inside real takes. Takes play whole at one
  scale; camera moves only on the stage between takes and in graphic scenes; expand/collapse transitions only.
- Plan (orchestration): sequential = treatment -> timeline (timeline.json, EV) -> picture + sound -> mux -> review.
  Picture and sound share the timeline and are tightly coupled; the writer does both (no child writers). A reader may
  review the final cut if useful. Owned files: geo/promo-lemo/** only (geo/promo/ untouched).
- Toolchain: picture = page contract of lemo (DUR/render/READY/EV/TEXTS) rendered with Python Playwright 1.63.0 +
  imageio-ffmpeg 0.6.0 (as v4); sound = lemo core/audio sfx.py + sampler.py with numpy/scipy/soundfile/soxr via uv;
  mux = two-pass loudnorm -14 LUFS with the imageio-ffmpeg binary (port of core/render/mux.sh; no system ffmpeg).
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-24-gaid-promo-video-v4-lemo/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo-20261024T014625.342944Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo-20261024T022827.582770Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo-20261024T023619.972785Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo-20261024T024347.706738Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo-20261024T024655.879578Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo-20261024T060710.491859Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo-20261024T061728.672417Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo-20261024T062754.451258Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
