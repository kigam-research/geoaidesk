---
format: 1
status: done
updated: 2026-10-22T01:39:59Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"e73f31b2-928f-4e58-a430-49186ac0f645","pid":1071582,"provider":"codex","session":"01a15ebe-4cf0-74d2-b30f-13e606b0b188","start":"47883007","token":"281236167c9f58c78e6908aa70ba51bc35bc9b17393c11fb2cefbff9f2d1f4c5"}
branch: task/gaid-design-identity--system
target: task/gaid-design-identity
parent: gaid-design-identity
---
# gaid-design-identity--system

## Goal and done criteria
Request from the starter:

# Child gaid-design-identity--system: apply direction 라 to the GAID system (workspace) screens

Goal: the project list and the research workspace read as GAID's own "research register" in light and dark themes,
consistent with the hub, with no AI-slop signs.
Owned files: web/src/app/page.tsx (app header and workspace chrome only), web/src/components/project-view.tsx,
web/src/components/workflows-panel.tsx, web/src/geo/workspace/**, web/src/geo/notes/**,
web/src/components/ui/{button,badge,card,tabs,input}.tsx (shared primitives: change only what the guide requires, e.g.
radius, outline, focus; check other screens still look right), their tests.
Screens to cover: project list (내 연구: header, project rows instead of identical folder cards with "설명이 없습니다",
the hub banner), app header (nav, project switcher, budget and resource chips, theme/settings buttons; header chips at
11 px must become ≥ 12 px), workspace panes (file tree pane as frame, centre work surface, right panel), research notes
list and note detail surfaces (paper for the researcher's note), Workflow panel (기본 Workflow rows: no peach category
cards or per-category icon colours; 환경 준비 필요 = amber chip, 미시험 neutral), Workflow start settings (TaskSetup)
surfaces. Known issues: violet pill + pulsing dot in page.tsx, decorative icons before section labels, tinted icon tiles,
category-coloured cards. Keep all behaviour, data and strings. The hub top-nav component (web/src/geo/hub/top-nav.tsx) is
owned by the hub child; if the header needs changes there, coordinate through the parent. Ports for your app
instance: UI 3330, API 18330.
## Common contract (both children)

Parent: gaid-design-identity (geoaidesk). User decision 2026-10-21 (verbatim): "1번 라로 하거나 현재 방식 유지다. 새로 제안한
디자인이 적절한 것이 없다. 2번 (가) 3번 (가)로 하고 (다)로 더 다듬거나 새롭게 디자인하는 것도 고려하자. 디자인은 항상 impeccable과
taste와 브랜딩 가이드 전문가 입장에서 디자인해야한다." → implement visual direction 라 "연구 등록부 / Research Register" in light
and dark themes; logo unchanged.

Read first (in your worktree): AGENTS.md; docs/design/ui-guide.md (v2; sections 1, 4, 4a, 9, 10 and the component
sections you touch); web/src/app/globals.css (tokens already done by the parent: use role classes such as
bg-gaid-frame, bg-background, bg-card, text-foreground, text-gaid-body, text-muted-foreground, border-border,
border-gaid-line-strong, text-gaid-link, bg-accent text-accent-foreground, bg-gaid-warning-bg text-gaid-warning,
bg-gaid-pending-bg; never hex or Tailwind hue utilities like violet-500/sky-600); geo/brand/README.md; the proposal
reports/2026-10-21-gaid-design-identity/index.md §3.3–3.4.
Visual reference (static prototype, same content): /home/seongin3/data/geoaidesk/work/gaid-design-identity/codex/
(dir-d.css, screens.html, png/d-{hub,work}-{light,dark}.png and *-1280.png) and its review.md (D section + "White
backgrounds and dark themes"). The prototype is a reference, not a pixel spec; keep app behaviour, data and copy.
Design lens (user rule): design as an impeccable + design-taste-frontend + brand-guide expert. Read
/home/seongin3/repos/skill_hub/.claude/skills/impeccable/SKILL.md, reference/craft-floor.md, reference/operate.md and
/home/seongin3/repos/skill_hub/.claude/skills/design-taste-frontend/SKILL.md §4, §9 (taste applies to discovery screens
like the hub, not dense tool panes). Review your result against them and against ui-guide §10 before finishing.

Rules that matter most: surface contract (frame / work surface / paper), register rows instead of card grids (V4), no
AI symbols (Sparkles/Wand/Bot) (V2), no gradients/backdrop-blur/glow (V3), no eyebrow labels (V5), images unfiltered and
no decorative placeholders (V6), 1 px lines and radius 0/2–4/6 px (V7), Pretendard only (V8), amber only for
action-needed states and category as text (S7, S8), both themes (S6), 12 px minimum text (T1), contrast (S4).

Do not edit: web/src/app/globals.css, docs/design/ui-guide.md, geo/ui/*, geo/integration-boundaries.json, reports/,
locale strings (no copy changes are planned; if one becomes necessary, ask the parent first). Upstream files outside
web/src/geo/ that you need beyond your list: ask the parent (it records boundaries). Tokens missing? Ask the parent;
do not add CSS variables yourself.

Verification: `cd web && npx tsc --noEmit -p . && npm test -- --run <your test files>` (fix tests you break; update
expectations only where the visual structure legitimately changed), `node geo/ui/check-ui.mjs`, and screenshots of your
screens in Korean at 1440×900 and 1280×800, light and dark, from your own app instance: copy the parent's data home
`rsync -a /home/seongin3/data/geoaidesk/work/gaid-design-identity/home/ ~/data/geoaidesk/work/<your-slug>/home/`, then
run `systemd-run --user --unit <your-slug>-app --collect -p WorkingDirectory=<worktree> -E PATH=$PATH -E HOME=$HOME
-E GAID_HOME=<that home> -E KADY_PORT=<api port> -E KADY_FRONTEND_PORT=<ui port> -p StandardOutput=append:<log>
-p StandardError=append:<log> <worktree>/start-gaid.sh` (absolute paths; a production build runs on start; restart the
unit after edits). Theme: toggle with the header theme button or set localStorage `theme` to `dark`. Screenshots with
`playwright-cli` (skill playwright-cli). Put them in ~/data/geoaidesk/work/<your-slug>/shots/ and list them in your
task document. Do not write reports; the parent integrates your screenshots and notes. Stop your app unit before finish.
Network: raw.githubusercontent.com is blocked.

## Current state
Implemented the Research Register system screens: aligned project rows; neutral Workflow lists/categories; amber preparation states and neutral untested/review chips; frame/work/paper note surfaces; 12 px header chips; shared control outline/focus/geometry. All data, strings and actions remain. New workspace defaults are tree 256 px / chat 400 px; saved widths remain unchanged.

Scoped checks passed: frontend typecheck, seven affected test files (72 tests), three follow-up files including workspace persistence (21 tests), production build/typecheck, UI checker and impeccable detector. Extra lint has seven baseline set-state-in-effect findings, independently reproduced from 1454b63f; no new errors. Parent's new slop scan has zero owned-file findings.

Final Korean screenshots: 16 PNGs in `/home/seongin3/data/geoaidesk/work/gaid-design-identity--system/shots/`, named `{projects,workspace,note,setup}-{light,dark}-{1440,1280}.png`. Manifest with SHA-256: `.../screenshot-manifest.json`; contrast evidence: `.../role-contrast.json`. App unit stopped and browser closed. Parent integration and full scripts/check remain with the parent; no deployment.

## Next steps
<!-- task:closed -->
Closed 2026-10-22T01:39:59Z: integrated into gaid-design-identity; closed with it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First screenshot matrix captured theme transitions before they settled. Those early captures are not delivery evidence; final capture waits for the theme.
- Routed notice 30c36f22b468 identifies the preview interruption: gaid-library-folders stopped our frontend/backend during a 3330/18330 port collision, then moved its instance to 3340/18340. We had already restarted our systemd instance, completed the final screenshots and stopped it. No code or user action is needed.
- Initial resume waited for another task transaction; retry succeeded without altering the other task.
- Running `npx tsc` at repo root selected the unrelated npm shim because dependencies were absent. Installed locked web dependencies and ran from web; typecheck passed.
- Initial app start inherited copied config port; stopped it before startup completed and restarted with KADY_ENV_FILE=/dev/null as directed by parent.
## Notes and decisions
- Final visual QA: both viewport sizes/themes have no horizontal page overflow; setup minimum visible text is 12 px; both header lockups use their correct asset on bg-gaid-header (dark rgb(23,31,36)). Original note cover/figure pixels are unfiltered. Role-pair contrast: light text ≥ 4.93:1, dark text ≥ 6.53:1; input boundaries ≥ 3.15:1 / 4.25:1. Header note actions fit at 1280 after the width correction. No analysis, model, registration, send-answer or status-changing action was run.
- Rule coverage: P2/P3/P4/P5, L2/L4/L6/L7, T1/T5, S1/S4/S6/S7/S8, V2–V8, G5/B6, A1/A2. No copy ids changed. Existing lint findings: seven react-hooks/set-state-in-effect errors, reproduced from baseline 1454b63f with eslint stdin; no behavior refactor in this visual task.
- Parent approved additional owned header files: resource-monitor.tsx, session-cost-pill.tsx, project-switcher.tsx; parent records their integration boundaries. Hub banner remains with the hub child.
- Sequential decisions: preserve supplied tokens and logo; keep all controls and data paths; omit absent descriptions and decorative thumbnails rather than adding copy.
- Owned files/interfaces: task contract above. No independent child packages (nested children unsupported); this coupled workspace pass is implemented by the single writer. Integration order: shared primitives, project/header, workflow/setup, notes, then browser verification.
- Checks are the scoped frontend/UI checks in the child contract; the parent owns full scripts/check and integration.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
None for this child. Existing lint debt and parent/hub-owned visual seams are recorded above; no new decision or approval is required.

## Report
Contributes to parent report `reports/2026-10-21-gaid-design-identity/index.md`; no separate child report.

## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
