# GAID promo film, lemo edition

Task `gaid-promo-video-v4-lemo`: v4's message (geo/promo/) rebuilt in the lemo-opuscar **Dark Tech Keynote** style, ~102 s,
1920×1080, 30 fps, stereo music and sound effects, no narration; internal review only, alongside v4. Treatment and cue map:
`TREATMENT.md`. Third-party material: `CREDITS`. The 40 s fully code-drawn film of the same task is `geo/promo-lemo-40/`.

| File | Role |
|---|---|
| `scene/` | The film as one page (lemo page contract: `DUR`, async `render(t)`, `READY`, `EV`, `CUES`, `TEXTS`) |
| `render.py` | Stills, `events.json`, reading check, and the silent picture (Chrome frame by frame → H.264, imageio-ffmpeg) |
| `mix.py` | Original score (VCSL samples through lemo's sampler) + procedural foley on the film's events → `mix.wav` |
| `master.py` | Two-pass loudnorm to −14 LUFS, AAC, picture copied; loudness and black-frame report (`master.json`) |

Real takes are shown whole at one scale inside windows of the motion graphics (no zoom or scroll inside a take; user feedback
2026-10-23 and 2026-10-24). `p` = PGI example (포천, capture-v3), `y` = Yilgarn example (capture-v2).

```sh
D=~/data/geoaidesk/work; O=<new output dir>
uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo-lemo/render.py --capture $D/gaid-promo-video-v3/capture-v3 --capture-y $D/gaid-promo-video-v2/capture-v2 --out $O
uv run --no-project --with numpy==2.3.4 --with scipy==1.16.3 --with soundfile==0.13.1 --with soxr==1.0.0 \
  python geo/promo-lemo/mix.py --events $O/events.json --out $O
uv run --no-project --with imageio-ffmpeg==0.6.0 python geo/promo-lemo/master.py --picture $O/picture.mp4 --mix $O/mix.wav \
  --out $O/gaid-promo-lemo.mp4
```

`build.sh` runs the three steps in a `task job run` output directory. Inputs: the lemo asset `lemo_opuscar` (configs/inputs.toml).
