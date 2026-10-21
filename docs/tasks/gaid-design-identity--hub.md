---
format: 1
status: waiting
updated: 2026-10-21T13:54:19Z
writer: {"host":"seongin3","reserved":"c6c81568434110b18d55cffb1d1710ded8914bb8b12f012ac7eedcc3d6246168"}
branch: task/gaid-design-identity--hub
target: task/gaid-design-identity
parent: gaid-design-identity
---
# gaid-design-identity--hub

## Goal and done criteria
Request from the starter:

# Child gaid-design-identity--hub: apply direction 라 to the GAID hub screens

Goal: the GAID hub reads as GAID's own "research register" in light and dark themes, with no AI-slop signs.
Owned files: web/src/geo/hub/** (including top-nav.tsx and hub-shell.tsx, shared by the project list header),
web/src/geo/hub-picker/**, web/src/geo/workflow/** (Workflow view/cards used on hub pages), their tests.
Screens to cover: hub home (#hub: header area, the two entry actions, recommended Workflows, catalogue tabs/search/
folders/list), shared Workflow entry detail (#hub/e/<id>), authoring screens (Workflow 만들기: source, questions, draft,
trial) at least for surfaces/lines/buttons, hub picker dialog. Known issues to fix: Sparkles icon as the hub symbol
(top-nav, sticky bar in shared-method.tsx, project list banner if rendered from hub code), random 6-colour avatar
palette (shared-method.tsx), backdrop-blur headers, card grids with centred placeholder icons for Workflows without a
picture (remove the placeholder; show a picture only when one exists, unfiltered, labelled 개념도), equal card grids for
recommendations and catalogue (register rows, ui-guide V4/G4/G5), tinted icon tiles, pill tabs. Keep all behaviour,
routes, data and strings. Ports for your app instance: UI 3320, API 18320.
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
