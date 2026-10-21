---
format: 1
status: active
updated: 2026-10-21T14:29:42Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"e3423a72-7472-4e57-ad64-7b7af68d8b04","pid":1024923,"provider":"codex","session":"01a15ebd-f21c-75a3-acb8-bed850e7227a","start":"47880771","token":"c6c81568434110b18d55cffb1d1710ded8914bb8b12f012ac7eedcc3d6246168"}
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
- Active implementation in the resumed worktree. Shared navigation, hub entry rail, recommended/authored/shared registers, avatars and authoring surface vocabulary changed to direction 라.
- Decisions: sequentially establish role-token surfaces, then register anatomy, then checks/browser evidence. No independent owned package exists within this child; work remains with this single writer. Parent owns globals/tokens, UI rules, reports and integration boundaries.
- No routes, data contracts or locale values changed. Existing hub.io.generated text labels concept previews without adding copy.
- Verification passed: `cd web && npx tsc --noEmit -p .`; `npm test -- --run src/geo/hub src/geo/hub-picker src/geo/workflow` (13 files, 67 tests); `node geo/ui/check-ui.mjs` (0 errors, 89 existing accepted debt); impeccable detector over owned directories returned `[]`; `git diff --check` clean.
- Rules followed: S1–S8, V1–V10, G4/G5, N2, B1/B6. Existing content/controls preserved. No new UI debt or copy ids.
- Final production build succeeded after the bounded visual-fix batch. Repeated TypeScript and all 67 targeted tests passed; UI validator remains 0 errors. No scientific analysis, installation, publication or model calls were triggered during browser checks.
- Browser checks passed: empty search recovery, retained query across catalogue/mine tabs, retained local answer across Previous/Next, visible keyboard focus. Browser console: 0 errors/0 warnings. All 36 captures have no horizontal page overflow.
- Dark header computed evidence: `web/src/geo/hub/hub-shell.tsx` renders `/brand/gaid-compact-on-dark.svg` on `rgb(23, 31, 36)` (#171F24). Light uses the separate colour lockup. Logo geometry/files unchanged.
- Visual inspection followed UI guide section 10 and impeccable/taste anti-tells: row anatomy, single primary, neutral states, readable category text, original concept pixels, no image placeholder, no tinted icon tiles, no blur, no generic AI symbols. Small-radius shared Badge overrides and stronger question radio boundaries were the one final fix batch. The source/trial workflow and existing content remain unchanged; long source forms continue to scroll internally.
- Screenshots (final build, Korean, 2026-10-21): `/home/seongin3/data/geoaidesk/work/gaid-design-identity--hub/shots/`. Each basename below has `-light-1440.png`, `-light-1280.png`, `-dark-1440.png`, `-dark-1280.png` (1440×900 and 1280×800):
  - `hub`: hub home/recommended/shared register.
  - `mine`: authored register/folders/stages.
  - `entry`: registered Workflow detail with real concept image.
  - `sources`: authoring source inputs.
  - `questions`: one-question/option/Other flow.
  - `draft`: draft overview/steps/trial preparation.
  - `trial`: optional trial page (copied draft has no installed trial).
  - `picker`: actual project Workflow import dialog.
  - `projects`: shared GaidHubEntry rail on project list (other project-list styling belongs to the system child).
- Evidence manifests/logs beside shots: `shots.sha256`, `final-capture.log`, `browser-checks.log`, `impeccable-detect.json`. No screenshots copied into reports here; parent selects/integrates them.
- Full `scripts/check` belongs to the parent integration; child checks are the exact requested targeted set.
## Next steps
<!-- task:closed -->
Closed 2026-10-21T14:05:59Z: ready; the parent gaid-design-identity integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First two `task resume` attempts saw a transient parent task-start transaction; successful third resume returned the same worktree.
- `task job run -- npm --prefix web ci` refused dirty source before creating a job; the authorized app launcher installed local dependencies instead.
- First isolated app startup used copied `config.env`, overriding API port to the parent's 18310. No configuration content read or edited. Restarted with `KADY_ENV_FILE=/dev/null` so explicit ports take precedence.
## Notes and decisions
- Parent confirmed the first visual batch matches the chosen direction; requested dark-logo/background verification is recorded above.
- No copy changes, schema changes, model calls, backend changes or report ownership changes.
## Open items
None.
## Report
Parent canonical report: `reports/2026-10-21-gaid-design-identity/index.md`. This child supplies implementation notes and external screenshots for that report.
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
