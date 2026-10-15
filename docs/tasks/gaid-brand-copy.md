---
format: 1
status: active
updated: 2026-10-15T22:59:20Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"a1684467-2f27-4645-9134-551b40e66be6","pid":3326138,"provider":"claude","session":"23cfe4ed-f98f-472e-a572-8da185372836","start":"57046241","token":"d2a3156f13a6dd3deca1c6ab1e7a65b39282d2f1add18ba826c65acfe7946882"}
branch: task/gaid-brand-copy
target: main
parent: 
---
# gaid-brand-copy

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-brand-copy` (geoaidesk) — product/agent names in UI copy, upstream attribution, desktop-first note

## User answer (verbatim, Korean, 2026-10-16, geoaidesk hub)
> "gaid-qwen-authoring-trial#1은 나로하고 #2는 \"Kady\"는 AI agent로 하고 K dense는 GAID로 표시하자. 그런데 워크플로우나 스킬 중
> K dense에서 가져온것은 출처가 해당 스킬이나 워크플로우가 표시되는 창에 표시되어야한다."
Items (docs/open-items/gaid-qwen-authoring-trial.md; evidence reports/2026-10-15-gaid-qwen-authoring-trial/index.md):
- #1 나): keep desktop first; state in the supported-environment docs (docs/geo/compatibility.md and/or docs/geo/install.md,
  geo/compatibility.json if it has a field) that narrow windows (~390 px) are not supported for the workspace chat
  (confirmation cards and the input button can be pushed off screen). No layout rework.
- #2 가) with the user's mapping: in visible UI copy, "Kady" → "AI agent" (Korean copy follows the copy kit term for AI agent);
  "K-Dense" → "GAID" (product name per the copy kit). About 54 places, see the trial report's list.
- Addition: skills and Workflows that came from K-Dense (upstream catalogue/workflows, e.g. K-Dense-AI scientific-agent-skills
  and the upstream workflow list) must show their source in the window where that skill or Workflow is shown (skills panel /
  detail, Workflow panel row or detail), e.g. "출처: K-Dense" with a link where known. GAID/KIGAM-made ones keep their own
  origin badge. Keep the upstream LICENSE/NOTICE attribution untouched; do not rename code identifiers, env vars
  (KADY_*), paths or API routes — this is visible copy only.

## Notes
- Copy rules: geo/copy/ (gaid-writing.md, terminology.csv, validator) and AGENTS.md "UI copy and locales"; the terminology
  now uses "Workflow". Upstream components translated via the gaid-ui-locale lookup; register any upstream file you touch in
  geo/integration-boundaries.json.
- gaid-hub-integration runs in parallel (hub fetch/install as LocalMethod, skills panel / Settings → Skills areas). Keep
  your changes to copy and the attribution display, `task sync` before finishing, and keep both sides on conflicts.
- Writer setup: Claude orchestrator; child writers/workers "general work" at normal speed. No paid model runs.
- Evidence: before/after screenshots (Korean and English) of the screens with changed names and of the attribution in skill
  and Workflow views. Checks: scripts/check. App data under ~/data/geoaidesk/work/gaid-brand-copy/; never touch the user's
  review instance. After the last check remove build caches and app-written files/links from the worktree.

## Current state
- 2026-10-16: surveyed. 57 locale ids per language name Kady/K-Dense/BYOK (web/src/geo/locales/*); visible literals
  outside locales: office-workspace "Kady Office", prompts-panel "K-Dense" badge. Provider hints in
  server/src/agent/provider-{auth,catalog}.ts are the English lookup keys of settings `source.*` (primitives.tsx), so
  they change together with en.json.
- Pinned catalogue 0.2.1: 5 skills are K-Dense imports (`sourceRevision.kind: import`, repository
  K-Dense-AI/scientific-agent-skills, commit, path); 8 are KIGAM-owned; all catalogue workflows are KIGAM-owned.
  Upstream Workflows (web/src/data workflows list, ALL_WORKFLOWS in workflows-panel.tsx) are K-Dense.
## Next steps
1. Implement packages A-C below myself (tightly coupled copy work), then screenshots and report.
## Failed approaches
## Notes and decisions
- Orchestration: no child writers; the work is copy plus one small server field, tightly coupled. Packages, in order:
  A) copy: Kady -> "AI agent" where it names the assistant, -> "GAID" where it names the app (restart, server, file
     browser, credential store, billing/ledger, shipped templates); K-Dense/BYOK as the app -> GAID. Kept: header
     attribution "Based on K-Dense BYOK (MIT)", and strings that name the upstream Workflow list itself
     (workspace.catalogue.noDetail, workspace.recipe.upstreamCategories) because they are source attribution.
     Code identifiers, env vars, routes, model-facing protocol strings (composer "Delegation: Kady picks") unchanged.
  B) attribution: server adds `upstream {name, repository, url}` to SkillInfo for catalogue skills imported from
     another repository (geo index sourceRevision.kind=import; upstream catalogue mode: KADY_SKILLS_REPO); skills panel
     row shows "출처: K-Dense" linked; upstream Workflow rows and the launch dialog show "출처: K-Dense" linked to the
     upstream repository. Owned files: server/src/api/skills.ts, server/src/geo/skill-origin.ts (new),
     web/src/lib/capabilities.ts, web/src/components/{skills-panel,workflows-panel,prompts-panel}.tsx.
  C) docs: narrow-window (~390 px) workspace chat unsupported in docs/geo/compatibility.md / install.md.
  Overlap with gaid-hub-integration: geo/integration-boundaries.json, AGENTS.md, locales/index.ts only.
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
