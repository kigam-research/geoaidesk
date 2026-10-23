---
format: 1
status: done
updated: 2026-10-23T03:22:48Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"24ac6438-9d3c-40bf-aed3-558f9bb47f6f","pid":3710210,"provider":"claude","session":"5e080e46-115a-40f8-bbc8-5648ad5fea05","start":"61251758","token":"54f15532caa6f0bb44aa2320e3a60c342b9ddac56953f1cfc70157047cf250d7"}
branch: task/gaid-project-resume
target: main
parent: 
---
# gaid-project-resume

## Goal and done criteria
Request from the starter:

# Goal: gaid-project-resume — keep each project's last work state on the GAID server

## User request (verbatim, 2026-10-23)

> 별도 작업 요청 내용이 있다. GAID 시스템에서는 프로젝트별로 관리되는 것을 이해하고 있다. 그런데 프로젝트를 선택하여 에이전트 분석 환경이 켜지면 다른 프로젝트에 접속할 수 없게 된다. 분석환경 내에서도 다른 프로젝트를 확인하고 해당 프로젝트로 이동할 수 있게 해야한다. 그리고 프로젝트도 마지막 작업 상태가 유지되어 있어야 이용자들이 해당 상태에서 다시 시작할 수 있을 것이다. 사용자의 요청 내용을 이해하였는지 먼저 확인 받자.

The hub confirmed its understanding (move between projects inside the analysis workspace; each project keeps its last
work state — open chat tabs, open files/viewers such as the map viewer, panel layout — and agent work in project A keeps
running while the user is in project B) and asked where to store the state: 가) per browser (current code,
`web/src/lib/workspace-persistence.ts`, localStorage + IndexedDB) or 나) on the GAID server per project, so any PC or browser
reopens the project in its last state. The user answered (verbatim):

> ProjectSwitcher는 잘 동작하다. "마지막 작업 상태"는 나로 진행하자.

## Done (the user's outcome)

- Moving between projects: the existing `ProjectSwitcher` in the workspace app bar works for the user; no change is
  required there (keep it working; do not redesign it).
- Last work state per project stored on the GAID server (나): reopening a project from any PC or browser — including after
  closing the browser or restarting the app — restores its last work state (open chat tabs and which is active, open
  files/viewers, panel layout as the current browser persistence already captures them). Running agent work keeps going
  while the user is in another project (the current mounted-workspace behaviour must not regress).
- Decide and record what happens when two browsers have the same project open (e.g. last save wins) and what stays
  browser-local (e.g. unsent image attachments or blob URLs, if they cannot move to the server).
- Checks: `scripts/check`. UI copy and design rules from AGENTS.md apply if any visible text changes.

## Notes for the writer

- The review app (PC74 :3000/:18000, ~/.geoaidesk, LAN-exposed with a fixed token) is in use by gaid-promo-video-v2--study
  for a recorded research cycle; do not restart or change it. Test with an own GAID instance under
  `~/data/geoaidesk/work/<slug>/` (own ports, not 3000/8000/8700/18000). The hub updates the review app after integration.
- Since the review app is now opened from several institute PCs, the server-side state must respect the backend's
  existing auth/request guard (token, project scoping via X-Project-Id).
- KIGAM network blocks raw.githubusercontent.com (use `gh api` or codeload).
- Outside check: none (not a research goal).

## Current state
Implemented (single writer, no child units; the change is one tightly coupled server+client seam):
- Server: `server/src/geo/workspace/workspace-state.ts` (store, `.kady/geo/workspace-state.json`, atomic write, revision,
  malformed file → 409 never rewritten, 4 MiB bound), `server/src/geo/routes/workspace-state.ts` (`GET/PUT /geo/workspace-state`),
  contract `web/src/geo/contracts/workspace-state.ts`. Scoping/auth come from the app's existing hooks (X-Project-Id; unknown
  project → PUT 404, GET falls back to default and the reply's `projectId` shows it).
- Client: `web/src/lib/workspace-persistence.ts` (`loadServerProjectWorkspaceState`, dirty-checked `queueServerSave`,
  `flushServerProjectWorkspaceState` keepalive on page hide), `web/src/app/page.tsx` (mount a project's workspace after its
  server state was read). ProjectSwitcher and mounted workspaces unchanged. No visible text changed.
- Verified: `server/test/geo-workspace-state.test.ts` (6) and `web/src/lib/workspace-persistence.test.ts` (14) pass; web and
  server typecheck clean. Real app (own instance, ports 13610/18610, data `~/data/geoaidesk/work/gaid-project-resume/`):
  browser 1 opened a project, a file and a second chat tab with draft text; a fresh browser 2 opened the same project with
  both tabs, the active tab, the draft and the open file restored; after browser 2 changed the active tab, closing the stale
  browser 1 did not overwrite it (revision unchanged); ProjectSwitcher Alpha → Beta → Alpha kept the Alpha workspace mounted.
- `scripts/check` passed (exit 0): server vitest 2255 passed / 8 skipped, web vitest 1236 passed, GAID checks and production smoke PASS.
## Next steps
<!-- task:closed -->
Closed 2026-10-23T03:22:48Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
- Two browsers on one project: the last save wins. A browser sends a save only when its state differs from what it last read
  from or wrote to the server, so merely having the project open (or closing that browser) never overwrites a newer save.
  An already-mounted workspace is not refreshed from the server while open (no live sync).
- Browser-local: composer image attachments and queued-message images (IndexedDB blobs; the server record names them by key).
  Another browser drops attachments it lacks and drops a queued message whose images are missing rather than sending it
  without them. The shell state (which projects were opened in this browser) stays per browser.
- Migration: a project with no server record mounts from the browser's existing local copy and uploads it on the next save.
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
