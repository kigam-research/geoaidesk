---
format: 1
status: active
updated: 2026-10-22T09:02:30Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"ea29dd8e-e163-4285-9af2-1aac21c96dfa","pid":1968478,"provider":"codex","session":"01a162d8-d0bb-7e81-b02f-224c6e0dcbbf","start":"54767775","token":"4d7a2652360ec828d71dd5cc78a2e5098093c044936d8b4a229d502998c372fe"}
branch: task/gaid-hub-server-trial--skills-server
target: task/gaid-hub-server-trial
parent: gaid-hub-server-trial
---
# gaid-hub-server-trial--skills-server

## Goal and done criteria
Request from the starter:

# Child unit: server side of hub skill records on the institute GAID hub server

Parent: gaid-hub-server-trial (writer: Claude orchestrator). User's request (verbatim, to the hub): "남은 항목 중 정해야 하는 항목은 권장 방식으로 진행하자."
Item answered: gaid-backend#3 가) "move hub skill records (gaid-hub-skills shelf) to the hub server the same way as HubRecordStore entries."

## Goal
Implement the hub server side of the hub skill shelf so researchers logged in to an institute hub server share skills through it.
The interface is settled and committed on the parent branch (read these first, do not change their semantics):
- `server/src/geo/hub-skills/records.ts`: `HubSkillRecordStore` (the contract every store implements; doc comments are the rules),
  `StoredHubSkill`, `validName`, `revisionState`, `shareable`, `skillOwnerId`, `revisionRegistrantId`, `visibleSkill`, `ReviewInput`.
- `server/src/geo/hub-server/protocol.ts`: section "Hub skill shelf" (wire routes, statuses).
- `web/src/geo/contracts/hub-skills.ts`: record shapes (`HubSkill`, `HubSkillRevision`, `HubSkillReview` with `byId`, `verified`).
- Existing local implementation for behaviour reference: `server/src/geo/hub-skills/{store,register,review,view}.ts` (the parent
  is rewriting these concurrently; read them, do not edit them).
- Pattern to follow exactly: `server/src/geo/hub-server/records.ts` (`SQLiteHubStore` for Workflow entries), `core.ts`
  (migrations, blobs, tx, audit), `index.ts` (routes), `import.ts`, `backup.ts`. Operator guide `docs/geo/hub-server.md`.

## Scope (files you own)
1. `server/src/geo/hub-server/core.ts`: migration 2 adding tables for skills (suggested: `hub_skills(id PK, record, author_id
   REFERENCES accounts, updated_at)`, `hub_skill_archives(skill_id, revision, sha256, size, uploader_id REFERENCES accounts,
   PK(skill_id,revision))`, `hub_skill_stars`, `hub_skill_comments`, `hub_skill_imports`); extend `HUB_TABLES`. Existing
   version-1 databases must upgrade in place on start (the PC74 service runs a v1 database now).
2. New `server/src/geo/hub-server/skills.ts`: `SQLiteHubSkillStore implements HubSkillRecordStore` (kind "server"),
   constructed per request with the calling account so `read`/`list`/`archive` apply `visibleSkill` for that account id;
   `shared` = the `SQLiteHubStore` of the same database. Enforce every rule in the interface doc comments server-side:
   author-only next revision, earlier revisions kept as stored (including their reviews), new revision with empty reviews,
   archive present with matching sha256/size (blob readable), folder exists, state/visibility derived, registrant fields and
   times from the actor and server clock, write-once archives with uploader reservation for new ids, 20 MiB limit, review rules
   (registrant cannot mark `checked`; replacement only for `deprecated` and must name another existing skill; note 1–4000 chars;
   `byId` = account id, `by` = display name, `verified: true`), comments bound to the latest revision (403 if not visible),
   stars keyed by account id, audit rows for every mutation. Put the review permission in one function (a later reviewer role
   narrows it; today: any account that can see the revision).
3. `server/src/geo/hub-server/index.ts`: the `/hub/v1/skills` routes exactly as in protocol.ts (archive PUT with
   `X-Content-SHA256` like entry files; content type parser already accepts application/gzip and octet-stream).
4. `server/src/geo/hub-server/backup.ts`: include skill archive blobs in the referenced-blob set; `check-backup` verifies them.
5. `server/src/geo/hub-server/import.ts`: also import `skills/<id>/` from the local shared store (`skill.json` with
   `schemaVersion: "gaid-hub-skill/v1"`, `packages/<n>.tar.gz`, `comments.jsonl`, `stars.json`) with the same author map:
   skill author and every revision registrant are required mappings (or `--unmapped-to`); review `by`, comment and star names
   map when listed, else stable `legacy-<sha256(name)>` identities with display `이전 사용자 · <name>`. Imported reviews keep
   `verified: false` (the name was unverified when recorded) and get `byId`. Keep original revision/review/comment times;
   skip unchanged re-imports via the skills import ledger, refuse changed sources, refuse id collisions; dry-run rolls back
   like entries; the result JSON gains skill counts. A source without `skills/` imports as today.
6. `docs/geo/hub-server.md`: skill shelf sections (what is stored, import, backup coverage). English.
7. Tests: server-only tests next to the existing hub server tests (`server/test/geo-hub-server*.test.ts`; find them): migration
   from a v1 database, register/next revision/author-only, visibility filtering for restricted licences, archive write-once and
   reservation, review rules, comments/stars, backup + check-backup with skill blobs, import dry-run/apply/re-run.

## Not in scope (owned by the parent; do not edit)
`server/src/geo/hub-skills/*` (except reading), `server/src/geo/hub-client/*`, `server/src/geo/hub-shared/*`,
`server/src/geo/routes/*`, `web/**`, `records.ts` and the protocol wire section. If the interface looks wrong or insufficient,
message the parent (task CLI / your task document) instead of changing it.

## Allowed actions and evidence
- Work only in your printed worktree; `task save` your commits; `task finish` when done.
- Checks: `cd server && npx tsc --noEmit` and `npx vitest run test/geo-hub-server*` (plus any test you touch); report exact
  commands and results. Full `scripts/check` is run by the parent after integration.
- Never touch the running PC74 service (`gaid-hub-server.service`), `~/data/geoaidesk/hub-server/`, or `~/.geoaidesk`. Use temp
  dirs for test homes.
- KIGAM network blocks raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"` if you need a file.
- Agent-facing text in English; user-visible server error strings stay Korean like the existing ones.

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
