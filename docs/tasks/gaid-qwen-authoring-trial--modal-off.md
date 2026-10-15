---
format: 1
status: active
updated: 2026-10-15T14:05:44Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"c9784d59-bb40-4f34-92f4-b99e911e0acb","pid":490184,"provider":"codex","session":"01a13fd5-7e73-7dc1-adb6-264a7912b776","start":"53831898","token":"3ed0f4ef35f21ef47645dfe765fa240819af1c91f4437fc68331c3c230921499"}
branch: task/gaid-qwen-authoring-trial--modal-off
target: task/gaid-qwen-authoring-trial
parent: gaid-qwen-authoring-trial
---
# gaid-qwen-authoring-trial--modal-off

## Goal and done criteria
Request from the starter:

# Child brief: turn Modal remote compute off in the GeoAIDesk distribution

Parent unit: gaid-qwen-authoring-trial (repo geoaidesk). You are a child writer; your branch merges into the parent.
Read AGENTS.md (GeoAIDesk fork section + the "Durable Modal remote compute" caveat) before editing.

## User words (verbatim, Korean, 2026-10-15, in the parent writer's tab)
> "그리고 Modal 서비스와 관련한 연산 환경도 없애도 되는 것이다. 불필요한 유료 서비스를 기관 연구자에게 강요한다. BYOK의 연계 유료서비스로 보인다."

## Goal
In the GeoAIDesk distribution (geo mode: `start-gaid.sh` / `geo/start.mjs`, catalogue pinned), Modal remote compute is
no longer offered: researchers see no Modal/compute surfaces and the lead agent and its subagents get no Modal tools.
Keep upstream code in place (upstream sync stays cheap): switch it off, do not delete it.

## Design (settled; ask the parent only if it cannot work)
- One switch in `geo/distribution.json` (e.g. `"features": { "remoteCompute": false }`), read by
  `server/src/geo/distribution.ts`; absent switch or non-geo/dev mode = upstream behaviour (Modal stays). Expose the
  state to the web the way the app already exposes distribution facts (an existing `/geo/...` or settings endpoint, or a
  build-time value like `NEXT_PUBLIC_APP_VERSION` in `web/next.config.ts`; pick the least invasive and say why).
- When off:
  - lead agent: no `modal_*` tools (`server/src/agent/session-registry.ts`, `makeModalTools`), no Modal wording in lead
    or child guidance that would invite their use (check `subagent-prompts.ts`, `subagent-control.ts`, seeded texts);
  - children: the `kady-modal` package is not required/seeded and no Modal background-work provider is registered;
  - web: the composer compute selector (`compute-selector.tsx`, chat "연산 환경"), the preview panel "연산 환경"/Modal
    tab and jobs panels, Settings → Services Modal token pair and Remote cache card, Settings → Defaults compute default,
    and the notebook robustness ("Stress-test finding") entry that requires Modal are hidden;
  - Modal recovery/startup work does not run (no outbound Modal calls).
- Existing project data under `.kady/modal/` is left untouched.
- Measure the effect on the start prompt (tool count / estimated tokens via `GET /geo/context/preview` or the unit
  test that computes the budget) before/after and report it.

## Scope and ownership
Own: the switch, `server/src/geo/distribution.ts`, the gating sites above, their tests, `docs/` lines that describe
Modal in GAID, and the AGENTS.md GeoAIDesk section line (add one line: Modal off in the distribution).
Do NOT edit (owned by the parent or a sibling): `web/src/components/permission-card.tsx`, `server/src/agent/data-guard.ts`,
`server/src/agent/bash-classifier.ts`, `server/pi-packages/kady-guard/`, `web/src/components/skills-panel.tsx`,
`server/src/geo/context.ts`, `server/src/geo/instructions.ts`, `web/src/geo/workspace/**`, `geo/copy/**`.
Upstream files you edit go in `geo/integration-boundaries.json` as one appended seam with
`"owner": "gaid-qwen-authoring-trial"` (already an allowed owner). New visible strings go in `web/src/geo/locales`.

## Checks and evidence
`npm run typecheck` and the affected vitest files in `server/` and `web/` (`npx tsc --noEmit` in web), `node --test
geo/tests/distribution.test.mjs`, and `node geo/copy/validate-copy.mjs web/src/geo/locales`. The parent runs the full
`scripts/check` after integration. Report: switched-off surfaces with file:line, tool count/start-prompt estimate
before → after, tests run. Network: raw.githubusercontent.com is blocked on this network (use gh api if needed).
No paid model runs. Remove build caches you created in your worktree before finishing.

## Current state
Implemented and pushed as `602d6516c583`. The GAID distribution no longer offers Modal tools or compute surfaces; upstream code and existing `.kady/modal/` data remain. Development/non-geo behaviour is preserved. Local checks passed: server typecheck + 80 tests, web typecheck + 51 tests, distribution/launcher tests, copy validator (0 errors; 56 unchanged warnings). The real production feature-only rebuild and final recorded prompt-budget evidence are running in job 1; no paid model or Modal jobs were run. The parent writes the Modal section in `reports/2026-10-15-gaid-qwen-authoring-trial/index.md` after integration; this child creates no report.

### Switched-off surfaces (source evidence)
- Policy: `geo/distribution.json:13` (`features.remoteCompute: false`), `server/src/geo/distribution.ts:184` (requires launcher marker + geo catalogue; missing switch/upstream/development stays on).
- Web state: `geo/start.mjs:65` sets `GAID_DISTRIBUTION=1` and the computed `NEXT_PUBLIC_GAID_REMOTE_COMPUTE`; `web/next.config.ts:51` inlines it, `web/src/geo/features.ts:2` defaults upstream/dev to on. This reuses the existing build-time distribution facts and avoids adding frontend fetch/state to every surface.
- Lead: `server/src/agent/modal-tool.ts:277` returns no Modal tools; `server/src/agent/session-registry.ts:442` skips the child attribution extension. `server/src/agent/modal-bridge.ts:24` and `:82` skip package/allowlist seeding.
- Children: `server/src/agent/subagent-control.ts:92` omits the required kady-modal extension and `:96` omits its background-work provider. `server/pi-packages/kady-modal/index.ts:602` also refuses registration from old ambient settings or the foreground runtime; `server/pi-packages/kady-child-runtime/index.ts:39` skips the child's background-work provider.
- Guidance: `server/src/agent/notebook.ts:172` and `:173` remove the stress-test invitation and robustness schema; `server/pi-packages/kady-notebook/index.ts:143` does the same for children. `server/src/agent/compaction-bridge.ts:329`, `:432`, `:454` omit the pending-Modal section and Modal-specific summary guidance. The seed's existing two Modal mentions are restrictions, not invitations; the parent agreed to leave them unchanged.
- Startup/API: `server/src/index.ts:188`, `:202`, `:210` omit robustness/Modal routes and both recovery calls. `server/src/api/credentials.ts:420` refuses Modal token changes before outbound validation; `server/src/api/subagents.ts:34` returns no compute items in the specialist fleet. `/config` reports the effective feature (`server/src/index.ts:176`).
- Composer: `web/src/components/chat-tab.tsx:1304` and `web/src/components/compute-selector.tsx:468` hide the selector; `chat-tab.tsx:1831` and `:1878` do not restore a stale target/default; `:1472` omits old Modal history navigation chips.
- Preview/jobs: `web/src/components/file-preview-panel.tsx:206` hides the pinned compute tab; `:1763` normalizes old persisted compute navigation. `web/src/app/page.tsx:340` and `:811` do not restore/open the disabled panel. `web/src/lib/use-modal-jobs.ts:97`, `:186`, `:327`, `:476` prevent catalogue/job/detail/log polling, including header job badges.
- Settings/notebook: `web/src/components/settings/services-panel.tsx:546` hides the token pair and remote cache; `defaults-panel.tsx:193` hides compute defaults and `:135` leaves the saved compute key untouched on other saves; `web/src/components/lab-notebook-entry-card.tsx:391` hides Stress-test finding while keeping local notebook actions.
- Documentation: one GAID caveat added to AGENTS.md and docs/modal-compute.md; all upstream edits are recorded in the appended gaid-qwen-authoring-trial seam. No visible strings were added/changed; no locale id changes.

### Checks and measurement
- Server: `npm run typecheck`; `npx vitest run test/geo-remote-compute.test.ts test/geo-distribution.test.ts test/modal-api-credentials.test.ts test/modal-package.test.ts test/notebook-package.test.ts test/notebook-tool.test.ts test/compaction-bridge.test.ts test/session-registry.test.ts test/geo-context.test.ts` — 9 files / 80 tests passed. Tests use fake credentials/adapters or construct idle sessions; they make no paid model requests.
- Web: `npx tsc --noEmit`; `npx vitest run src/components/compute-selector.test.tsx src/components/file-preview-panel.test.tsx src/components/settings/services-panel.test.tsx src/components/settings/defaults-panel.test.tsx src/components/lab-notebook-entry-card.test.tsx src/lib/use-modal-jobs.test.tsx` — 6 files / 51 tests passed. Off-mode tests cover selector/tab/settings/notebook hiding, old navigation, saved defaults and zero remote polling.
- Distribution/launcher: `node --test geo/tests/distribution.test.mjs geo/tests/start.test.mjs geo/tests/production-feature-stamp.test.mjs` — 16 passed, 1 optional actual-build smoke skipped in this local run. The ordinary stamp test executes the production build functions extracted from start.mjs with fake npm: same inputs reuse BUILD_ID; changing only the public feature value calls npm run build again and changes the stamp.
- Copy: `node geo/copy/validate-copy.mjs web/src/geo/locales` — 0 errors / 56 existing warnings. `git diff --check` passed.
- Recorded job 1 installs locked dependencies in its external source snapshot, repeats the live off-mode test (including fleet API), writes `out/remote-compute-prompt-budget.json`, and runs the same launcher build functions with real npm/Next twice. Results pending; source SHA and receipt are in the Running jobs block. The parent runs full scripts/check after integration.
## Next steps
1. On the job-1 exit notice, read its exit/log and `out/remote-compute-prompt-budget.json`; do not restart it. If it never started (no exit/empty log), use task job resume with its receipt.
2. Add the measured counts/tokens and actual Next rebuild evidence here, verify final source state and finish. The parent writes the canonical report after task complete.
## Failed approaches
- The first server test used nonexistent SDK `getActiveTools`; corrected to `getActiveToolNames`/`getAllTools`. Fake Modal tokens were too short and failed input validation before the feature gate; replaced with valid-length dummy strings.
- An early `task job run` attempt did not launch (dirty source; no receipt/jobs block created). Dependencies were installed with ordinary `npm ci` for local checks; the real build job must follow a reviewed task save.
## Notes and decisions
- Sequential implementation: settle a single manifest feature and distribution-launch mode; gate server/child registration and recovery; gate UI and polling; verify both modes; integrate evidence. This is tightly coupled work, with no additional workers.
- Owned interfaces: `features.remoteCompute` in the manifest; launcher identifies distribution execution; frontend receives the computed state through an inlined `NEXT_PUBLIC_` value, included in the existing production-build stamp. Development/non-geo execution keeps upstream behaviour.
- Existing sandbox settings may already reference kady-modal; gate the package registration itself as well as skipping new seeding. Never remove `.kady/modal` data.
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
- /home/seongin3/data/geoaidesk/runs/gaid-qwen-authoring-trial--modal-off-20261015T140438.137272Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
