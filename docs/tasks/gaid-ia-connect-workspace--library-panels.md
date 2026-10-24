---
format: 1
status: active
updated: 2026-10-24T06:43:23Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"c206f174-c6d7-4de4-9d76-d5f1849dec13","pid":1414880,"provider":"codex","session":"01a16c9e-d2f2-70e3-ba32-e30d39d2facc","start":"71164929","token":"8fdfa25da058480f039db194f018f505b36bb16b6f1c7344e4f841a9563f5a08"}
branch: task/gaid-ia-connect-workspace--library-panels
target: task/gaid-ia-connect-workspace
parent: gaid-ia-connect-workspace
---
# gaid-ia-connect-workspace--library-panels

## Goal and done criteria
Request from the starter:

# Goal: gaid-ia-connect-workspace--library-panels — 서재 as a side panel where literature is used

Mockups: report figures 04 (project screen, right pane with "AI agent | 서재") and 05 (Connect authoring, 서재 picker as a right side panel). Implement both with real data.

1. Workspace project screen: the right pane in `web/src/app/page.tsx` (WorkspacePage) has views `chat | workflows` switched from `ChatTabsBar`. Add a third view `library` (a 서재 button in ChatTabsBar next to Workflows; keep chat tabs mounted as today). New component `web/src/geo/library/project-library-panel.tsx`: segmented "프로젝트 문헌 N | 전체 서재"; project literature = the project's attached papers and folders (`.kady/geo/literature.json`; use existing server routes/clients in `web/src/geo/library/api.ts` and `server/src/geo/routes/library.ts`; add a small read route only if none lists a project's scope, and say so); search; rows with title (clamped), authors · year, and how often the project's notes/chat cite it when that is available cheaply (else omit); selecting a row shows its actions: open the stored PDF through the existing citation PDF pane (`CitationPdfContext` / `useCitationPdf` in page.tsx, page 1 or the cited page), "프로젝트에 넣기" for whole-library rows (`attachToProject`), and a footer link "서재 전체 화면" that calls `openLibrary({ itemId })` from `web/src/geo/places/navigation.ts` (the parent wires the full screen; the event may be unhandled until then). Clicking a citation in a chat answer or research note should also switch the pane to the library view with that item selected if that is a small change; otherwise leave the existing PDF behaviour and note it.
2. Connect authoring: `web/src/geo/hub/library-picker.tsx` (`LibrarySourcePicker`, a dialog today, used in `hub-screen.tsx`) becomes a right side panel beside the source step (440 px, header "서재에서 자료 고르기", one-line context, 논문 | 정리 노트 segment, search, checkbox rows, footer "N개 고름" + "서재 전체 화면" link + filled "자료 N개 더하기"). Keep its add behaviour and tests; below 1280 px it may overlay as a sheet (UI guide L1).
- Use shared parts (SEG_TRACK/segItem, Button, Input, tokens), UI guide D6, G1, G6, L1, B1. Strings in namespace `library` (and `hub` for the picker's existing ids), Korean first.
- Tests: component tests for the panel (list, attach, open PDF callback) and the picker as a panel.
- Owned files: `web/src/geo/library/project-library-panel.tsx` (new), `web/src/components/chat-tabs-bar.tsx` (or wherever ChatTabsBar lives), the right-pane hunk of `web/src/app/page.tsx` (do not edit HomePage or the app bar part; the parent edits those), `web/src/geo/hub/library-picker.tsx`, the picker hunk of `web/src/geo/hub/hub-screen.tsx`, locale namespace `library` (+ picker ids in `hub`), their tests. Another child renames place-name copy in other namespaces in parallel; avoid editing strings that name 허브/내 연구.
- Screenshots: Korean, 계측/도폭 × light/dark at 1440×900 of both panels (run `cd web && npx next dev -p <free port>` with a backend from your worktree, or mock data on a dev page) into ~/data/geoaidesk/work/gaid-ia-connect-workspace--library-panels/; list the UI guide rule ids followed or broken in your task document.

Context: parent unit gaid-ia-connect-workspace (geoaidesk) reframes GAID as GAID Workspace (analysis framework: projects, installed Workflows, AI agent, files, viewers, research notes) + GAID Connect (formerly GAID 허브: make/share Workflows) with 서재 as the researcher's personal literature space opened from either place. Read the parent report reports/2026-10-24-gaid-ia-connect-workspace/index.md (mockups, §3.6 rename table) and ADR docs/adr/2026-10-24-gaid-connect-workspace.md in your worktree. User decision 2026-10-24 (verbatim): "모두 권장대로 하자." (approve mockups; app bar shows Workspace/Connect; institute hub server is "기관 Connect 서버" in visible copy; "등록" becomes "공유": 공유된 Workflow, Connect에 공유, 공유됨, version wording unchanged).
Rules: follow AGENTS.md of your worktree (UI guide v2 sections 1, 2, 10 before UI work; copy rules: strings in locale catalogues, Korean first, English with the same meaning). Network: the KIGAM network blocks raw.githubusercontent.com; use NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt for npm. Server tests: unset VITEST_MAX_WORKERS or use 1. Python only via uv. Stay inside your owned files; if you must touch another file, keep the hunk minimal and say so in your task document. Do not touch the review app (gaid-review unit, ports 3000/18000) or any hub server.
Evidence: run the relevant checks (cd server && npm run typecheck && npm test -- <your tests>; cd web && npx tsc --noEmit && npm test -- <your tests>; node geo/copy/validate-copy.mjs web/src/geo/locales; node geo/ui/check-ui.mjs). Full scripts/check is run by the parent after integration; you may run it if time allows. Record in your task document what you changed and the check results, then task finish.

## Current state
Implementation and scoped tests complete; visual checks next. Existing GET /geo/library?filter=project already expands attached folders and descendants; no server route needed. Citation frequency is omitted because summary counts are global, not project-specific.
## Next steps
1. Capture the implemented panels in the browser, inspect both sizes, then review the final diff.
2. Capture both panels in Korean across both styles/themes and two desktop sizes; run scoped checks, then finish.
## Failed approaches
- Initial tsc invocation found no dependencies (no node_modules). Installed pinned dependencies with npm ci via recorded job -1, exit 0. Initial job run refused dirty source before starting; saved then ran the recorded install.
- First picker test exposed a missing space in the segmented control accessible name; added an explicit separator. Recheck passed.
## Notes and decisions
- Sequential plan: reuse the library API and PDF state; build the project panel; integrate the right-pane switch; convert the authoring picker; test and capture. No independent writer package remains within this child unit. Owned interfaces: panel PDF callback, listLibrary optional projectId, unchanged picker onAdd contract.
- Minimal additional seams: library/api.ts adds explicit project scope; citation-pdf.tsx opens stored PDFs by item (including papers without a citation key); workspace-persistence.ts retains the new library view.
- UI rules to verify: D6, G1, G6, L1, B1, P4, R2, I6, I9/I14.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
- Checks: web npx tsc --noEmit passed; web scoped component/PDF/persistence suite 29/29 passed; server npm run typecheck passed; geo-library and geo-library-folders 13/13 passed. Copy validator: 0 errors, 101 existing warnings; UI validator: 0 errors, 78 accepted debt.
- Screenshot plan: temporary dev-only harness renders the implemented components on the approved static context, with browser-intercepted library API fixtures. No user data, review app, or hub server is touched.

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
- /home/seongin3/data/geoaidesk/runs/gaid-ia-connect-workspace--library-panels-20261024T064045.938876Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
