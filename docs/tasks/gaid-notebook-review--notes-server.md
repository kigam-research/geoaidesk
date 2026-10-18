---
format: 1
status: active
updated: 2026-10-18T09:25:33Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"03bb8c52-5554-4f2c-8eac-ff609606e9cb","pid":2981080,"provider":"codex","session":"01a14e33-e7dc-7f11-896d-cc8d6a1c24a8","start":"20132575","token":"9229f706ac6aec69b0c3a4f13b440d4152f6c305c5f8571194c2420dbb8d0540"}
branch: task/gaid-notebook-review--notes-server
target: task/gaid-notebook-review
parent: gaid-notebook-review
---
# gaid-notebook-review--notes-server

## Goal and done criteria
Request from the starter:

# Child unit: notes-server (parent gaid-notebook-review)

Goal: server side of GAID "research notes" (정리 노트). User decision 2026-10-18 on the parent report
reports/2026-10-18-gaid-notebook-review/index.md §6: "모두 권장으로 진행하자." (1-가 research-note-first, 2-가 the agent
writes/updates a note when an analysis has results). Read first: `docs/geo/research-notes.md` (format and behaviour)
and the IO-free contract `web/src/geo/contracts/research-notes.ts` (do not change its shapes; if something is truly
missing, add an optional field and say so in your task document).

Scope (owned files):
1. `server/src/geo/notes/` (new):
   - parser: frontmatter subset (`key: value`, `[a, b]` lists, comma lists), title fallback to the first `# ` heading,
     `## ` sections matched against RESEARCH_NOTE_SECTIONS (Korean exact, English case-insensitive; tolerate a leading
     number like `## 1. 결과`), decisions (numbered question lines; option lines `- 가) …`/`- a) …`; `(권장: …)` /
     `(recommended: …)` marks recommended + reason), problems (contract codes). Pure, unit-tested.
   - store: list `연구노트/*/index.md` (direct subfolders with a safe name: no leading `.`, no separators; ≤500 notes;
     files ≤2 MiB, larger → skipped with a problem or 413 on read), cover resolved relative to the note folder and kept
     only if it exists inside the sandbox, `supersededBy` computed across notes (effective status superseded), sessions
     from `.kady/geo/notes.json` (geoStateDir; atomic writes; malformed file → treat as empty for reads, never rewrite it
     silently on read), method from the method-trial record of the note's chats (`server/src/geo/methods/trials.ts`,
     latest session that has a trial; name from the installed method when available). Status update rewrites/inserts only
     the frontmatter `status` line (adds a minimal frontmatter block if none), atomic replace, preserves every other byte.
     Normalise paths to NFC (macOS writes NFD).
   - extension `makeResearchNoteExtension(paths, sessionId)`: on a successful lead `write`/`edit` whose path is
     `연구노트/<id>/index.md` (with or without leading `@`/`./`, NFC-normalised): record the session in notes.json and
     append to the tool result a short English notice listing format problems (skip image problems — the existing
     markdown image check reports them) and, when the folder name does not match RESEARCH_NOTE_ID, the expected
     `YYYY-MM-DD-<topic>` form. No notice when there is nothing to fix. A failure never changes the tool's own result
     (follow `server/src/geo/markdown-images.ts`). Register it in `geoSessionParts` (`server/src/geo/session.ts`).
2. Routes `server/src/geo/routes/notes.ts` registered in `server/src/geo/routes.ts`: `GET /geo/notes`,
   `GET /geo/notes/:id`, `POST /geo/notes/:id/status` (body `{status}`; 400 invalid, 404 unknown id). Project scope as
   in the other geo routes. Answers follow the contract types.
3. Agent instruction: add `RESEARCH_NOTE_RULE` to `server/src/geo/instructions.ts` and include it in GEO_INSTRUCTIONS as
   one bullet. Use this text (you may shorten, not lengthen):
   "When an analysis the user asked for has produced results, write a research note before your final reply, or update the note of the same question: `연구노트/<YYYY-MM-DD>-<topic>/index.md`, with the figures it shows copied to its `figures/`. Frontmatter: title, date, status: pending, headline (one-sentence conclusion), cover, supersedes. Sections in order: 한눈에 (table: 요청, 결론, 믿을 수 있는 정도, 결정할 일), 결과, 한 일, 한계, 결정할 일 (numbered questions, options `- 가) …`, one marked `(권장: reason)`), 근거 (links to files). In English replies use At a glance, Results, What was done, Limits, Decisions, Evidence. Research language only: no commands, tool names or ids. Keep logging notebook entries."
   Fix any test that pins the GEO_INSTRUCTIONS text or prompt size; report the added character count.
4. Hub handoff: check that a note file and its figures written in a chat appear among the handoff preview files
   (`server/src/geo/hub-handoff/builder.ts`, provenance outputs). Change nothing if they do; if they do not, make the
   smallest fix and test it.
5. Tests: `server/test/geo-notes.test.ts` (parser cases incl. English headings and malformed decisions, list/read/status,
   supersededBy, NFD path, hook notice + session mapping, routes). Add a `geo/integration-boundaries.json` seam entry
   (append-only, owner `gaid-notebook-review`) for each upstream-area file you add or edit outside `server/src/geo/`
   (e.g. the test file).

Out of scope: any web/UI file, `web/src/geo/**` (except reading the contract), notebook entries/exports, docs other than
your task document. Do not edit `docs/geo/research-notes.md`; propose changes in your task document instead.

Checks before finish: `cd server && npm run typecheck`, `npx vitest run test/geo-notes.test.ts` plus the geo tests your
change can affect (instructions/context/session/hub-handoff). The full `scripts/check` runs at parent integration; run it
too if time allows and report the result honestly. Network: raw.githubusercontent.com is blocked on this network; use
`gh api` if you need GitHub content.

Evidence in your task document: files changed, test commands and results, the final RESEARCH_NOTE_RULE text and its
length, any contract deviation. Then `task finish`.

## Current state
Implemented the server-side research notes: pure bilingual parser, bounded NFC/NFD-aware sandbox store, byte-preserving atomic status edits, lead write/edit format checks and session association, project-scoped list/read/status routes, and the exact requested agent instruction. No shared contract or web/UI changes. Hub handoff needs no source change: a real ProvenanceRecorder test verifies that lead-written notes and figures appear in preview.files. After fixing the full-check Windows path guard, final backend typecheck and 89/89 tests across 9 affected suites passed (23 note tests). RESEARCH_NOTE_RULE is the supplied 675-character text, adding 678 prompt characters. POST status returns ResearchNoteSummary directly. Parent integration and deployment have not happened; task finish reruns the declared full check before publishing this child.
## Next steps
<!-- task:closed -->
Closed 2026-10-18T09:14:08Z: ready; the parent gaid-notebook-review integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
Third full check again passed all backend tests, but two unrelated frontend tests (CSV pagination and LaTeX review/save) hit their existing 5-second timeout under host load ~43 on 32 threads (41 GiB RAM available). The previous full run passed all 1077 frontend tests. Do not change out-of-scope UI source or weaken the test timeout. Direct rerun with `--maxWorkers=2` passed both files, 13/13 tests (11.45 s). Installed Vitest source confirms VITEST_MAX_WORKERS overrides maxWorkers, so use `VITEST_MAX_WORKERS=2 task finish` for the next finish only; no persistent config change. The closed marker above is an unpublished finish intent, not evidence of successful publication.
Second task finish passed backend (1899 passed / 15 skipped) and frontend (1077 passed), then failed the distribution owner allowlist: this task's explicitly requested gaid-notebook-review owner was not registered. Both full-check failures reflected the assumption that the existing repository-wide integration guards already covered the new area. Direct source inspection confirmed a literal owner allowlist; added only gaid-notebook-review (preserving the requested boundary owner) and a self-describing boundary seam for that check file. This necessary declared-check maintenance adds geo/tests/distribution.test.mjs to the owned scope. Validate that check directly before the next finish, rather than changing the owner or weakening the guard.
First task finish full check failed on the existing win-portability source guard: direct path.relative calls in the new store/extension bypassed the repository choke point (even though they manually normalised separators). Replaced them with sandbox-fs apiRelative/isWithin; no guard weakening or upstream test edits. First full backend result: 1 failed / 1898 passed / 15 skipped, with the new notes tests passing. Rerun task finish in place; do not resume or task save between finishes.
Initial tests exposed an NFC/NFD sibling-root lookup failure; path resolution now explores both actual spellings and list deduplicates NFC ids. Test fixtures initially used the wrong ProvenanceRecorder API, a string instead of Pi content blocks, and an invalid installed-method identity; corrected against the existing sources. A 2 MiB Buffer deep-equality assertion exceeded Vitest's timeout; Buffer.equals verifies the same bytes without per-element matcher overhead. No unresolved implementation failure remains.
## Notes and decisions
Sequential decisions: preserve the IO-free contract and file-master behaviour; settle parser output before store/routes. Owned files: server/src/geo/notes/*, routes/notes.ts, routes.ts, session.ts, instructions.ts, server/test/geo-notes.test.ts and append-only boundary entries. Integration order: parser → store → hook/routes/instructions → tests. This child has no independent writer packages; tightly coupled implementation stays with this writer, with no nested child units.

### Implementation and integration evidence

- New files: server/src/geo/notes/{parser,store,extension}.ts, server/src/geo/routes/notes.ts, server/test/geo-notes.test.ts.
- Updated seams: server/src/geo/{session,routes,instructions}.ts; appended the new note test and the distribution owner-registration check entries (owner gaid-notebook-review) in geo/integration-boundaries.json. geo/tests/distribution.test.mjs registers that owner, as required by its existing allowlist. The task document is the only changed documentation.
- Public API: GET /geo/notes → ResearchNoteListResponse; GET /geo/notes/:id → ResearchNoteResponse; POST /geo/notes/:id/status → the updated ResearchNoteSummary (not a content wrapper). Invalid status → 400, unknown/unsafe id → 404, oversized direct read/status → 413.
- Oversized files are skipped in lists and explicitly rejected on direct reads/status edits. Listings retain at most 500 notes, sorted by date then updatedAt. Frontmatter status is the only rewritten line; BOM, newline style and all other bytes survive. A status edit that would cross 2 MiB is rejected before replacement. Atomic replacement failure preserves the original and removes its temporary file.
- notes.json is an object mapping NFC note ids to unique session-id arrays, oldest first. Malformed mapping reads return empty associations without writing; a subsequent hook refuses to overwrite the malformed map. Lead associations are recorded even if a later format check fails. No child hook is registered.
- Method identity/workflow/assessment come from the latest associated session with a recorded method trial; the installed method supplies its Korean name (English fallback), otherwise name is null. No trial assessment is inferred from tool success.
- No contract deviation, additional field or change to docs/geo/research-notes.md is needed. No locale strings or visible UI were changed; the new notice and instruction are model-facing English.
- Codegraph is unindexed for this exact worktree; used native reads after its explicit unavailable response.

### Agent instruction

RESEARCH_NOTE_RULE is **675 JavaScript characters**; the one bullet adds **678 characters** to GEO_INSTRUCTIONS (newline + `- ` + rule). Existing tests do not pin a full prompt-size constant. Final text, exactly as requested:

> When an analysis the user asked for has produced results, write a research note before your final reply, or update the note of the same question: `연구노트/<YYYY-MM-DD>-<topic>/index.md`, with the figures it shows copied to its `figures/`. Frontmatter: title, date, status: pending, headline (one-sentence conclusion), cover, supersedes. Sections in order: 한눈에 (table: 요청, 결론, 믿을 수 있는 정도, 결정할 일), 결과, 한 일, 한계, 결정할 일 (numbered questions, options `- 가) …`, one marked `(권장: reason)`), 근거 (links to files). In English replies use At a glance, Results, What was done, Limits, Decisions, Evidence. Research language only: no commands, tool names or ids. Keep logging notebook entries.

### Checks

- `cd server && npm ci`: passed; no dependency or lockfile edits.
- `cd server && npm run typecheck`: final rerun passed.
- `cd server && npx vitest run test/geo-notes.test.ts`: 23/23 passed, including bilingual parser/malformed decisions, list/read/status and limits, NFD, supersession, corrupt-map preservation, installed/uninstalled method attribution, hook notices and session mapping, project routes and actual provenance-to-hub preview.
- Affected regression command after the portability fix: `cd server && npx vitest run test/geo-notes.test.ts test/win-portability.test.ts test/geo-context.test.ts test/geo-reply-language.test.ts test/geo-markdown-images.test.ts test/geo-hub-handoff.test.ts test/geo-methods.test.ts test/geo-read-hints.test.ts test/session-registry.test.ts`. Final rerun: 9/9 files, 89/89 tests passed (49.70 s). Backend typecheck also passed after that fix.
- `git diff --check` and parsing geo/integration-boundaries.json: passed. Final source/test files reviewed; no out-of-scope edits.
- Full `scripts/check` via first task finish: failed only the existing direct-path.relative source guard (1898 backend tests passed, 15 skipped). Fixed with apiRelative/isWithin and verified the guard in the focused command above. The rerun task finish executes the full declared check and stores its result in the CLI receipt; do not infer full-suite success from the focused tests.
- Second full check: backend 1899 passed / 15 skipped; frontend 1077 passed; launcher dependency check passed; distribution 47 passed / 1 skipped / 1 failed (new owner missing from its literal allowlist). Only that registration is changed for the next finish; earlier component behaviour is unchanged.
- `node --test geo/tests/distribution.test.mjs`: 7/7 passed after registering the requested owner. `git diff --check`: passed. Rerun task finish in place to complete the remaining declared-check phases and publication.
- Third full check: backend 1899 passed / 15 skipped; frontend 1075 passed / 2 timed out. `cd web && npx vitest run src/components/csv-viewer.test.tsx src/components/latex/latex-editor.test.tsx --maxWorkers=2`: 2 files / 13 tests passed with no source edits. Next full check uses temporary VITEST_MAX_WORKERS=2, not a changed timeout or skipped test.
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
