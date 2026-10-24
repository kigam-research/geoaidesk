---
format: 1
status: active
updated: 2026-10-24T05:47:45Z
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
- Export job 3 is running after the timestamp-order fix, pinned at bace939c7e78. AG1/AG2 PNGs and contacts are present and visually checked. The only remaining work depends on this recorded job: full-run/result exports, audit, final visual QA and task finish.
- Controller job 1 exited 0 and port 18349 is inactive. Its log retains the already-resolved UI-staging exception; both actual runs completed and no third run was sent. Export job 2 exited 1 at the native timestamp-order assertion; this is fixed for job 3.
- Capture is closed. The retake completed in 623.05 s wall time (122.692 s reported pipeline/validation processes), including a packaging hash-path repair without numerical rerun. This is 23 s beyond the nominal ~10-minute target.
- Selected same-run shots are AG1 5.5 s, AG2 65 s sampled at 10 fps from a genuine 12.755 fps source interval, AG2-whole 623 s sampled at 2 fps, and AG3 6 s. AG3 opens pgi_live_retake/outputs/orebody_3d.png through the real file tree. No internal cut in any selected take.
- Chrome 156.0.8078.47 closed; Korean/light/instrument preferences read back; pageerror count 0. Final PNG export and artifact checks remain.
- First run finished in 507.21 s wall time (102.3 s reported pipeline stages); all five models remained unconverged. Corrected compositor source is archived.
- The sole authorized retake started at 2026-10-24T05:28:56Z, in pgi_live_retake/. AG1-final has been exported and its real click/Workflow-card geometry checked. The full retake is continuously recorded; fixed-cadence screenshots supplement sparse compositor events for the >=10 fps active-work requirement.
- One actual Pocheon example run is in progress under GPT-6.1 Sol/high, with separate pgi_live_capture/ outputs. A corrected native take now records full-size streaming activity; initial footage is archived as failed capture geometry.
- Resumed in the assigned worktree. Review app is accessible on loopback without a token gate. Deployed checkout HEAD reads 4e198c762b9bde20ca23b1f3223243fb2af16ab0.
- No app/model/service settings changed. Inspector Chrome was closed before starting the capture browser.
## Next steps
1. Wait for recorded export job 3 to exit (receipt in Running jobs; no periodic polling). If it succeeds, set capture.json's legacy top-level fps to 30 to match the final export.py; per-shot fps stays 30/10/2/30. Job 3 was pinned before this metadata-only default changed.
2. Run `uv run --no-project python geo/promo-lemo/capture/audit.py`. Inspect contact-AG2-whole.jpg, contact-AG3.jpg and every remaining beat image. AG1 and AG2 contacts plus their first beat are already visually checked; verify AG3 pointer rectangles and original new image opening.
3. Confirm verification.json/README.md/frame-checks.json and 2241 PNG frames exist under the external capture-v6 payload. Update Current state with final self-contained handoff and source/capture manifest hashes, then run task finish. No further analysis or review-app operation is authorized or needed.
## Failed approaches
- Export job 2 failed its chronological-arrival assertion on AG2-whole. Direct inspection found 25 native frame deliveries out of presentation-time order, with unique timestamps and small delays during concurrent readbacks. Export now sorts by the native presentation timestamp while retaining original arrival frame IDs. No source image, time interval or UI content is changed.
- Native view scale also scales CDP input coordinates. A normal Playwright click hit the header rather than Workflow during retake staging. Direct hit testing confirmed the 2.25 coordinate factor; staging now resets native scale, and filmed pointer events multiply only dispatched coordinates while logging CSS coordinates. No second analysis was sent during that failed staging attempt.
- Chrome emits sparse screencast events when the app presents no visual changes. The whole-run stream retains them honestly; an additional screenshot readback stream records unchanged states at an independently measured cadence. No animation or DOM text was added.
- The initial direct screenshot path was too slow at full resolution; pipelining did not reliably satisfy cadence.
- A native-view/screencast attempt assumed deviceScaleFactor alone set backing-view scale. The actual image test disproved this: a 2880×1620 file contained only a 1280×720 image in its top-left. Explicit Emulation scale 2.25 plus visible size 2880×1620 fixed geometry; confirmed visually and with native frame timestamps (~30 fps).
- The first real analysis is retained as a failed capture attempt, not selected footage. Its initial full-run capture geometry is invalid. The task explicitly allows one second run for capture failure; the second run will use a separate output directory and the corrected native compositor capture from before send. No third analysis run is authorized.
## Notes and decisions
- Sequential decisions: validate capture throughput before starting any model work; select the faster installed example with complete methodology; record continuously, then export and verify.
- Owned files: geo/promo-lemo/capture/ and this task document. No independent worker package is needed for this tightly coupled browser session.
- No automated app checks are planned because app code is unchanged; capture syntax, artifact/timing checks and visual inspection are the declared checks.

(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo--agent-capture-20261024T051313.832789Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo--agent-capture-20261024T054028.627085Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v4-lemo--agent-capture-20261024T054434.323462Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
