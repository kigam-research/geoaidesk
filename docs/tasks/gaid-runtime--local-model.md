---
format: 1
status: done
updated: 2026-10-11T04:26:32Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"6868fb3e-df61-4f95-9b8b-6969b644d3c9","pid":3660182,"provider":"codex","session":"01a128e4-01e8-7261-9bf0-b7141477814a","start":"15339424","token":"678e6a4621bca6508ffa52de4cab714cb9f6c182668863bcbd572346b02492e2"}
branch: task/gaid-runtime--local-model
target: task/gaid-runtime
parent: gaid-runtime
---
# gaid-runtime--local-model

## Goal and done criteria
Request from the starter:

# Child brief: `local-model` — workable local-model setup whose model/context persists (GAID WP03)

Goal (WP03 done criterion): "selected model/context persists", using the existing Custom Model Server mechanism
(plan §3.8 "Context configuration": use the custom-model path first; Kady's built-in Ollama/OpenAI-compatible routes
hard-code a 32,768 context in server/src/agent/models.ts, which the 2026-10-10 trial showed is too small: a 66,423-token
request failed at 32K; with a Modelfile num_ctx 98,304 + custom server entry + a short skill list it succeeded, peak
context 89.9%, ~18% CPU offload on an RTX 4090 24 GB, model qwen3:30b-a3b-instruct-2507-q4_K_M). Trial notes:
/home/seongin3/data/skill_hub/work/geo-byok-plan/trial/trial-notes.md (read-only).

Deliver:
1. `server/src/geo/local-model.ts` + `server/src/geo/routes/local-model.ts` (stub exists; keep the export name):
   - `GET /geo/local-model/status`: Ollama reachability at `ollamaBaseUrl()` (server/src/config.ts); its models
     (`/api/tags`); per model the configured `num_ctx` parameter and trained `context_length` from `/api/show`, and
     the loaded context from `/api/ps` when the server reports it; the GAID-managed custom provider entry (if any)
     and the app default model (`readAppDefaults`, server/src/app-settings.ts). Report a mismatch or "unverified"
     when the declared context of the entry exceeds what the Ollama model is known to run with.
   - `POST /geo/local-model/configure` `{ model, contextWindow, maxTokens, createVariant?, setDefault? }`:
     validate; when `createVariant` is true create a derived Ollama model (`POST /api/create` with `from` and
     `parameters: { num_ctx }`, name like `<base>-gaid-<n>k`) — an explicit user action only, never automatic; write or
     update ONE GAID-managed provider (id `gaid-local`) through the existing custom-models module
     (server/src/agent/custom-models.ts: validation, atomic write, sidecar ownership, `ModelRuntime.refresh()`), base URL
     `<ollama>/v1`, api `openai-completions`, the model with explicit `contextWindow`/`maxTokens` and zero cost; and when
     `setDefault` is true set the app default model (`writeAppDefaults`) to `gaid-local/<model>`. Both files persist
     across restarts; prove it with a test that re-reads them in a fresh module state.
   - `server/src/geo/local-model-profiles.ts`: data for (a) the recorded reference profile above, labelled as one
     recorded trial on one machine, with the offload disclosed; (b) proposed compact profiles 32K and 64K labelled
     "proposed, not tested". No claim beyond that.
   - Check billing: a `gaid-local` model must be classified local/$0 or payg at $0 so it never counts against a
     spend cap (see server/src/cost/billing.ts and the "Local model servers" caveat in AGENTS.md). If the custom
     provider path bills payg at the declared $0, say so in the report; do not edit billing.ts.
2. Web: `web/src/geo/local-model/` — a Settings card (Korean-first strings in `strings.ts` via `defineGeoStrings`)
   that shows Ollama status, lets the user pick a model, a context size (profile presets + custom number), max
   output, "create a variant with this context" (explicit checkbox, explained), and "use as default", then calls
   the routes and shows the persisted result. Mount it with one import + one JSX line in the Local model servers area
   of `web/src/components/settings/providers-panel.tsx` (seam; report it). Use the existing API helper
   (`apiFetch` in web/src/lib/api-auth.ts or how the providers panel calls the backend). Add a vitest for the card
   with mocked fetch.
3. Tests (server/test/geo-local-model*.test.ts) against a stub HTTP server standing in for Ollama (no real Ollama, no
   model calls): status parsing, mismatch/unverified detection, configure with and without variant, validation
   errors, persistence of models.json + kady-settings.json, idempotent re-configure (one provider entry).

Do not call `/api/create` (or anything that changes state) on the real local Ollama; a read-only `GET /api/tags`
against it for a manual smoke is fine if it is running. Out of scope: built-in Ollama route context (models.ts stays
unchanged), skill exposure, prompt budget (the parent owns those).
Owned files: server/src/geo/local-model.ts, server/src/geo/local-model-profiles.ts,
server/src/geo/routes/local-model.ts, server/test/geo-local-model*.test.ts, web/src/geo/local-model/**; seam lines in
web/src/components/settings/providers-panel.tsx.
## Common rules for this child unit (parent: geoaidesk task gaid-runtime, WP03)
- Repository: kigam-research/geoaidesk (GeoAIDesk = GAID, fork of K-Dense BYOK). Read AGENTS.md and
  docs/tasks/gaid-runtime.md (section "Plan") in your worktree first. The plan source is skill_hub
  docs/specs/geo-byok-plan.md §3.2 and §3.8; a local copy is at
  /home/seongin3/data/geoaidesk/work/gaid-runtime/specs/geo-byok-plan.md (read-only).
- Network: raw.githubusercontent.com is blocked on the KIGAM network. Use
  `gh api repos/OWNER/REPO/contents/PATH?ref=REF -H "Accept: application/vnd.github.v3.raw"` if you need a GitHub file.
- The pinned geo catalogue archive is at ~/assets/geo-catalogue/0.2.0/geo-catalogue-0.2.0.tar.gz (read-only asset);
  an unpacked copy for reading is at /home/seongin3/data/geoaidesk/work/gaid-runtime/cat-0.2.0/ (environments.json,
  workflows.json, catalogue/index.json, runtime/skills/). Code loads it through `loadGeoCatalogue()`
  (server/src/geo/catalogue.ts); tests pass explicit options and must not depend on ~/assets (build a small fixture
  archive in the test, or skip visibly when the asset is absent).
- Settled interfaces you build on (do not change their signatures; ask the parent through your task document /
  final report if one must change): server/src/geo/{catalogue,catalogue-types,context,session,routes,inspection}.ts,
  web/src/geo/contracts/inspection.ts, web/src/geo/viewers/registry.ts, web/src/geo/i18n.ts (`defineGeoStrings`).
- server/vitest.config.ts sets `GAID_CATALOGUE=off` so upstream tests keep the upstream catalogue path; geo-mode tests
  set the env per test (and reset module state) or pass explicit options.
- GAID code lives in server/src/geo/, web/src/geo/. Any edit to an upstream file is a seam: keep it to the lines
  named in your brief and list every such file in your final report; the parent records them in
  geo/integration-boundaries.json (do not edit that file yourself).
- Visible UI strings: Korean first, English second, in a `strings.ts` next to your component built with
  `defineGeoStrings`; plain wording, no marketing claims, no claim that something is tested when it is not.
- Server style: match the surrounding upstream code (TypeScript run by tsx, typebox, fastify, vitest in server/test/).
  Tests deterministic, no network to model providers, no paid model runs. Put test fixtures under
  server/test/fixtures/geo/ (small files only, nothing over 200 KB).
- App data for manual checks goes under ~/data/geoaidesk/work/gaid-runtime/<your-slug>/, never inside the repo.
- Checks before finishing: `cd server && npm run typecheck && npx vitest run <your tests>`, `cd web && npx tsc --noEmit`
  and the web tests you touched, plus a full `cd server && npm test` once. Report exact commands and results; do not
  write "tests passed" for tests you did not run.
- Use the task CLI for saving/finishing (`task save`, `task finish`); your finish notifies the parent.

## Current state
Implemented Ollama status/configure, explicit-only derived models, custom-provider/default persistence, profiles,
and the Korean/English Settings card. All tests use a loopback stub, not real Ollama.
Verified: server typecheck; 22 focused server tests (including fresh-module reads and real Pi runtime reload/restart);
web typecheck; 4 card tests, rerun after improving custom-profile selection.
First task finish checked ec25d8a (including parent a2d58d9): backend 137 files passed / 1 skipped,
1533 tests passed / 11 skipped (including 2 mzML tests excluded by the existing network probe); frontend
133 files / 893 tests passed; launcher checks and 11 distribution tests passed. Production UI build passed.
Finish did NOT succeed: production smoke fetched catalogue/context after stopping its backend.
Parent has already fixed this ordering in 3f710b3; rerun task finish in place to merge that fix and recheck.
No codegraph index exists for this exact worktree; used direct source reads.
## Next steps
<!-- task:closed -->
Closed 2026-10-11T04:26:32Z: integrated into gaid-runtime; closed with it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
First task finish: scripts/check exited 1 in production smoke after start/build/project-create/file-save/stop succeeded.
The smoke then fetched /geo/catalogue and /geo/context/preview from the stopped backend (ECONNREFUSED).
This parent-owned test-order regression was fixed independently by the parent in 3f710b3; no child seam expansion.
Check log: /home/seongin3/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-eb2rvih5.log
Smoke launcher log: /tmp/gaid-smoke-X978Xu/launcher-1.log
## Notes and decisions
Plan: sequentially settle status/configure response shapes, implement the server, then the card, then checks.
Owned files are the brief's local-model modules/tests and providers-panel seam. No child writers are needed for this tightly coupled package.
Integration: custom-model writer/ownership sidecar -> runtime refresh -> optional app default -> status readback.
The parent owns integration-boundaries.json; the sole planned upstream seam is providers-panel.tsx.
Real Ollama mutation is forbidden; all create requests will target the test HTTP fixture.
Billing evidence: gaid-local uses existing payg classification with all four declared costs at zero; it adds $0
to spend. No billing.ts changes. Existing generic payg admission still refuses any payg run when a project is
already over cap (run-pipeline.ts); $0 pricing does not exempt this provider from that pre-existing guard.
Parent integration notes: keep registerGeoLocalModelRoutes export; optional options only support isolated tests.
Routes are /geo/local-model/status (GET) and /geo/local-model/configure (POST); UI seam is one import + one JSX
line in web/src/components/settings/providers-panel.tsx. The parent must register this upstream file's boundary
and include these delivered results/evidence in the parent report. No new report is created by this child.

## Checks
- `cd server && npm run typecheck`
- `cd server && npx vitest run test/geo-local-model.test.ts`
- `cd web && npx tsc --noEmit`
- `cd web && npx vitest run src/geo/local-model/card.test.tsx`
- `cd server && npm test` (full suite via scripts/check during task finish; outcome recorded by the CLI)
- `scripts/check` (repository-declared integration checks, run by task finish)
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
