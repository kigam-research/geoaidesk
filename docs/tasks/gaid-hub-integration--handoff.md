---
format: 1
status: active
updated: 2026-10-15T14:21:01Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"e6a23203-e5dc-44f5-b6a0-74d8c942a195","pid":665078,"provider":"codex","session":"01a13fed-7ed2-7881-9654-a6218e794d87","start":"53989197","token":"a3929f3225e1d96db2f1b61b4260ff571b00591ae659bf12d432aa22b67b343b"}
branch: task/gaid-hub-integration--handoff
target: task/gaid-hub-integration
parent: gaid-hub-integration
---
# gaid-hub-integration--handoff

## Goal and done criteria
Request from the starter:

# Child writer brief: `gaid-hub-integration--handoff` (geoaidesk) — "방금 한 분석을 skill_hub 초안으로 보내기"

Parent: gaid-hub-integration (Claude orchestrator). Read the parent task document docs/tasks/gaid-hub-integration.md
(Goal, Orchestration) and AGENTS.md first. You own package P2 only.

## User decision (verbatim, Korean, 2026-10-15)
"skill_hub에서 작성하고 GAID는 설치·실행·시험만 합니다. ... GAID의 대화 화면에는 \"방금 한 분석을 skill_hub 초안으로 보내기\"만 둡니다."
So skills/workflows are authored in skill_hub (the GAID hub). In GAID's chat the only authoring entry is sending the analysis
just done to the hub as authoring material for a new draft.

## Deliverable
1. Replace the composer action "재사용 스킬 만들기" (web/src/geo/workspace/chat-actions.tsx, `GeoChatActions`, which creates a
   project skill template and prefills a chat instruction) with "방금 한 분석을 skill_hub 초안으로 보내기". Remove the old
   skill-template path from this component (Settings → Skills keeps its own create/install features; do not touch them).
2. Server: build a handoff bundle for one chat session.
   - `POST /geo/hub/handoff/preview` `{ sessionId }` → what would be sent: the user's request (first user message text of the
     session), the final assistant answer text, model ref, files the session produced (from the session's provenance log
     `sandbox/.kady/provenance/<sessionId>/steps.jsonl`, artifacts with change created/modified/wrote that still exist, with
     size and current sha256 and whether they are code (by extension: .py .r .R .ipynb .sh .js .ts .sql .m .json .yaml .yml .toml
     .md) or results), and files under `user_data/` the session read (listed, unselected by default). Bound everything
     (e.g. <= 200 files listed, text fields truncated with a visible marker).
   - `POST /geo/hub/handoff` `{ sessionId, files: string[], note?: string }` → `application/gzip` download
     `gaid-analysis-<sessionId-prefix>-<yyyymmdd>.tar.gz` with `handoff.json` (`schemaVersion: "gaid-analysis-handoff/v1"`:
     request, finalAnswer, note, modelRef, gaidVersion (geo/distribution.json version), createdAt, projectId,
     sessionId, files[{path, sha256, size, role: "code"|"result"|"user-data", provenanceStepIds[]}], excluded counts) plus the
     selected files under `files/<sandbox-relative path>`. Limits: 20 MiB total, 200 files, 5 MiB per file; refuse anything
     outside the sandbox, dot-directories (`.kady`, `.pi`, `.venv`, ...), symlinks, secrets-like names (.env*, *.pem, *.key, id_*).
     `user_data/` files only when explicitly selected. Re-hash at build time; a file changed since preview is still sent with
     its new hash (the bundle records what was sent).
   - Reuse the existing session history reader (`GET /sessions/:id/history` implementation in server/src/api/sessions.ts) and
     provenance store (server/src/provenance/) rather than parsing ad hoc where possible. Files: server/src/geo/hub-handoff/*,
     server/src/geo/routes/hub-handoff.ts; add one register line to server/src/geo/routes.ts.
3. Web: the dialog shows (in Korean first, English locale too) what will be sent: request, final answer excerpt, file list
   with checkboxes (code and results preselected, user data unselected and labelled), an optional note to the hub, a clear
   line that raw data is not included unless selected, and the hub site to open (from `GET /geo/skill-hub` sites; the
   authoring entry URL is not settled yet — use the site's base URL and a constant `authoringPath` placeholder in one place
   so the parent can set it after the hub contract is agreed). Primary button: download the bundle; then a link
   "skill_hub에서 초안 시작하기" opening the hub in a new tab, with a one-line instruction to attach the downloaded file there.
   Disabled while streaming or with no session (keep today's guard). Files: web/src/geo/hub-handoff/*, chat-actions.tsx,
   new locale namespace `hubHandoff` (web/src/geo/locales/hubHandoff/{ko,en}.json + two lines in web/src/geo/locales/index.ts).
   Follow AGENTS.md "UI copy and locales" and geo/copy/gaid-writing.md + terminology.csv (use "워크플로", "스킬", "초안").
   Remove the now-unused `workspace.skill.*` strings only if no other code uses them.
4. Tests: server vitest for preview/bundle (limits, exclusions, user_data opt-in, tar contents and handoff.json) and a web
   test for the dialog. Move the three old GeoChatActions cases out of web/src/geo/workspace/workspace.test.tsx into your
   new test file (that file is also edited by gaid-qwen-authoring-trial; keep your edit there to deleting those cases).
5. Add any upstream file you edit to geo/integration-boundaries.json with owner gaid-hub-integration (chat-actions.tsx is
   already GAID-owned code).

## Constraints
- Do not edit files owned by the running unit gaid-qwen-authoring-trial: task-catalogue.tsx, workflows-panel.tsx,
  server/src/geo/context.ts, instructions.ts, skills-panel.tsx, locales app/workspace/workflows/settings/work (except removing
  the unused workspace.skill block if needed — prefer leaving it and listing it in your report as cleanup).
- The bundle format may change after the skill_hub hub answers the contract (parent request da92dc0fec04); keep the
  builder in one module with the schema version constant.
- Checks: targeted `cd server && npx vitest run <your tests>` and `cd web && npx vitest run <your tests>`, typecheck both
  (`npm run typecheck` in server, `npx tsc --noEmit` in web), and `node geo/copy/validate-copy.mjs web/src/geo/locales`. The
  full scripts/check is run by the parent at integration; run it if time allows and report the result honestly.
- Report back in your task document under ## Current state: routes, bundle schema, string ids with Korean/English text,
  test results. Then `task finish`.

## Current state
- Resumed the assigned worktree; read its rules and parent orchestration. P2 implementation is starting.
## Next steps
1. Implement the bounded provenance-backed builder and project-scoped routes.
2. Replace GeoChatActions with the preview/download/hub dialog; add hubHandoff locales and tests.
3. Run the declared targeted checks, record evidence/string ids, and finish for parent integration.
## Failed approaches
## Notes and decisions
- 2026-10-15 terminology correction (user verbatim): "용어로서 워크플로우가 표준용어이고 가급적 영어로 Workflow로 사용하길 원한다." New strings prefer `Workflow` even in Korean; Korean spelling, when required, is `워크플로우`. This supersedes the brief's older spelling. Other namespaces remain untouched.
- Orchestration: this child is the single writer; no nested child units. Builder → routes → dialog → targeted tests is sequential because interfaces are tightly coupled. Own only P2 files plus append-only route/locale seams and deletion of the three old chat-action tests. Keep unused workspace.skill strings for the trial unit/parent cleanup.
- The exact worktree has no codegraph index; use native source reads without creating an index.
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
