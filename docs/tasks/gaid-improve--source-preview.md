---
format: 1
status: waiting
updated: 2026-10-15T08:13:00Z
writer: {"host":"seongin3","reserved":"db9fae716c04af7d82d26b6856d3d9672b1221e85b12d91525fa96e3c37ccbca"}
branch: task/gaid-improve--source-preview
target: task/gaid-improve
parent: gaid-improve
---
# gaid-improve--source-preview

## Goal and done criteria
Request from the starter:

# Child writer: source-preview

Goal: implement the real PDF/source-input portion of the user-approved CLICKABLE source-first authoring prototype. This is not AI extraction or scientific execution. Parent: gaid-improve. Use task CLI isolated worktree and general work profile at normal speed. First task resume the printed child slug and read AGENTS/task document. raw.githubusercontent.com is blocked; uv Python only. Do not touch live ~/deploy/geoaidesk or credentials/model connections.

Read docs/design/authoring-preview-implementation.md, docs/design/spatial-pu-pilot.md, geo/copy/gaid-writing.md and terminology.csv; shared interface web/src/geo/contracts/authoring-preview.ts. Images source-first-01-intake.png and source-first-02-coauthor.png under canonical report figures are approved visual authority. Preserve topology/readability/palette using existing shadcn/Lucide and real PDF.js; do not rasterize UI or import NotebookLM design.

Owned files ONLY:
- web/src/geo/authoring-preview/source-pane.tsx and source-input.tsx, related focused tests.
- web/src/components/pdf-viewer/pdf-viewer.tsx (additive raw source URL/page request/document-ready seams, default behavior unchanged), narrowly necessary related PDF tests.
- web/src/geo/locales/previewSource/{ko,en}.json.
- Your own task document.
Parent owns shared types, locale index (already registered), root layout/routes/sample asset, other UI, docs/report and integration boundaries (already declared). Do not edit these. If an interface blocker needs a change, send the exact small proposal to parent rather than changing shared files.

Exports: PreviewSourcePane(PreviewSourcePaneProps), PreviewSourceInput(PreviewSourceInputProps). Use contract types. Source pane uses sourceUrl (same-origin or blob), hideAnnotationUi and initialFitWidth. Add optional sourceUrl, pageRequest {page,sequence}, onDocumentReady callback to existing PdfViewer without changing sandbox defaults or annotation behavior elsewhere. Real pdf navigation/zoom and page-link requests must work. Keep no project/sandbox/annotation calls in the raw-URL view-only preview. Parent owns object URL creation/revocation and persistence. Do not use generated paper images or copy the 13-MB PDF into Git.

Input component: compact URL input, local PDF selection, explicit sample-paper action, current source chip/clear. Validate http/https URL and PDF File/type/size in the UI (parent will re-check). User-picked PDFs stay in browser. Parent callback resolves sample/external URL state; do not fetch remote URLs or call AI/backend here. Give accessible error/loading/empty states, keyboard labels, responsive layout. If native PdfViewer toolbar differs slightly, preserve real functionality; no dead decorative controls.

All visible strings go through geoText('previewSource') and ko/en catalogs. Follow existing glossary (workflow/spatial block etc), no unsupported automatic-analysis claims. Use existing dependencies only.

Evidence: focused tests for raw source seam/legacy URL preservation and page request behavior where meaningful, local copy validator; parent will do integrated browser flow and required scripts/check. Follow child task CLI check requirements and report exact checks vs not run. No model calls or scientific reruns. Keep working autonomously; finish child with task finish so parent can task complete it. Do not write a separate canonical user report.

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
