---
format: 1
status: active
updated: 2026-10-24T05:51:40Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"bc6e9cee-ee39-46ef-a805-4ff63734ee67","pid":3074304,"provider":"codex","session":"01a16c51-66d7-7da0-9e3f-54c9f0e81781","start":"70657535","token":"9c009c4d569b64974ce26d76748af332f16430ba0ec0d5d410c3e01f9ef54674"}
branch: task/gaid-promo-video-v4-lemo--agent-capture
target: task/gaid-promo-video-v4-lemo
parent: gaid-promo-video-v4-lemo
---
# gaid-promo-video-v4-lemo--agent-capture

## Goal and done criteria
Request from the starter:

# Child unit: record an AI agent actually working in GAID (live footage) for the lemo promo film

Parent unit: gaid-promo-video-v4-lemo (geoaidesk). You are the single writer of this child unit.

## User request (verbatim, 2026-10-24, parent writer tab; the part this unit answers)

> 그리고 57초 구간 근처에 있는 에이전트 계산 부분은 실제로 에이전트 작업되고 있는 부분들이 보였으면 한다. 멈춰있는 사진들을 사용하는 것은 적절하지만 촬영을 통한 움직음으로 보이는 것이 적절한 것은 섞어가면서 완성도를 높였으면 한다.

Verified context (parent): every existing take of the agent run is a cut of finished states, not motion. capture-v3 R3
(`~/data/geoaidesk/work/gaid-promo-video-v3/capture-v3/capture.json`) cut 132.29 s and 1,328.22 s of the real run; v2 R2 and
v5 Y4 are also cuts. So the film has no footage of tool calls appearing as the agent works.

## Goal and done criteria

Record new, real takes in the GAID review app (PC74, loopback http://127.0.0.1:3000, backend 18000; user data ~/.geoaidesk):
1. AG1 (4–6 s, real time): an installed example Workflow's start settings summary → the start action → the Workflow message
   appearing in a new chat (the composer/transcript shows the `<workflow>` card).
2. AG2 (live work): the chat pane while the AI agent works through the Workflow — tool calls, their status and streamed text
   appearing as they happen. Record continuously in real time at ≥ 10 frames per second for at least 40 s of active work (more
   is fine), plus the whole run sampled at 2 frames per second, so the parent can show it sped up and mark it as sped up.
3. AG3 (4–6 s): the result arriving — the saved result figure or map opening in the file/map panel.
Same frame format and look as capture-v3 so the parent can mix them: 1280×720 CSS viewport, device scale 2.25 (2880×1620 PNG),
Korean UI, light theme, 계측 style, installed Google Chrome through Playwright; the capture pointer drawn the same way as
`geo/promo/capture.py` (`DRAW`: #14213d arrow with white outline, click ripple).

## Deliverables

- Frames + `capture.json` in `~/data/geoaidesk/work/gaid-promo-video-v4-lemo--agent-capture/capture-v6/` (outside Git), schema
  `gaid-promo-capture-v2` as in capture-v3 (shots with frames/pattern/url/actions/cuts/beats) plus, per shot, `fps` (real frame
  rate of that take), `pointer`: the drawn pointer tip per frame in CSS px (or null), and `beats` whose `rect` is measured from the
  DOM at that time and whose window matches where the pointer acts (a beat rect must contain the pointer for most of its window
  when the beat is about a pointer action; passive regions such as the streaming tool list may have no pointer). Record any cut
  with its removed duration and reason (no hidden cuts).
- `verification.json` (app SHA, Workflow and example used, run start/end times and duration, model shown in the composer, frame
  counts, cut list) and contact sheets; a short README in the capture folder for the parent (what each take shows, frame ranges
  with the densest tool activity, limits).
- Capture scripts in Git under `geo/promo-lemo/capture/` (you own that folder only), reusing `geo/promo/capture*.py` as the base
  (copy, do not edit geo/promo/). Keep your task document current; finish with `task finish`.

## Constraints

- Review app use: tell the project hub before you start and after you finish (`task hub --send --prompt-file <file>`), e.g.
  "capture child will use the review app for one real Workflow run, no settings change". No settings, model or service changes.
- Example analyses coarse/loose, at most ~10 minutes per run, the method kept whole; at most one real run (a second only if the
  first fails for a capture reason, say why). Pick the example Workflow (Yilgarn nickel MPM or Pocheon PGI, both installed in the
  review app) whose run shows the agent working best within that limit.
- No mocked routes, fabricated results or DOM text substitutions. The capture pointer and ripples are overlays; hovers and clicks are
  real. Visible names stay as the app shows them.
- raw.githubusercontent.com is blocked on this network. Use uv (`uv run --no-project --with playwright==1.63.0 ...`), never pip.
- Other units render on this PC; keep Chrome to one capture browser.
- If something needs the user (credentials, a decision), write it as an open item in your task document and finish; do not block.

## Current state
- Delivered 2,241 verified 2880×1620 PNGs at `~/data/geoaidesk/work/gaid-promo-video-v4-lemo--agent-capture/capture-v6/`, with capture.json, verification.json, frame-checks.json, README, four contact sheets, seven visually checked beat images and original result stills.
- Same selected Pocheon example run: AG1 165 frames / 5.5 s at 30 fps; AG2 650 / 65 s at 10 fps (genuine source interval 12.755 fps); AG2-whole 1,246 / 623 s at 2 fps; AG3 180 / 6 s at 30 fps. Per-shot fps is authoritative: AG2 at 30 fps is 3×, whole at 30 fps is 15× and must be labelled as sped up. No internal cuts; explicit trims are recorded.
- capture.json SHA-256: `e4f120e64293ef46917a2b858552d566d3d4cc7c9dafba44acff3f0a4a15ab98`. App SHA 4e198c762b9bde20ca23b1f3223243fb2af16ab0; GPT-6.1 Sol/high; Korean/light/instrument. AG3 genuinely opens new pgi_live_retake/outputs/orebody_3d.png. README identifies useful activity ranges and capture limits.
- Export job 3 and audit passed: all frame dimensions/counts/timestamps, pointer-action containment, example/result hashes and 185 protected files unchanged. Contacts and remaining seven beats visually checked. Syntax and git diff checks passed. No app tests were run because app code is unchanged.
- One capture-error retake was used; both full methods completed, all five models unconverged. The selected run took about 10 min 21 s from UI send to observed ready, with 623 s captured; nominal ~10-minute overrun came from packaging repair, not enlarged numerical work. Initial failed capture is archived, not selected.
- Chrome is closed, controller port inactive, hub before/after notices delivered. Controller job 1 and export job 3 exited 0; failed export job 2 was corrected and superseded. No new model/settings/service change or third analysis run occurred.
## Next steps
1. Run task finish to notify the parent. The parent integrates with task complete and owns the film edit/report. No more review-app use or analysis run is needed.
2. Safe read-only recheck: `uv run --no-project python geo/promo-lemo/capture/audit.py`; no model or browser calls. Do not rerun retake.py or resend either request file.
## Failed approaches
- Export job 2 failed its chronological-arrival assertion on AG2-whole. Direct inspection found 25 native frame deliveries out of presentation-time order, with unique timestamps and small delays during concurrent readbacks. Export now sorts by the native presentation timestamp while retaining original arrival frame IDs. No source image, time interval or UI content is changed.
- Native view scale also scales CDP input coordinates. A normal Playwright click hit the header rather than Workflow during retake staging. Direct hit testing confirmed the 2.25 coordinate factor; staging now resets native scale, and filmed pointer events multiply only dispatched coordinates while logging CSS coordinates. No second analysis was sent during that failed staging attempt.
- Chrome emits sparse screencast events when the app presents no visual changes. The whole-run stream retains them honestly; an additional screenshot readback stream records unchanged states at an independently measured cadence. No animation or DOM text was added.
- The initial direct screenshot path was too slow at full resolution; pipelining did not reliably satisfy cadence.
- A native-view/screencast attempt assumed deviceScaleFactor alone set backing-view scale. The actual image test disproved this: a 2880×1620 file contained only a 1280×720 image in its top-left. Explicit Emulation scale 2.25 plus visible size 2880×1620 fixed geometry; confirmed visually and with native frame timestamps (~30 fps).
- The first real analysis is retained as a failed capture attempt, not selected footage. Its initial full-run capture geometry was invalid. The task explicitly allowed one second run for capture failure; that retake used a separate output directory and corrected capture from before send. No third run was sent.
## Notes and decisions
- Final visual QA removed the passive AG1 Workflow-card callout because the composer resized after its DOM measurement. The real start-click callout remains correct. AG3 retains a genuine failed packaging-check row in the chat; that failure was repaired later in the same run, without numerical rerun. The result-pane focus is clean; no visible error was hidden.
- Sequential decisions: validate capture throughput before starting any model work; select the faster installed example with complete methodology; record continuously, then export and verify.
- Owned files: geo/promo-lemo/capture/ and this task document. No independent worker package is needed for this tightly coupled browser session.
- No automated app checks are planned because app code is unchanged; capture syntax, artifact/timing checks and visual inspection are the declared checks.

## Open items
None.
## Report
Child capture handoff only; the parent owns the canonical film report. Technical locator, source receipts, timing, limits and hashes are in the external payload README and verification.json.
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo--agent-capture-20261024T051313.832789Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo--agent-capture-20261024T054028.627085Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo--agent-capture-20261024T054434.323462Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
