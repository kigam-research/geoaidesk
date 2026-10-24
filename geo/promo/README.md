# GAID promo film

v5 (task `gaid-promo-video-v5`): a ~100-second internal review film (1920×1080, 30 fps, silent; user decision
2026-10-22: "무음이고 내부검토용 영상이다."). Same structure and messages as v4 — opening → background motion graphics →
the research cycle (GAID 허브 / GAID 시스템) → six demo chapters, each led by its purpose line → KIGAM second brain →
closing — reworked after the user's feedback on v4 of 2026-10-24 (task document `docs/tasks/gaid-promo-video-v5.md`,
"Analysis of v4" and "Direction v5"):

- examples are chosen per step: the Pocheon magnetite PGI study (v3 takes) and the Yilgarn nickel MPM example (v5 takes);
  every window carries an example chip;
- the real screens are windows inside the motion design (`LAY` in `scene.js`), not full-frame; pair steps put both
  examples side by side;
- each step frames one whole UI region (v5: DOM-measured beat rects; v3: `V3` rects re-derived from the frames along
  panel/card edges, checked with `frame_check.py`) and, when that gains legibility, lifts the same original pixels into an
  enlarged detail window beside the window. Inside a window the frame is never zoomed or panned.

`CONTRACT.md` is the v5 capture interface (Yilgarn shot list); `CAPTURE.md` documents the v3 study and the v5 takes.
`timed()` in `scene.js` maps each motion scene onto its slot; the film length and standard stills follow from the page
(`window.motion.duration`, `window.motion.stills`, one still per beat for box checks). v1–v4 are in the git history of
these files and `reports/2026-10-2{3,4}-gaid-promo-video*/`.

| File | Role |
|---|---|
| `scene/` | The film as one HTML page; `window.motion.frame(t)` draws film second `t` deterministically |
| `render.py` | Serves the page with both captures merged, steps Chrome frame by frame, pipes PNG screenshots to H.264 |
| `frame_check.py` | Draws highlight rects (CSS px) on capture frames, with an optional zoomed crop and grid, for box checks |
| `capture*.py` | Real GAID footage recorded in the review app (capture children) |
| `prepare_data.py` | v1 chart numbers; later scenes do not use them (`--data` is optional) |

```sh
W=~/data/geoaidesk/work
uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo/render.py --capture v3=$W/gaid-promo-video-v3/capture-v3 --capture v5=$W/gaid-promo-video-v5/capture-v5 \
  --out <new dir> --stills-only
task job run -- uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo/render.py --capture v3=$W/gaid-promo-video-v3/capture-v3 --capture v5=$W/gaid-promo-video-v5/capture-v5
```

The final render refuses to run without both captures and writes `manifest.json` (input hashes, frame count, video hash),
`stills/` and `contact-sheet.jpg` next to `gaid-promo-v5.mp4`. Outputs never go into Git.

Visual language follows `docs/design/ui-guide.md` (계측): tokens, Pretendard, brand blue, bevelled corners; no gradients,
glass, image filters, AI icons or emoji; footage pixels are shown unfiltered. Icons: Lucide via the pinned Icon Wiki asset
(`scene/icons/README.md`); logo paths come unchanged from `geo/brand/logo/horizontal-color.svg`.
