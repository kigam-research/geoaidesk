---
format: 1
status: active
updated: 2026-10-24T05:25:24Z
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
- Orchestration: small, tightly coupled change; done by the writer alone (no child units or readers).
- PC70 run 3 (main f504ace4 + hub-client-fake path fix, NODE_EXTRA_CA_CERTS for that run): scripts/check passed; backend
  2322 passed / 8 skipped, frontend 1326 passed; quality kit shadcn 248 (166 keys), impeccable 0, visual 0, axe 0; Chromium
  v1243 = Chrome for Testing 153.0.8010.12 (Playwright 1.63.0). Finding keys identical to PC74 gaid-ui-shared-contrast/after2.
  Copies in ~/data/geoaidesk/work/gaid-ui-checks-blocking/pc70/. Nothing left running on PC70 (scratch clone 3.8 GB kept).
- Switched: ui-rules.json modes impeccable/axe = block + `switches` record; run.mjs `not-checked` coverage findings and
  failure message (/dev/parts); AGENTS.md (quality kit, Checks incl. NODE_EXTRA_CA_CERTS note), ui-guide.md §10.5,
  scripts/check step title, integration-boundaries responsibility; server/test/geo-hub-client-fake.ts base under homedir.
- Report reports/2026-10-24-gaid-ui-checks-blocking/index.md (humanizer applied, review copy in the vault).
- PC74 scripts/check with the switch (unit gaid-check-pc74-1): passed; backend 2322 passed / 8 skipped, frontend 1326,
  copy/ui 0 errors; quality kit shadcn 248, impeccable [block] 0, visual 0, axe [block] 0; keys identical to PC70 run 3.
  Log ~/data/geoaidesk/work/gaid-ui-checks-blocking/pc74-check.log.
- Fail-path test: temporary <img> without alt on the parts page, `run.mjs --only axe,impeccable` → axe 4 image-alt (A1),
  exit 1, failure message printed; file restored (git clean). Log fail-test.log. The not-checked path was not provoked.
## Next steps
1. task save, task finish.
## Failed approaches
- PC70 run 1 (main f504ace4 unchanged): backend tests 25 failed / 2297 passed / 8 skipped, all `EACCES mkdir '/home/seongin3'`
  from the hard-coded base path in server/test/geo-hub-client-fake.ts (gaid-backend--hub-client); scripts/check stopped there
  (set -e), quality kit not reached. Fixed in this unit (base under os.homedir()); run 2 = main + that one-line patch.
- PC70 run 2: all checks passed, but Chromium (Playwright 1.63 = chromium v1243, Chrome for Testing 153.0.8010.12) could
  not be downloaded: `self-signed certificate in certificate chain` (KIGAM TLS inspection; PC70's Node has no
  NODE_EXTRA_CA_CERTS while PC74 sets it). Browser tools skipped (shadcn 248, impeccable static 0, live/visual/axe skipped).
  Run 3 passes NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt (contains KIGAM.crt) for that run only; PC70 profile unchanged.
## Notes and decisions
Closes: gaid-ui-shared-contrast#1
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-24-gaid-ui-checks-blocking/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
