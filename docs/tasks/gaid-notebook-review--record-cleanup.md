---
format: 1
status: waiting
updated: 2026-10-18T08:49:53Z
writer: {"host":"seongin3","reserved":"f8920c52ddfb78cfda8aa61a33610fd220a79d3b368da7c773080f68204acb5b"}
branch: task/gaid-notebook-review--record-cleanup
target: task/gaid-notebook-review
parent: gaid-notebook-review
---
# gaid-notebook-review--record-cleanup

## Goal and done criteria
Request from the starter:

# Child unit: record-cleanup (parent gaid-notebook-review)

Goal: make the existing notebook (it becomes the "작업 기록" / work record behind GAID research notes) follow the GAID
researcher-view rules and language. Parent report: reports/2026-10-18-gaid-notebook-review/index.md §3.1 (diagnosis);
user decision 2026-10-18: "모두 권장으로 진행하자." Read `docs/design/ui-guide.md` sections 1, 8, 9 and the copy rules in
AGENTS.md (UI copy and locales; `geo/copy/gaid-writing.md`, `geo/copy/terminology.csv`) before changing visible text.

Scope:
1. Entry card (`web/src/components/lab-notebook-entry-card.tsx` and helpers it uses): execution evidence that shows
   command lines, script paths or tool output (e.g. "보고된 근거: uv run python .pi/skills/…") moves behind a collapsed
   disclosure whose locale id ends in `.technical` (UI guide R2/R4); the visible line keeps the execution state in
   research words. Saved-result links (`notebook-result-links.tsx`) must not show chat/session or tool-call ids
   (seen in the review app as `01a13dfc-…/chatcmpl-tool-…` under "저장된 결과 1 보기"); keep the open action.
   Agent-written entry titles/bodies are data: do not translate or rewrite them.
2. Exports and print: the Markdown/JSON/ZIP exports (`server/src/agent/notebook-export.ts`, `notebook-zip.ts`) and the
   print view (`web/src/lib/notebook-print.ts`) use hard-coded English headings/labels ("Lab Notebook", type labels,
   "User notes", "Evidence status", "Proposed next investigations — not performed", …). Make them follow the UI locale:
   the web passes its locale (e.g. `?lang=ko|en`) to the export routes, the server picks Korean or English labels (default
   English when absent, so upstream callers keep working); the print view uses `t()` strings. The chat tab's
   "연구 노트 (.md)" export (`server/src/agent/session-export.ts` heading "# Lab Notebook … exported from K-Dense BYOK")
   must not show K-Dense/BYOK (AGENTS.md "Names in visible copy"): use GAID wording in the chosen language.
3. Methods draft (`server/src/agent/methods-draft.ts`): the system prompt has no language rule; add one that writes the
   draft in the language of the entries/the user's request (reuse `REPLY_LANGUAGE_RULE` from `server/src/geo/instructions.ts`
   or an equivalent sentence). Keep the existing tests passing; add one assertion for the rule.
4. `web/src/components/next-experiments-dialog.tsx:21` hard-coded English default text → locale string.

Owned files: the files above, `web/src/geo/locales/notebook/*` and `web/src/geo/locales/research/*` (new keys only where
needed), their tests, and append-only `geo/integration-boundaries.json` entries (owner `gaid-notebook-review`) for every
upstream file you edit. Do NOT touch `web/src/components/file-preview-panel.tsx`, the layout/scope logic of
`web/src/components/lab-notebook-view.tsx` (the parent rebuilds the notebook tab around it), `web/src/geo/notes/**`,
`server/src/geo/notes/**`, or docs other than your task document and `docs/lab-notebook.md` export lines if wording changes.

Checks before finish: `cd web && npx tsc --noEmit && npx vitest run` for the touched component tests;
`cd server && npm run typecheck && npx vitest run` for export/methods-draft/session-export tests;
`node geo/copy/validate-copy.mjs web/src/geo/locales`; `node geo/ui/check-ui.mjs`. No screenshots needed (the parent takes
them at integration). Network: raw.githubusercontent.com is blocked; use `gh api` if needed.

Evidence in your task document: files changed, check commands and results, and every changed/added string id with Korean
and English before → after (copy rule). Then `task finish`.

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
