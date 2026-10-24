---
format: 1
status: active
updated: 2026-10-24T07:21:39Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"88242334-24a3-4030-852c-b9e9ffb2a8dd","pid":1391055,"provider":"codex","session":"01a16c9e-0b00-7740-8c11-82980cf46d08","start":"71159800","token":"6c5b08a03458b5c901586e5be96b4af834d24c257068e81294c29e8e68ac58eb"}
branch: task/gaid-ia-connect-workspace--home-summary
target: task/gaid-ia-connect-workspace
parent: gaid-ia-connect-workspace
---
# gaid-ia-connect-workspace--home-summary

## Goal and done criteria
Request from the starter:

# Goal: gaid-ia-connect-workspace--home-summary — server summary for the GAID Workspace home

Implement `GET /geo/workspace/home` exactly per the contract `web/src/geo/contracts/workspace-home.ts` (already in the branch; do not change field names; you may add an optional field if the data needs it and say why).

- New server module(s) under `server/src/geo/workspace/` (e.g. `home.ts`) plus a route file under `server/src/geo/routes/` registered where the other geo routes are registered. The route reads every active (not archived) project; it must not depend on X-Project-Id. Read-only: write nothing.
- Recent entries: chats from each project's session metadata (title, last activity time; `running` when a run is live now — reuse whatever `/projects/activity` or the session registry uses), research notes from `server/src/geo/notes/` (status → unreviewed/checked, open decisions → decisions with count), the Workflow a chat was started from from the exposure record (`method:<slug>:<workflow>` in `.kady/geo/exposure/<sessionId>.json`) resolved to its title and hub version; newest first, limit WORKSPACE_HOME_RECENT_LIMIT. Hidden/system sessions (scheduler resident session) are excluded.
- Workflows: installed methods across projects (as `GET /geo/methods` reports them: title, one-line purpose, hub version from the package origin, source shared|draft, readiness) grouped by slug with the projects that have them; then catalogue Workflows that a project actually used (exposure records), source catalogue, version null. Keep it bounded and fast (no subprocess per project; cap the number of sessions read per project; a project that fails to read increments `unreadableProjects`).
- No researcher-facing machinery in the response beyond ids used to open entries (UI guide R1).
- Tests: `server/test/geo-workspace-home.test.ts` with temp projects (KADY_PROJECTS_ROOT is a temp dir in vitest; GAID_CATALOGUE=off): chats, a running chat if feasible to fake, notes with decisions/status, an installed method, an archived project excluded, ordering and limit.
- Owned files: the new server files, the route registration line, the new test. Do not edit web/.

Context: parent unit gaid-ia-connect-workspace (geoaidesk) reframes GAID as GAID Workspace (analysis framework: projects, installed Workflows, AI agent, files, viewers, research notes) + GAID Connect (formerly GAID 허브: make/share Workflows) with 서재 as the researcher's personal literature space opened from either place. Read the parent report reports/2026-10-24-gaid-ia-connect-workspace/index.md (mockups, §3.6 rename table) and ADR docs/adr/2026-10-24-gaid-connect-workspace.md in your worktree. User decision 2026-10-24 (verbatim): "모두 권장대로 하자." (approve mockups; app bar shows Workspace/Connect; institute hub server is "기관 Connect 서버" in visible copy; "등록" becomes "공유": 공유된 Workflow, Connect에 공유, 공유됨, version wording unchanged).
Rules: follow AGENTS.md of your worktree (UI guide v2 sections 1, 2, 10 before UI work; copy rules: strings in locale catalogues, Korean first, English with the same meaning). Network: the KIGAM network blocks raw.githubusercontent.com; use NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt for npm. Server tests: unset VITEST_MAX_WORKERS or use 1. Python only via uv. Stay inside your owned files; if you must touch another file, keep the hunk minimal and say so in your task document. Do not touch the review app (gaid-review unit, ports 3000/18000) or any hub server.
Evidence: run the relevant checks (cd server && npm run typecheck && npm test -- <your tests>; cd web && npx tsc --noEmit && npm test -- <your tests>; node geo/copy/validate-copy.mjs web/src/geo/locales; node geo/ui/check-ui.mjs). Full scripts/check is run by the parent after integration; you may run it if time allows. Record in your task document what you changed and the check results, then task finish.

## Current state
- Implemented `GET /geo/workspace/home` against the existing contract without field changes. It aggregates active projects, recent chats and notes (running/decisions/unreviewed/checked), linked Workflow titles and hub versions, installed methods grouped by slug, and only used catalogue Workflows. Archived projects and scheduler/system-only sessions are excluded; failed projects increment `unreadableProjects`.
- Read-only verified through the real app hooks: changing/missing X-Project-Id does not change the summary or seed a project; snapshots show no project/index writes. Catalogue loading cannot stage/repair files. Environment checks reuse settled, current probes only; no subprocess or pending-probe wait. Hub pin checks use local/last-seen records, not archive downloads; unknown pins are not ready.
- Checks passed: server typecheck; 58 tests across home/workspace-state/environments/notes/catalogue, followed by all 10 final home tests after the trial-link and hub-pin refinements; copy validator (0 errors, 101 pre-existing warnings); UI checker (0 errors, 78 accepted debt); git diff --check. No web files or visible copy changed.
- First `task finish` automatically ran full `scripts/check`: backend 2,333 passed / 8 skipped; frontend 1,327 passed / 1 existing map-viewer test timed out at 5 seconds. Direct map-viewer recheck with `VITEST_MAX_WORKERS=1`: all 9 tests passed. Retrying finish with that worker cap, without speculative source changes.
- Dependencies job exited 0 (receipt below). Implementation is ready for parent integration; no deployment was performed.
## Next steps
<!-- task:closed -->
Closed 2026-10-24T06:58:17Z: ready; the parent gaid-ia-connect-workspace integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Automatic full check at `706c4131`: the default frontend concurrency timed out `src/geo/viewers/map/viewer.test.tsx:38` while several project check suites ran on the host. The test passes unchanged with one worker. First log: `~/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-so06ssza.log`; output: `~/data/geoaidesk/work/checks/706c4131dbf1-20261024T064742.450078Z`.
## Notes and decisions
- Sequential plan: establish read-only project/session access, reuse note/method contracts and live run broker, then aggregate/order and verify the route. This is one tightly coupled server package; no additional workers.
- Parent approved narrow extra hunks in `server/src/index.ts` (skip project seeding only for exact GET `/geo/workspace/home`) and `server/src/geo/environments.ts` (cached-only readiness, all existing callers unchanged). Existing project/session list functions write; existing method readiness probes subprocesses. Home must do neither. Unprobed environments are conservatively not ready.
- Additional narrow extra hunk: `server/src/geo/catalogue.ts` adds optional `readOnly` (default unchanged) so the home cannot stage/repair a cold or damaged catalogue. The parent was notified. New test is appended to `geo/integration-boundaries.json`; existing index.ts seam already covers project scope.
- Bounds: newest 64 session files per project, metadata cached by file stamp (512 entries), streaming transcript reads retaining metadata only; 8 final recent entries. Required-input availability uses a names-only inventory capped at 3,000 entries and depth 6, plus present example data. Catalogue absence and unprobed/expired environments remain not-ready rather than triggering installation or interpreter checks.
- Grouped slugs may have different versions in different projects: the most recently used project's title/source/version represents the group, while ready means at least one listed project is ready. Per-chat/note refs retain their own project's installed hub version. Pending notes expose decisions; confirmed notes expose checked with zero open decisions; superseded notes are omitted.
- Safe recheck: `cd server && npm run typecheck`; `env VITEST_MAX_WORKERS=1 npm test -- test/geo-workspace-home.test.ts test/geo-workspace-state.test.ts test/geo-environments.test.ts test/geo-notes.test.ts test/geo-catalogue.test.ts`. Full/web checks belong to the parent because this child owns no web edits.
- Codegraph has no index for this exact worktree; relevant native source files were read instead, per knowledge-lookup.
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
- Parent canonical report: `reports/2026-10-24-gaid-ia-connect-workspace/index.md`; parent incorporates this child's delivered API and checks in the combined implementation report.
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-ia-connect-workspace--home-summary-20261024T063547.000125Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
