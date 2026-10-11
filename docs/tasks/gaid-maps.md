---
format: 1
status: active
updated: 2026-10-11T05:29:34Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"5cf81d21-5cc5-4b20-94ff-55570f0c20dc","pid":3978975,"provider":"codex","session":"01a12945-6839-7642-ba5c-59b7217a6194","start":"15977732","token":"525532c561304251f1b7cd09aedacc4c46d7ca47b8b06c05ffe31f837880c5e3"}
branch: task/gaid-maps
target: main
parent: 
---
# gaid-maps

## Goal and done criteria
Request from the starter:

# Writer brief: WP05 `gaid-maps` (geoaidesk)

This unit answers forwarded goal 432814c7cee1 from the skill_hub project hub. The full forwarded request, including the
user's verbatim words, package text, status and inputs, is in /home/seongin3/data/geoaidesk/work/hub/432814c7cee1.md — read
it first; it is the authoritative scope (goal, owned files, done criteria, order). Do not add required items.

Verified facts from the hub (2026-10-11):
- geoaidesk main is at or after 5d9fe8d with WP02 gaid-fork-base and WP03 gaid-runtime merged; their reports are
  reports/2026-10-11-gaid-fork-base/index.md and reports/2026-10-11-gaid-runtime/index.md. WP03 publishes the
  inspection/viewer interfaces this package uses.
- WP04 `gaid-well-tables` and WP05 `gaid-maps` run in parallel as separate units right now. Shared seams
  (web/src/lib/viewers/registry.ts, the file-preview dispatch in web/src/components/file-preview-panel.tsx,
  web/src/lib/use-sandbox.ts): append only your own entries; non-additive changes belong to WP07. Integrate
  shared seams serially: run `task sync` before finishing and resolve append-only conflicts by keeping both sides.
- Read skill_hub files with
  `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
  (raw.githubusercontent.com is blocked on the KIGAM network; pass this to any worker using the network).
- Writer setup: started with the Paseo profile "고급 Fast worker" by the user's choice ("이미 작업중인 것은 끝까지
  진행하고 이후 작업부터 고급 fastworker를 쓰게하자."). You orchestrate and do the work yourself; keep fast
  (service_tier priority) through resume and handoff.
- No paid model runs unless the user asks.
- Checks: `scripts/check` (see AGENTS.md). App data for task work goes under ~/data/geoaidesk/work/gaid-maps/,
  never inside the repo. After your last check, remove regenerable build caches from the worktree
  (server/node_modules, server/src/helpers/.venv, web/node_modules, web/.next, web/next-env.d.ts,
  web/tsconfig.tsbuildinfo) so the unit can close.
- When the unit completes, its outcome returns to the skill_hub hub automatically through the goal link.

## Current state
- Parent API/manifest/inspection integration implemented. Backend typecheck and 30 targeted tests pass.
- Two child packages (helper and viewer) remain active; not integrated yet.
- Helper environment prepared with frozen uv lock (Python 3.12.14). Browser verification tooling is external under the task data directory.
- Direct checks authorized by the hub while backbone job-template filtering is repaired. No paid model calls.
## Next steps
1. Integrate completed helper/viewer children with task complete; inspect their reported evidence.
2. Run real route/fixture integration tests, browser map-plus-table walkthrough and scripts/check.
3. task sync shared seams, canonical result report, cache cleanup, task finish.
## Failed approaches
- Job snapshot blocked on upstream `.env.example`; no job started and no receipt was issued. Hub authorized direct checks (reply 65caed1a1d90).
- First targeted run: 27/29 tests passed; corrected unknown CRS on unsafe companions and equivalent WGS84 identifiers, then 29/29 passed. Added extent/paging coverage: 30/30 passed.
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

## Orchestration (WP05)
- Sequential decisions: read authoritative forwarded scope and WP03/WP06 seams; establish `web/src/geo/contracts/maps.ts`; implement bounded helper and UI independently; integrate helper through inspection/routes; integrate children; sync append-only seams; run scripts/check; remove regenerable caches; finish.
- Parent owns map contracts, TypeScript map transport/routes, inspection registration and source identity, manifest adapter, route/integration tests, integration boundaries, report and final integration.
- Independent package `helper`: Python raster/vector inspect/window/area implementation and generated known-answer fixtures/tests in `server/src/geo/maps/` and `geo/tests/`; no parent/interface changes.
- Independent package `viewer`: OpenLayers map viewer and tests in `web/src/geo/viewers/map/`, its raster/vector registry entries, `ol` dependency + lock only. Parent owns all other shared seams.
- CRS policy: source declaration preserved; default display EPSG:3857 only for declared sources; unknown uses native/pixel inspection and cannot overlay with declared layers or calculate area. Area explicitly chooses projected CRS or ellipsoid geodesic method; never uses preview subsets.
- Transport contract: inspect helper returns additive GeoInspection fields; vector/raster/area responses follow maps.ts. Helper input is one JSON object on stdin with `{operation, path:absolutePath, ...request}`; stdout one JSON object; errors stderr, exit 3 dependencies / 4 missing / 5 invalid / 1 other. Parent sandbox-validates paths/companions and bounds subprocess time/output.
- Integration order: parent contract commit -> child packages -> parent routes/tests -> child completion -> task sync -> full checks -> report/cleanup/finish. No paid model runs.

### Active packages
- helper: `gaid-maps--helper`, writer `7e627c39-8f96-4667-b685-4abba81a1202`, owned Python/helper fixture paths above. Started from shared contract 91e7df38.
- viewer: `gaid-maps--viewer`, writer `2bcba6ab-0329-4c49-8cb2-c835676e8dc3`, owned viewer/ol paths above. Started from shared contract 91e7df38.
- Parent implementation in progress: bounded uv subprocess bridge, active-project routes, artifact manifest validation, source companion validation/fingerprints, and route tests. Tests not run yet; dependencies not present in this worktree.

### Checkpoint: job-launch dependency
- Parent source and route tests published at ecfa88918f8c; execution not yet verified.
- First dependency/targeted-check job did not start: `job snapshot blocked: forbidden path .env.example`, exit 1, no receipt. Existing upstream template was not read/edited. Do not delete or rename it to bypass the CLI.
- Forwarded dependency to geoaidesk hub with `task hub --send`, request `65caed1a1d90`; follow the returned resolution before rerunning a new launch. No periodic polling.
- Next action: receive child completion/CLI resolution, complete each child, run targeted checks and full scripts/check, then sync/report/cleanup/finish. Parent can review child results and continue independent integration after notification. No completion claim.

### Hub resolution: direct checks authorized
- Hub reply to `65caed1a1d90` verifies a backbone `.env*` snapshot-policy inconsistency; fix routed to backbone as c3b9eff232af. User accepted: "제안대로 하자."
- Explicit interim authorization: run checks directly in this worktree, without `task job run`; checks are not retained analytical runs. `.env.example` stays unchanged/unread.
- `npm --prefix server ci --no-audit --no-fund`: passed (504 packages, 10 s). Targeted typecheck/tests now running directly under that authorization.
- `npm --prefix server run typecheck`: passed.
- First targeted tests: 27/29 passed; corrected unsafe-companion unknown CRS metadata and equivalent WGS84 authority handling (OGC:CRS84/EPSG:4326). This was a code-level failure, unrelated to the job CLI.
- Native read-only reviewer `/root/map_api_review` checks the parent TypeScript integration only; child writers remain sole owners of helper and viewer. Parent will triage concrete blockers.
- Targeted recheck: 29/29 tests passed (3 files). Typecheck passed again.
- Read-only reviewer found degenerate point/line manifest extents rejected and high offsets silently clamped. Parent now separately validates source extents (equality allowed) and rejects offsets above 100000; added regression assertions. Multi-layer manifests require explicit layer selection.
- Parent TypeScript metadata path now attempts the map helper first and uses baseline only on failure, avoiding redundant metadata subprocesses on successful map requests. Typecheck + same 30 targeted checks passed after this change.
- Added real HTTP fixture integration tests in server/test/geo-maps-integration.test.ts; these deliberately await child fixture/helper integration and have NOT run yet. Browser check must exercise actual OpenLayers rendering and area output; do not claim it from mocks.
- Parent independent implementation is checkpointed; await child completion notification rather than polling. Both children were active at the last bounded status check.

### Routed coordination f3b3631f1273
- Viewer reports implementation complete, 40 targeted frontend tests/typecheck/lint passed. Its finish merged parent 3481060 but the full check correctly failed because parent's new real integration test refers to the not-yet-integrated helper fixture. Do not weaken that test or copy unpublished sibling files.
- Helper's corrected finish (boolean category transport fix) is still running full scripts/check. A local ready frontmatter is not a completed CLI publication: attempted `task complete gaid-maps--helper` returned no finished unit/no completion record; no merge occurred.
- Route reported `--blocked` as a pending-integration checkpoint. Parent remains driver. On final helper completion: task complete helper, verify published parent helper/fixture, update route report so hub resumes existing viewer in place, then integrate viewer and continue browser/full checks. No user decision needed.
