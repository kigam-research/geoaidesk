---
format: 1
status: waiting
updated: 2026-10-24T01:48:31Z
writer: {"host":"seongin3","reserved":"5ced0ccb082ec0b914e81e989d8affe48c55c4635f80cdf377dfbffaa29a1f8e"}
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
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
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
