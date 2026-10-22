# GAID promo film

A 90-second internal review film (1920×1080, 30 fps, silent; user decision 2026-10-22: "무음이고 내부검토용 영상이다.").
`CONTRACT.md` is the capture interface; `CAPTURE.md` describes the real-footage take. Report:
`reports/2026-10-23-gaid-promo-video/index.md`.

| File | Role |
|---|---|
| `prepare_data.py` | Real numbers for the charts: pinned catalogue archive, one registered hub Workflow, the 2026-10-22 acceptance-test citation check |
| `scene/` | The film as one HTML page; `window.motion.frame(t)` draws film second `t` deterministically |
| `render.py` | Serves the page, steps Chrome frame by frame, pipes PNG screenshots to H.264 (imageio-ffmpeg) |
| `capture*.py` | Real GAID footage from a separate instance with copied review data (capture child) |

```sh
W=~/data/geoaidesk/work/gaid-promo-video
uv run --no-project python geo/promo/prepare_data.py --hub $W/home/pi-agent/skill-hub/shared --out $W/data-v1/data.json
uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo/render.py --data $W/data-v1/data.json --capture $W/capture-v1 --out <new dir> --stills-only
task job run -- uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo/render.py --data $W/data-v1/data.json --capture $W/capture-v1
```

The final render refuses to run without the capture (no placeholder footage) and writes `manifest.json` (input hashes,
frame count, video hash), `stills/` and `contact-sheet.jpg` next to the video. Outputs never go into Git.

Visual language follows `docs/design/ui-guide.md` (계측 identity: white faces on aluminium chrome, 45° chamfers,
graduated scales, the orbit as "the AI agent is working", brand blue only as signal, Pretendard, tabular figures).
The scattered-files scene is the one illustrative scene and carries an on-screen `개념도` tag. Icons: Lucide via the
pinned Icon Wiki asset (`scene/icons/README.md`); logo paths come unchanged from `geo/brand/logo/horizontal-color.svg`.
