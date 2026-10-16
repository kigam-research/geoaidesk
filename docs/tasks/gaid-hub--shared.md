---
format: 1
status: active
updated: 2026-10-16T05:55:29Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"5ec9f772-e53c-4317-86d2-a3fcfa929f01","pid":2862681,"provider":"codex","session":"01a1432a-b5ae-7f33-944f-b94e9a46e39d","start":"1617388","token":"491aea7f6f8038cd7a0c9baf26f006c00849ba73061cccfb131ec8664caf046d"}
branch: task/gaid-hub--shared
target: task/gaid-hub
parent: gaid-hub
---
# gaid-hub--shared

## Goal and done criteria
Request from the starter:

# Child brief: `gaid-hub--shared` — shared GAID hub server (registry, folders, stars, comments, recommendations)

Parent: `gaid-hub` (geoaidesk). First `task resume gaid-hub--shared`, read AGENTS.md and the PARENT task document
`docs/tasks/gaid-hub.md` (Goal, "User feedback 2", "User decisions after mockup round 4", Orchestration plan).
Codex runs at Normal speed. Work only in your printed worktree.

## Goal
The user approved mockups where the GAID hub is the sharing and discussion space on the institute's GAID server:
researchers register methods built in the hub, browse them in topic folders, star and comment on them like GitHub, and
install a registered method into their own research project. Build the server side.

## Fixed interface (parent-owned; propose changes to the parent, do not rename)
`web/src/geo/contracts/hub-shared.ts` (types + route table) and `web/src/geo/contracts/authoring.ts` (`AuthoringProject`
now has optional `folderId` and `visuals`). Server imports them like other geo contracts.

## Scope
1. `server/src/geo/hub-shared/` store + routes, registered through a new `server/src/geo/routes/hub-shared.ts`
   (one line in `server/src/geo/routes.ts`). Store under `<KADY_PI_AGENT_DIR>/skill-hub/shared/` (env
   `GAID_HUB_SHARED_DIR` for tests): `folders.json`, `entries/<id>/entry.json`, `entries/<id>/packages/<rev>.tar.gz`
   (immutable copies), `entries/<id>/comments.jsonl` (append), `entries/<id>/stars.json` (user → true). Atomic writes,
   serialized mutations per entry (follow `server/src/geo/authoring/store.ts`).
2. Identity: header `X-GAID-User` (URL-encoded UTF-8 display name, 1–40 chars, trimmed). Mutations without it → 401
   `{error}` in Korean. `GET /geo/hub/me` echoes the decoded name or null. Do not add accounts or tokens.
3. Register (`POST /geo/hub/entries`): read the authoring project from the authoring store (export a getter from
   `server/src/geo/authoring/routes.ts` or construct `AuthoringStore` with the same root — coordinate via the store class,
   not by duplicating paths), package the chosen draft revision through `buildPackage` if no package exists for it
   (same rule as the authoring packages route: once per draft revision; refuse with 409 + CheckResult when checks fail),
   copy the archive into the entry, append a revision. One entry per authoring project (re-register = new revision).
   The entry's author is the registering user; only that user may add revisions (403 otherwise). Tags from the draft
   taxonomy tasks/methods (max 6). Cover: first image of the draft's `visuals` if present (serve via `/cover`), else null.
4. Detail: profile/workflow from the registered draft revision (stored with the entry at registration so later authoring
   edits do not change a registered revision). Comments newest last; body 1–4000 chars; author from the header.
5. Stars: toggle per user; counts.
6. Install (`POST /geo/hub/entries/:id/install`): install the latest registered package into `projectId` through the same
   gate as authoring installs (`server/src/geo/authoring/install.ts`: refactor it into a function that takes package
   bytes + slug + method identity so both callers share it; keep its protections: never overwrite a non-hub skill or a
   locally edited one). Package origin kind stays `gaid-hub`.
7. Recommended (`GET /geo/hub/recommended`): up to 4 cards: shared entries with the most stars first (stars >= 1), then
   catalogue Workflows from the pinned catalogue (`loadGeoCatalogue().workflows`, skip when the catalogue is off) to fill.
   Card images: entry cover or a catalogue Workflow image if the catalogue provides one, else null.
8. Folders: create/list with entry counts; an entry's folder must exist; a default folder "일반" exists.
9. Trials count: number of GAID trial records the server knows for installs of that entry (look at
   `server/src/geo/methods/trials.ts`; if this needs cross-project scanning, count trials in projects listed in the entry's
   install log — record installs in the entry on install). Never present it as a review.

## Tests and checks
`server/test/geo-hub-shared.test.ts` (vitest, temp dirs, fake vocabulary as in `server/test/helpers/geo-authoring.ts`):
register → detail → star toggle (two users) → comments → recommended ordering → install into a temp project → revision
by another user refused → missing user header refused. `cd server && npm run typecheck && npx vitest run
test/geo-hub-shared.test.ts test/geo-authoring*.test.ts` must pass. Prettier style as the authoring code (double quotes,
semicolons, 120 columns).

## Boundaries
- Do not edit `web/src/geo/hub/**`, locales or `web/src/app/**` (parent owns the screens and wires them).
- Do not edit `server/src/geo/authoring/{agent,prompts,package,sources}.ts` except exporting what you need; the install
  refactor in `install.ts` is yours (keep `installPackage(store, project, pkg, body, deps)` working for its callers).
- No model calls. Do not touch the user's review instance (3000/18000, ~/.geoaidesk) or the parent's dev instance
  (3330/18330). raw.githubusercontent.com is blocked.
- Record in your task document what you built, deviations and test evidence; `task finish` when done.

## Current state
- Shared server implemented: name identity; default/general and researcher-created folders; filtered registry;
  per-project registration/revisions; immutable registered package/draft/image snapshots; star counts; append-only
  revision-bound comments; up to four star-first/catalogue recommendations; acknowledged project install; trial counts.
- The live authoring store is shared through the parent's exact getter. `installPackageBytes` is the common gate;
  `installPackage` retains its signature and authoring install log. Foreign/locally edited enabled AND disabled skills
  are kept, including copies with no base hash. Origins remain `gaid-hub`.
- `npm run typecheck` passed; `npx vitest run test/geo-hub-shared.test.ts test/geo-authoring.test.ts
  test/geo-authoring-package.test.ts` passed (3 files, 25 tests). No real model calls or running-instance changes.
- First `task finish` full check: backend 166 files passed/1 skipped; 1,830 tests passed/11 skipped. Frontend stopped
  on one stale project title expectation and load-related file-preview/map viewer waits (3 files/4 tests).
- Parent explicitly authorized `project-view.test.tsx`: Choose a project → My research (approved UI title), identical
  to their local correction. Boundary entry added; other frontend code/tests are unchanged. The three affected
  frontend files pass with two workers (19 tests). No resume or task save after the failed finish.
- Parent owns screen integration and final runtime walkthrough. Parent confirmed the sibling check ended at 14:54:59;
  no sibling scripts/check process remains. Retrying full checks in place with the authorized title correction.
## Next steps
1. Rerun `task finish` in place; do not resume or save. Fix any material failure, otherwise await parent integration.

<!-- task:closed -->
Closed 2026-10-16T05:37:42Z: ready; the parent gaid-hub integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Initial typecheck caught the difference between AtlasTextInput and MethodText and an inferred optional union;
  corrected the text helper and check-result narrowing.
- Recommendation test initially copied a draft with the same slug into a second project, correctly triggering the
  existing method-name collision check. Updated the fixture's slug AND workflow/artifact local skill refs; suite passed.
- Initial full frontend check ran concurrently with sibling gaid-hub--visuals. Do not change timeout/product code to
  accommodate that load; parent confirmed load-related baseline waits and requested an in-place finish retry.
## Notes and decisions
- Sequential decisions: keep parent contracts unchanged; reuse the live AuthoringStore (no second cache); serialize
  registration by deterministic entry id, then package by authoring project; snapshot draft/images before publishing.
- Owned files: server/src/geo/hub-shared/**, routes/hub-shared.ts, test/geo-hub-shared.test.ts; additive mounting/store
  getter and install.ts refactor. Trial counting may add a lightweight record-count helper to methods/trials.ts.
- No independent work package warrants another reader; this child cannot create nested writer units.
- Integration order: store/install seam → routes → temp-directory integration tests → typecheck and authoring regression.
- Codegraph has no index for this exact worktree; using bounded native source reads instead, as instructed by its tool.
- Parent coordination applied verbatim: getAuthoringStore WeakMap code after AuthoringOptions and stores.set after
  initialization. Route mounted after authoring. No contract, frontend product, locale or lockfile edits; the single
  frontend test expectation correction was explicitly requested by the parent after the first full check.
- Image convention confirmed by parent: `cover` exclusively selects cover (fallback first available image), known node
  ids populate detail.visuals, `output:<outputId>` becomes detail.outputImages[outputId]. Additive immutable image route:
  GET /geo/hub/entries/:id/visuals/:key?revision=n. Cover/package revision queries address shared-entry revisions.
- Trials count only actual matching methodId/packageSha256 records in distinct projects from the entry install log;
  unreadable records are skipped like existing trialCounts. No 200-row list cap and no inferred scientific review.
- Storage follows AuthoringStore's single-process ownership. Atomic JSON replacement; immutable files published by
  no-overwrite hard links; per-entry serialized mutations. Malformed JSON/comment logs return 409 and stay untouched.
- Empty/invalid/missing X-GAID-User returns 401 for mutations; display names are not account authentication, per scope.
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
