# GAID promo v4_brag

The v4 film (`geo/promo/`, task `gaid-promo-video-v4`) rebuilt with the `brag-slim` skill (latent-spaces/brag
`669ab9286aa28b6c3ee30e75f181ee74319d012a`, MIT; installed user-level at `~/.claude/skills/brag-slim/`, not vendored here):
same messages and storyline, re-cut to a 100 BPM grid, with a generated stereo soundtrack (music and effects, no narration;
user decisions 2026-10-24). Internal review only.

| File | Role |
|---|---|
| `brag-plan.md` | brag's plan: angle, hook, music, scene-by-scene storyboard on the beat grid |
| `scene.js` | v4's `scene/scene.js` with the brag timeline (piecewise slot maps, whole-beat takes, cues for the soundtrack) |
| `soundtrack.py` | Synthesises the soundtrack from the scene's cues (numpy/scipy; no samples or recordings) |
| `render.py` | Renders `brag.mp4` (frame 0 = poster), `brag.jpg`, `manifest.json`; copies `brag-plan.md` and `share-copy.txt` |
| `share-copy.txt` | brag's share copy |

`render.py` reuses `geo/promo/scene/{index.html,scene.css,icons}` and the v4 renderer's helpers.

```sh
W=~/data/geoaidesk/work/gaid-promo-video-v3   # the v3 takes, as in v4
uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  --with numpy==2.5.4 --with scipy==1.18.1 \
  python geo/promo/brag/render.py --capture $W/capture-v3 --out <new dir> --stills-only --transitions
task job run -- uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  --with numpy==2.5.4 --with scipy==1.18.1 python geo/promo/brag/render.py --capture $W/capture-v3
```

The final render checks the film length (3,024 frames) and decodes the AAC track back against the synthesised WAV (length,
alignment within 1 ms) before it writes `manifest.json`. Outputs never go into Git.
