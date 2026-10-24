# brag-plan — GAID promo40

Made with the `brag-slim` skill (latent-spaces/brag `669ab9286aa28b6c3ee30e75f181ee74319d012a`, MIT), input: this project.
Options: `--tone default` with the user's freer promotional direction, `--format landscape --duration 40`.
User direction (2026-10-24): same messages as v4, freer and more promotional; 40 s; may be made fresh in code; no need to
follow the v4 style because takes exist; both the Yilgarn and the Pocheon PGI examples may be used, whichever fits;
captured screens appear as window elements inside the motion graphics, not full screen.

## Angle, hook, highlights, punchline

- Angle: a product launch film for GAID. Problem in big type → GAID gathers it → the cycle → six quick proofs in the real
  app → the ecosystem → logo.
- Hook (0–4 s): on ink, "자료를 / 논문을 / 코드를" slam in on beats 0, 2 and 4 with their own live vignettes (contours and
  survey points, a highlighted page, typed code with a run bar); a diamond marker hops between them on eighth notes.
- Reveal (8 s, bar 4 downbeat): the scattered real tool names fly into the centre, a ring bursts, the on-dark GAID lockup
  draws itself; the tools orbit it; "흩어진 스킬과 도구를 한곳에" → "지구과학 연구자를 위한 AI agent 연구 지원 플랫폼".
- Highlights (16–32 s): six numbered proofs, GAID 허브 (blue-tint ground) and GAID 시스템 (chrome ground); each is a
  kinetic headline plus one outcome tag on the left and real GAID screens as floating windows on the right. Pocheon PGI
  (v3 takes) and Yilgarn nickel (v2 takes) appear side by side where two studies make the point (hub, analysis, note,
  return to the library).
- Punchline (32–40 s): researcher rings link into a growing network around the mark (KIGAM Second brain), then the
  colour lockup on white with the subtitle and "내부 검토용 영상".

## Visual identity

GAID brand: blue `#1f5eff` (on ink the brandOnDark `#4d7fff` and the `on-dark` logo file; on light the `color` file),
ink `#171b23`, chrome/face/tint tokens, Pretendard 800 for kinetic type (OFL), Lucide icons, the orbit ring from the logo
as the recurring motif, chamfered windows. No gradients, glass or stock imagery. Transitions: a skewed blue band sweeps
across the scene cuts at 12, 16, 32 and 36 s; inside the highlights, windows slide in staggered on beats.

## Music

120 BPM, 4/4, D major; beat 0.5 s = 15 frames, bar 2 s; 20 bars = 40 s = 1,200 frames. Generated in code
(`soundtrack.py`, the instruments and reverb of the v4_brag soundtrack); no samples or recordings.

| Bars | Film s | Section | Chords | Arrangement |
|---|---|---|---|---|
| 0–1 | 0–4 | hook | Bm G | four-on-the-floor from the first frame, bell-and-tom stabs on each slam, hop plucks |
| 2–3 | 4–8 | scattered | Em Asus | sixteenth hats, claps, chip pops, snare build and riser into bar 4 |
| 4–5 | 8–12 | reveal | D A | impact and chord bells on the downbeat, logo shimmer, bright pad, arp |
| 6–7 | 12–16 | cycle | Bm G | groove, a pluck on every station the point reaches, bell on the version step |
| 8–15 | 16–32 | six proofs | D A Bm G ×2 | full groove; tom on each proof, whoosh as windows land, bell on each tag; lead motif in the GAID 허브 proofs |
| 16–17 | 32–36 | Second brain | Gmaj7 Asus | lift, ring ticks, join bell, snare build into the outro |
| 18–19 | 36–40 | outro | Dadd9 | logo shimmer, held chord fading to silence on the last frame |

## Storyboard

| # | Film s | Scene | On-screen copy | Real screens (window crops) |
|---|---|---|---|---|
| 1 | 0–4 | Hook | 자료를 찾고 / 논문을 읽고 / 코드를 짭니다 | — |
| 2 | 4–8 | Scattered | 쓸 만한 스킬과 도구는 곳곳에 흩어져 있습니다 | — (real skill and tool names) |
| 3 | 8–12 | Reveal | 흩어진 스킬과 도구를 한곳에 → 지구과학 연구자를 위한 AI agent 연구 지원 플랫폼 | — |
| 4 | 12–16 | Cycle | 논문이 Workflow가 되고, 쓰일수록 나아집니다 (GAID 허브 / GAID 시스템, version 0.1.0 → 0.1.1) | — |
| 5 | 16–18 | 01 GAID 시스템 | 연구는 내 서재의 논문에서 · 논문을 곁에 두고 읽기 | v3 L1 library, v3 L2 PDF |
| 6 | 18–21 | 02 GAID 허브 | 논문 속 방법을 AI agent가 따르는 Workflow로 · 원문 근거를 바로 곁에 → 단계로 정리된 분석 절차 | v3 A2 question + evidence, v3 stage rail |
| 7 | 21–24 | 03 GAID 허브 | 허브에서 함께 쓰고 고쳐 갑니다 · 다음 version으로 등록 → 허브에서 가져다 쓰기 | v3 H2 Pocheon entry, v2 H2 Yilgarn entry (title and summary only) |
| 8 | 24–27 | 04 GAID 시스템 | 공유된 Workflow로 내 자료를 분석 · AI agent가 Workflow대로 → 원본 좌표 그대로 지도에 | v3 R3 agent work, v2 M1 Yilgarn map, v3 M1 Pocheon map |
| 9 | 27–29.5 | 05 GAID 시스템 | 결과와 판단은 연구노트에 · 두 논문의 쪽수까지 인용 | v3 N1 note, v2 Yilgarn note figure |
| 10 | 29.5–32 | 06 GAID 시스템 | 서재로 돌아와 다음 연구로 · 논문·Workflow·노트의 연결 | v3 L5 and v2 L3 connection maps |
| 11 | 32–36 | Second brain | 연구자마다 고리가 돌면 생태계가 자랍니다 / 논문·Workflow·연구노트가 이어져 KIGAM의 Second brain이 됩니다 | — |
| 12 | 36–40 | Outro | 지구과학 연구자를 위한 AI agent 연구 지원 플랫폼 · 내부 검토용 영상 | — |

Poster: 11.0 s (lockup with the subtitle and the orbiting tools), baked in as frame 0.
Privacy: the v2 Yilgarn hub crop leaves out the author row and the old "판" chip; no personal data is shown.
