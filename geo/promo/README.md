# GAID promo film

v4 (task `gaid-promo-video-v4`): a ~103-second internal review film (1920×1080, 30 fps, silent; user decision
2026-10-22: "무음이고 내부검토용 영상이다."). Same structure as v2/v3 — opening → background → the research cycle →
real-system demo in six chapters → KIGAM second brain → closing — reworked after the user's feedback of 2026-10-24
(task document `docs/tasks/gaid-promo-video-v4.md`, "Analysis of v3" and "Direction v4"):

- the background is motion graphics (the researcher's data survey, literature analysis and coding; skills and agent tools
  scattered out of reach; GAID gathering them) with one short caption per phase;
- the research cycle names its two parts, GAID 시스템 and GAID 허브;
- each demo chapter opens with its purpose and the part of GAID that carries it, a mini cycle ring shows the position, and
  each step carries one outcome tag (`TAGS` in `scene.js`) instead of a feature list;
- no on-screen "개념도" tag; the report names the illustrative scenes.

The demo reuses the v3 takes (`capture-v3`, `CONTRACT.md` is the v3 capture interface); A4 is left out and `USE` trims a
few takes. `timed()` in `scene.js` maps each motion scene onto its slot; the film length and standard stills follow from
the page (`window.motion.duration`, `window.motion.stills`). v1–v3 are in the git history of these files and
`reports/2026-10-2{3,4}-gaid-promo-video*/`.

| File | Role |
|---|---|
| `scene/` | The film as one HTML page; `window.motion.frame(t)` draws film second `t` deterministically |
| `render.py` | Serves the page, steps Chrome frame by frame, pipes PNG screenshots to H.264 (imageio-ffmpeg) |
| `capture*.py` | Real GAID footage recorded in the review app (study-and-capture child) |
| `prepare_data.py` | v1 chart numbers; the v2 scenes do not use them (`--data` is optional) |

```sh
W=~/data/geoaidesk/work/gaid-promo-video-v3   # v4 reuses the v3 takes
uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo/render.py --capture $W/capture-v3 --out <new dir> --stills-only
task job run -- uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo/render.py --capture $W/capture-v3
```

The final render refuses to run without the capture and writes `manifest.json` (input hashes, frame count, video hash),
`stills/` and `contact-sheet.jpg` next to `gaid-promo-v4.mp4`. Outputs never go into Git.

Demo frames are shown whole at one scale (1280×720 CSS → 1696 px wide), never zoomed or panned (user feedback
2026-10-23); each step gets a blue box, a light dim outside it and a Korean outcome tag (`TAGS`, rects from `capture.json` beats). Shot
timing comes from the capture frame counts. Visual language follows `docs/design/ui-guide.md` (계측). Icons: Lucide via the pinned Icon Wiki asset
(`scene/icons/README.md`); logo paths come unchanged from `geo/brand/logo/horizontal-color.svg`.
