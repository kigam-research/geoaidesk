---
format: 1
status: waiting
updated: 2026-10-11T06:49:53Z
writer: {"host":"seongin3","reserved":"0ad6da35675d2000f5c07717317e785564506d6fc8b8286f4dc84b6231054c5a"}
branch: task/gaid-korean-workspace--tasks
target: task/gaid-korean-workspace
parent: gaid-korean-workspace
---
# gaid-korean-workspace--tasks

## Goal and done criteria
Request from the starter:

# Child writer brief: `gaid-korean-workspace--tasks` (geoaidesk, WP07 task UI)

You are a child writer of top-level unit `gaid-korean-workspace` (WP07 of the GeoAIDesk plan). Run `task resume` for
your slug first, read the returned worktree's AGENTS.md, and work only there. Base: parent branch at ba1a71b (the
shared foundation below is already in it).

## Goal (from the package text; do not add required items)
WP07 done criteria you serve: "researcher opens data, sees relevant actions, launches the correct pack, and opens
outputs. Missing skills/environments are not shown as ready. New chat/pack transitions preserve drafts." You build the
task UI components; the parent builds the server routes, the upstream mount points and the actual-screen checks.

## Already settled by the parent (read these files first; do not change their signatures)
- Contract types: `web/src/geo/contracts/workspace.ts` (GET /geo/workflows, POST /geo/suggestions {path},
  POST /geo/recipes/check {recipe}, start-task hand-off, geo-result reference). The parent implements the server
  routes in parallel in `server/src/geo/workspace/`; develop and test against mocked `apiFetch` (`@/lib/projects`
  pattern used by existing tests). If you need a contract change, write it under "Notes and decisions" in your task
  document with the reason and continue with the current contract; do not edit the contract file.
- Hand-off: `startGeoTask(detail)` in `web/src/geo/workspace/events.ts` returns `"opened" | "tab-limit" |
  "no-workspace"`; app/page.tsx opens a NEW tab whose composer holds `detail.text` (never sent automatically), with
  `attachedFiles`, pinned `skills` and `geoExposure: "workflow:<id>"` (the session is created with that skill exposure
  on the first send). The source tab keeps its own draft.
- Mount points that already render your components (placeholders now; replace their bodies, keep names/props):
  - `web/src/geo/workspace/task-catalogue.tsx` `GeoTaskCatalogue({projectId, availableFiles, children})`: the
    workflows view; `children` is the upstream K-Dense workflow list.
  - `web/src/geo/workspace/file-actions.tsx` `GeoFileActions({path, projectId})`: above the file viewer in view mode.
  - `web/src/geo/workspace/chat-actions.tsx` `GeoChatActions({projectId, sessionId, isStreaming})`: chat composer
    toolbar next to the prompt-budget chip.
  - `web/src/geo/workspace/result-card.tsx` `GeoResultBody({card, projectId, onOpenFile})`: body of the
    scientific_result card kind `geo-result` (basic version exists).
- Strings: `t("workspace.<key>", values)` from `@/geo/i18n`; catalogue `web/src/geo/locales/workspace/{ko,en}.json`
  (ICU subset; existing keys `result.label`, `result.open`). Catalogue text such as workflow titles comes as `{ko, en?}`
  from the server: pick `en` when `geoLocale()==="en"` and it exists, else `ko`.

## Owned files
`web/src/geo/workspace/**` (except `events.ts` and `tab-state.ts`, which you use but do not change),
`web/src/geo/locales/workspace/{ko,en}.json`, tests next to them. Do not edit upstream files, other locale namespaces,
contracts, server code or `geo/integration-boundaries.json`. If a mount point is missing something, record it in your
task document; the parent changes the seam.

## What to build
1. **Task catalogue** (`GeoTaskCatalogue`). When `GET /geo/workflows` reports `catalogue.state === "ready"`: list the
   catalogue workflows (7 in 0.2.0) as compact cards: title, one-line description, accepted input formats, expected
   outputs, the boundary (what the result does not claim), a readiness badge and, when `readiness.runRecord ===
   "none"`, a separate 미시험 badge ("GAID 실행 기록 없음"). Readiness wording is exact: only `ready` may read as ready;
   `missing-skills` names the missing skills; `needs-environment` names the environment and offers an explicit
   "환경 준비" action (`POST /geo/environments/<id>/prepare` with `{target: "project"}`, progress and error output shown,
   then re-fetch); `unavailable` says why. Never merge run record, environment and skill state into one "verified"
   badge. Actions per card: open the task setup; import a recipe (below). Keep the upstream list reachable through a
   secondary control (render `children` on demand). When the catalogue is not ready, render `children` with a one-line
   status of the geo catalogue above it.
2. **Task setup dialog** (shadcn Dialog). For one workflow: each input role with a file picker over `availableFiles`
   filtered by the role's `extensions` (the file the user came from preselected for the matching role); each required
   scientific choice as a select (when `options`) or a text field, with its `why`; a choice may be left for the agent to
   ask ("작업 중 결정"), recorded as unresolved; expected outputs and boundary shown. Primary button creates the task
   draft: compose the draft text from the workflow `prompt` (locale) plus input bindings, answered choices and
   unresolved choices, using catalogue message templates (complete messages, no fragment concatenation); pin the
   workflow's primary skill when `/skills` lists its runtime name as enabled; call `startGeoTask` with title = workflow
   title. The button is enabled only for `ready`; for `needs-environment` show the prepare action instead; handle
   `"tab-limit"` with a clear message. Form state survives closing and reopening the dialog for the same workflow in
   the same page session (draft preservation), and is cleared after a successful start.
3. **Recipe import** (`.geo-start.json`, schema `geo-start/v1`). From the catalogue (file input) and from
   `GeoFileActions` when the open file ends with `.geo-start.json` (read it via the existing sandbox read API used by
   the file preview). Send `{recipe}` to `POST /geo/recipes/check`; show `issues` (code + message) when not ok; when
   ok, open the task setup prefilled with `setup.choices` / `setup.unresolvedChoices`. Importing never starts or
   sends anything.
4. **File actions** (`GeoFileActions`). `POST /geo/suggestions {path}`; render at most three suggestions as a compact
   strip: title, why it matches (input role label + format), choices still needed, readiness badge, and a button that
   opens the task setup with this file bound to the matching role. Render nothing when there are no suggestions or the
   catalogue is off; never auto-run.
5. **geo-result card** (`GeoResultBody`): result kind label, manifest path, optional thumbnail (reuse how the plot
   card in `web/src/components/scientific-result-card.tsx` builds image URLs, including `withApiToken`), one button
   that names its object (지도 열기 / Depth track 열기 / 검증 곡선 열기) calling `onOpenFile(manifestPath)`.
6. **Make reusable skill** (`GeoChatActions`): button "재사용 스킬 만들기" enabled when `sessionId` is set and not
   streaming. Dialog: skill name (Pi rule: lowercase letters, digits, hyphens, ≤ 64) and one sentence describing the
   task. On confirm: `createSkill({name, description, scope: "project"})` from `@/lib/capabilities` (POST
   /skills/create, template), then `prefillChat(text)` (`@/lib/chat-prefill`) with an instruction to fill
   `.pi/skills/<name>/SKILL.md` from the completed work in this chat: inputs, steps, scripts copied into the skill
   folder, limits, and no validation claim. Show creation errors (e.g. name exists). Nothing is sent automatically.

## Copy, accessibility, layout
- Every visible string in `locales/workspace/{ko,en}.json`; read `geo/copy/gaid-writing.md` and
  `geo/copy/terminology.csv` first and follow the agent prompt block in AGENTS.md ("UI copy and locales"). Korean
  first; buttons = object + action (`작업 설정 열기`, `환경 준비`, `레시피 가져오기`); no question titles, hype words or
  emoji; limits (미시험, 검토 전, boundary text) are never removed.
- Keyboard: every action is a button/input reachable by Tab with a visible focus ring; dialogs trap focus and close
  on Esc; badges carry words, never colour alone.
- Narrow layout: cards and the suggestion strip wrap at 375 px without horizontal scrolling.

## Checks (yours)
`cd web && npx tsc --noEmit && npx vitest run src/geo && npx eslint src/geo/workspace && node ../geo/copy/validate-copy.mjs src/geo/locales`
Component tests with mocked `apiFetch` for each component, including: readiness states never shown as ready unless
`ready`; the start button disabled for missing skills; `startGeoTask` called with the expected detail (text, files,
skills, exposure); the dialog keeps its form after close/reopen; recipe issues displayed; at most three suggestions.
The parent runs the full `scripts/check` and the browser checks. No paid model runs. The KIGAM network blocks
raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"` if you need GitHub files.

## Finish
Keep your task document current. In it, list the string ids you added with Korean and English text. `task save`
reviewed files, then `task finish`.

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
