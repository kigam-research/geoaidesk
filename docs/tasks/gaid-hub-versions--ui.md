---
format: 1
status: waiting
updated: 2026-10-23T06:57:06Z
writer: {"host":"seongin3","reserved":"439122785c0ef2741fb6290719f33f7d911ae7984a2150a314072fcd11f03a42"}
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
