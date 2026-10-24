---
format: 1
status: waiting
updated: 2026-10-24T01:16:17Z
writer: {"host":"seongin3","reserved":"cf5c8f589e76a6dbecf6337ab862cef0503ee6d44a62675d7a617b3f37b86d07"}
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
