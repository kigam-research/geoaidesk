---
format: 1
status: done
updated: 2026-10-24T03:20:46Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"6f438c48-ca8f-43cb-a763-3e2c3f4e1f5d","pid":1195251,"provider":"codex","session":"01a16b98-98fb-76e2-936a-665bab0a74ca","start":"69446405","token":"5ced0ccb082ec0b914e81e989d8affe48c55c4635f80cdf377dfbffaa29a1f8e"}
branch: task/gaid-note-bundle-export--notebook-links
target: task/gaid-note-bundle-export
parent: gaid-note-bundle-export
---
# gaid-note-bundle-export--notebook-links

## Goal and done criteria
Request from the starter:

# Child unit: notebook-links (parent gaid-note-bundle-export)

Goal (from the user's request, integration 가 of reports/2026-10-24-gaid-notebooklm-review/index.md §3.5): save a related
Gemini Notebook URL on a 서재 folder or on a project and open it from there. No data exchange: GAID never fetches, embeds or
calls the URL or any Google service; the link only opens in a new browser tab. Not in scope: importing Gemini Notebook
results, Drive sync, Enterprise API.

Read AGENTS.md (GAID fork rules, copy rules, UI guide v2 sections 1, 2, 10 + D4 popovers, B1-B4, G-rules) first.

## Settled interfaces (implement exactly; the parent depends on them)
1. Contract `web/src/geo/contracts/notebook-link.ts` (IO-free):
   - `NOTEBOOK_URL_MAX = 2048`; `normalizeNotebookUrl(raw: unknown): string | null` — trims; accepts only `https:` URLs
     with a host, no username/password, length <= max; returns the URL's `href`; anything else → null.
   - `ProjectNotebookLink { url: string | null; updatedAt: string | null }` (GET/PUT `/geo/notebook-link`, PUT body
     `{ url: string | null }`, null removes; invalid URL → 400). Scoped by X-Project-Id like other `/geo/*` routes
     (use `activePaths()` as `server/src/geo/routes/notes.ts` does).
2. Project store `server/src/geo/workspace/notebook-link.ts`: file `<sandbox>/.kady/geo/notebook-link.json`
   (`geoStateDir(paths)` from `server/src/geo/context.ts`), `{ schema: "gaid-notebook-link/v1", url, updatedAt }`,
   atomic write; malformed file → 409 and never rewritten (same rule as recipes/workspace-state). Route file
   `server/src/geo/routes/notebook-link.ts`, registered beside the other geo routes in `server/src/geo/routes.ts`.
3. 서재 folder: optional `notebookUrl?: string` on `LibraryCollection` (`web/src/geo/contracts/library.ts`; comment: a
   researcher-saved external notebook page, opened only, GAID-side field kept across Zotero reconcile and hub sync).
   Store method in `server/src/geo/library/store.ts` (e.g. `setCollectionNotebook(id, url | null)`) allowed for GAID and
   Zotero-linked folders alike (it never writes to Zotero). Route `PUT /geo/library/collections/:id/notebook`
   `{ url: string | null }` in `server/src/geo/routes/library.ts`. Check that `reconcileFolders`
   (`zotero-service.ts`) and library sync (`server/src/geo/library/sync/`) keep the field (add a test for each).
4. UI, namespace `notebookLink` (`web/src/geo/locales/notebookLink/{ko,en}.json`, registered in
   `web/src/geo/locales/index.ts`), components in `web/src/geo/notebook-link/`:
   - `NotebookLinkControl({ url, onSave(url: string | null): Promise<void>, context: "folder" | "project" })`: when a URL
     is saved, a plain link-style action "노트북 열기" (`target="_blank" rel="noopener noreferrer"`, shows the host in a
     tooltip) plus edit; when none, a plain "노트북 링크 저장" action. Editing is a popover beside the trigger (D4) with one
     URL field, save (filled only inside the popover), remove (when saved), cancel/Escape; invalid input shows an inline
     error in research terms (F5). One line explaining that GAID only opens the page and sends nothing.
   - `ProjectNotebookLink()`: loads/saves the project link through `/geo/notebook-link` with the existing geo api fetch
     helper (look at how `web/src/geo/notes/research-notes-panel.tsx` or `web/src/geo/library/api.ts` call the server)
     and renders `NotebookLinkControl` with context "project". The PARENT mounts it in
     `web/src/geo/notes/research-notes-panel.tsx`; do NOT edit that file.
   - Mount `NotebookLinkControl` (context "folder") in `web/src/geo/library/folder-panel.tsx` header area, keeping the
     header at <= 3 actions (B4): put it in the existing ⋯ menu as "노트북 링크 저장…/바꾸기…" plus a visible
     "노트북 열기" link when a URL is saved, or another placement that keeps B4; say which in your evidence.
   - Copy: read `geo/copy/gaid-writing.md`, `geo/copy/terminology.csv`; Korean first, English same meaning; button labels
     name the action; no em dashes. Product name "Gemini Notebook" as in the review report.
5. Tests: contract unit test (`normalizeNotebookUrl`: http, javascript:, userinfo, too long, whitespace), server tests for
   both routes (valid, invalid 400, remove, malformed file 409), folder field survives Zotero reconcile and sync, a web
   component test for NotebookLinkControl (open link attributes, save, invalid input).

## Owned files
New files above; edits to `web/src/geo/contracts/library.ts`, `server/src/geo/library/store.ts`,
`server/src/geo/routes/library.ts`, `server/src/geo/routes.ts`, `web/src/geo/library/folder-panel.tsx`,
`web/src/geo/library/api.ts`, `web/src/geo/locales/index.ts`, `web/src/geo/locales/library/*` if needed. Do not edit
`web/src/geo/notes/*`, `web/src/geo/contracts/note-export.ts`, `server/src/geo/notes/*`, `server/src/geo/routes/notes.ts`
(the parent's). If a shared file needs a change outside this list, ask the parent first.

## Checks and evidence
Run `cd server && npx tsc --noEmit && npx vitest run <your tests>`, `cd web && npx tsc --noEmit && npx vitest run <your
tests>`, `node geo/copy/validate-copy.mjs web/src/geo/locales`, `node geo/ui/check-ui.mjs`. Full `scripts/check` is run by
the parent after integration; you may run it too. No screenshots needed (the parent takes them). Record in your task
document: files changed, the folder-panel placement chosen, string ids with Korean/English text, test commands and
results. Network: raw.githubusercontent.com is blocked on the KIGAM network. Finish with `task finish`.

## Current state
Delivered external Gemini Notebook link storage for projects and library folders, with HTTPS validation, atomic project writes and read-only recovery for malformed records. The folder header shows the shared plain save/edit control and, when saved, a direct open link, alongside the existing More menu (maximum three actions). The browser opens the saved URL in a new tab with noopener/noreferrer; GAID never fetches the page or sends research data there.

Parent integration: mount `ProjectNotebookLink` from `web/src/geo/notebook-link/project-notebook-link.tsx` in the research-notes panel. That parent-owned file is unchanged. Zotero reconciliation and hub sync already preserve the field; regression tests verify both without changing those implementations.

Checks passed: server and web `npx tsc --noEmit`; server route/persistence suite (15 tests); web contract/control/project-wrapper suites (24 tests); copy validator (0 errors, 100 existing warnings); UI validator (0 errors, 78 accepted existing debt); `git diff --check`. Full `scripts/check` and visual screenshots remain the parent's integration checks, as agreed.
## Next steps
<!-- task:closed -->
Closed 2026-10-24T03:20:46Z: integrated into gaid-note-bundle-export; closed with it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
Dependency installation job was refused twice before launch because edits were made before the launcher checked source cleanliness.
No job receipt was created and no install started. Save and wait for job launch before further edits.
Initial web typecheck rejected an unsupported `exact` option on Testing Library `getByRole`. Removed it (role names match exactly by default); typecheck and all web tests passed afterward.
First automatic finish check: backend passed 210 files/2315 tests (1 file/8 tests skipped); web failed 6 existing tests in csv-viewer, file-preview-panel (2), settings-dialog and map viewer (2). Four were 5-second timeouts; two were late/missing editor or settings queries. Notebook tests passed. The four affected files with maxWorkers=2 passed 25/26 tests; a.tex draft assertion then failed, but file-preview-panel alone with maxWorkers=1 passed all 8. Installed Vitest supports `VITEST_MAX_WORKERS` (read from its resolver), so retry will use 1 without changing unrelated source. Log: `/home/seongin3/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-9z1z66hr.log`. Full-suite resource/timing interference is suspected, not proven.
## Notes and decisions
Sequential plan: settle the shared contract and storage first, build the common UI second, then verify persistence and UI together.
This is tightly coupled work; the single writer owns all listed files and does not delegate.
Folder placement: plain save/edit control and saved open link beside the existing More menu (at most three header actions, B4).
No change to the parent's research-notes panel; it will mount ProjectNotebookLink.
The exact worktree has no codegraph index; direct source reads are used per knowledge-lookup fallback.

### Changed files
- Shared contracts: `web/src/geo/contracts/notebook-link.ts` and test; `web/src/geo/contracts/library.ts` adds optional `notebookUrl`.
- Server: `server/src/geo/workspace/notebook-link.ts`, `server/src/geo/routes/notebook-link.ts`, route registration in `server/src/geo/routes.ts`, folder setter in `server/src/geo/library/store.ts`, folder route in `server/src/geo/routes/library.ts`, tests in `server/test/geo-notebook-link.test.ts`.
- Web: `web/src/geo/notebook-link/{notebook-link-control,project-notebook-link}.tsx` and component tests; `web/src/geo/library/{api.ts,folder-panel.tsx}`; namespace registration and `web/src/geo/locales/notebookLink/{ko,en}.json`.
- No upstream files, boundaries, dependencies, library sync or Zotero implementation changed.

### UI evidence
P1/P4: one notebook address edited beside the trigger, in context. B1: only the popover Save link is filled; header actions remain plain. B2/B3/B4: standard text controls, action labels, at most three header actions. D4: Radix popover supports Escape, cancel, outside click and focus return. G3: no new card or list chrome. F5/R2: local inline errors, no raw server message shown. I2/I8/I12/I13: shared role tokens and standard controls work in both styles/themes; no hard-coded colours or pixel filtering. Screenshots are explicitly owned by the parent.

### New strings (all previously absent)
All IDs have the `notebookLink.` prefix.

| ID suffix | Korean | English |
| --- | --- | --- |
| open.action | 노트북 열기 | Open notebook |
| add.action | 노트북 링크 저장 | Save notebook link |
| edit.action | 링크 바꾸기 | Change link |
| folder.title | 폴더의 Gemini Notebook 링크 | Folder's Gemini Notebook link |
| project.title | 프로젝트의 Gemini Notebook 링크 | Project's Gemini Notebook link |
| url.label | 노트북 주소 (https://) | Notebook address (https://) |
| openOnly | GAID는 페이지만 열며 자료를 보내지 않습니다. | GAID only opens the page and sends no research data. |
| invalid | 노트북 주소를 확인하세요. https://로 시작하고 로그인 정보가 없는 주소를 입력하세요. | Check the notebook address. Enter an https:// address without sign-in information. |
| saveFailed | 링크를 저장하지 못했습니다. 주소와 연결을 확인한 뒤 다시 저장하세요. | Could not save the link. Check the address and connection, then save again. |
| save.action | 링크 저장 | Save link |
| remove.action | 링크 삭제 | Remove link |
| cancel.action | 취소 | Cancel |
| saving | 링크 저장 중 | Saving link |
| loadFailed | 저장한 노트북 링크를 읽지 못했습니다. | Could not read the saved notebook link. |
| retry.action | 링크 다시 읽기 | Reload link |
| loading | 노트북 링크 읽는 중 | Reading notebook link |

### Re-verification
Dependencies were installed from lockfiles by the recorded job (exit 0), in its pinned source snapshot. Temporary dependency symlinks used for local checks were removed before finish; a fresh consumer can run `npm ci` in server and web as usual.
- `cd server && npx tsc --noEmit && npx vitest run test/geo-notebook-link.test.ts`: exit 0, 15 tests. Covers project scope, normalized save/read/remove, invalid 400, malformed 409/non-rewrite, no fetches, GAID/Zotero folder editing, Zotero metadata refresh and two-library hub sync including link update/removal.
- `cd web && npx tsc --noEmit && npx vitest run src/geo/contracts/notebook-link.test.ts src/geo/notebook-link/notebook-link-control.test.tsx src/geo/notebook-link/project-notebook-link.test.tsx`: exit 0, 24 tests. Covers URL bounds/schemes/userinfo, safe new-tab attributes, save/invalid/error/remove/cancel/Escape, project-explicit requests and ignored late response after a project switch.
- `node geo/copy/validate-copy.mjs web/src/geo/locales`: exit 0, 35 catalogues, 0 errors, 100 existing warnings (none from notebookLink).
- `node geo/ui/check-ui.mjs`: exit 0, 14558 strings, 0 errors, 78 accepted existing debt, no new baseline.
- `git diff --check`: exit 0.
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
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-note-bundle-export--notebook-links-20261024T015255.219892Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
