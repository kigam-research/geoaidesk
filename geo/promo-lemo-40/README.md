# GAID 40 s promo (lemo-opuscar, Dark Tech Keynote)

A 42.0 s promotional film for GAID drawn entirely in code: 1920×1080, 30 fps, stereo music and sound effects, no
narration, about −14 LUFS. Plan: `TREATMENT.md`. Third-party material: `CREDITS`. Internal review only.

## Rebuild (one command)

```sh
sh geo/promo-lemo-40/build.sh ~/data/geoaidesk/work/<slug>/<new dir>
# kept runs: task job run -- sh geo/promo-lemo-40/build.sh   (writes to TASK_OUTPUT_DIR)
```

Needs `uv`, `/usr/bin/google-chrome`, the lemo-opuscar asset (`LIB`, default `~/assets/lemo-opuscar/3961ddb/lib`, read
only) and the two GAID capture folders (`~/data/geoaidesk/work/gaid-promo-video-v3/capture-v3`,
`~/data/geoaidesk/work/gaid-promo-video-v2/capture-v2`, read only). No system ffmpeg: imageio-ffmpeg's bundled binary
encodes, muxes and measures. `WORKERS` (default 4) sets the Chrome workers.

## Files

| File | Does |
|---|---|
| `scene/index.html`, `scene/film.js` | the page: deterministic `render(t)` on one canvas, `EV` sound events, `CUES`, `TEXTS`, `textSpans` |
| `scene/icons/` | Lucide icons and two GAID domain icons (copies) |
| `render.py` | copies the page, fonts and logo, downscales the take frames once, renders stills, events, the reading check and `picture.mp4` |
| `mix.py` | score, foley and ambience from `events.json` with lemo's sampler (VCSL) → `mix.wav` |
| `master.py` | two-pass loudnorm to −14 LUFS, mux → `gaid-promo-40s.mp4`; measures loudness, black and empty frames |

Outputs (never in Git): `picture.mp4`, `mix.wav`, `gaid-promo-40s.mp4`, `events.json`, `readcheck.json`, `stills/`,
`contact-sheet.jpg` and the three manifests (`picture-`, `mix-`, `master-manifest.json`).

Checks: no automated checks for these sources. The build itself fails on browser errors, a wrong frame count, loudness
outside −14 ± 1 LUFS, a true peak above −1 dBTP, or black or empty frames; `readcheck.json` lists every message text with
its hold time against the lemo rule (hangul ÷ 4.5 + other ÷ 15 + 1.5 s).
