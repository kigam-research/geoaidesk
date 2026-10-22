---
format: 1
status: active
updated: 2026-10-22T02:50:17Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"813b374f-6081-4e35-bb00-2a85b20c78b0","pid":2577995,"provider":"codex","session":"01a1616f-ac32-7212-a099-657c660972dd","start":"52400975","token":"036c33bc715fc3253d6171a7b69b7e96a7088ceff337e24a0d8d0d1cf2cffa5f"}
branch: task/gaid-research-visuals--records
target: task/gaid-research-visuals
parent: gaid-research-visuals
---
# gaid-research-visuals--records

## Goal and done criteria
Request from the starter:

Child B — gaid-research-visuals--records: figure records (server + web).

Goal (user decision 2026-10-22): in a research note, every figure shows how it was made (kind), which chat, script and data
produced it, whether those changed since, the latest journal check and, for AI-made figures, the target journal's policy and
a disclosure draft; the researcher can redraw it, redraw it at the target journal size, run the check, and set the kind.

Server (server/src/geo/figures/, routes server/src/geo/routes/figures.ts registered in server/src/geo/routes.ts):
1. Figures of a note: parse image links of `연구노트/<id>/index.md` (reuse server/src/geo/notes/parser.ts and the existing
   relative-path rule; caption = the `그림 N. …` line after the image when present). Project-wide list = figures referenced
   by notes (bounded 200).
2. Record per FigureRecord (contract web/src/geo/contracts/figures.ts) from server/src/provenance/lookup.ts
   artifactProvenance(): staleness, producing step, lineage inputs with roles (script by extension .py/.r/.jl/.m/.ipynb/.sh;
   image by FIGURE_EXTENSIONS; else data), changedSinceUse, incomplete when lineage.truncated or degraded. Copy resolution:
   when the note figure's producer is a copy (bash/cp-like step whose input is an image) follow that edge; otherwise, when
   the note figure has no producer, look for a recorded output with the identical sha256 elsewhere in the project and use its
   provenance (copyMatch "hash"). Read ADR decision 3 for kind derivation; generate_image steps (toolName "generate_image")
   are ai-picture. Researcher override in `.kady/geo/figures.json` keyed by path+sha256. Disclosure draft (English and Korean
   variants are fine as plain text from the step: tool, model ref, date, purpose = caption) only for kindIsAiMade.
3. Target journal `.kady/geo/figure-target.json`; journals from geo/skills/gaid-figures/assets/journals.json (child A ships
   it; until it lands use a small test fixture and read the real file when present; a missing file → empty list, never a
   crash). Policy = profile.aiPolicy[kind].
4. POST /geo/figures/check: run geo/skills/gaid-figures/scripts/check_figure.py (child A) with helperPython()
   (server/src/helpers-env.ts) under a timeout, args per child A's CLI (`<figure> --journals <file> [--journal] [--width]
   [--kind] [--use] --out <json>`), output to `.kady/geo/figure-checks/<sha256>.json`; map helper exit codes like
   api/sci-helpers.ts does. Script missing → 503 with a clear code. Paths through the sandbox resolver only; refuse
   anything outside the sandbox or under dot dirs.
5. Routes: GET /geo/figures?note=, GET /geo/figures/record?path=, PUT /geo/figures/kind, PUT /geo/figures/target,
   GET /geo/figures/journals, POST /geo/figures/check. Tests in server/test/geo-figures.test.ts with a temp project and a
   synthetic provenance log (see existing provenance tests; pass captureEnvironment: false where a recorder is built).

Web (web/src/geo/figures/, locales web/src/geo/locales/figures/{ko,en}.json):
6. `NoteFigures` component (props: projectId, noteId, onOpenFile, onOpenChat, onPrefill) for the note detail: a compact list
   of the note's figures (thumbnail with original pixels, caption, kind as text, one attention readout when stale/changed or
   a check failed) and a record pane beside it (UI guide P4 inspector/popover): 만든 곳 (chat link, script, data with changed
   marks), 점검 (target journal + width picker, results with measured vs required, CVD previews, "투고 전 최신 지침 확인"
   limit line, rules date), AI 그림 (policy for the target journal, disclosure draft with copy button, record view behind
   `기록 보기` with `.record` ids), 종류 바꾸기. Actions (one primary per view): 다시 그리기 and 저널 크기로 다시 그리기 open
   a chat prefill (web/src/lib/chat-prefill.ts; compose mode, not auto-send) naming the figure, its script and data and the
   target, and asking the agent to use the gaid-figures skill; 점검하기 calls POST check. Do NOT edit
   research-notes-panel.tsx; export the component and a short usage note — the parent wires it.
7. Dark theme: a figure whose own background is white sits on a light mat (I6); never filter or invert images.
8. Tests: component test(s) next to the code (vitest + testing-library as in web/src/geo/notes/*.test.tsx).

Owned files: server/src/geo/figures/**, server/src/geo/routes/figures.ts, one registration line in server/src/geo/routes.ts,
server/test/geo-figures*.test.ts, web/src/geo/figures/**, web/src/geo/locales/figures/**, the locale aggregator entry in
web/src/geo/locales/index.ts if a new namespace needs registering.
Evidence in your finish summary: a curl/vitest transcript of GET /geo/figures for a synthetic note with (a) a script-drawn
figure copied into the note, (b) a generate_image figure, (c) a figure with no record; tests run; what was not verified.
Common rules for this child of gaid-research-visuals (GeoAIDesk, repo kigam-research/geoaidesk):
- Read AGENTS.md of your worktree, the parent ADR docs/adr/2026-10-22-figure-records-and-connection-map.md, the parent
  proposal reports/2026-10-21-gaid-research-visuals/index.md (§3.3, §3.5, §3.7) and the IO-free contracts
  web/src/geo/contracts/figures.ts and web/src/geo/contracts/connections.ts. The contracts are settled; if you need a change,
  make the smallest additive change and say so in your finish summary.
- Work only in the files you own (listed below). Do not edit web/src/geo/notes/research-notes-panel.tsx, the library
  unit's files (server/src/geo/library/**, web/src/geo/library/**, contracts/library.ts) or other children's dirs.
- Any edit to an upstream (non-geo) file must first be listed in geo/integration-boundaries.json with owner
  gaid-research-visuals and a one-line responsibility.
- UI (if any): read docs/design/ui-guide.md v2 sections 0–2, 10, 11 and the parts you touch. Role tokens only (`--gaid-*`,
  Tailwind `gaid-*`), shared parts in web/src/geo/shell/, never branch on the style; figures/maps/images keep original
  pixels (I6, V6). Every visible string in web/src/geo/locales/<namespace>/{ko,en}.json read with t(); Korean first; read
  geo/copy/gaid-writing.md and terminology.csv; no model/tool names or ids in researcher views (R1), record-view strings end
  in `.record` (R4). `node geo/ui/check-ui.mjs` and `node geo/copy/validate-copy.mjs web/src/geo/locales` must pass.
- Network: the KIGAM network blocks raw.githubusercontent.com; use `gh api repos/OWNER/REPO/contents/PATH?ref=REF -H "Accept:
  application/vnd.github.v3.raw"` or codeload.github.com. Python only via `uv run` / the helper venv; no pip install.
- Tests: add focused vitest tests next to the existing geo tests (server/test/geo-*.test.ts, web *.test.ts(x)); run the ones
  you touch plus `cd server && npm run typecheck` and `cd web && npx tsc --noEmit`. The full scripts/check is the parent's.
- Report in your task document: what you built, owned files, checks run with results, anything not verified. Finish with
  `task finish`.

## Current state
Implemented the figure-record server and independent NoteFigures component. Provenance resolves script-drawn copies
by observed copy edges or matching recorded hashes, preserves consumed versions, derives kinds, detects input/figure
changes, and supplies caption-grounded AI disclosure drafts. Kind overrides are path+hash-scoped; target journal and
exact-byte checks are persisted separately. Missing skill/profile files degrade to a clear 503 / empty profile list.
The hidden CVD preview endpoint serves only fixed hash+variant filenames. No contract changes.

Focused checks pass: server 10 tests, component 5 tests; related suites pass (server 65 total, web 11 total). Both
TypeScript checks and UI/copy validators pass. Seventeen Korean fixture screenshots cover both styles, both themes,
1440x900 and 1280x800 (origin/check plus AI detail). Parent note-panel wiring and actual sibling checker execution
remain integration work, not verified here. The parent should consume this child with task complete after finish.
## Next steps
<!-- task:closed -->
Closed 2026-10-22T02:47:39Z: ready; the parent gaid-research-visuals integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First task finish full check: 2076 backend tests passed, 8 skipped; the sole failure was win-portability's source
  conformance check because the preview normalizer used path.relative directly. Replaced it with apiRelative, the
  repository's wire-format choke point. Focused portability + figure tests: 30 passed across 2 files; retrying finish.
- Stopped the second finish check's own process group before changing code: the final screenshot review found
  gaid-seg attached to the active tab rather than its wrapper, which missed the shared mapsheet selection rule.
  Corrected the wrapper, rechecked the 5 component tests and UI validator, and recaptured the complete matrix at
  settled CSS-transition states. No unrelated process was stopped.
- The initial copy recognizer failed to match cp at the opening quote of JSON-serialized arguments; corrected the token
  boundary and verified both observed-edge and hash-copy cases, including a hash match to another copied figure.
- The external screenshot fixture initially missed Tailwind source scanning and the public font directory; fixed the
  fixture's explicit sources/publicDir and recaptured. This was a QA harness issue, not an app styling workaround.
- Dependency job commands were refused before a receipt because the source was dirty. No job started. Local npm ci
  completed for both packages; no package manifests or locks changed.
## Notes and decisions
Owned interfaces: the FigureRecord contract remains unchanged. Server implementation precedes the component; shared
checker CLI is consumed from the sibling skill unit. This child does not create nested writers. No independent package
remains that warrants a reader; provenance and UI work are tightly coupled within this unit.

### Delivered interfaces and files
- Server: server/src/geo/figures/{store,check}.ts; server/src/geo/routes/figures.ts and its geo registration seam.
- Web: web/src/geo/figures/ (NoteFigures, redraw-message, fixed preview URL builder, export and usage README).
- Locales: new figures namespace and its locale aggregator entry. All figures.* strings are new (before: absent);
  no existing locale value changed. Examples: figures.redraw = 다시 그리기 / Redraw figure;
  figures.redrawTarget = 저널 크기로 다시 그리기 / Redraw at journal size;
  figures.runCheck = 그림 점검하기 / Check figure; figures.view.record = 기록 보기 / View record.
  Full Korean/English values are in web/src/geo/locales/figures/{ko,en}.json.
- Tests: server/test/geo-figures.test.ts and web/src/geo/figures/note-figures.test.tsx.
- The IO-free contracts were not changed. Extra additive route, requested by the parent:
  GET /geo/figures/check-preview?sha256=<64 lowercase hex>&variant=deuteranopia|protanopia|tritanopia.
  It reads only .kady/geo/figure-checks/<sha>-cvd-<variant>.png, with project scope and normal auth; no arbitrary path.
- UI guide: P2/P3/P4/P9, I6, S1, L6/L7, R1/R2/R4 and V1/V6. One filled action in origin/check; record/model/disclosure
  facts stay behind View record; no image filtering or theme branching. White corner samples choose the existing
  primary-foreground light mat token. No new accepted UI debt.

### Verification evidence
- npm test --prefix server -- --run test/geo-figures.test.ts: 10 passed. Synthetic GET /geo/figures?note=2026-10-22-analysis
  returns (a) plot.png: data-figure, script draw.py, copyMatch edge, origin chat-a; (b) ai.png: ai-picture,
  generating model retained behind record and purpose from caption; (c) unknown.png: unknown, origin null, disclosure null.
  The tests also cover hash copies, consumed-version input changes, figure staleness, kind/target mutation, missing files,
  the 200-figure bound, hidden/escaped/symlink paths, malformed-state preservation, helper exit mapping and fixed CVD names.
- npm test --prefix server -- --run test/geo-figures.test.ts test/provenance-lineage.test.ts test/geo-notes.test.ts:
  65 passed across 3 files. Own tests passed again after caption/record refinements.
- npm test --prefix web -- --run src/geo/figures/note-figures.test.tsx src/geo/notes/research-notes-panel.test.tsx:
  11 passed across 2 files. Own 5 tests passed again after refinements. Covers composer-only redraw, journal width,
  changed inputs, measured/required check results, hidden disclosure, kind override, scoped fetches and tokenized previews.
- npm run typecheck --prefix server: pass. cd web && npx tsc --noEmit: pass.
- node geo/ui/check-ui.mjs: 0 errors, 112 pre-existing accepted debt, no new debt.
- node geo/copy/validate-copy.mjs web/src/geo/locales: 0 errors, 61 existing warnings outside figures.
- git diff --check: pass. Focused web ESLint: 0 errors (native img warning is intentional: original figure pixels).
- Browser fixture uses the real component, globals.css, tokens and font with mocked API data. 17 screenshots under
  /home/seongin3/data/geoaidesk/work/gaid-research-visuals--records/visual-qa/. Original/check views cover the full
  style/theme/size matrix; AI view additionally captured at 1280x800 mapsheet dark. Inspected for section 12:
  no horizontal overflow; one primary in actionable views; visible labels and focusable native controls; record details
  collapsed; original pixels (computed filter none); white mats remain rgb(255,255,255); font loaded.
  Representative files and sha256:
  - 1280-instrument-dark-check.png: 3eaa44e4119096a9b13c403f00c42f5efa42449879be0e2c6fb995b5f03c637c
  - 1440-mapsheet-light-origin.png: 6d4acdfc5cda89544bd4c6da8fa66ed16b7554a4eb60d0ae6ce1dd663c165513

### Integration limits
- The skill directory does not exist in this child snapshot. Actual Python/journal/CVD execution is not verified here;
  helper invocation/output handling uses a fixture and mocked runner. Parent integrates the skill sibling and checks it.
- No note-panel, library, catalogue, deployment or upstream file was modified. Parent owns actual application wiring,
  full scripts/check, report screenshots in the canonical report and publication.
- The temporary browser fixture is external; its transient service and browser are stopped before finish.
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
