---
format: 1
status: active
updated: 2026-10-24T02:28:19Z
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
- (A) ~102 s Dark Tech Keynote cut: sources in geo/promo-lemo/ (TREATMENT.md, scene/, render.py, mix.py, master.py,
  build.sh, CREDITS, README). Demo = real takes as windows inside the motion graphics (left: part badge, purpose, outcome
  rows with a leader line to the box on the take); PGI takes (capture-v3) and Yilgarn takes (capture-v2: M1 map, N1 note,
  L3 connection map) per the user's 2026-10-24 message. Preview pv1 (work dir) mastered to -14.1 LUFS / TP -1.3 dB,
  3069 frames, 102.3 s, no black segments; contact sheets look/sheetA.jpg, sheetB.jpg and press strip checked by eye.
- Final render: job job-geoaidesk-gaid-promo-video-v4-lemo-1 succeeded (source 4a58eec1): out/gaid-promo-lemo.mp4
  sha256 22dba68e…5717, 102.3 s, 3069 frames, -14.1 LUFS, TP -1.3 dB, no black segments (out/master.json). Report written
  with figures from the final file; registry entry `gaid-promo-video-v4-lemo` (review). Reading check: 17 of 44 texts
  under lemo's hold rule (rows, cycle labels, second-brain lines 2.8/3.3 s) — stated in the report limits.
- lemo-opuscar at 3961ddb + VCSL pack registered as asset `lemo_opuscar` (configs/inputs.toml, ~/assets/lemo-opuscar/3961ddb).
- (B) 40 s child unit gaid-promo-video-v4-lemo--promo-40s running (user's later message forwarded to it).
- Style candidates shown to the user: vault `연구 보고서/geoaidesk/2026-10-24-style-choice` (A Dark Tech Keynote chosen).
## Next steps
1. Wait for the 40 s child; then `task complete gaid-promo-video-v4-lemo--promo-40s`, merge section-40s.md into report §8,
   add its registry entry, humanizer pass, review-copy, task finish.
2. (done for A) Write reports/2026-10-24-gaid-promo-video-v4-lemo/index.md (+ figures), registry entry `review`, humanizer pass,
   review-copy; merge the child's section-40s.md after `task complete gaid-promo-video-v4-lemo--promo-40s`.
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
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
