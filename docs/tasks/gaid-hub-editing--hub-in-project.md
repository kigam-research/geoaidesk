---
format: 1
status: active
updated: 2026-10-20T08:40:28Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"c359215c-e879-4d90-a057-edcee1bddc36","pid":2584475,"provider":"codex","session":"01a15877-cef2-7143-9188-68e06ebafa16","start":"37354718","token":"8691512afe8ffc731b44bed2379aa7dd89fc4e8eded71cb9167c4bdbd3dfa27d"}
branch: task/gaid-hub-editing--hub-in-project
target: task/gaid-hub-editing
parent: gaid-hub-editing
---
# gaid-hub-editing--hub-in-project

## Goal and done criteria
Request from the starter:

# Child unit hub-in-project (parent gaid-hub-editing, geoaidesk)

Goal (user request items 1 and 2, verbatim parts): "레시피 가져오기에서 GAID 허브가 연동되어 이용자들이 GAID 허브에서 레시피를
가져올 수 있게 연동되어야 한다. skill 추가 시에도 skill_hub는 legacy이며 GAID 허브에서 스킬을 찾을 수 있게 연동되어야 한다."
Confirmed scope: (1) the Workflow panel's "레시피 가져오기" can find and import recipes from the GAID hub; (2) Settings →
Skills finds skills in the GAID hub; skill_hub becomes legacy and stays only as an "이전 skill_hub" link (user accepted this
option), not the primary path.

Current behaviour (parent's step 0, screenshots in pc74:~/data/geoaidesk/work/gaid-hub-editing/before/05-skill-add.png and
07-recipe-import.png): the recipe dialog (`web/src/geo/workspace/recipe-add.tsx`, RecipeAdd) only takes a `.geo-start.json`;
Settings → Skills → 스킬 추가 shows the "skill_hub 스킬 추가" card first (`web/src/geo/skill-hub/skill-hub.tsx`,
SkillHubInstall inside `web/src/components/skills-panel.tsx`).

Settled interfaces (do not change them; ask the parent if you need to):
- GAID hub listing: `GET /geo/hub/entries?q=` → `{ entries: HubEntry[] }` (`web/src/geo/contracts/hub-shared.ts`; client
  `sharedHub` in `web/src/geo/hub/shared-api.ts`, import it, do not edit it). `HubEntry.recipe` (new, parent commit 77d08ce)
  is true when the latest revision carries a Workflow with 레시피 defaults. All 5 entries in the trial data have it.
- Install into a project: `POST /geo/hub/entries/:id/install` `{ projectId, acknowledged: true, revision }` → InstallResult
  (`install.methodKey`, `workflowId`, `recipeId`). Installed methods appear in the Workflow panel through `useMethodRows`
  (`web/src/geo/methods/`); `openMethodSetup` (`web/src/geo/hub/handoff.ts`) opens their start settings.
- Do not edit `web/src/geo/hub/*`, `server/src/geo/hub-shared/*`, `server/src/geo/authoring/*` (parent and sibling own them).

Design to implement:
1. A small reusable hub picker (new folder `web/src/geo/hub-picker/`): search box + result list of hub entries (title,
   tagline one line, author, ★ count, 판 n, at most three badges), loading/empty/error states, an optional filter (recipes
   only). Locale namespace `hubPicker` (new `web/src/geo/locales/hubPicker/{ko,en}.json`, collected by
   `web/src/geo/locales/index.ts`).
2. Recipe import: RecipeAdd dialog offers "GAID 허브에서 찾기" first and "파일에서 가져오기" second (existing file flow
   unchanged). Choosing a hub entry shows what will happen (installs the method into the current project and opens its
   start settings with the 레시피 defaults), the same install acknowledgement as the hub's "내 프로젝트에서 시험"
   (`hub` text `trial.consent` wording; put your own string in your namespace), then installs (pinned to the shown revision),
   refreshes the method rows and opens the start settings. Show an already-installed state if the method is already in
   the project (the methods list tells you).
3. Settings → Skills: the first card becomes "GAID 허브에서 스킬 찾기" with the picker; "미리보기" sends the entry to the
   existing preview → acknowledgement → install gate of SkillsPanel (unchanged gate). Server: extend
   `POST /geo/skill-hub/preview` (`server/src/geo/routes/skill-hub.ts`, `previewSkillHub` in `server/src/geo/skill-hub.ts`)
   with `{ hubEntry: { id, revision }, scope }`: read the package bytes from the shared hub store on this server
   (`SharedHubStore` in `server/src/geo/hub-shared/store.ts`, file `packages/<revision>.tar.gz`; import, do not edit) and run
   the same staging/verification as an upload; origin kind `gaid-hub` with entry id and revision. The old site link, page URL
   and `.tar.gz` inputs move behind one "이전 skill_hub" disclosure/link (collapsed by default).
4. Update AGENTS.md lines for skill_hub install / Workflow panel to describe the new primary path (keep it short).

Rules: read AGENTS.md (UI guide `docs/design/ui-guide.md` sections 1, 9 and the components you touch; copy rules
`geo/copy/gaid-writing.md`, `terminology.csv`; all visible strings in locale catalogues, Korean first). Tests: add focused
vitest tests for the picker filter/states, the RecipeAdd hub path and the server preview by hub entry (follow existing
`skill-hub.test.tsx`, `server/test/*skill-hub*`). Run `cd server && npm run typecheck && npx vitest run <your tests>`,
`cd web && npx tsc --noEmit && npx vitest run <your tests>`, `node geo/copy/validate-copy.mjs web/src/geo/locales`,
`node geo/ui/check-ui.mjs`. The full `scripts/check` runs at the parent.
Screenshots: Korean 1440x900 and 1280x800 of the recipe dialog (hub list + selected entry) and the Skills card, on your own
trial app (systemd-run --user, own ports e.g. 3381/18381, GAID_HOME a copy of
pc74:~/data/geoaidesk/work/gaid-hub-editing/home under ~/data/geoaidesk/work/gaid-hub-editing--hub-in-project/; never
~/.geoaidesk, never inside the repo; playwright-cli skill; set localStorage `gaid:hub-user` and `gaid:locale`=ko). Network:
raw.githubusercontent.com is blocked. Deliver: commits via `task save`, then `task finish`; in your task document's
Current state list the string ids added/changed (ko/en), the UI rule ids followed or broken, screenshot paths (small PNGs
also copied to reports/2026-10-20-gaid-hub-editing/figures/ with names p1-*.png) and a short Korean section text for the
parent's report.

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
