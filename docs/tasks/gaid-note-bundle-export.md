---
format: 1
status: done
updated: 2026-10-24T03:48:46Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"41dbea06-326f-4f1c-b1e0-05cf1380bd4f","pid":1132461,"provider":"claude","session":"7898f15a-75bb-457c-98ce-bcd12e76095b","start":"69414348","token":"33e8cf317ab33bac9151faf65006114ce8fd8a1b39690d843d61a72029a0e651"}
branch: task/gaid-note-bundle-export
target: main
parent: 
---
# gaid-note-bundle-export

## Goal and done criteria
Request from the starter:

# Goal: gaid-note-bundle-export — research-note result bundle, public-material export for Gemini Notebook, and notebook links

Done: (1) proposal 2 — from one research note, download a bundle with the note body, figures, fingerprints (sha256) of the data it used, environment record, Workflow version, cited papers list, built on the evidence-package code; bounded size, shown before download. (2) integration 나 — a 'public material export' that bundles the research note (Markdown), the Workflow 지침 (Markdown) and openly licensed paper PDFs the researcher picks, for manual upload to Gemini Notebook; before export a confirmation screen lists every file and asks whether each may leave the institute (no Google API calls; nothing uploaded by GAID). (3) integration 가 — save a related Gemini Notebook URL on a 서재 folder or a project and open it from there (no data exchange). Not now: importing Gemini Notebook results, Drive sync, Enterprise API. Running in parallel: gaid-cite-open-pdf (touches note views — coordinate via the hub if you edit the same files) and gaid-uiux-skills-scan.

## User decision (verbatim, 2026-10-24)

> gaid-notebooklm-review 모두 권장대로 진행하자.

Answers recorded on open items gaid-notebooklm-review#1 (가: build proposal 1 "인용을 눌러 PDF 쪽 열기" and proposal 2 "연구 노트 결과
묶음" first; 3–5 later) and #2 (가: now only "노트북 링크 저장" and "공개 자료 내보내기" with a confirmation screen; "결과 가져오기" later;
Drive sync and the Enterprise API wait for the institute security office). Source: `reports/2026-10-24-gaid-notebooklm-review/index.md`
§3.4 (proposals table) and §3.5 (integration table). The report found: chat and note citations are text only and do not open the PDF;
the PDF side panel (gaid-library-pdf-panel, `web/src/geo/pdf/pdf-pane.tsx`, `pageRequest`) can go to a page but is used only in hub
authoring; notes cannot be exported with their evidence; the existing evidence-package feature (`server/src/evidence/*`) is the base.

Checks: scripts/check; UI guide v2 (sections 1, 2, 10 + components touched; Korean screenshots both styles/themes at 1440×900 and
1280×800) and copy rules ("version", never 판). Do not touch the review app (PC74, loopback-only) or the hub server; the hub deploys
after integration. Outside check: none.

## Current state
Result for the hub (2026-10-24): all three requested features are built on this branch.
1. 결과 묶음: from a research note's 더 보기 menu, a previewed ZIP with the note folder, data fingerprints from the note
   chats' provenance (same/changed/missing/not compared now), environment records, Workflow version + 지침, cited papers,
   README and SHA256SUMS; no data files, no reproduction claim; 409 when the preview is stale.
2. 공개 자료 내보내기: note Markdown (+ reference list), Workflow 지침 Markdown, cited paper PDFs; nothing pre-ticked, each
   file needs its own "기관 밖으로 내보내도 되는 자료입니다" confirmation (enforced server-side), local export record; no Google
   calls.
3. Gemini Notebook links (child gaid-note-bundle-export--notebook-links, completed and closed): project link under the notes
   list summary, 서재 folder link under the folder facts; https only, opened in a new tab, never fetched.
Verified: server tests (note export 7, notebook link 15), web tests (notes/notebook-link/library 35), typechecks, copy and UI
validators 0 errors; trial app (unit gaid-note-bundle-export-app, stopped) walked both downloads (ZIP sha matched the
header, `sha256sum -c SHA256SUMS` passed) and both link places; 40 UI-guide shots in
~/data/geoaidesk/work/gaid-note-bundle-export/shots/. Report: reports/2026-10-24-gaid-note-bundle-export/index.md.
Full scripts/check: run by task finish.
## Next steps
<!-- task:closed -->
Closed 2026-10-24T03:48:46Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
Plan (orchestration):
- Sequential: shared contract `web/src/geo/contracts/note-export.ts` first (features 1 and 2 share the note file
  listing, Workflow 지침 rendering and citation resolution).
- Packages: (A) features 1+2, writer itself (server `server/src/geo/notes/export.ts`, routes `server/src/geo/routes/notes.ts`,
  UI `web/src/geo/notes/export-*.tsx`, namespace `noteExport`); (B) feature 3 notebook links, child writer `notebook-links`
  ("general work"): owns library collection field + routes + `web/src/geo/library/folder-panel.tsx` edits, project link
  store `server/src/geo/workspace/notebook-link.ts` + route, component `web/src/geo/notebook-link/`; the writer mounts the
  project component in `research-notes-panel.tsx` (writer-owned file).
- Integration order: B merged into the parent branch via `task complete`, then the writer mounts it, checks, report.
- Coordination: gaid-cite-open-pdf touches note views (citation rendering in note markdown). This unit edits only the note
  detail header/더 보기 menu in `research-notes-panel.tsx`; no changes to `note-markdown.ts` citation rendering.
- Design choices (no user decision needed, within the request): bundle holds data fingerprints (sha256 + size + when
  recorded), never the data files themselves; public export contains only the files the researcher ticks, each with its
  own "기관 밖으로 내보내도 되는 자료" confirmation, enforced server-side; PDFs are never pre-ticked; licence is shown
  when the paper metadata has one, otherwise "이용 조건 확인 안 됨". GAID never contacts Google; links open in a new tab.
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
Report: reports/2026-10-24-gaid-note-bundle-export/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
