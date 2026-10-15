---
format: 1
status: waiting
updated: 2026-10-15T13:51:48Z
writer: {"host":"seongin3","reserved":"3ed0f4ef35f21ef47645dfe765fa240819af1c91f4437fc68331c3c230921499"}
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
