# GAID promo film

v2 (task `gaid-promo-video-v2`): a ~105-second internal review film (1920×1080, 30 fps, silent; user decision
2026-10-22: "무음이고 내부검토용 영상이다."). Structure: background (existing skill ecosystems) → the research cycle →
real-system demo in six chapters (내 서재 → 논문에서 Workflow → GAID 허브 공유 → 연구 분석 → 연구노트 → 다시 내 서재) →
KIGAM second brain → closing. `CONTRACT.md` is the capture interface (v2); `CAPTURE.md` describes the take. v1
(90 s, 2026-10-23) is in the git history of these files and `reports/2026-10-23-gaid-promo-video/`.

| File | Role |
|---|---|
| `scene/` | The film as one HTML page; `window.motion.frame(t)` draws film second `t` deterministically |
| `render.py` | Serves the page, steps Chrome frame by frame, pipes PNG screenshots to H.264 (imageio-ffmpeg) |
| `capture*.py` | Real GAID footage recorded in the review app (study-and-capture child) |
| `prepare_data.py` | v1 chart numbers; the v2 scenes do not use them (`--data` is optional) |

```sh
W=~/data/geoaidesk/work/gaid-promo-video-v2
uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo/render.py --capture $W/capture-v2 --out <new dir> --stills-only
task job run -- uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo/render.py --capture $W/capture-v2
```

The final render refuses to run without the capture and writes `manifest.json` (input hashes, frame count, video hash),
`stills/` and `contact-sheet.jpg` next to `gaid-promo-v2.mp4`. Outputs never go into Git.

Demo frames are shown whole at one scale (1280×720 CSS → 1696 px wide), never zoomed or panned (user feedback
2026-10-23); each feature gets a blue box, a light dim outside it and a Korean tag from `capture.json` beats. Shot
timing comes from the capture frame counts. Visual language follows `docs/design/ui-guide.md` (계측). Conceptual scenes
(scattered sources, second brain) carry an on-screen `개념도` tag. Icons: Lucide via the pinned Icon Wiki asset
(`scene/icons/README.md`); logo paths come unchanged from `geo/brand/logo/horizontal-color.svg`.
