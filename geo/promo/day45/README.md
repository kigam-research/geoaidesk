# GAID 45-second product film ("한 연구자의 하루")

Added to task `gaid-promo-video-v5` (user request 2026-10-24): a product film rather than a feature tour — code-only motion
graphics, music and sound effects (brag-slim way), about 45 s, internal review only. Plan and storyboard: `PLAN.md`.

| File | Role |
|---|---|
| `scene/` | The film as one page; `window.motion.frame(t)` draws film second `t` (96 BPM grid, 18 bars) |
| `soundtrack.py` | Music and effects synthesised as one piece (numpy), 48 kHz stereo WAV |
| `render.py` | Stills, frames → H.264, soundtrack, mux to H.264 + AAC, poster as frame 0, manifest |

```sh
uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 --with numpy==2.3.4 \
  python geo/promo/day45/render.py --out <new dir> --stills-only
task job run -- uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  --with numpy==2.3.4 python geo/promo/day45/render.py
```

It reuses the GAID promo icons (`../scene/icons/`), Pretendard and the unchanged logo paths. No app footage, no invented
numbers; the on-screen words are the app's own (서재, Workflow, AI agent, 연구노트, version, GAID 허브).
