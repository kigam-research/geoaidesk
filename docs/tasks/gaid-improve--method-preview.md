---
format: 1
status: ready
updated: 2026-10-15T08:22:02Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"0f805fd9-0a65-4a06-a989-436a5ecdcca7","pid":2472511,"provider":"codex","session":"01a13ea0-2a2c-7e30-a258-fadfb356f741","start":"51804685","token":"84f022dc40c565feab0199c4629c9faa29b46d0a9be164973d06b89729c28740"}
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
Implemented PreviewMethodPane, PreviewTrialPane and PreviewDialogs against the frozen PreviewMethodProps contract. They emit typed events only: source-linked findings (pages 9/20), unselected implementation choices/defer, metadata-only attachments, gated draft creation, editable draft, local-save request and illustrative file/trial/sharing dialogs. The procedure branch is explanatory, not executable; all branches stay private/untested. No model, installation, execution, publication or server-write API was added. Parent integration and integrated browser checks remain parent-owned.

Focused evidence: 11 UI tests passed, including metadata gating, defer without an answer, every choice, edits/save/dialog events, non-sample finding suppression, bilingual formatting, trial-summary-only state and Escape/focus restoration. Web TypeScript and owned-file ESLint passed. Copy validator: previewMethod 0 errors/0 warnings; entire locale tree 0 errors/56 existing unrelated warnings. git diff --check passed. Re-verify from web: npm test -- --run src/geo/authoring-preview/method-preview.test.tsx; npx tsc --noEmit --incremental false; npx eslint src/geo/authoring-preview/{method-pane,trial-pane,preview-dialogs,method-preview.test}.tsx. From repo: node geo/copy/validate-copy.mjs web/src/geo/locales/previewMethod. Full scripts/check and browser checks have not yet been run manually in this child; task finish applies CLI-required checks.
## Next steps
<!-- task:closed -->
Closed 2026-10-15T08:22:02Z: ready; the parent gaid-improve integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Initial dependency-install task job was refused with "job source dirty; save first" before any receipt/job was created. No resume was needed. Installed frontend dependencies locally with npm ci --prefix web --no-audit --no-fund (11 seconds, no package/lock changes).
- Initial TypeScript check found PreviewAttachment was not assignable to the ICU MessageValues index-signature type. Fixed by passing plain metadata objects; recheck passed. No shared-contract change was needed.
## Notes and decisions
Sequential decisions: preserve saved purpose and source-specific findings; gate attach-code on metadata; emit events only. The three views are tightly coupled and are implemented by this single writer without readers. Parent owns reducer/state validity, persistence, report, full scripts/check and integrated browser checks. Integration order: method view → trial view/dialogs → focused tests → parent integration.
- All previewMethod IDs are new (previous catalogs were empty objects); no existing approved hero/install/limit strings changed. The complete Korean/English before→after copy record is the diff of web/src/geo/locales/previewMethod/{ko,en}.json: absent → catalog value for every added ID. Key transitions: previewMethod.method.createDraft absent → "선택한 방식으로 초안 보기" / "View draft with selected approach"; previewMethod.choice.draft-code.title absent → "논문 기반 코드 작성 계획" / "Plan code writing from the paper"; previewMethod.trial.previewRequest absent → "시험 요청 요약 보기" / "View trial request summary"; previewMethod.sharing.open absent → "공유할 내용 살펴보기" / "Review proposed sharing contents". previewMethod.finding.body preserves the no-independence-guarantee limit; setting.new.body rejects a 50 km default; choice.*.note and files/trial/sharing.dialog.description state their specific unconnected boundaries.
- No new app dependencies. Formatting used temporary npm-exec Prettier 3.6.2 without package or lock edits. Native HTML radio controls use a labeled fieldset, keyboard behavior and no implicit answer; shadcn dialogs trap focus and restore the opener on dismissal.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
None. Parent integration/browser checks are already in the parent's approved scope, not new user decisions.
## Report
No separate child report. Parent owns reports/2026-10-15-gaid-researcher-ecosystem/index.md and can incorporate the implementation, copy and evidence above.
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
