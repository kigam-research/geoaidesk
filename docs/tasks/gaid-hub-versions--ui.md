---
format: 1
status: active
updated: 2026-10-23T07:11:46Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"85dddf2d-e5cf-4fd4-9e09-1bd517612fc9","pid":2306567,"provider":"codex","session":"01a1678c-afff-7a90-bcc6-4c8ff80df8f6","start":"62657466","token":"439122785c0ef2741fb6290719f33f7d911ae7984a2150a314072fcd11f03a42"}
branch: task/gaid-hub-versions--ui
target: task/gaid-hub-versions
parent: gaid-hub-versions
---
# gaid-hub-versions--ui

## Goal and done criteria
Request from the starter:

# Goal: ui — screens and copy for hub Workflow removal and versions

Parent unit: gaid-hub-versions (GeoAIDesk). The parent writer already changed contracts and the server (commit 756004dd on
task/gaid-hub-versions). You own the web screens and the researcher-facing copy. Read AGENTS.md (sections "Workflow model",
"GAID hub", "Institute hub server", "UI copy and locales", "UI guide v2") and the parent task document
docs/tasks/gaid-hub-versions.md (Goal, decisions 1-6, Current state) first.

User decisions (verbatim request and answers are in the parent task document):
- 2. Removal: the registrant and administrators can remove a registered Workflow; it disappears from hub lists; an
  administrator can restore it; copies already installed in projects stay.
- 3. Term: use the English word "version" on Korean screens too (not 버전, not 판); English screens "version". This replaces
  the 2026-10-20 term 판.
- 4. Existing revisions 1, 2, 3 … read 0.1.0, 0.1.1, 0.1.2 … (the server already fills `revisions[].version` in every HubEntry).
- 5. The registrant chooses the version when registering an update: patch (0.1.x → 0.1.x+1), minor (0.x → 0.x+1.0), major
  (main release 1.0.0, later 2.0.0 …).
- 6. Drafts carry no version and show 초안.

Contract (do not change the server or contracts; ask the parent via your task document if something is missing):
- `web/src/geo/contracts/hub-version.ts`: `HubVersionBump`, `HUB_VERSION_BUMPS`, `FIRST_HUB_VERSION`, `nextHubVersions(current)`,
  `hubVersionOf(entry, revision?)`, `hubRefVersion(ref)` (install origins / draft links without a version), `legacyHubVersion`.
  Import it directly (hub-shared.ts does not re-export it).
- `web/src/geo/contracts/hub-shared.ts`: `HubEntryRevision.version`, `HubEntry.removed` (`HubRemoval {at, by, byId?, reason}`,
  only in the removed list), `HubMe.admin`, `RegisterBody.bump`, `RemoveEntryBody { reason? ≤500 }`, routes
  `POST /geo/hub/entries/:id/remove` (204; 403 not allowed; 409 already removed), `GET /geo/hub/removed` → `{ entries }` (what
  the caller may restore: hub server admin all; local store without a hub server: the registrant their own; others []),
  `POST /geo/hub/entries/:id/restore` → HubEntry.
- `MethodOrigin.hubEntry.version?`, `LocalMethodSummary.hubVersion` (null → show 초안), `HubEntryLink.version?` (use
  `hubRefVersion(link)`), skill rows `SkillInfo.workflow.version` (already wired in skills-panel.tsx), `WorkflowDoc.version`
  (workflow-doc.ts, workflow-card.tsx and the `workflowDoc` locale namespace are already done by the parent — leave them).

Do:
1. Hub entry page (`web/src/geo/hub/shared-entry.tsx` and its dialogs): for `entry.mine || me.admin`, an action to remove the
   Workflow from the hub, behind a confirm dialog that names it and states: it disappears from the hub lists, copies already
   installed in projects stay, an administrator can restore it (without a hub server: the registrant restores it from the
   removed list). Optional reason (≤500 chars). On success go back to the hub list and refresh lists/sidebar counts.
2. A removed list in the hub (a hub place such as `#hub/removed` in `web/src/geo/hub/location.ts`, an item in
   `hub-sidebar.tsx` shown when `me.admin` or the list is non-empty): rows with title, version, author, removed by/when/reason
   and a restore action → refresh.
3. Registration (`register` dialog / registration preview bar): first registration states version 0.1.0; an update offers
   patch / minor / major with the resulting version shown (from `nextHubVersions(current)`), default patch, and explains
   major as the main release when the current major is 0 (1.0.0). Send `bump` in RegisterBody.
4. Every place a hub Workflow revision is shown as "{n}판" shows "version x.y.z" instead: hub browse cards, entry page,
   revision history rows, comments' revision if shown, picker (`web/src/geo/hub-picker/`), install preview
   (`web/src/geo/skill-hub/install-preview.tsx`), methods/Workflow detail (`web/src/geo/methods/`), start settings, handoff,
   draft step ("registered"/"update" lines: use the entry's version; the "edit"/"copy" draft banners: `hubRefVersion(link)`;
   say the next version is chosen at registration). Drafts and non-hub packages show 초안, never a draft/package number as 판.
5. Hub skills (namespaces `hubSkills`, `skillHub`, `workspace` hub-skill lines, `workflowView.hubRevision`/`other-revision`):
   term change only, "{revision}판" → "version {revision}" (hub skill revisions stay integers; semver for hub skills is out of
   scope). `hubFeeds.release` ("{tag} 판"): choose wording under the copy rules without 판.
6. Glossary/terminology: `geo/copy/terminology.csv` gets a `version` row (definition: registered Workflow version, starts at
   0.1.0, registrant picks patch/minor/major, 1.0.0 = main release; note gaid-hub-versions 2026-10-23) with 판 forbidden if the
   validator allows it without breaking unrelated strings (check `버전`/`판` elsewhere; report what you chose). Update the
   hub glossary entry in `hub/ko.json`/`en.json` (`term: "판"`) and the hub skill terminology row wording (판 → version).
7. Copy rules: read geo/copy/gaid-writing.md and terminology.csv first; Korean first, English with the same meaning; buttons
   name the next action; list string ids with ko/en before→after in your task document.
8. UI guide v2 (docs/design/ui-guide.md sections 1, 2, 10 and the components you touch): tokens only, destructive action
   styling per the guide. Korean screenshots of the changed screens (entry page with remove action + confirm dialog, removed
   list, registration version choice) in both styles (계측 default, 도폭 via `data-style="mapsheet"`) and both themes at
   1440×900 and 1280×800, saved outside Git under ~/data/geoaidesk/work/gaid-hub-versions/screenshots/; put a few small
   decision-relevant PNGs (≤ 300 KB each) in reports/2026-10-23-gaid-hub-versions/figures/ and list rule ids followed/broken
   in your task document. Run the app with `KADY_PROJECTS_ROOT=~/data/geoaidesk/work/gaid-hub-versions/projects`,
   `GAID_HUB_SHARED_DIR=~/data/geoaidesk/work/gaid-hub-versions/hub-shared` and a free port pair; never touch the review
   app (ports 3000/18000) or deployed services. Login-free checks: playwright-cli skill.
9. Tests: update/add web vitest tests for the remove/restore flow and version choice; `cd web && npx tsc --noEmit && npm test`
   must pass; `node geo/copy/validate-copy.mjs web/src/geo/locales` and `node geo/ui/check-ui.mjs` must pass.

Do not edit: server/**, web/src/geo/contracts/**, web/src/geo/workflow/workflow-card.tsx, locales/workflowDoc, AGENTS.md (the
parent updates AGENTS.md and writes the report index.md). Network: raw.githubusercontent.com is blocked on the KIGAM network.
Evidence to return in your task document: changed files, string ids before→after, test/check commands with results,
screenshot paths, open questions. Finish with `task finish`.

## Current state
Implementation complete, verification in progress: removal dialog, removed Workflow list and hash route, sidebar visibility/counts, registration patch/minor/major choices, registered version display and draft labels. No server/contracts edits. Codegraph is unavailable for this exact worktree (unindexed); relevant native files were read.

Sequential decisions: preserve revision numbers for transport, resolve registered display through hubVersionOf/hubRefVersion, never show package build versions as registered versions. This child owns web screens/locales plus terminology and page.tsx one-line seam; parent owns contracts/server/report. Integration order: UI implementation, web tests and typecheck, copy/UI checks, isolated screenshots, finish into parent. No delegated workers.

Backend contract follow-up: basedOn.version is now supplied by parent 8cd0ba6d (merged). Requested version fields for hub skill usedBy/origin Workflow references; UI handles older refs with hubRefVersion.

Initial dependency state: this worktree had no web/server node_modules. npm ci is now installed in both (server by task sync; web by npm ci, 13 s). Two tsc invocations found the unrelated npx tsc placeholder (root, then web); stop retrying compiler until npm ci installs the declared dependencies. task job refused dirty source; save this checkpoint before installing.
## Next steps
1. Web typecheck passed; focused 7-file suite passed 51 tests. Full web suite running, then recheck changed expectations.
2. Capture Korean screens in the isolated app; finish after declared checks.
## Failed approaches
- `task sync` merged parent commit 8cd0ba6d, then ran the full scripts/check. Its server suite reported the pre-existing parent-owned workflow-doc expected-version failure. Stopped that duplicate full check with SIGINT (exit 130) after reporting it to parent; no integration was claimed. Parent owns the server fix and final full check.
- Initial web full test run finds only old wording expectations so far; updating them rather than changing implementation back.

## Notes and decisions
- `판` is not a globally forbidden glossary substring: unrelated strings use 판단, 판정, 출판. `버전` is a forbidden variant; the version contexts owned here use version.
- Asked parent to supply HubEntry.basedOn.version (currently only revision); legacy mapping is not enough after minor/major updates. Trial headings will omit package numbers because MethodTrial has no registered version.
- UI guide rules: P2/P3/P5/P9, I5/I7/I8/I9, B1/B3, D1/D2, A1/A2/A5, F5/F7, R1/R2, V1. New controls use existing tokens and dialog/button components.

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
- /home/seongin3/data/geoaidesk/runs/gaid-hub-versions--ui-20261023T071019.838626Z/receipt.json
  - disposition: {"evidence":[],"reason":"Isolated UI test backend restarted with KADY_FRONTEND_PORT=3137 to permit the test origin.","recorded":"2026-10-23T07:11:29Z","state":"cancelled"}
- /home/seongin3/data/geoaidesk/runs/gaid-hub-versions--ui-20261023T071038.935980Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
