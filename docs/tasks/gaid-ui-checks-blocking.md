---
format: 1
status: waiting
updated: 2026-10-24T04:47:42Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"755a15f3-f2f7-4942-8c0a-e8091304de3f","pid":2896468,"provider":"claude","session":"24fdc1a9-65a4-4763-bc45-5d33b264d1d2","start":"70520948","token":"18bae5c8cafe7f4c15eadbf94560db92131b6a58406595657162165b5629a912"}
branch: task/gaid-ui-checks-blocking
target: main
parent: 
---
# gaid-ui-checks-blocking

## Goal and done criteria
Request from the starter:

# Goal: gaid-ui-checks-blocking — confirm the quality kit on another PC and make impeccable + axe blocking

## User decision (verbatim, 2026-10-24)

> 권장 방법으로 하자.

Answer to open item gaid-ui-shared-contrast#1 (option 가, `reports/2026-10-24-gaid-ui-shared-contrast/index.md` §6): run the full check
once on another PC; if it gives the same result (impeccable 0, axe 0), switch those two tools from report-only to blocking in
`scripts/check`. Screenshot comparison and the shadcn lint stay report-only. The switching rule is in `geo/ui/ui-rules.json` `quality`
(kit: `geo/ui/quality/`, debt `geo/ui/ui-baseline.json` `quality`).

## Facts (hub, 2026-10-24)

- PC71 is away (Intel RMA). PC70 (`ssh pc70`, host kongi, 24 threads, 45 GB RAM) has git and Node v22.22.1; uv was not found on the
  non-interactive PATH and `~/assets/geo-catalogue` is absent there — check `~/.local/bin` and set up what the check needs within your
  authority (uv per the user's rules; copy the pinned catalogue asset from PC74 `~/assets/geo-catalogue/<v>/` if the full check needs it),
  or run the quality-kit steps the switching rule requires and say exactly what ran. Use a scratch clone outside any repo on PC70
  (e.g. `~/data/geoaidesk/work/gaid-ui-checks-blocking/`), at the current main SHA; leave nothing running there.
- KIGAM network blocks raw.githubusercontent.com (use `gh api` or codeload.github.com).

## Done

- Record PC70's result next to PC74's (counts per tool, SHA, browser/font versions). If both are 0: make impeccable and axe blocking
  (with a clear failure message pointing to the 부품 상태 견본 page), update the rule and AGENTS.md "Checks" text, and run scripts/check on
  PC74. If PC70 differs: do not switch; report the difference and its cause, and ask the hub.
- Close the item with a literal `Closes: gaid-ui-shared-contrast#1` line under Notes and decisions once switched (or explain why not).

Running in parallel: gaid-hub-stage-cards (scenario A, screens) and gaid-promo-video-v4-lemo (video). Do not touch the review app or hub
server. Outside check: none.

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
