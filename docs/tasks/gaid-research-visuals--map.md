---
format: 1
status: active
updated: 2026-10-22T02:48:56Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"38934232-bc69-4c6e-85ce-d9508ca7b59d","pid":2583953,"provider":"codex","session":"01a1616f-fbe3-7443-b1ed-dcbcf3b16315","start":"52403024","token":"d0d836486e1bf422e38ed51e1a06432ed72a99c80a8e5ce015532b50e7faf79f"}
branch: task/gaid-research-visuals--map
target: task/gaid-research-visuals
parent: gaid-research-visuals
---
# gaid-research-visuals--map

## Goal and done criteria
Request from the starter:

Child C — gaid-research-visuals--map: the connection map (server + web).

Goal (user decision 2026-10-22): from a research note, a figure or a library paper the researcher opens a map of the
connections around it inside their own work: papers ↔ notes ↔ figures ↔ files (scripts, data) ↔ chats ↔ Workflows. It
answers "this figure came from which data and which paper's method" and "which notes and figures used this paper".

Server (server/src/geo/connections/, route GET /geo/connections in server/src/geo/routes/connections.ts registered with one
line in server/src/geo/routes.ts): build ConnectionMapResponse (contract web/src/geo/contracts/connections.ts) per request,
bounded by CONNECTION_LIMITS, from existing sources only (read-only imports, no edits to them):
- note citations and library items: server/src/geo/library/uses.ts (projectNoteCitations, library store lookups; citation key
  → library item; unresolved keys become no node);
- note ↔ chat: the sessions list of the research note (server/src/geo/notes/store.ts; never show session ids as text — chat
  titles come from the session registry/history title helpers if available, else a neutral `채팅` label + date);
- note → figure: image links in the note (server/src/geo/notes/parser.ts);
- figure/file lineage: server/src/provenance/lookup.ts artifactProvenance().lineage (edge confidence observed/inferred;
  attention "changed" from changedSinceUse/staleness, "missing" when the file is gone);
- Workflow ← chat: method trial records (server/src/geo/methods/, `.kady/geo/method-trials/`); paper → Workflow: LibraryUse
  kind "workflow" for an item.
Depth 1 or 2 from the focus; truncated when the node limit cuts. Tests: server/test/geo-connections.test.ts with a temp project
(synthetic note, provenance log, library fixture).

Web (web/src/geo/connections/, locales web/src/geo/locales/connections/{ko,en}.json):
- Add dependencies @xyflow/react and @dagrejs/dagre (MIT; exact pins) to web/package.json + lock; you are the
  dependency-lock owner for web/package.json/web/package-lock.json during this child (update that boundary entry). Add both
  to THIRD_PARTY_NOTICES.md only if child A has not touched it yet — otherwise list them in your finish summary for the
  parent.
- `ConnectionMapPane` (props: projectId, focus, onOpenNote, onOpenFile, onOpenChat, onOpenPaper, onOpenWorkflow, onClose):
  dagre left-to-right layout, nodes as small cards (title ≤ 1 line, kind as text, one attention readout), edge labels by
  kind in Korean (인용함, 씀, 들어감, 그림, 씀(자료) …; pick wording with geo/copy/terminology.csv), inferred edges dashed,
  focus node marked with the identity's selection cue; depth toggle 1/2; legend beside the map without scrolling; keyboard
  focus and an accessible list alternative (A rules). Clicking a node selects it and shows an action (열기) — no navigation
  on single click. Re-centre on a node via 이 항목 중심으로 보기.
- `ConnectionMapButton` (props: focus, label?) that opens the pane in a sheet/side pane (UI guide D rules).
- Do NOT edit research-notes-panel.tsx, web/src/geo/figures/** or web/src/geo/library/**; the parent wires entry points.
- Tests: pure layout/mapping unit tests + one component test.

Owned files: server/src/geo/connections/**, server/src/geo/routes/connections.ts, one line in server/src/geo/routes.ts,
server/test/geo-connections*.test.ts, web/src/geo/connections/**, web/src/geo/locales/connections/**, web/package.json,
web/package-lock.json, the locale aggregator entry if needed, geo/integration-boundaries.json entries for the deps.
Evidence in your finish summary: GET /geo/connections output for focus note:/figure:/paper: on the synthetic project; tests run;
not verified items.
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
Implemented the connection-map API and reusable pane/button. Final CLI publication awaits a full declared-check retry after the parent-authorized distribution-owner registration fix. No settled contract changes. Existing note/library/provenance/trial sources stay read-only; no graph master store or model calls were added.

- GET /geo/connections supports 1/2 hops and 80 returned nodes. It resolves citation aliases, omits unresolved citations, joins note chats and local images (including missing covers), reads version-aware lineage, preserves inferred confidence, omits model-declared edges, and marks changed/missing/retracted items. Invisible/outside-sandbox paths are rejected. An 81-artifact lineage lookup safety budget also marks a response truncated when exhausted.
- Library Workflow links use the packaged methodId when present, joining trial identity; otherwise the existing entryId/authoringId is retained. Chat history names come from SessionManager.list; missing history gets a localized neutral label and recorded date, never an identifier as its title.
- Web: LR dagre layout with React Flow, centre/index cue, one-line titles and one attention readout, dashed inferred links, depth switch, selected-item actions, recentering, keyboard zoom controls, accessible list/tab switching, loading/retry/empty/truncation states. Button opens a non-modal side pane with Escape/focus restoration. Theme and style are token-driven, not branched. React Flow attribution remains visible.

Checks completed:
- First task finish ran the full declared suite automatically: backend 184 files passed/1 skipped, 2073 tests passed/8 skipped; frontend 178 files/1147 tests passed; launcher check passed. Distribution checks stopped on the missing gaid-research-visuals owner in the fixed allow-list. The parent explicitly authorized adding that owner and the test seam in this child; the focused distribution test passed (7/7), followed by task finish in place. Remaining full distribution/environment/production checks are not yet passed.
- server: npx vitest run test/geo-connections.test.ts — 6 passed; npm run typecheck — passed.
- web: focused layout/pane vitest files — 3 passed; npx eslint src/geo/connections/*.ts src/geo/connections/*.tsx — passed; npx tsc --noEmit — passed (including the final font adjustment).
- node geo/ui/check-ui.mjs — 0 errors, unchanged 112 accepted debt entries.
- node geo/copy/validate-copy.mjs web/src/geo/locales — 0 errors, 62 warnings. One new warning is the expressly requested centre.button wording, “이 항목 중심으로 보기”; retained intentionally.
- git diff --check — passed.
- Browser standalone harness imports the real pane/button and serves a captured synthetic GET response. Keyboard selection does not navigate; explicit file open calls its callback; arrow-key map/list switch, list selection, Escape and trigger focus restoration passed. Fresh browser reload: 0 errors, 0 warnings. Korean screenshots cover both styles × both themes × 1440×900/1280×800; all 8 checks show visible/no-scroll legend and no pane overflow. Integrated note/library/figure entry points and full scripts/check remain the parent's checks.

Synthetic GET evidence (depth 2): note focus returns 6 nodes/5 edges; figure focus 6/5; paper focus 4/3; all truncated=false. Re-run the server test with CONNECTION_EVIDENCE_DIR to capture exact JSON. External evidence folder: /home/seongin3/data/geoaidesk/work/gaid-research-visuals--map/evidence/ (note.json, figure.json, paper.json, browser-check.log, copy-check.log). Screenshot folder: /home/seongin3/data/geoaidesk/work/gaid-research-visuals--map/playwright/; files instrument|mapsheet-light|dark-WIDTHxHEIGHT.png and list-keyboard-1280x800.png. Parent should copy decision-relevant small images into its canonical report, then run humanizer/review-copy there.

## Next steps
<!-- task:closed -->
Closed 2026-10-22T02:41:29Z: ready; the parent gaid-research-visuals integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First task finish stopped at geo/tests/distribution.test.mjs because the new required seam owner was not in its static allow-list. Parent authorization (2026-10-22) extended ownership to that single allow-list registration and its boundary entry; no test expectations for application behavior changed.
- Initial web import named a nonexistent useProjectId; corrected to existing useProjectScopeId. Effect-based reset failed the React lint rule; keyed per-entry state plus request-keyed asynchronous results now pass without suppressions. Initial component test assumed whitespace between adjacent spans; explicit localized accessible labels fixed the ambiguity. A test-evidence command was first run from repo root with server-relative include rules, found no tests, then was rerun successfully from server/.
## Notes and decisions
UI rules followed: D1/D2 (non-modal pane), S1/S3/S7 (role colours, labelled attention/selection, states), G1/G6 (compact titles/index cue), N6/A1–A3 (keyboard and accessible list), MAP1 (adjacent visible legend), R1/R2 (no internal identifiers in titles or edge accessible names; no raw error). No new baseline debt. Zoomable graph labels use 15–16 px source text; the list retains ordinary UI text when zoomed out.

Copy: all connections.* ids are additions (before: absent); after values are the paired ko/en catalogues. Primary additions: connections.show.button = 연결 지도 열기 / Open connection map; connections.centre.button = 이 항목 중심으로 보기 / Centre on item; connections.truncated.limit = 80개를 넘는 항목은 표시하지 않습니다. 다른 항목을 중심으로 범위를 좁히세요. / Only up to 80 items are shown. Centre on another item to narrow the range. No existing copy changed.

Integration: import from web/src/geo/connections/index.ts. ConnectionMapButton retains focus,label and adds optional projectId and onOpenNote/File/Chat/Paper/Workflow callbacks; pass all applicable callbacks. Workflow refs are packaged methodIds where available, else existing hub entry/draft ids. No callback is guessed and no navigation occurs on a single card click.
Sequential ownership: this child owns server connections, the route registration seam, web connections/locales and web dependency locks. Shared contracts stay unchanged. No nested writers; the server and web are tightly coupled and implemented here. Parent owns note/library/figure entry points, full checks and the canonical report.
Dependency pins selected from npm registry metadata: @xyflow/react 12.12.0 and @dagrejs/dagre 3.1.1, both MIT. Third-party notice additions will be reported to the parent to avoid overlapping child A.
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
