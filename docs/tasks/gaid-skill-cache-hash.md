---
format: 1
status: done
updated: 2026-10-22T08:29:44Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"496b2f44-908a-4be7-acf6-b2ea8de5da17","pid":1509732,"provider":"claude","session":"16c18294-79a0-451e-a810-42626e1f84b5","start":"54460954","token":"18351797fc7f149b8797432d41774a4511f50beb995e2b13701d1bc58c5bc54b"}
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
- Done: one predicate `isRegenerableCache` (new `server/src/geo/regenerable-cache.ts`: `__pycache__`, `*.pyc`/`*.pyo`,
  `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.ipynb_checkpoints`). `hashDirectory` (skills-sync.ts; also used by
  skills-install and, through skills-sync, provision.ts) skips them. `shipped-skills.ts` dropped its private copy
  (`hashShippedTree`, Python caches only) and uses `hashDirectory` + the predicate for its copy filter.
  `geo/methods/tree-hash.ts` (`methodTreeHash`, same tree format) uses the same predicate so both hashes stay equal;
  `removePythonCaches` → `removeRegenerableCaches` (hub-skills/install.ts, authoring/install.ts).
- Manifest compatibility: same `kady-skill-tree-v1` format; a cache-free tree hashes byte-identically to the old
  function (golden digest computed with HEAD's function, pinned in the new test).
- Tests: server/test/skills-sync.test.ts adds "run-cache only → updated; real script edit → kept" and the golden-hash
  test; both fail with the skip line removed and pass with it. Related suites (skills-sync, geo-shipped-skills,
  geo-note-style, geo-provision) pass: 34 tests.
- Review app check (read-only): launcher.log line `geo-catalogue@0.3.0+d09d5311b7be applied to project default: 4 added,
  0 updated, 1 kept as edited`. The one catalogue skill in `customized` is `assay-composition-explorer`; its only
  differences are `scripts/__pycache__/{explore,verify_kola}.cpython-312.pyc` (2026-10-15). Hashed with the new
  function it equals its recorded baseHash/upstreamHash `32f1769a…` → kept only because of the cache folder. The
  other `customized` names (council-mode, gaid-figures, gaid-note-style, pi-subagents) are not catalogue entries.
  Its manifest stays as is until the next provisioning (next pinned catalogue label); then it is `unchanged`/updated.
- scripts/check run 1 failed only in geo-method-tree-hash.test.ts, which asserted the old behaviour
  (`hashDirectory` changes with `__pycache__`); test updated to the new contract after aligning methodTreeHash.
  Typecheck + affected suites (99 tests) pass. scripts/check run 2 passed ("All geoaidesk checks passed."; server
  2184 passed / 8 skipped, web 1202 passed; log ~/data/geoaidesk/work/gaid-skill-cache-hash/check.log).
## Next steps
<!-- task:closed -->
Closed 2026-10-22T08:29:44Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
Closes: gaid-library-next#2
- `node_modules` is not skipped: unlike bytecode/test caches it can be shipped skill content, and skipping it would hide
  upstream changes to a vendored dependency tree. No catalogue skill ships or creates one today.
- No report file: small fix, results are in this document.
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
