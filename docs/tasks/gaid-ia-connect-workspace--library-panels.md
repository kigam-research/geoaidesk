---
format: 1
status: active
updated: 2026-10-24T07:16:41Z
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
Implemented the two library side panels. Workspace now has a library view beside chat and Workflows, project-scoped paper search/list, add-to-project, stored-PDF actions and full-screen library navigation. Chat/note citations open the existing PDF column and select the library paper (including repeat presses). The library view survives workspace restoration. Connect source selection is a non-modal 440 px side panel, an overlay below 1280 px, with unchanged multi-source add behavior, close/Escape and restored keyboard focus.

Existing GET /geo/library?filter=project expands attached folders and descendants; no server route was added. Citation frequency is intentionally omitted because available summary counts are global, not project-specific.

Scoped verification: web component/PDF/persistence tests 30/30; server library/folder tests 13/13; both typechecks; copy validator 0 errors (101 existing warnings); UI validator 0 errors (78 existing accepted debt). Korean screenshots cover both panels × both styles × both themes at 1440×900 and 1280×800 (16), plus 1100×800 instrument/light (2). Screenshots use the implemented components with intercepted sample API replies over the approved static surrounding context, not a live researcher project. No browser console errors in the final session. No user data, review app or hub server was touched.

Code is on this child branch; parent integration remains separate. First automatic scripts/check: backend 2323 passed/8 skipped, frontend 1346 passed; distribution checks rejected the child seam owner. Corrected it to the existing parent package; distribution test 7/7 now passes. Second full check: backend passed again; frontend had 5 timing/lookup failures in existing file-preview/settings/LaTeX/map tests under unrestricted parallel load. The four affected files pass all 31 tests with maxWorkers=2, without source changes. Retrying task finish with VITEST_MAX_WORKERS=1 (also follows the server-test constraint) to bound resource use. No deployment is part of this unit.

## Next steps
<!-- task:closed -->
Closed 2026-10-24T07:01:30Z: ready; the parent gaid-ia-connect-workspace integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Second task finish had 5 existing frontend test timing/lookup failures in four files; all 31 tests in those files passed with --maxWorkers=2. The previous full frontend run had passed 1346/1346 at the same runtime source. Inference: unrestricted concurrent suites exceeded existing 1 s waits / 5 s test budgets under shared host load (load ~21, 32 threads). Local Vitest implementation explicitly supports VITEST_MAX_WORKERS. No product/test timeout changes; rerun full check with VITEST_MAX_WORKERS=1.
- First task finish automatically ran scripts/check. Backend 2323 passed/8 skipped and frontend 1346 passed; distribution checks rejected the child task name as a seam owner. Corrected the owner to the existing registered parent package (no test allowlist expansion). Re-verified the distribution test directly before retry. Log: ~/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-b0xw5j7p.log.
- Initial tsc invocation found no dependencies (no node_modules). Installed pinned dependencies with npm ci via recorded job -1, exit 0. Initial job run refused dirty source before starting; saved then ran the recorded install.
- Initial screenshot attempt on 127.0.0.1 could not hydrate because Next dev blocked the HMR origin; used localhost (no product configuration change).
- First picker test exposed a missing space in the segmented control accessible name; added an explicit separator. Recheck passed.
## Notes and decisions
- Sequential plan: reuse the library API and PDF state; build the project panel; integrate the right-pane switch; convert the authoring picker; test and capture. No independent writer package remains within this child unit. Owned interfaces: panel PDF callback, listLibrary optional projectId, unchanged picker onAdd contract.
- Minimal additional seams: library/api.ts adds explicit project scope; citation-pdf.tsx opens stored PDFs by item (including papers without a citation key); workspace-persistence.ts retains the new library view.
- UI rules followed: D6/P4 (side inspector, work remains visible), G1 (56 px two-line rows, title ellipsis and full title tooltip in the project panel), G6/I9/I14 (announced selected state plus identity cue), L1 (440 px alongside at >=1280, overlay below), B1 (one filled picker add action; project PDF/attach remain secondary), R2 (readable failure without raw errors), I6 (existing original-pixel PDF pane), A1/A2 (named controls, checkbox and Escape/focus return). No intentional rule exception.
- Visual checklist: 18 captures showed no document overflow. Project selected-paper/PDF and picker primary actions stay visible at both required sizes. Final capture fixed the picker height to the available pane and its selected-row index cue.
- Screenshot evidence: ~/data/geoaidesk/work/gaid-ia-connect-workspace--library-panels/{project,authoring}-{instrument,mapsheet}-{light,dark}-{1440x900,1280x800}.png; 1100x800 instrument/light also captured. capture.cjs and screenshot-harness.tsx remain there for reproduction. The temporary /dev/library-panels source route was removed.
- In-repo report figures: reports/2026-10-24-gaid-ia-connect-workspace/figures/08-project-library-implemented.png and 09-authoring-library-implemented.png (instrument/light, 1440x900). Parent owns the report prose and main integration.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
- Checks: web npx tsc --noEmit passed; web scoped component/PDF/persistence suite 30/30 passed; server npm run typecheck passed; geo-library and geo-library-folders 13/13 passed. Copy validator: 0 errors, 101 existing warnings; UI validator: 0 errors, 78 accepted debt.
- Screenshot dev job -2 exited 0 after all 18 captures; its log contains successful 200 responses for each requested combination. The temporary route was removed and port 3107 stopped intentionally.
- Screenshot method: temporary dev-only harness renders the implemented components on the approved static context, with browser-intercepted library API fixtures. No user data, review app, or hub server is touched.

## Open items
None.
## Report
Report: reports/2026-10-24-gaid-ia-connect-workspace/index.md
Parent-owned canonical report; implementation figures added, prose integration deferred to the parent to avoid concurrent edits.

## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-ia-connect-workspace--library-panels-20261024T064045.938876Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-ia-connect-workspace--library-panels-20261024T064336.499685Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

## Copy changes (Korean first; English equivalent)
- New library.panel.* (19 ids): scope/title, search/loading/empty/failure/retry, PDF page, attach states, full-screen link and pagination. Examples: project = "프로젝트 문헌 {count}" / "Project papers {count}"; attach = "프로젝트에 넣기" / "Add to project"; fullScreen = "서재 전체 화면" / "Full library". No previous values.
- hub.library.title: "서재에서 자료 추가" / "Add sources from the library" -> "서재에서 자료 고르기" / "Choose sources from the library".
- hub.library.description: multi-sentence PDF/note detail -> one-line "논문과 정리 노트를 Workflow의 근거 자료로 넣습니다." / "Add papers and research notes as evidence for the Workflow." Source ingestion behavior is unchanged.
- hub.library.notes: "연구 노트" -> "정리 노트" (English "Research notes" unchanged).
- hub.library.addAction: "{count}개 추가" / "Add {count}" -> "자료 {count}개 더하기" / "Add {count} sources"; addEmpty: "추가" / "Add" -> "자료 더하기" / "Add sources".
- New hub.library.close, failed, addFailed: close action and readable list/add failure messages, with matching English. Existing raw error output removed from this picker.
