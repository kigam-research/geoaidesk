---
format: 1
status: active
updated: 2026-10-22T06:03:20Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"719ab3a6-fd9a-45bf-bd3d-4ba793a8be7e","pid":173800,"provider":"codex","session":"01a16234-aa5a-7a41-8b21-6fc2461e73fb","start":"53692003","token":"fa04026f43f744274997d89765e602222bba852a5f0ef3258ad98fc0e4a91a66"}
branch: task/gaid-hub-skills--store
target: task/gaid-hub-skills
parent: gaid-hub-skills
---
# gaid-hub-skills--store

## Goal and done criteria
Request from the starter:

Child unit `store` of gaid-hub-skills (geoaidesk). Goal: server side of hub-managed skills, phase 1.

Read first (in your worktree): AGENTS.md; docs/adr/2026-10-22-hub-managed-skills.md (the decision; user chose all
recommended options 2026-10-22); web/src/geo/contracts/hub-skills.ts (the settled contract: records, states, HTTP API —
implement it; change it only if something is impossible, and say so in your task document); reports/2026-10-22-gaid-hub-skills/index.md §3.6–3.8.
Existing code to reuse: server/src/geo/hub-shared/{store,routes,edit}.ts (display-name identity X-GAID-User, folders,
stars/comments, write-once archives, atomic JSON, serial queue), server/src/geo/skill-hub.ts (`stageSkillHubPackage`,
tar reading), server/src/geo/authoring/install.ts (`installPackageBytes`: preview → acknowledged install through
`previewSkillSource`/`installStagedSkills`, never overwrite edited or foreign same-name skills), server/src/agent/skills-install.ts
(`previewSkillSource` stages a `skills` CLI source without installing), server/src/geo/methods/{package-origin,hub-pins,tree-hash}.ts
(origin kind `gaid-hub-skill` + `hubSkill` and the pure pin-state helper are already added by the parent — use them).

Scope (you own these files; anything else: ask the parent first):
- New `server/src/geo/hub-skills/**`: store under `<sharedDir>/skills/<id>/` (skill.json `gaid-hub-skill/v1`,
  packages/<rev>.tar.gz write-once, stars.json, comments.jsonl), registration from the three sources in `RegisterSkillSource`
  (project skill: origin `own` unless its install recorded an external source → `github` with source/ref/skillPath;
  workflow: bundled skill folder of a registered hub entry revision, without gaid-method.json/atlas.yaml if those are
  Workflow-package files — decide from the package format and note it; source: stage via `previewSkillSource`, choose by name,
  never install), preview (nothing stored), archive building (one root folder `<name>/`, deterministic tar if practical),
  `treeHash` = `methodTreeHash`/`hashDirectory` of the folder, per-file sha256 list, licence detection (`institute|declared|
  restricted|unknown`, known SPDX list, SKILL.md `license:`, LICENSE*/COPYING files), findings (`format`, `hidden-text`:
  HTML comments, zero-width/bidi/invisible Unicode, ≥ 8 blank lines in .md; `network`, `shell`, `package-install`,
  `credentials`, `outside-write` by line patterns in scripts and Markdown; bounded: ≤ 200 findings, excerpt ≤ 160 chars),
  visibility (non-shareable licence → author only), unique names across the hub, refuse catalogue skill names (use the
  geo catalogue index like `skillHubCatalogue()`), next revision only by revision 1's author and only when the tree changed,
  re-check the previewed `treeHash` on register, review per revision (`checked` refused when reviewer = registrant; `deprecated`
  optional `replacement` must be an existing hub skill; `suspended`), `usedBy` computed from registered hub Workflow
  snapshots whose gaid-workflow/v1 `skills[]` pin this skill (source "hub"), install-preview and install into a project
  (stage the stored archive with hash checks, write origin record kind `gaid-hub-skill` with `hubSkill {id, revision, treeHash}`,
  refuse a suspended revision, refuse foreign or edited same-name skills with the existing Korean messages style, return
  `installed: false` when the same tree is already there), read-only file view (text only, ≤ 256 KiB, path checks).
- Routes exactly as listed in the contract, registered from `server/src/geo/routes/hub-shared.ts`.
- `GET /skills` rows: add `hubSkill?: InstalledHubSkill` for skills installed from the shelf (`server/src/api/skills.ts`,
  add yourself to the existing boundaries entry for that file in geo/integration-boundaries.json with owner
  gaid-hub-skills--store) and make `server/src/geo/skill-details.ts` not mistake hub-skill rows for Workflow skills.
- Exports the parent will use (keep names stable, document them at the top of the module): the store class,
  `readHubSkillRevision(store, id, revision)`, `installHubSkillRevision(store, { skillId, revision, projectId, acknowledged }, deps)`,
  `listHubSkills(store, { q?, user? })` for authoring suggestions.
- Tests: `server/test/geo-hub-skills*.test.ts` covering the ADR acceptance list: GitHub source changes after registration
  do not change stored bytes; tampered archive/tree refused; two Workflows pin different revisions; new revision with new
  scripts keeps the old one installable; suspended revision refuses install; unknown/restricted licence hidden from others;
  reviewer = registrant refused for `checked`; same-name foreign/edited project skill not overwritten. Use temp dirs
  (GAID_HUB_SHARED_DIR, KADY_PROJECTS_ROOT per vitest config) and a local folder or fake for the `skills` CLI source;
  no network.

Out of scope: web UI (sibling child `ui`), Workflow install/readiness/authoring (parent). Keep files small and readable
like the surrounding code. Own data under ~/data/geoaidesk/work/gaid-hub-skills--store/ if you run the app; never touch
~/.geoaidesk. KIGAM network blocks raw.githubusercontent.com (use gh api or codeload if you need GitHub).
Checks before finish: `cd server && npx tsc --noEmit && npx vitest run test/geo-hub-skills*.test.ts test/geo-hub-shared.test.ts test/geo-skill-origin.test.ts`;
run the full `npm test` in server once. Write a short section for the parent report under `## Report` notes in your task
document (what exists, how verified, limits); no report of your own. Finish with `task finish`.

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
