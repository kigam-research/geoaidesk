---
format: 1
status: ready
updated: 2026-10-24T02:08:09Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"24b0e76b-628b-401e-adf8-0eca667720c5","pid":1060493,"provider":"claude","session":"23acab05-738d-4eb4-a516-d0f306fbf009","start":"69353657","token":"58b40e34279b58109446810b4fe4e2083e762187fbfcd1e612e152007331cea0"}
branch: task/gaid-promo-video-v4-lemo--promo-40s
target: task/gaid-promo-video-v4-lemo
parent: gaid-promo-video-v4-lemo
---
# gaid-promo-video-v4-lemo--promo-40s

## Goal and done criteria
Request from the starter:

# Child unit: a 40-second promotional GAID film drawn entirely in code (lemo-opuscar, Dark Tech Keynote)

Parent unit: gaid-promo-video-v4-lemo (geoaidesk). You are the single writer of this child unit.

## User request (verbatim, 2026-10-24, in the parent's writer tab)

> 메시지는 동등해도 되는데 연출은 오히려 더 자유롭게 홍보성으로 만들자. 그리고 분량은 40초로하고 코드로 된 영상 기반으로 전면 새로 만들어도 좋다. 현재 촬영자료가 있다고 너무 v4스타일로 만들필요는없다. 현재 렌더링중인것은 계속만들고 별도로하나더 생성하자.

Earlier terms for the lemo film (user, "모두 권장방식대로하자"): main messages equal to v4; music and sound effects only, no narration
(the message is carried by on-screen copy); internal review only; rendered alongside v4 (not superseding it).
The parent keeps making the ~103 s version with the real takes (geo/promo-lemo/). This child makes a separate, new film.

## Goal and done criteria

1. A ~40 s (38–42 s) promotional film, 1920×1080, 30 fps, stereo music + sound effects, about −14 LUFS, made the lemo way: every frame
   drawn in code (canvas/SVG/HTML page with a deterministic render(t), rendered frame by frame). No screenshots of the app are required;
   GAID UI moments may be redrawn in code, but every visible label, mode name and button must be one the real app shows (see "Sources").
   Direction is free and promotional: do not follow v4's scene order or demo-chapter layout. Messages stay those of v4:
   - background: researchers search data, read papers and write code; useful geoscience skills and agent tools are scattered;
     GAID gathers them in one place to support research;
   - GAID is "지구과학 연구자를 위한 AI agent 연구 지원 플랫폼", in two parts: GAID 허브 (Workflows made from papers, shared and improved,
     "version") and GAID 시스템 (내 서재 → 연구 분석 with an AI agent following the Workflow → 연구노트 → back to 내 서재);
   - the research cycle grows into an ecosystem: "KIGAM Second brain".
   Pick only what fits 40 s; the cycle (서재 → Workflow → 허브 → 분석 → 연구노트 → 서재) is the spine.
2. Style: lemo-opuscar Dark Tech Keynote (`styles/dark-keynote/STYLE.md`), chosen by the parent; keep its invariants (dark stage, hairline
   grid, one accent, snap-grid motion on the beat, light reveals, UI expand/collapse transitions, two sound families). Accent = GAID brand
   blue in its dark-theme tokens (`--gaid-signal` #3366e8, accent text #7fa2ff, logo on dark #4d7fff; neutrals from the `.dark` block of
   web/src/app/globals.css). Type: Pretendard only (web/public/fonts/PretendardVariable.woff2, OFL); tabular figures for labels.
   Logo: geo/brand/logo/*-on-dark.svg, paths unchanged. Icons: copies in geo/promo/scene/icons/ (Lucide, ISC/MIT; read-only reuse).
3. GAID rules: visible names "AI agent" and "GAID" (never Kady/K-Dense/BYOK except "K-Dense AI 과학 스킬" as a real skill-source name, as v4
   shows); no invented numbers, counts, stats or performance claims; no proprietary assets/fonts; no KIGAM logo; no "개념도"-style corner
   labels; Korean copy follows geo/copy/gaid-writing.md and terminology.csv (Workflow, version, 내 서재, 연구노트, GAID 허브, GAID 시스템).
   End card: GAID lockup + "지구과학 연구자를 위한 AI agent 연구 지원 플랫폼" + small "내부 검토용 영상". No LemoLab sign-off in the film.
4. Deliver: sources in geo/promo-lemo-40/ (TREATMENT.md first, per lemo DIRECTOR.md §4; scene page; render, mix and master scripts;
   CREDITS with every third-party asset and licence; README with one-command rebuild), outputs outside Git under
   ~/data/geoaidesk/work/<your slug>/ for previews and a final render through `task job run -- …` (so it gets a receipt), then
   a report section draft for the parent at reports/2026-10-24-gaid-promo-video-v4-lemo/section-40s.md (Korean 합니다체, result first:
   what the film shows, 3–4 small PNG key frames in reports/2026-10-24-gaid-promo-video-v4-lemo/figures/40s-*.png, video locator +
   sha256 + duration + loudness, style/licence/soundtrack provenance, limits). The parent writes the canonical report and the registry entry.
5. Checks: review loop of lemo TECHNIQUE.md §8 (contact sheets at least twice, frame strips of key actions), loudness measured on the
   final file, no blank frames, every text readable long enough (lemo readcheck rule; Korean ≈ hangul ÷ 4.5 + 1.5 s, short labels may be
   less if they repeat). No `scripts/check` changes are expected; say "no automated checks" for the film sources.

## Sources and tools (verified by the parent)

- lemo-opuscar is registered as a local asset: ~/assets/lemo-opuscar/3961ddb/ — `lib/` is the repo at commit
  3961ddb3d24d8876e0e2754f7790d66908acee51 (MIT code/docs; demo films and stills CC BY 4.0 — do not reuse demo footage/stills in the film;
  films made with the library need no credit) plus `lib/core/audio/instruments/vcsl/` (VCSL sample pack, CC0, pack sha256
  3ed8f753500e629485e323fc7f883b35aca6a77a1ab04522d1d47037d503f6e1; marimba, vibraphone, vibraphone_bowed, glockenspiel, hand_chimes,
  percussion). Read DIRECTOR.md, TECHNIQUE.md, styles/dark-keynote/STYLE.md; read DEMO.md and demo/ only after your treatment exists,
  and make at least four of six things differ from the demo (DIRECTOR.md §11). Do not edit the asset.
- Sound: lemo core/audio/sfx.py and sampler.py from the asset (import with sys.path pointing at `lib/`; run with
  `uv run --no-project --with numpy --with scipy --with soundfile --with soxr python …`; record the versions uv resolved).
- No system ffmpeg/ImageMagick/sox on this PC. Use imageio-ffmpeg 0.6.0's bundled ffmpeg (`imageio_ffmpeg.get_ffmpeg_exe()`) for encode,
  mux and two-pass loudnorm (port the logic of the asset's core/render/mux.sh; there is no ffprobe). Picture: Python Playwright 1.63.0 with
  /usr/bin/google-chrome, as geo/promo/render.py does. Ask the parent before installing anything else. Use uv, never pip.
- raw.githubusercontent.com is blocked on this network (use gh api or codeload.github.com if you ever need GitHub content).
- Real app labels: v4 sources geo/promo/scene/scene.js (TAGS, CHAPTERS, background tool names) and the real takes' stills/contact sheets
  in ~/data/geoaidesk/work/gaid-promo-video-v3/capture-v3/ (read-only; contact-sheet-*.jpg, stills/). The parent's in-progress lemo
  version is geo/promo-lemo/ on branch task/gaid-promo-video-v4-lemo (read-only reference; you may copy helpers from it).
- PC74 has 32 threads, RTX 4090; other units render too: keep a final render to about 4 Chrome workers.

## Scope and allowed actions

Own only geo/promo-lemo-40/** and the section draft + figures/40s-*.png under reports/2026-10-24-gaid-promo-video-v4-lemo/.
Do not edit geo/promo/ or geo/promo-lemo/. No review app, no outside publication. Keep your task document current; finish with
`task finish`. If a decision needs the user, ask the parent via your task document's open items and finish; do not block on it.

## Current state
- Done. Sources in geo/promo-lemo-40/ (TREATMENT.md, scene/, render.py, mix.py, master.py, build.sh, README.md, CREDITS).
  Film: 42.0 s one-orbit structure (TREATMENT.md §2–6); real takes only inside six station windows (PGI L1/A3/H2/L3,
  Yilgarn R2/N1), per the user's 2026-10-24 message forwarded by the parent.
- Final render: job job-geoaidesk-gaid-promo-video-v4-lemo--promo-40s-1 (source bfbe423), exit 0. Film
  ~/data/geoaidesk/runs/gaid-promo-video-v4-lemo--promo-40s-20261024T020340.602701Z/out/gaid-promo-40s.mp4,
  sha256 e390feba2bda353d6dbb5629c36905f26a47f097a6301a903e5fdc130da49bb0, 1260 frames, 42.0 s, 1920×1080 30 fps,
  −14.1 LUFS, LRA 7.5 LU, TP −1.1 dBTP, no black or empty frames, reading check 44 texts / 0 short.
- Review loop: contact sheets prev1, prev2 and the final job's; 0.2 s strips on prev4 (work dir
  ~/data/geoaidesk/work/gaid-promo-video-v4-lemo--promo-40s/); fixes in TREATMENT.md §11. Sound checked only by
  measurement (loudness, band energy), not by listening.
- Section draft for the parent: reports/2026-10-24-gaid-promo-video-v4-lemo/section-40s.md (as §8) with
  figures/40s-{1-scatter,2-cycle,3-brain,4-end}.png. Humanizer not run on it; the parent runs it before review-copy.
- Checks: no automated checks for the film sources; scripts/check unchanged and not run.
## Next steps
<!-- task:closed -->
Closed 2026-10-24T02:08:09Z: ready; the parent gaid-promo-video-v4-lemo integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
- Structure: one orbit (the AI agent's dot) instead of the parent's disorder→grid arc, so the 40 s cut differs from the
  103 s cut. Demo comparison: TREATMENT.md §10 (4 of 6 differ outright).
- Audio packages resolved by uv and pinned: numpy 2.5.4, scipy 1.18.1, soundfile 0.14.0, soxr 1.1.0.
- master.py ports lemo mux.sh to imageio-ffmpeg 0.6.0 (bundled ffmpeg 7.0.2); no grain (vector style).
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
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo--promo-40s-20261024T020340.602701Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
