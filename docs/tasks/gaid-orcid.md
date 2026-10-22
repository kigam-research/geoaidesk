---
format: 1
status: waiting
updated: 2026-10-22T09:11:04Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"ca53ee3a-1baa-4c53-a886-8b6a2b35ab75","pid":2058627,"provider":"claude","session":"f7c1067b-f670-4e6e-8814-18489c0168f7","start":"54821171","token":"dae9ec8a184e9be9fa328343821519f08272071bd5d8e2924897cb9c9d582b43"}
branch: task/gaid-orcid
target: main
parent: 
---
# gaid-orcid

## Goal and done criteria
Request from the starter:

# Request: gaid-orcid

User request (verbatim, 2026-10-22, to the geoaidesk hub): "별도 작업으로 이용자들의 ORICD를 연동하는 기능도 구현 가능하면 진행하고 싶다."
("ORICD" = ORCID.)

Order: feasibility first, then a short plan the user confirms in your tab, then implement the confirmed scope.
1. Feasibility (oracle-search for current facts, Extra High; KIGAM network blocks raw.githubusercontent.com): ORCID Public API vs Member
   API (what is free, rate limits, whether KIGAM/KISTI consortium membership exists or is needed), OAuth "Sign in with ORCID" /
   authenticated iD (/authenticate scope), redirect URI rules (https vs loopback/localhost, how it fits a PC-local GAID and the institute
   hub server on PC74 over internal HTTP), reading a researcher's public works/employment/education, sandbox for testing, terms of use.
   Check reachability of orcid.org / pub.orcid.org / sandbox.orcid.org from PC74.
2. What it should enable for researchers (value first): link an ORCID iD to the researcher's GAID hub account (gaid-backend accounts;
   gaid-hub-server-trial is deploying the server now) and show it on hub entries/profiles; import the researcher's publications as
   the basis of "내 논문" (planned in reports/2026-10-21-gaid-research-hub, phase 2: ORCID + Crossref + OpenAlex + KCI, researcher confirms
   each match); optionally prefill library items. Say what is not worth building.
3. Anything needing the user's action (ORCID account, registering a public API client and redirect URI, client secret storage) — ask in
   your tab; never put secrets in Git, files or chat; store them like other GAID keys (server-side config).
Coordination: gaid-hub-server-trial owns the hub server/accounts code now; agree interfaces through the hub, do not edit its files in
parallel. gaid-user-acceptance is testing in the review app (PC74 :3000) — do not touch it; own GAID_HOME under
~/data/geoaidesk/work/gaid-orcid/. UI per docs/design/ui-guide.md v2. ADR if there is a real architecture choice. scripts/check passes.
Outside check: no outside check.

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
