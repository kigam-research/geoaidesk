# Live agent footage

`live.py` adapts the real-review-app controller in `geo/promo/capture_v3.py`.
`pointer.py` copies `DRAW` unchanged from `geo/promo/capture.py`. It does not
include the old disconnected-label mask, blocked routes or static frame copies.

The payload is external:
`~/data/geoaidesk/work/gaid-promo-video-v4-lemo--agent-capture/capture-v6/`.
Its README and verification.json identify the selected run and source intervals.

## Recording

Start through `task job run` after saving the source:

```sh
task job run -- uv run --no-project --with playwright==1.63.0 python geo/promo-lemo/capture/live.py
```

The controller owns one installed Google Chrome instance. Send bounded async
Playwright snippets from stdin with `uv run --no-project python
geo/promo-lemo/capture/control.py`. The endpoint is loopback-only and executes
local Python; close it when capture ends. This is a local capture helper, not an
app service.

Use `StreamRecorder(page).start(name)` before the action. Native compositor
presentation timestamps are stored beside every JPEG. Explicit backing-view
size and scale are necessary: DPR alone does not make a screencast 2880×1620.
Check both dimensions and visible content before sending a real analysis.
Do not use Playwright screenshots while a screencast is active; its temporary
viewport changes can alter the native view.

`Pointer` moves the real mouse in CSS coordinates and draws the capture arrow
and click ripple. Set `stream.pointer_provider = lambda: pointer.pointer` while
the overlay is visible, and return None when it is hidden. Measure action bounds
from the target locator immediately before the click. The stream's observer
records viewport, scroll-region bounds and actual page text once per second.

`await stream.stop()` drains acknowledgements and saves timing.json. To close
the controller and browser, send `done.set()` through the control helper. No
script changes credentials, global model settings, services or displayed text.

## Export and checks

Describe source intervals, DOM-measured beats and any removed time in the
external `edit.json`, then run:

```sh
uv run --no-project --with pillow==12.3.0 python geo/promo-lemo/capture/export.py --root ~/data/geoaidesk/work/gaid-promo-video-v4-lemo--agent-capture/capture-v6
```

The exporter selects the most recent genuine browser frame at each requested
real-time sampling point. It does not interpolate motion. Unchanged intervals
hold the last browser presentation; source frame IDs and timestamps make these
holds explicit. It checks every PNG's dimensions, consecutive numbering, beat
bounds and pointer containment, writes frame hashes, and makes contact sheets.
Inspect the sheets and each action beat's midpoint before handing off. App
tests are not part of this capture-only change; no app code is modified.
