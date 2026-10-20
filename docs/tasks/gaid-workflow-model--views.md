---
format: 1
status: active
updated: 2026-10-20T14:20:15Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"ba3b4f2b-c8fe-4134-9b12-57a30c6692b3","pid":2648217,"provider":"codex","session":"01a159a9-b149-7c60-ad98-b868e9e79a56","start":"39359451","token":"6ad9a80a4529b2d1d5e199dd84072973e513b30277243ddd8deb218c1e6b41c9"}
branch: task/gaid-workflow-model--views
target: task/gaid-workflow-model
parent: gaid-workflow-model
---
# gaid-workflow-model--views

## Goal and done criteria
Request from the starter:

# Child task: gaid-workflow-model--views (Workflow 상세: one view of the final Workflow form)

Parent: gaid-workflow-model (geoaidesk). Read first: ADR docs/adr/2026-10-20-workflow-runtime-form.md (accepted),
report reports/2026-10-20-gaid-workflow-model/index.md §3.4, §3.10 item 2, §3.11–3.15, the shared contract
web/src/geo/contracts/workflow-doc.ts, web/src/geo/workflow/render.ts (workflowDocText), server/src/geo/workflow-doc.ts.
The user's requirement (2026-10-20): "GAID 허브에서도 최종 워크플로우 형태가 어떤 것인지 보여야 한다" — the hub and the
project must show the final Workflow form: what the AI agent receives. skill_hub is legacy: no skill_hub work.

## Goal
One shared view component `web/src/geo/workflow/workflow-view.tsx` that shows a WorkflowDoc:
1. 단계 (numbered; each with its skill, checks, researcher decisions, outputs) — for hub entries keep the existing
   concept pictures/IO examples of MethodFlow where they exist (reuse, do not fork MethodFlow's picture logic);
2. 사용하는 스킬 (name, source label 기본 제공 / 가져온 스킬 + ref / Workflow에 딸린 스킬, purpose, a "지침 보기" that
   opens the skill's SKILL.md read-only — reuse the terms child's web/src/geo/skills/skill-instructions.tsx when the
   skill is installed in the current project; on the hub show the bundled skill's SKILL.md from the registered package);
3. 입력, 연구자가 정할 조건 (all of them with options), 결과 파일, 해석 한계;
4. "AI agent가 받는 지침": the full rendered text (workflowDocText target "preview"; in TaskSetup's summary, target
   "chat" with the researcher's current settings) with a copy button;
5. legacy docs show the 이전 형식 note.
Mount it in: the shared hub entry page (replace "Workflow 단계"/flow section with the doc's steps when the entry has a
workflowDoc — HubEntryDetail.workflowDoc is already served; keep profile-based IO band, limits, comments), the hub
author's draft screen (serve the draft's doc from the authoring draft route), the project Workflow detail
(methods.tsx MethodDetail: workflows[].doc is already in GeoWorkflowSummary), a new detail button on catalogue
("기본 Workflow") rows in the Workflow panel (doc in GeoWorkflowSummary), the hub "추천" catalogue cards (replace the
toast with a page; add a read-only server route returning the catalogue Workflow's WorkflowDoc, e.g.
`GET /geo/hub/catalogue/:id`), and TaskSetup's summary step (a disclosure "AI agent가 받는 지침 보기" with the
researcher's settings filled in).
Also: readiness for gaid-workflow/v1 `skills[]` with source `imported` (missing → show it and offer the existing
"GitHub 등에서 가져오기" flow with the recorded ref), and fix the hub flow's researcher-decision marks so they come from
steps' `choiceIds` (report §3.5: shown 1 of 5 today).
Leave a slot for the CLI child's `CliExportButton` (web/src/geo/workflow/cli-export.tsx, being built in
gaid-workflow-model--cli): if that file exists when you integrate, mount it in the hub entry and project detail views;
otherwise leave a TODO-free prop slot the parent can fill.

## Ownership
You own web/src/geo/workflow/workflow-view.tsx (new), the screens listed above, and a new locale namespace
`workflowView` (ko first, en same meaning). The parent owns web/src/geo/contracts/workflow-doc.ts,
web/src/geo/workflow/render.ts, workflow-card.tsx and the workflowDoc namespace: if you need a contract change, ask the
parent (Paseo message) instead of editing them. Existing namespaces (hub, methods, workspace …) were just updated by the
terms child (merged into the parent before you start): edit them only for strings on the screens you change.

## Rules and checks
AGENTS.md UI copy rules (string ids before/after in your report) and docs/design/ui-guide.md (sections 1, 9, touched
components; rule ids followed/broken). Korean screenshots at 1440×900 and 1280×800 of every mounted place, in an
isolated GAID_HOME under ~/data/geoaidesk/work/gaid-workflow-model--views/ (copy ~/data/geoaidesk/work/gaid-workflow-model/home;
never ~/.geoaidesk). Tests for the view and each mount. Run scripts/check; remove build caches before finishing.
Evidence in your task document's Current state, first and self-contained (screenshot paths + sha256).

## Current state
Resumed in the printed worktree. Parent owns WorkflowDoc contract/render/runtime; this child owns view/mounts and read-only routes. No existing local edits.
## Next steps
1. Implement shared WorkflowView and MethodFlow document adapter; mount hub entry/draft, project detail, catalogue detail and setup summary.
2. Add bounded read-only document/source endpoints and imported-skill install link, then focused tests, UI screenshots and scripts/check.
## Failed approaches
## Notes and decisions
- Sequential decisions: preserve MethodFlow picture/IO renderer; adapt its profile from WorkflowDoc steps/choiceIds. Shared WorkflowView owns the remaining sections and rendered text.
- Owned interfaces: ReactNode exportAction slots for parent CLI integration; read-only /geo/hub/catalogue/:id, entry skill source, authoring draft document routes.
- Integration order: shared view → routes → all mounts → tests → visual checks/full checks. Parent is asked to own imported-skill backend readiness/exposure; child wires the import UI. No delegated workers (tightly coupled screens).
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
