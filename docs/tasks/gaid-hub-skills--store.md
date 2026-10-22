---
format: 1
status: active
updated: 2026-10-22T06:33:27Z
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
Server shelf implementation is complete and pushed: immutable revisions, three-source preview/registration, licence/findings, review/visibility, Workflow usedBy, read-only files, acknowledged revision installs and installed skill-row metadata. Parent branch changes were merged by task finish; integration of this child into the parent and deployment remain separate.
Verification: server TypeScript check and 30 targeted tests passed. Full server job 2 at f1dd6c30178b succeeded (exit 0): 184 files and 2082 tests passed; 1 file and 8 tests skipped. The failed helper-less job 1 is superseded by job 2; no source workaround was needed.
First task finish required check (c950770ccedb): server TypeScript and 2085 tests passed (8 skipped), web 1156 tests passed. Only distribution ownership metadata failed; correction is in progress.
Stable integration API: server/src/geo/hub-skills/index.ts exports HubSkillStore, readHubSkillRevision -> {skill, revision, archive}, installHubSkillRevision and listHubSkills. No contract changes.

## Next steps
<!-- task:closed -->
Closed 2026-10-22T06:24:38Z: ready; the parent gaid-hub-skills integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First task finish merged parent f962590b and ran scripts/check. Server: 2085 passed, 8 skipped; web: 1156 passed. Distribution failed only because concatenating two owner ids in integration-boundaries.json is not a valid allowlisted owner. Restore the historical seam and add a separate shelf-owned seam; use unit-level owner gaid-hub-skills and merge parent allowlist commit 349f50a6163e (do not edit the test in this child). Fix in place and rerun task finish, without task save/resume in between.
- Full-suite job 1 omitted helper environment setup. All reported failures are missing geopandas/table/Office helper dependencies. Correct the job command before repeating; do not edit unrelated source code.
- New /skills/all test initially wrapped app.inject with withActiveProject; Fastify request context did not inherit it. Replaced it with the same onRequest scope hook used by the server; all 13 shelf tests passed.
## Notes and decisions
- Sequential work: store and archive interfaces first, then registration, install/routes, row annotations, acceptance tests. All owned files stay with this writer; no child writers.
- Public exports agreed with parent in server/src/geo/hub-skills/index.ts; readHubSkillRevision returns {skill, revision, archive}.
- Archive gzip comments carry a deterministic revision identity. Reverting to an older tree cannot overwrite that older installed revision's package-origin record.
- Parent boundary decision: keep the historical gaid-workflow-model seam unchanged and add a separate server/src/api/skills.ts seam owned by gaid-hub-skills. Parent owns the allowlist update (349f50a6163e).
- Parent authorized the same one-line PRIVATE export in authoring/package.ts as its commit 580d4339b331; applied locally to avoid importing unrelated parent authoring changes before full tests.
- Parent decisions: the builder's exact PRIVATE marker is absent for licence detection (import its constant); any other unknown declaration stays unknown. Install/install-preview do not require a display name, but anonymous users can install only publicly visible revisions. Other mutations retain the name gate.
- Latest non-shareable licences hide the entire skill from other names; old non-shareable revisions remain hidden after a later release.
- Workflow extraction removes root gaid-method.json and atlas.yaml, which the current builder generates as Workflow metadata; scripts, references, notices and SKILL.md remain.
## Open items
None.

## Report
Parent report notes (no separate child report):
- The server shelf stores immutable, hash-checked skill revisions with source provenance, file inventories, licence records, findings and unverified display-name reviews. A researcher can register a project skill, extract the bundled skill from a registered Workflow, or stage a skills CLI source without installing it.
- Public reads hide restricted/unknown latest revisions from other names and keep older non-shareable revisions hidden after a later release. Public skill installation works without a display name; author-only installs require the author's name. The exact generated authoring PRIVATE marker is not an external licence declaration.
- Installs use the existing preview/acknowledgement and atomic install engine, never fetch GitHub, reject suspended revisions, and preserve foreign or edited project skills. Reinstalling the same unedited hub tree writes nothing. GET /skills and /skills/all include the installed pin, current shelf revision/state and edited flag.
- TypeScript check and 30 targeted tests passed at ee4b980af331. Tests use temporary stores/projects and the real skills CLI with local sources, not network access. Coverage includes source changes after registration, archive/tree/inventory tampering, two Workflow revisions pinning different skill revisions, old-revision installs, suspension, visibility/review, source choice, text/path/size gates, metadata extraction, deterministic long/Unicode/empty-folder archives, reverted-tree origin stability and real skill-row annotations.
- Full server suite job 2 at f1dd6c30178b passed: 184 files, 2082 tests; 1 file and 8 tests skipped. Frozen Python helpers were prepared first. The initial helper-less job failed only in dependency-dependent maps/tables/Office tests and is superseded by job 2. Scanner findings are bounded heuristics (200 findings; 160-character excerpts), not a safety verdict. Licence detection uses a known SPDX list, not a legal opinion; unsupported declarations remain author-only. The skills CLI exposes no resolved commit on this path, so the origin does not invent one. UI and Workflow authoring/readiness are owned by the parent/sibling, not this child.

## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-hub-skills--store-20261022T061227.637852Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/runs/gaid-hub-skills--store-20261022T061750.108769Z/log"],"reason":"The first full-suite snapshot omitted frozen Python helper setup; the replacement ran the same code with the scripts/check helper setup and passed all enabled server tests.","recorded":"2026-10-22T06:24:19Z","replacement":"/home/seongin3/data/geoaidesk/runs/gaid-hub-skills--store-20261022T061750.108769Z/receipt.json","state":"superseded"}
- /home/seongin3/data/geoaidesk/runs/gaid-hub-skills--store-20261022T061750.108769Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
