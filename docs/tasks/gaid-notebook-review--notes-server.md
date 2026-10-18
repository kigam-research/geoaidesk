---
format: 1
status: active
updated: 2026-10-18T08:50:45Z
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
