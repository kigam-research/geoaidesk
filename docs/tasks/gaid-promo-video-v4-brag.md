---
format: 1
status: waiting
updated: 2026-10-24T01:16:07Z
writer: {"host":"seongin3","reserved":"9825be956e484ea4be90d2e182aaed55b5cf2c9ca62fa47c866e8d332f9219cb"}
branch: task/gaid-promo-video-v4-brag
target: main
parent: 
---
# gaid-promo-video-v4-brag

## Goal and done criteria
Request from the starter:

# Goal: gaid-promo-video-v4-brag — the v4 promo message rebuilt with the brag skill, with sound

## User request (verbatim, 2026-10-24)

> 사용자는 현재 v4 영상 작업이 완료되면 https://github.com/latent-spaces/brag를 도입하고 사용하여 v4_brag로 소리까지 포함된 홍보영상을 생성하고싶다. 주요 메시지는 v4와 동등하게 하면서 brag스킬로 영상을 생성하게 하는 작업을 opus 5.5 high fast로 진행시키자.

Hub questions and the user's answer ("모두 권장방식대로하자"):
1. Length (가): same as v4, about 90–105 s, carrying all of v4's messages, while following brag's direction rules (2-second hook,
   cuts on the beat, a proper music mix). Use brag's `--duration`.
2. Sound (가): music and sound effects only, no narration; the message is carried by on-screen copy.
The film stays internal review only (earlier user decision); only this version has sound.

## Verified facts (hub, 2026-10-24)

- latent-spaces/brag: MIT, ~18k stars, pushed 2026-10-23. Skills `brag` (Hyperframes workflow) and `brag-slim` ("rebuilt lean for Opus
  5.5": story, visuals, music and effects made by the model with tools already on the machine; `/brag` hands off to it on Opus 5.5;
  default duration ~20 s; rules: hook first, every cut on a beat, music and effects as one mixed piece; ask before installing anything).
  Voiceover is off by default (Kokoro via Hyperframes in full mode only).
- Install: `npx skills add https://github.com/latent-spaces/brag --skill brag-slim` (or copy `skills/brag-slim/` to
  `~/.claude/skills/brag-slim/`); raw.githubusercontent.com is blocked on the KIGAM network — use `gh api` or codeload.github.com.
  Record the installed brag commit. Install user-level (the user asked to adopt brag); do not commit brag into this repo.

## Parallel start (user, verbatim 2026-10-24)

> V4와 병렬로 진행가능하면 brag 영상 작업시작하자.

v4 (gaid-promo-video-v4) is rendered and reported on branch task/gaid-promo-video-v4 (not yet on main): report `reports/2026-10-24-gaid-promo-video-v4/index.md`, sources `geo/promo/` (scene.js v4), video from job `job-geoaidesk-gaid-promo-video-v4-1` (receipt `~/data/geoaidesk/runs/gaid-promo-video-v4-20261024T005812.015692Z/receipt.json`; 103.00 s, 1920×1080 30 fps, no audio, sha256 5f6d50ca02a4364363b01ca2f430c1e9796ff6969020950692e472d3da40f098). Read them from that branch (git show origin/task/gaid-promo-video-v4:<path>) or main once v4 merges.

## Done

1. Start from v4 (gaid-promo-video-v4: report under reports/, sources `geo/promo/`, its video and registry entry): same main messages and
   storyline, rebuilt through brag-slim (plan `brag-plan.md`, composition, share copy) with v4's real-system takes and assets where they fit.
2. Render `v4_brag` 1920×1080 30 fps with a stereo soundtrack (music + effects, mixed, beat-synced), about 90–105 s; poster frame per brag.
   No ffmpeg/ImageMagick/sox on this PC: use the `media-craft` skill for encoding/audio if brag needs it, or ask before installing anything.
3. Keep GAID rules: visible names "AI agent"/"GAID"; no invented numbers; no proprietary assets/fonts; music generated, not taken from
   copyrighted tracks; KIGAM logo internal only; no "개념도"-style corner labels.
4. Outputs outside Git (`~/data/geoaidesk/...`); report with small PNG key frames, video locator + sha256, licence/provenance of the
   soundtrack, registry entry `review` (alongside v4, not superseding it).

Writer: Opus 5.5 high fast (user). Outside check: none. Tell the hub before any use of the review app (not expected).

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
