---
format: 1
status: waiting
updated: 2026-10-15T08:13:57Z
writer: {"host":"seongin3","reserved":"84f022dc40c565feab0199c4629c9faa29b46d0a9be164973d06b89729c28740"}
branch: task/gaid-improve--method-preview
target: task/gaid-improve
parent: gaid-improve
---
# gaid-improve--method-preview

## Goal and done criteria
Request from the starter:

# Child writer: method-preview

Goal: implement controlled method/question/draft/trial UI for the user-approved CLICKABLE source-first authoring prototype. Parent gaid-improve. Use task CLI isolated worktree, general work at normal speed; first resume printed child slug and read AGENTS/task. raw.githubusercontent.com blocked; uv Python only. No real model/execution/installation/publication requests or live review changes.

Read docs/design/authoring-preview-implementation.md, docs/design/source-authoring-agents.md, geo/copy/gaid-writing.md and terminology.csv; shared interface web/src/geo/contracts/authoring-preview.ts. Approved images source-first-02-coauthor.png and source-first-03-draft-trial.png under canonical report figures. Maintain calm source/method juxtaposition, readable Korean typography, white/slate/blue GAID/shadcn/Lucide identity. No NotebookLM visual design.

Owned files ONLY:
- web/src/geo/authoring-preview/method-pane.tsx, trial-pane.tsx, preview-dialogs.tsx and focused related tests.
- web/src/geo/locales/previewMethod/{ko,en}.json.
- Your task document.
Parent owns shared contract/state reducer/persistence/fixtures/app shell/routes/locale index (namespace already registered), report/boundaries. Do not edit parent or source-child files. Send precise interface blockers to parent if unavoidable.

Exports: PreviewMethodPane, PreviewTrialPane, PreviewDialogs, all using PreviewMethodProps {state,onEvent,onSourcePage}. Stateless/controlled views: emit PreviewEvent; parent owns state validity/transitions and browser-local save. Use canCreatePreviewDraft helper.

Method state: only the prepared sample's grounded finding, 50-km original-study setting distinctly separate from new-data choice; p.9 source link via onSourcePage(9), optional Figure6 source link to p.20. Do not guarantee spatial independence. Preserve saved purpose. Missing-code question choices attach-code/draft-code/procedure, none selected until user chooses; upload attached code metadata through attach event, allow defer, require file for attach-code before draft. Show that code-writing/analysis are unconnected preview actions, not real outputs. Parent ensures non-sample documents cannot reach this fixture analysis.

Trial state: editable draft title/summary; planned four-part method; separate skill and workflow launch-request contents; expected outputs marked as expected; untested/private state. source viewing uses onSourcePage. Explicit local preview save event. File preview dialog shows illustrative instruction/request content, not installed/validated files; no fake script implementation. Trial dialog lets user select file metadata and enter comparison criteria, then view a request summary; it NEVER starts a process or turns status into executed/pass. Procedure-only choice is explanatory, not an executable pipeline. Sharing dialog is review of proposed sharing contents only; no publication action. Every visible button should do something honest, not a dead decorative mock.

Use existing shadcn Button/Card/Dialog/Input/Textarea/RadioGroup/Badge/Sheet as suitable, accessible labels and keyboard behavior, responsive stack on narrow screens. User-facing strings ONLY geoText('previewMethod') and bilingual catalogs; current glossary says workflow, not 워크플로우. Avoid repetitive limitation walls; clear contextual preview/untested state is enough. No new dependencies.

Evidence: focused UI tests for choices/defer/gating/emitted actions and dialogs where meaningful, copy validator. Parent does integrated reducer/browser and required scripts/check. Follow child task CLI check rules; report exact checks/not-run. Finish with task finish; parent will task complete. No separate canonical user report, no model calls or scientific reruns.

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
