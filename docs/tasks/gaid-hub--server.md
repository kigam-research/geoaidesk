---
format: 1
status: active
updated: 2026-10-16T02:56:22Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"44493f95-ae0b-4928-a7a8-aece5a9dd72d","pid":473002,"provider":"claude","session":"86221638-71d6-426f-8fae-de543721f7e2","start":"369943","token":"7b34b1e9deea5360f09dd28a3eb9c003ae004588a4f735954bd988c2a9967395"}
branch: task/gaid-hub--server
target: task/gaid-hub
parent: gaid-hub
---
# gaid-hub--server

## Goal and done criteria
Request from the starter:

# Child brief: `gaid-hub--server` — port skill_hub's authoring service into GAID's backend

Parent unit: `gaid-hub` (geoaidesk). Read the parent task document `docs/tasks/gaid-hub.md` (Goal: user words verbatim;
"Orchestration plan") and AGENTS.md first. Work only in your own worktree printed by `task resume`.

## Goal
GAID's backend owns the source-grounded authoring service that skill_hub ran (the GAID hub moves into GAID). A researcher
creates an authoring project, attaches sources (paper PDF, code archive .zip/.tar.gz or single files, notes, a GAID analysis
bundle), the coauthor (a model through GAID's own runtime) analyses them into anchored findings and a few material questions,
the researcher answers all questions together, the coauthor drafts a skill + Workflow + 레시피, the server checks it (six
checks), builds a deterministic gaid-method/v1 package, and installs it into a chosen GAID project through GAID's existing
install gate. Restart recovery and idempotent operations as in skill_hub.

## Fixed interface (parent-owned; do not rename fields — propose changes to the parent)
- Records, API bodies and the route table: `web/src/geo/contracts/authoring.ts` (already on the branch). Server imports it
  like other geo contracts (`../../../../web/src/geo/contracts/authoring.ts`). Additive optional fields are fine if you tell
  the parent in your finish notes.
- Routes: exactly the `/geo/authoring/*` table in that file, registered via a new `server/src/geo/routes/authoring.ts`
  (`registerGeo*Routes` pattern, `server/src/geo/routes.ts`). User-level: routes ignore the project scope except the
  install route, which targets `body.projectId` (`resolvePaths(projectId)`; unknown project → 404).

## Source to port (read-only reference, never a runtime dependency)
skill_hub main 54fe4773d06fcb3d0dc36882d5cd44d9094cade5, unpacked at
`~/data/geoaidesk/work/gaid-hub/inputs/skill_hub/` (do not edit it; do not fetch raw.githubusercontent.com — it is blocked).
- `web/server/authoring/{store,sources,anchors,prompts,agent,model,package,routes}.ts` (Express → Fastify)
- `web/shared/authoring/{records,gaid-method}.ts` (types now live in the contract file)
- dependencies of package/agent: `web/shared/atlas/{validate,types,byok-export}.ts` (only what a single-profile check
  needs), `schemas/{atlas-profile,gaid-method,gaid-hub-package,geo-workflow}.schema.json`, `registry/taxonomy/*.yaml`
- spec `docs/specs/hub-authoring-service.md`, contract `docs/specs/gaid-method-package.md`
- tests `web/server/authoring.test.ts` (10), `web/server/authoring-package.test.ts` (8), `web/scripts/authoring-probe.ts`
- inventory: skill_hub `reports/2026-10-16-gaid-hub-authoring/index.md` §3.5–3.6 and appendix A (same folder).

## Required changes vs skill_hub
1. Placement: `server/src/geo/authoring/**`. Store root `<KADY_PI_AGENT_DIR>/skill-hub/authoring/` (overridable by env
   `GAID_AUTHORING_DIR` for tests), same folder layout as the spec (project.json atomic replace, sources/, attempts/,
   packages/). Startup marks running attempts `interrupted`. DELETE moves a project folder to `<root>/archive/` (no rm).
2. Model: GAID's own runtime, never a direct provider endpoint. `resolveModel(ref ?? configuredDefaultRef(), registry)`
   (refuse `fusion/`), `assertModelAuthentication`, `billingForModel`; refuse with 402 when the cap is exceeded
   (`billingCountsTowardBudget` + `isBudgetExceeded("default")`); call `getModelRuntime().completeSimple(model, context,
   { maxTokens, reasoning, signal })` with an injectable complete function for tests (pattern: server/src/agent/
   next-experiments.ts, methods-draft.ts, one-shot-reasoning.ts). Reasoning = the request's `thinkingLevel` else medium.
   Abort after a configurable timeout (default 15 min). Ledger every response (also invalid ones) with `recordRun` under
   project `default`, sessionId `gaid-hub-authoring`, before validating. JSON via prompt + server validation (strip one
   whole-answer fence), never provider schema mode. Record model ref/thinking/usage in the attempt; never hidden reasoning.
3. Questions (UX rules from the user, parent doc): each round at most 5 questions; `text` one sentence, `reason` and
   `affects` one short sentence each; choice questions get 2–4 options with short `label` and optional one-line `hint`;
   `recommendedOptionId` must be one of the option ids (drop it otherwise) with a one-line `recommendedWhy`; default
   answerType `choice-or-text`. Answers arrive together via `POST /answers` (validate every item first — option membership,
   revision, non-empty response unless deferred — then apply all or none; `draft: true` then starts the draft attempt, or
   `revise` when a draft exists, with the new decisions). Single-answer route is not needed.
4. Draft content rules: procedure nodes carry short plain `summary` (≤ 2 sentences, Korean); keep revision-4 fixes from
   skill_hub (bounded variogram/computation guidance, distribution names + install commands for packages outside the GAID
   environment e.g. scikit-gstat, expected artifact file names, option display labels, Workflow `prompt` written as the
   researcher's request, no "(선택)" in input names, source title never "Subject:"). Fix the known false positive: a
   package that is installed as a dependency of a declared one (e.g. joblib with scikit-learn) is not an undeclared
   dependency — use an explicit, documented allowlist of such pairs, not a broad guess.
5. Checks: the six check ids stay (schema, atlas, taxonomy, portability, workflow, claims). Atlas check = single-profile
   validation (schema + the per-profile lints that apply to one profile); no whole-catalogue compile. Catalogue skill ids
   (name collisions, workflow skillIds) and environment ids/packages come from GAID's pinned catalogue
   (`server/src/geo/catalogue.ts`: environments.json, catalogue/index.json, workflows.json) — find the existing reader.
   Each CheckFinding gets a plain one-line Korean `plain` sentence where possible (researcher view); `message` keeps the
   technical text.
6. Vendored inputs: `geo/hub/` with the four schemas and the taxonomy YAML files copied byte-for-byte, plus
   `geo/hub/SOURCE.md` (skill_hub SHA, source paths, sha256 of each file, how to refresh) — like `geo/copy/SOURCE.md`.
7. Sources: PDF page text with poppler `pdftotext`/`pdfinfo` (as skill_hub; health reports `pdfText:false` when missing,
   and the add-source reply says page text is unavailable — no crash). Archives without spawning tar/unzip: `.tar.gz` via
   `server/src/geo/tar.ts` (`readTarGz`), `.zip` via adm-zip, both with the same limits/link/traversal refusal.
8. Package: deterministic tar.gz without the `tar` binary (`archiver` as in server/src/geo/hub-handoff/builder.ts or a
   small writer; sorted entries, fixed mtime/mode/owner), `gaid-method.json` inside the skill folder with files[]/
   packageDigest computed exactly as GAID's verifier expects (`server/src/geo/methods/method-file.ts`
   `verifyMethodTree`). `provenance.hub.url` = `gaid-local:` (or another explicit local marker — tell the parent).
   Lifecycle `draft`. No private PDF/data in the package.
9. Install seam: `POST .../packages/:rev/install {projectId, acknowledged:true}` stages the archive through the existing
   gate (`stageSkillHubPackage` + method checks + `previewSkillSource` + `installStagedSkills`, project scope), with a new
   package origin kind for locally authored packages (extend `PackageOriginRecord.kind` / `originOfSource` in
   `server/src/geo/methods/package-origin.ts` and the `MethodOrigin.kind` union in `web/src/geo/contracts/methods.ts`
   additively, e.g. `"gaid-hub"`; lifecycle stays `draft`). Record an `AuthoringInstall`; return the method's first
   workflow id and recipe id. Refuse without `acknowledged`. Do not change how remote hub descriptors are fetched.
10. Express-only pieces (`gaid-routes.ts` /api/gaid listing for other apps) are not ported.
11. Docs: update AGENTS.md (one GeoAIDesk bullet for the authoring service) and add `docs/design/hub-authoring-service.md`
    (GAID version of the spec: storage, model route, API, limits). Add any upstream file you edit to
    `geo/integration-boundaries.json` with owner `gaid-hub`.

## Tests and checks
Port the skill_hub tests to vitest (`server/test/geo-authoring*.test.ts`) with a fake complete function and temp dirs:
anchor verification, line-number stripping, one bounded repair, restart recovery (interrupted, same questions, no
duplicates), stale answer/edit refusal, all-or-none answers, recipe rules, archive link/traversal refusal, package
determinism + digest verified by GAID's own `verifyMethodTree`, install through the gate into a temp project (skill
appears, LocalMethod lists it with the new origin), 402 over cap, ledger row written for an invalid response.
`cd server && npm run typecheck && npx vitest run test/geo-authoring*` must pass; run the wider geo tests you touch.
Full `scripts/check` is run by the parent at integration; do not run it unless cheap.

## Boundaries
- Do not edit `web/src/geo/hub/**`, locales, `web/src/components/**` or `web/src/app/**` (parent owns the screens).
- No model calls to real providers in tests. You may make ONE small real smoke call through a running GAID instance only
  if the parent asks; the shared KIGAM Qwen server serves one session at a time.
- Do not touch the user's review instance (gaid-review, ports 3000/18000, ~/.geoaidesk) or skill_hub.
- Report in your task document: what was ported/changed, deviations from this brief, test evidence, open questions.

## Current state
- Retired without changes (2026-10-16). The Codex writer stopped before any edit ("workspace out of credits", then a
  Codex token-refresh error in Paseo on every prompt). User decision in the parent tab: "2번으로 진행하자." = the parent
  writer (gaid-hub, Claude) ports the server itself; it did so on task/gaid-hub (ef4d124). Hub request 0bc1c179ab4c.
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
