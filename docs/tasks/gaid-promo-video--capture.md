---
format: 1
status: waiting
updated: 2026-10-22T14:56:18Z
writer: {"host":"seongin3","reserved":"cc78fa674759f3fec1f8f3937f349bf22c0068400c3f89dd13ffad712b1d9e05"}
branch: task/gaid-promo-video--capture
target: task/gaid-promo-video
parent: gaid-promo-video
---
# gaid-promo-video--capture

## Goal and done criteria
Request from the starter:

# Child unit gaid-promo-video--capture: real GAID footage for the 90-second promo video

Parent: gaid-promo-video (writer: Claude). User request (verbatim, 2026-10-22):

> Gaid 시스템에 대해서도 seoul_geomodel 이나 ccs_transport 프로젝트에서 모션그래픽을 생성한것처럼 1분 30초짜리 홍보 모션그래픽을 생성하자. ... 실제 시스템 모습과 모션그래픽을 적절히 섞어서 마켓팅 프로덕션급으로 생성해야한다.

User decision: "무음이고 내부검토용 영상이다." (silent, internal review only).

## Your goal
Produce the real-system footage takes defined in `geo/promo/CONTRACT.md` (read it first; it is the interface).
The parent builds the motion graphics and the final film; you deliver `capture-v1/` (frames, stills, capture.json)
plus `geo/promo/capture.py` (and `capture_*` helpers) and `geo/promo/CAPTURE.md` in Git.

## Scope and allowed actions
- Start your own GAID instance from your worktree (GAID launcher, free ports, `systemd-run --user` with absolute paths
  and file logs) with `GAID_HOME=~/data/geoaidesk/work/gaid-promo-video/home`. Do not touch the shared review app
  (ports 3000/18000, unit `gaid-review`) or its data `~/.geoaidesk` beyond read-only copying of what the shots need.
  Never copy or read credentials (`auth.json`, `config.env`, `mcp-auth.json`, `hub-server/connection.json`).
- No live model calls; show stored hub records, chats, notes, library. Copy-only label clean-ups are allowed and
  must be listed in capture.json/CAPTURE.md (e.g. drop `검토용 - ` from project names, hide test projects).
- Playwright via `uv run --no-project --with playwright==1.63.0 --with pillow==12.3.0 python ...` using the installed
  Google Chrome (`/usr/bin/google-chrome`), as in the reference `~/repos/ccs_transport/scripts/testbed_motion/capture_workbench.py`
  (drawn pointer + ripple, frame-stepped screenshots, read it for the technique; do not edit that repo).
- If a shot is impossible with the copied data (for example no stored chat started from a Workflow), pick the closest
  real alternative, record why, and tell the parent in your finish notes; do not fabricate content.
- Follow `docs/design/ui-guide.md` sections 1, 2, 10 for what researchers see. Korean UI, light theme, 계측 style.
- KIGAM network blocks raw.githubusercontent.com; do not use it.
- Outputs only under `~/data/geoaidesk/work/gaid-promo-video/` (never in Git). Stop your instance when done.

## Evidence
capture.json per the contract, a contact sheet JPG of first/middle/last frame per shot (outside Git), frame count/size
check, browser error list (must be empty), proof that `~/.geoaidesk` was not changed (file list + mtime snapshot before and
after). Commit only `geo/promo/capture*.py`, `geo/promo/CAPTURE.md` and your task document. Finish with `task finish`.
Write your task document and commits in English.

## Current state
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
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
