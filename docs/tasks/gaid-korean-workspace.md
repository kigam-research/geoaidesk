---
format: 1
status: active
updated: 2026-10-11T06:47:54Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"5a34c88d-50ba-4323-a756-6a9488fbdf87","pid":380762,"provider":"claude","session":"6df29ac7-f824-41c6-9216-1a3b7d461f2f","start":"16638656","token":"1a4386f654d16d2945fa89db25384d9bf52e4732defb4b77b0f0281efd272b96"}
branch: task/gaid-korean-workspace
target: main
parent: 
---
# gaid-korean-workspace

## Goal and done criteria
Request from the starter:

# Writer brief: WP07 `gaid-korean-workspace` (geoaidesk)

This unit answers forwarded goal b619ca2ff749 from the skill_hub project hub. The full forwarded request, including the
user's verbatim words, package text, status and inputs, is in /home/seongin3/data/geoaidesk/work/hub/b619ca2ff749.md —
read it first; it is the authoritative scope (goal, owned files, done criteria, order). Do not add required items.

Verified facts from the hub (2026-10-11):
- geoaidesk main (57527b4 or later) contains WP02 gaid-fork-base, WP03 gaid-runtime + gaid-runtime-followups,
  WP04 gaid-well-tables (950786a) and WP05 gaid-maps (fe1fd72); reports under reports/2026-10-11-*/index.md.
  No other geoaidesk unit is running, so WP07 owns the shared frontend seams (viewer registry, file-preview dispatch,
  use-sandbox, suggestion seam) including non-additive changes.
- Writer setup by the user's choice ("현재 수행중인 작업까지만 astra fast로 작업 후 다시 기존대로 opus 5.5 오케스트레이터에
  gpt 6.1 sol high 워커로 작업하는 방식으로 진행하자."): you are the Claude top-level orchestrator; child writers and
  delegated workers use the Paseo profile "general work" (gpt-6.1-sol high) at normal speed (no fast/priority).
- skill_hub inputs: read with
  `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
  (raw.githubusercontent.com is blocked on the KIGAM network; pass this to any worker using the network).
  WP00 (design tokens, design/copy/gaid-writing.md, terminology.csv, copy-policy.json, copy validator) is finishing on
  skill_hub branch task/gaid-design-copy and lands on main shortly; use main once it is there (the skill_hub hub tells
  the geoaidesk hub if it is delayed; ask the geoaidesk hub if you are blocked on it).
- Catalogue release 0.2.1 (sha256 e9f50606…f55f5) exists in skill_hub; pinning it in geoaidesk is WP10, not this unit.
- The backbone task CLI fix that exempts `.env.example` from the job snapshot check is live on PC74 (backbone 0031581),
  so `task job run` works in this repo again.
- No paid model runs unless the user asks.
- Checks: `scripts/check` (see AGENTS.md). App data for task work goes under ~/data/geoaidesk/work/gaid-korean-workspace/,
  never inside the repo. After your last check, remove regenerable build caches from the worktree (server/node_modules,
  server/src/helpers/.venv, web/node_modules, web/.next, web/next-env.d.ts, web/tsconfig.tsbuildinfo, __pycache__)
  so the unit can close.
- When the unit completes, its outcome returns to the skill_hub hub automatically through the goal link.

## Current state
(what is done, how it was verified, safe commands to re-verify)
- 2026-10-11: inputs read (forwarded goal, plan §3.5–3.6/§4.5–4.6/§5.3/WP07, gaid-interfaces.md); frontend surveyed.
  WP00 is not on skill_hub main yet: its approved state is branch task/gaid-design-copy @ 63cbdad22f (user approved
  the copy set there); vendored from that commit, to be re-pinned to main when it lands.
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
- Scope = WP07 package text only (forwarded goal b619ca2ff749). Done: researcher opens data, sees relevant actions,
  launches the correct pack, opens outputs; missing skills/environments never shown as ready; new chat/pack transitions
  preserve drafts; primary-path Korean, keyboard, narrow-layout and actual-screen checks recorded.
- Sequential decisions (settled by the orchestrator before children start):
  1. Locales: per-namespace catalogues `web/src/geo/locales/<ns>/{ko,en}.json` (ICU subset, flat dotted ids inside),
     aggregated by `web/src/geo/locales/index.ts` (owner: orchestrator). Reason: parallel writers never edit one JSON
     file; the WP00 validator walks directories recursively. `t(id, vars)` in `web/src/geo/i18n.ts`; locale = saved
     override (`gaid:locale`) else browser language, Korean default.
  2. WP00 copy kit vendored into `geo/copy/` (validator, icu-lite, policy, terminology, guideline, agent prompt) with
     `geo/copy/SOURCE.md` (skill_hub commit + sha256); `scripts/check` runs it over `web/src/geo/locales`.
     The catalogue archive's `policy/` replaces the vendored copy when WP10 pins a release carrying it.
  3. Pack launch does not pre-create a session: the new tab carries `geoExposure: "workflow:<id>"` in its persisted
     chat state; the first send passes it to `POST /sessions` → `createSession(..., {geoExposure})` →
     `geoSessionParts({mode})`. Survives reload/restart like any draft. Draft = workflow prompt + choices + bound files
     in the new tab's composer, never auto-sent; the source tab keeps its own draft.
  4. Start-task seam: window event `gaid:start-task` (web/src/geo/workspace/events.ts) handled in page.tsx: open a new
     tab seeded from the active tab's model/thinking/compute plus the task draft, attached files, pinned primary skill
     and geoExposure.
  5. Readiness is computed server-side (`GET /geo/workflows`): skills installed+enabled in the project, project
     environment import probe, and `compatibilityRef` (GAID run record) reported separately; "ready" needs the first
     two; no record shows as 미시험, never as verified.
  6. geo-result reference: scientific_result kind `geo-result` {manifestPath, resultKind map-layer|depth-track|
     validation-curve, thumbnailPath?}; the card opens the manifest through the existing onOpenFile chain.
- Packages / owners / integration order:
  - O (orchestrator, first): i18n + locales layout, copy kit + check step, contracts
    `web/src/geo/contracts/workspace.ts` + `server/src/geo/workspace/types.ts`, upstream seams (page.tsx start-task
    handler, workspace-persistence geoExposure, use-agent/chat-tab ensureSession body, sessions.ts POST body,
    session-registry option, mount points in file-preview-panel / scientific-result-card / chat-tab).
  - O: server workspace API (`server/src/geo/workspace/`, routes `GET /geo/workflows`, `POST /geo/suggestions`,
    `POST /geo/recipes/check`, scientific-result `geo-result` kind) + tests.
  - Child `gaid-korean-workspace--tasks` (general work): `web/src/geo/workspace/**` UI — workflow catalogue panel,
    task setup dialog, recipe import, file action suggestions (≤3), geo-result card, "make reusable skill" entry; its
    locale namespace `workspace`.
  - Child `gaid-korean-workspace--korean` (general work): Korean primary path — branding (layout metadata, header,
    brand assets from WP00 when present), WP00 app tokens/fonts, migrate geo module `strings.ts` into locales,
    translate primary-path upstream components via `t()` (namespace `app.*`), language setting; boundaries entries.
  - Integration (O): merge children, actual-screen browser checks (ko, keyboard, 375–1440 px), report.
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
