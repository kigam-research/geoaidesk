# GAID review-app study capture (`capture-v2`)

The study runs in the existing review app, not a curated copy. Contract: `geo/promo/CONTRACT.md` v2. Outputs remain
outside Git under `~/data/geoaidesk/work/gaid-promo-video-v2/`. The parent owns the film and its canonical report.
The v1 capture procedure is retained in Git history; `capture.py` still implements its original takes.

## Session and capture method

1. Save the capture helper, then launch with `task job run -- uv run --no-project --with playwright==1.63.0
   --with pillow==12.3.0 python geo/promo/capture_study.py`. Resume an existing receipt instead of relaunching it.
2. The controller listens only on `127.0.0.1:18329`; POST bounded Python UI commands to `/exec`. `page`, `ctx`,
   `StudyTake`, `OUT`, and `WORK` are available. Use actual UI clicks and file inputs for study writes. This is an
   operator-controlled capture session, not an unattended replay of record creation.
3. Chrome: installed `/usr/bin/google-chrome`; 1280x720 CSS pixels, scale 2.25, Korean, light, instrument style.
   `StudyTake` reuses v1's drawn pointer, real mouse interpolation and click ripple. It does **not** use v1's request
   mutation guard, disconnected-state masking, curated home or display-name replacements.
4. `StudyTake(page, OUT, id, print)` captures a shot. `hold`, `move`, and `click` record film frames; `finish(beats)`
   appends the `gaid-promo-capture-v2` manifest. Static holds repeat one captured frame; all changing pointer and
   click-ripple frames are captured individually. No scroll is recorded inside a shot. Omitted waits are listed in
   `cuts`; a screen change after an off-camera scroll must be an explicit cut.
5. Access-token gate: use the normal startup link in the review app's launcher log through the UI. Never print or
   save the token. Do not open credential files, change providers, restart the app, or change its defaults.
6. Verify frames and beats with `uv run --no-project --with pillow==12.3.0 python geo/promo/capture_verify.py`.
   Build the contact sheet with `capture_sheet.py --take <capture-v2-directory>` using the same uv dependencies.

## Study records and state

The authoritative IDs, model, observed usage, timing and deviations are in external `study.json`. The before/after
stat inventories cover project metadata, library records and local hub records; remote hub entries have separate
API snapshots. Compare existing item records separately from expected collection/link/sync bookkeeping changes.
The app may refresh Zotero connection status automatically; no Zotero setting is changed by this study.

Current completed captures: L1 (folder and paper), L1b (PDF/DOI import and bibliography export), A1 (paper to source),
A2 (live interview choice). Further shots and the final evidence summary are added after the research cycle.

## Deviations and observed failures

- The app's authoring default twice returned `OpenRouter is not configured`. The parent then authorized selection
  of an already connected subscription model in each action's picker, without changing Settings or credentials.
  Selected `openai-codex/gpt-6.1-sol`; its analyze attempt succeeded. Chat shows `제공사의 구독 한도 적용`.
- An initial A1 take encountered the API access gate and was discarded outside `shots/`. The completed A1 uses the
  normal startup-link flow and contains no access gate. The token was never copied into study artifacts.
- The existing Zotero web-key failure is left intact. Library scenes use the new folder and detail pane to keep its
  explanatory card outside the frame where possible; the header status remains truthful.
