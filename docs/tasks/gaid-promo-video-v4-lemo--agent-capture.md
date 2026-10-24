---
format: 1
status: active
updated: 2026-10-24T05:10:47Z
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
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
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
