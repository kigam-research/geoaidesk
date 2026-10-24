# brag-plan — GAID promo v4_brag

Made with the `brag-slim` skill (latent-spaces/brag `669ab9286aa28b6c3ee30e75f181ee74319d012a`, MIT), input: this project.
Options: `--tone polished --format landscape --duration 100.8`. The duration is the user's choice (same length and
messages as v4, 90–105 s) and overrides brag's 15–25 s law; every other brag law holds.

## Inspect answers

- What it is: GAID, an AI agent research platform for geoscience researchers (지구과학 연구자를 위한 AI agent 연구 지원 플랫폼).
- Who / what for: a researcher who moves between data, papers and code; GAID gathers the scattered skills and tools in one
  place, turns a paper's method into a shared Workflow (GAID 허브) and runs it on the researcher's own data with notes and
  library (GAID 시스템).
- What sets it apart: the research cycle — library → Workflow → hub → analysis → research note → library — where shared
  Workflows get better each time they are used (version 0.1.0 → 0.1.1).
- Most impressive claim (from the source, not invented): a paper's method becomes a Workflow the AI agent follows, and the
  note cites both papers down to the page.
- Visual hook: the researcher bouncing between three kinds of work, then the scattered tools snapping into GAID.
- Real UI: the v3 takes of the real app (`capture-v3`, 15 shots), shown whole, never zoomed (user rule 2026-10-23).
- Tone: polished — serious, restrained, soft fades, long-enough holds; the brand blue as the only accent.
- Share caption: see `share-copy.txt`.
- Personal data: the takes already use the review app's fictional/test data (v3 capture record `textSubstitutions`);
  nothing new is captured.

## Angle, hook, highlights, punchline

- Angle: the v4 storyline, cut to music. Problem → GAID → the cycle → the cycle shown in the real app → the ecosystem.
- Hook (0–2.4 s, first bar): no logo intro. The researcher appears with three work cards that land on the first three beats
  (자료 조사, 문헌 분석, 코드 작성) and a pointer darting between them on eighth notes; line "자료를 찾고, 논문을 읽고, 코드를 짭니다".
- Reveal (bar 4 downbeat, 9.6 s): GAID's panel lands with the impact hit and the tools fly into its shelves; then the full
  lockup with "지구과학 연구자를 위한 AI agent 연구 지원 플랫폼" (bars 6–7).
- Highlights: (1) the research cycle with GAID 허브 / GAID 시스템; (2) the six demo chapters, purpose line first; (3) KIGAM
  Second brain.
- Punchline / outro: the logo again with the subtitle and "내부 검토용 영상".

## Visual identity

v4 unchanged: 계측 style, `--chrome` ground, white faces, brand blue `#1f5eff`, Pretendard (OFL), Lucide icons, the logo
paths from `geo/brand/logo/horizontal-color.svg`. No "개념도" corner labels. Visible names "AI agent" and "GAID".

## Music

100 BPM, 4/4, D major; beat 0.6 s = 18 frames, bar 2.4 s = 72 frames, so every beat and eighth note falls on a whole frame.
42 bars = 100.8 s = 3,024 frames. Generated in code (`soundtrack.py`, numpy/scipy synthesis: additive pads, sine bass,
synthesised kick/hat/clap, FM bells, plucks, filtered-noise risers and whooshes, one shared synthetic reverb); no samples,
no third-party recordings. Effects use the chord tones of the bar they fall in and share the music's reverb.

| Bars | Film s | Section | Chords | Arrangement |
|---|---|---|---|---|
| 0–1 | 0–4.8 | hook: the researcher's work | Bm G | muted pulse bass, soft kick on 1 and 3, plucks on the card hits |
| 2–3 | 4.8–9.6 | scattered tools | Em A | off-beat hats, thin suspended pad, tool pops, riser into bar 4 |
| 4–5 | 9.6–14.4 | GAID gathers them (reveal) | D A | impact on the downbeat, full pad, rising pluck run as the tools fly in |
| 6–7 | 14.4–19.2 | title lockup | Bm G | wide pad, logo shimmer, half-time kick |
| 8–10 | 19.2–26.4 | research cycle | D A Bm | groove starts, arp eighths, plucks as the point passes stations |
| 11–36 | 26.4–88.8 | real-system demo, 6 chapters | D A Bm G cycle | groove; whoosh + tom on chapter cuts, soft tick on shot cuts, bell on each outcome tag; lead motif in the GAID 허브 chapters, lighter breakdown in 연구노트 |
| 37–39 | 88.8–96.0 | KIGAM Second brain | G A Bm | lift: fuller pad, riser into the second line |
| 40–41 | 96.0–100.8 | closing | D | logo shimmer, final chord, ring-out to silence at the last frame |

## Storyboard (every cut on a bar line; shot cuts on beats)

| # | Film s | Bars | Scene | On-screen copy |
|---|---|---|---|---|
| 1 | 0.0–4.8 | 0–1 | Hook: researcher + 자료 조사 / 문헌 분석 / 코드 작성 cards | 자료를 찾고, 논문을 읽고, 코드를 짭니다 |
| 2 | 4.8–9.6 | 2–3 | Scattered skills and tools; reaching lines stop short | 쓸 만한 스킬과 도구는 곳곳에 흩어져 있습니다 |
| 3 | 9.6–14.4 | 4–5 | GAID panel; cards and tools fly into its shelves | GAID가 한곳에 모아 연구를 돕습니다 |
| 4 | 14.4–19.2 | 6–7 | Logo lockup | 지구과학 연구자를 위한 AI agent 연구 지원 플랫폼 |
| 5 | 19.2–26.4 | 8–10 | Research cycle, GAID 허브 / GAID 시스템, version 0.1.0 → 0.1.1 | 논문과 분석이 공유된 Workflow가 되고, 쓰일수록 나아집니다 |
| 6 | 26.4–33.6 | 11–13 | Demo 내 서재 (L1 4.2, L2 3.0) | 연구는 내 서재의 논문에서 시작합니다 |
| 7 | 33.6–48.0 | 14–19 | Demo Workflow 만들기 (A1 4.8, A2 4.8, A3 4.8) | 논문 속 방법을 AI agent가 따르는 Workflow로 만듭니다 |
| 8 | 48.0–55.2 | 20–22 | Demo 허브 공유 (H1 4.2, H2 3.0) | 만든 Workflow는 허브에서 함께 쓰고 고쳐 갑니다 |
| 9 | 55.2–72.0 | 23–29 | Demo 연구 분석 (R1 4.2, R2 3.6, R3 6.0, M1 3.0) | 공유된 Workflow로 내 자료를 분석합니다 |
| 10 | 72.0–79.2 | 30–32 | Demo 연구노트 (N1 7.2, last frame held 0.7 s) | 결과와 판단은 연구노트에 남습니다 |
| 11 | 79.2–88.8 | 33–36 | Demo 다시 서재로 (L3 3.0, L4 3.6, L5 3.0) | 연구가 서재로 돌아와 다음 연구로 이어집니다 |
| 12 | 88.8–96.0 | 37–39 | KIGAM Second brain | 연구자마다 고리가 돌면 지구과학 AI agent 생태계가 자랍니다 / 논문, Workflow, 연구노트가 이어져 KIGAM의 Second brain이 됩니다 |
| 13 | 96.0–100.8 | 40–41 | Closing lockup | 지구과학 연구자를 위한 AI agent 연구 지원 플랫폼 · 내부 검토용 영상 |

Sum: 4.8 + 4.8 + 4.8 + 4.8 + 7.2 + 7.2 + 14.4 + 7.2 + 16.8 + 7.2 + 9.6 + 7.2 + 4.8 = 100.8 s.

The 22 outcome tags of v4 stay, timed to their (trimmed) takes. Transitions dip through the ground colour: the outgoing scene
is gone on the bar line, the incoming one starts there, so two busy layouts never cross-fade.

## Differences from v4 (same messages)

- The opening logo moves from 0 s to the reveal (14.4 s); the film opens on the hook instead.
- All slots snap to the 100 BPM grid; demo takes are trimmed or held by up to 0.8 s so chapter cuts land on bar lines.
- Sound: music and effects only, no narration (user decision 2026-10-24).
- Poster frame baked into frame 0 (brag); the film is otherwise frame-for-frame the timeline above.
