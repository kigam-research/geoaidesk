---
format: 1
status: active
updated: 2026-10-15T14:29:37Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"30efe6cf-247e-4b79-ae96-4f2d48ae2ae8","pid":616412,"provider":"claude","session":"e4759be6-1136-4c5c-8dd0-c43f9b2997c1","start":"53955591","token":"44c9356cdb1cfd8e6e5266192f329ff05ef51ffc9b47036733adc766aad28642"}
branch: task/gaid-hub-integration
target: main
parent: 
---
# gaid-hub-integration

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-hub-integration` (geoaidesk) — GAID side of the GAID-hub ecosystem

This unit answers forwarded goal bd45c51400e1 (from the gaid-qwen-authoring-trial writer). Read
/home/seongin3/data/geoaidesk/work/hub/bd45c51400e1.md first (user's verbatim words, verified facts, contract items).

## Additional user words (verbatim, Korean, 2026-10-15, geoaidesk hub)
> "사용자는 현재 writer tab에 skill hub의 전면개선 작업도 요청하였다. 시안만 보여주고 구현작업을 하지 않고 있었던것과 앞으로
> 스킬허브는 GAID 허브가 되어야한다. 그리고 GAID허브에서 생성한 스킬 또는 워크플로우 레시피가 GAID 시스템에서 불러와서 테스트되어야한다.
> 사용자가 진정으로 요청한 방식이고 연계된 생태계이다. 이를 위해 논문을 지정해주고 테스트시나리오를 알려주어 시스템을 일관성 있게
> 검증하면서 개선구현하라고한것이다."

## Split (hub decision)
- skill_hub hub, request 78fce59a1e63 (same day): overhaul skill_hub into the GAID hub with implemented source-grounded
  authoring (paper → questions → skill/workflow draft → validation → package). Not this unit's code; do not edit skill_hub.
- This unit (GAID side, implementation, not mockups):
  1. Fetch hub-authored skills/workflows from the hub and install them in GAID as LocalMethod (design:
     docs/design/spatial-pu-pilot.md, additive; geo-start/v1 meaning unchanged), through GAID's existing preview →
     acknowledgement → install gate; run them in GAID and record the trial.
  2. GAID chat offers only "방금 한 분석을 skill_hub 초안으로 보내기" (send the analysis as a hub draft).
  3. Personal drafts are testable in GAID before hub publication (design: researcher-ecosystem report §3.9–3.10, §3.14;
     docs/design/source-authoring-agents.md).
  4. End-to-end acceptance with the user's paper and scenario: test paper `authoring_preview_paper`
     (~/assets/gaid-authoring-preview/20261015/author-manuscript.pdf), scenario docs/design/spatial-pu-pilot.md (keep the
     pre-existing PU skill out of the authoring context); author in the hub → fetch/install in GAID → bounded trial, with
     observed outcomes recorded. Qwen route (KIGAM server, qwen3.8-flash-next, reasoning levels low/medium/xhigh); no
     paid runs. Verify consistently across both systems and fix GAID-side problems you find.
- Shared interface first: agree the package/registration contract (bd45c51400e1 "Contract changes" item 2) with the
  skill_hub side through the hubs (`task hub --send --repo skill_hub ...` via the geoaidesk hub is fine: send drafts to the
  geoaidesk hub and it forwards). skill_hub owns the final contract; propose GAID's consumer requirements early.

## Coordination
- gaid-qwen-authoring-trial is still finishing its trial fixes (chat-made skill exposure, origin badges, Settings narrow
  width, provider copy, permission card, 워크플로 terminology, workflow list first view, outside-project write
  confirmation, Modal off). Avoid those files until it merges; then `task sync`. Reuse its evidence and harness
  (~/data/geoaidesk/work/gaid-qwen-authoring-trial/, its task document) and its visual-review method: researcher agent
  (Claude Sonnet 5.5 high) viewing screenshots, plus "Claude 고급검토" and "Codex 고급검토" visual reviews before/after.
- Writer setup: you are the Claude top-level orchestrator; child writers/workers use "general work" (gpt-6.1-sol high) at
  normal speed. Own GAID instance on free ports with its own GAID_HOME under ~/data/geoaidesk/work/gaid-hub-integration/;
  never touch the user's review instance (gaid-review, 3000/18000, ~/.geoaidesk). Checks: scripts/check. Report under
  reports/<date>-<topic>/. After the last check remove build caches and app-written files/links from the worktree.

## Current state
- 2026-10-15: contract draft v0 (GAID consumer requirements) sent to the skill_hub hub, request da92dc0fec04; text in
  ~/data/geoaidesk/work/gaid-hub-integration/to-skill_hub-contract-v0.md. skill_hub unit: gaid-hub-authoring (just started).
- P1 server implemented (not yet wired to session creation): web/src/geo/contracts/methods.ts,
  server/src/geo/methods/{method-file,package-origin,local-methods,trials}.ts, server/src/geo/routes/methods.ts,
  descriptor fetch + origin record in server/src/geo/skill-hub.ts, getSkillProvenance returns baseHash
  (skills-sync.ts, boundaries updated). Consumer contract: docs/design/hub-method-package.md.
  Verified: `cd server && npx vitest run test/geo-methods.test.ts test/geo-skill-hub.test.ts` (23 pass), typecheck clean.
- Child P2 `gaid-hub-integration--handoff` running: writer e6a23203-e5dc-44f5-b6a0-74d8c942a195,
  worktree ~/worktrees/geoaidesk/gaid-hub-integration--handoff; term correction forwarded to it.
- Routed request term-workflow-gaid-hub-integration (user: "용어로서 워크플로우가 표준용어이고 가급적 영어로 Workflow로 사용하길
  원한다."): consumed; applies to this unit's new strings ("Workflow"; "워크플로우" only where Korean spelling is unavoidable).
  Report it with route-report at finish.
## Next steps
1. Wire trial recording into session creation (`method:` exposure in context.ts → recordMethodTrial) once the trial
   unit merges; until then build P3 UI parts that do not touch its files.
2. Adjust to the hub's contract answer (da92dc0fec04).
3. After gaid-qwen-authoring-trial merges: `task sync`, then P3 (UI) and the `method:` exposure in context.ts.
4. When the hub delivers authoring + package URLs: P4 end-to-end acceptance with the paper (Qwen route, no paid runs).
## Failed approaches
## Notes and decisions
### Orchestration (2026-10-15)
Sequential decisions: (1) package/registration contract with skill_hub (GAID proposal v0 = skill folder + optional
`gaid-method.json` `gaid-method/v1` launch contract, geo-workflow/v1-shaped workflows with `local:<slug>` skill ids and
catalogue environment ids, hub-recorded lifecycle never self-asserted; descriptor URL `gaid-hub-package/v1` with sha256;
http only for loopback hubs); (2) exposure mode for local-method chats (`method:` mode, so a trial chat sees only the
method's skills and not the withheld catalogue PU skill) — touches server/src/geo/context.ts, owned by the trial unit
until it merges.
Packages:
- P1 LocalMethod server (parent): server/src/geo/methods/*, server/src/geo/routes/methods.ts, server/src/geo/skill-hub.ts
  (descriptor fetch), web/src/geo/contracts/methods.ts, server/test/geo-methods*.test.ts.
- P2 GAID→hub analysis handoff (child `handoff`, Codex general work): server/src/geo/hub-handoff/*,
  server/src/geo/routes/hub-handoff.ts, web/src/geo/hub-handoff/*, web/src/geo/workspace/chat-actions.tsx (replace
  "재사용 스킬 만들기" with "방금 한 분석을 skill_hub 초안으로 보내기"), locales namespace `hubHandoff`, its tests.
- P3 LocalMethod UI (parent, after trial merge): web/src/geo/methods/*, wiring into task-catalogue.tsx/TaskSetup, locales
  namespace `methods`.
- P4 end-to-end acceptance (parent; researcher agent + visual reviews like the trial unit).
Shared one-line seams: server/src/geo/routes.ts (each package adds its register call), web/src/geo/locales/index.ts.
Integration order: P1 → P2 complete → sync trial merge → P3 → P4.
Avoid until the trial merges: task-catalogue.tsx, workflows-panel.tsx, context.ts, instructions.ts, skills-panel.tsx,
locales app/workspace/workflows/settings/work.
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
