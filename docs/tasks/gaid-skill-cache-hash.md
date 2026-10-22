---
format: 1
status: waiting
updated: 2026-10-22T08:11:03Z
writer: {"host":"seongin3","reserved":"18351797fc7f149b8797432d41774a4511f50beb995e2b13701d1bc58c5bc54b"}
branch: task/gaid-skill-cache-hash
target: main
parent: 
---
# gaid-skill-cache-hash

## Goal and done criteria
Request from the starter:

# Request: gaid-skill-cache-hash

User decision (verbatim, 2026-10-22): "부채 2를 고치자." — answers gaid-library-next#2 with option 가).
Item: a catalogue skill whose scripts were run gets a __pycache__/ folder, so the skill sync's tree hash sees it as a user-edited
skill ("kept as edited") and the next catalogue version never updates it (reports/2026-10-21-gaid-library-next/index.md §3.3).
Do (small unit): exclude regenerable cache folders/files (at least __pycache__/ and *.pyc; consider other obvious caches such as
.pytest_cache, node_modules) from the skill tree hash used by skills-sync (server/src/agent/skills-sync.ts and any GAID hash path,
e.g. server/src/geo/provision.ts, note-style seeding), so a run skill still upgrades while real edits stay protected. Keep manifest
compatibility (existing recorded hashes must still match unedited skills). Add tests: run-cache only → upgrades; real edit →
kept. Also check, read-only, the review app's log line "geo-catalogue@0.3.0 … applied to project default: … 1 kept as edited"
(~/data/geoaidesk/work/review-app/launcher.log; data under ~/.geoaidesk is read-only for you, never modify it) and say whether that
one skill was kept only because of a cache folder. scripts/check passes; brief report. Outside check: no outside check.

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
