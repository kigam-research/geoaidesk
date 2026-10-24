# GAID 45-second product film — plan (brag-slim)

Task `gaid-promo-video-v5`, added scope (user request 2026-10-24, verbatim in `docs/tasks/gaid-promo-video-v5.md`):
a product film, not a feature tour. Key messages carried by code-only motion graphics, so the pictures alone show why a
geoscientist would want GAID. About 45 s, with music and sound effects (brag-slim), no narration, internal review only.
User choices: structure "한 연구자의 하루형", tone "밝은 계측 + 블루 전환", music "경쾌한 미니멀".

## Answers before planning (brag-slim §1)

- What it is: GAID, an AI agent research platform for geoscientists (지구과학 연구자를 위한 AI agent 연구 지원 플랫폼).
- For whom / what it does: a researcher whose data, papers and code live apart gets one place where a paper's method
  becomes a Workflow the AI agent follows, runs on their own data, is shared and improved with colleagues, and leaves its
  result and evidence in a research note that returns to the library.
- What sets it apart: papers become runnable, shared Workflows; results keep their evidence; every researcher's loop
  adds to the institute's Second brain.
- Visual hook: a desk buried under flying PDF pages, code, tables and map tiles, then one blue stamp and everything
  snaps into order.
- Real UI shown: none (code-only). Labels used are the app's own words (서재, Workflow, AI agent, 연구노트, version,
  GAID 허브); stage names are GAID's analysis-flow example (자료 준비 → 처리·모델링 → 평가 → 해석·결과). No invented
  numbers or claims; "version 0.1.0 → 0.1.1" is the real version scheme.
- Share line: "논문 한 편이 내 자료에서 도는 Workflow가 되고, 결과는 근거와 함께 다음 연구로 이어집니다 — GAID."

## Identity

GAID UI guide v2 계측: chrome ground `#f1f3f6`, white faces with 45° chamfered corners, ink `#171b23`/`#525a68`, brand
blue `#1f5eff` (signal ink `#1d4fd8`, tint `#e8eeff`), Pretendard, index ticks and graduated scales. Two full-bleed brand
blue moments (the stamp, the hub). No gradients, glass, filters, emoji or AI icons; the logo paths are unchanged
(white on the blue field). Icons: the pinned Lucide set in `../scene/icons/`.

## Tempo and grid

96 BPM, 4/4: beat 0.625 s, bar 2.5 s, 16th 0.15625 s. 18 bars = 45.0 s. Every cut and every sound sits on this grid,
counted from frame 0. Key D major; progression per bar D – A – Bm – G.

## Storyboard (a researcher's day)

| Bars | Film s | Time of day | Picture | Line (on screen) |
|---|---|---|---|---|
| 1–2 | 0–5 | 아침 | Hook: PDF pages, code windows, tables, map tiles and tool chips rain onto the researcher's desk and pile up, jittering | 자료는 여기, 논문은 저기, 코드는 또 따로 |
| 3–4 | 5–10 | | Blue wipe; the GAID mark stamps white on blue; the field folds into an orbit; the pieces circle the mark and snap onto five shelves (서재 · 스킬과 도구 · Workflow · 자료와 지도 · 연구노트) | GAID에 모두 모입니다 |
| 5–8 | 10–20 | 오전 | A paper leaves the shelf and opens; four highlighted sentences peel off and become step blocks 자료 준비 → 처리·모델링 → 평가 → 해석·결과 inside a Workflow card; the AI agent's orbit runs along them | 논문 속 방법이 / AI agent가 따르는 Workflow가 됩니다 |
| 9–11 | 20–27.5 | 오후 | The researcher drops "내 자료" into the Workflow; a map draws its contours and its cells light up step by step | 내 자료에 바로 적용합니다 |
| 12–13 | 27.5–32.5 | | Blue field: the Workflow card goes to the GAID 허브, colleagues take it, one improvement comes back and the chip ticks version 0.1.0 → 0.1.1 | 동료와 함께 쓰고, 쓸수록 나아집니다 |
| 14–15 | 32.5–37.5 | 저녁 | The map folds into a research note (headline, figure, evidence marks) that slides onto the shelf beside the paper; a loop closes paper → Workflow → note | 결과와 근거는 연구노트로 남습니다 |
| 16–17½ | 37.5–41.25 | 밤 | Pull back: the researcher's loop is one of many; they link to the centre and a network of papers, Workflows and notes grows | 연구가 쌓여 KIGAM의 Second brain이 됩니다 |
| 17½–18 | 41.25–45 | | Logo lockup, subtitle, "내부 검토용 영상" | 지구과학 연구자를 위한 AI agent 연구 지원 플랫폼 |

Reading rule: every line is fully on screen ≥ 0.3 s per word before it leaves. Transitions stagger (old out, then new in)
or pass through a full blue field, never a muddy cross-dissolve of two busy layouts.

## Sound (one piece)

Synthesised in `soundtrack.py` (numpy, 48 kHz stereo), all on the 96 BPM grid:
- bars 1–2: muted pluck ticks and a clock-like hat, filtered; a noise riser into the stamp;
- bar 3 downbeat: soft low impact + bright D chord stab under the stamp; kick enters;
- bars 3–11: kick on 1 and 3, light clap on 2 and 4 from bar 5, 8th hats, bass roots, an 8th-note pluck arpeggio over
  D–A–Bm–G, a quiet pad; pitched ticks (scale tones) when step blocks snap and when the agent passes a step;
- bars 12–13 (hub): open hats and a bell line; a chime on the version tick; whooshes on both blue wipes;
- bars 14–17: same groove, thinner; a riser into 41.25 s;
- 41.25 s: final Dadd9 chord with a soft impact, decaying to silence at 45 s.
Effects sit under the music, same key, same reverb. Target: peak ≤ −1 dBFS, overall RMS about −16 dBFS. `render()` reports every event time that is off the 16th grid (expected: none).

## Deliverables (outside Git)

`gaid-day45.mp4` (H.264 + AAC, poster baked into frame 0), `poster.jpg`, `share-copy.txt`, `soundtrack.wav`,
`manifest.json`, stills and contact sheet — in the job output directory.
