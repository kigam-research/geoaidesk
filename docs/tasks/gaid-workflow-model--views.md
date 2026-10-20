---
format: 1
status: done
updated: 2026-10-20T15:29:47Z
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
Implemented all six requested WorkflowDoc mounts; exact preview/chat renderer, copy, all choices/options, source-labelled skills and read-only skill instructions. MethodFlow reuses picture/IO logic and uses steps/choiceIds; project steps are compact disclosures. Imported missing skills use the existing import/acknowledgement gate with ref prefill. CLI buttons now mount by default in hub and project detail, retaining exportAction overrides. No authoring/** edits.
Verification: 103 focused frontend tests passed after visual fixes; 29 view/method rechecks passed; 3 new server route tests passed; backend/frontend typecheck and focused lint passed. Korean screenshots of six mounts plus hub instructions at 1440×900 and 1280×800 (14 files) were visually inspected; no overflow outside the intended scroll panels or browser console errors. Source SHA 4e214c0204bd. Report sections 3.16 and appendix carry the result and three figures.
Full scripts/check job at 1b0ddcf0 failed the distribution seam-owner allowlist: child slug was not an allowed owner. Corrected new seams to parent owner gaid-workflow-model; the exact failing check now passes. First task finish passed backend 1965 tests (8 skipped) and all 1132 frontend assertions but failed on an existing file-preview saved-indicator timer after jsdom teardown. Full frontend rerun passed (1132). Parent authorized narrow timer lifecycle cleanup; the 8 file-preview tests including re-arm/unmount regression and all 1133 frontend tests now pass. Final task finish reruns the declared check and attaches its authoritative result.

Screenshot originals and hashes (base: /home/seongin3/data/geoaidesk/work/gaid-workflow-model--views/playwright):
- 01-hub-entry-1280.png: `18d3dda38d58d1a1971cc4743417402242ea1ae6c49b09b5b25a30e23eb2c6d4`
- 01-hub-entry-1440.png: `5b77afa9b3056f95a19a21a8ed32f63928628e95f79779337c23b8a89b031026`
- 01b-hub-instructions-1280.png: `43891cc91cb5a591e23bfd73488423cce187359c280c5ec4db703fd75e94baea`
- 01b-hub-instructions-1440.png: `df3d0fd89f6719232cd0f55428777b9af2344a8191049e175d4da9486a6bdcae`
- 02-hub-draft-1280.png: `9c6b81eda1eec393024822904d1e943cd6074215f393b8d50d3335857a079a9c`
- 02-hub-draft-1440.png: `1dfd18e740d3148a88fe1a23b4378c8aac346dac0b1a4a88977470244580bddc`
- 03-project-detail-1280.png: `512981e5b3c31422cb446cd29aba30023aa2ad91fd30dddbba0cf50f5259db59`
- 03-project-detail-1440.png: `682c8df9d9a21346209eeb012b976784e5430b175d0c8681292b47f14228d664`
- 04-setup-summary-1280.png: `45de160737076fb2ef8b58f531b08e07cbd4d83f523d5de4787c1558f7e3467c`
- 04-setup-summary-1440.png: `dab1b345d38f1877dc631e99adfa737a6c18ce1914f8e499d6546bece21af959`
- 05-catalogue-detail-1280.png: `905652b5f915ba7a372c4d0fce8e92c3a051a83b21714983e4b5d37d582759bf`
- 05-catalogue-detail-1440.png: `a90dc52d7498bced0876cbc06769361347b9701d3ba847e27139b25f48eabba3`
- 06-hub-catalogue-1280.png: `fac576fded6d2914f3e40aa9c6174f13377300f19d06ad0a5ee3c73a089a7aab`
- 06-hub-catalogue-1440.png: `76eccc51dc97e325b55da665ad6c9d4993437a66171dc4724ff299586f3940d4`
## Next steps
<!-- task:closed -->
Closed 2026-10-20T15:29:47Z: integrated into gaid-workflow-model; closed with it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First task finish: backend 1965 passed/8 skipped and frontend 1132 passed, but a file-preview TextEditor saved-indicator timeout fired after jsdom teardown (window is not defined). Parent authorized timer cleanup after observing a second intermittent failure in that area.
- Preliminary task sync checks were stopped after concurrent test/source edits invalidated their tree. Parent integration already completed.
- The first full check job found a seam-owner allowlist failure; use the parent work-package owner, not the child unit slug. No application source workaround was needed.
## Notes and decisions
- Finish retry target advanced to e9e076a (CLI integration). Resolved additive locale/report conflicts by keeping both; CLI result is report 3.17, views 3.16. Mounted default CliExportButton in hub/project details with existing exportAction overrides.
- Parent authorized a narrow baseline fix after final full-suite failure: code-views.tsx saved-indicator timer is now retained in a ref, cancelled before re-arm and on unmount; file-preview-panel test covers both. No test suppression. Optional lint of the upstream editor still reports pre-existing ref-in-render patterns outside this narrow fix; the focused Workflow view lint passed.
- Sequential decisions: preserve MethodFlow picture/IO renderer; adapt its profile from WorkflowDoc steps/choiceIds. Shared WorkflowView owns the remaining sections and rendered text.
- Owned interfaces: ReactNode exportAction slots for parent CLI integration; read-only /geo/hub/catalogue/:id, entry skill source, authoring draft document routes.
- Integration order: shared view → routes → all mounts → tests → visual checks/full checks. Parent is asked to own imported-skill backend readiness/exposure; child wires the import UI. No delegated workers (tightly coupled screens).
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
None. CLI producer integration reached the branch during the finish retry; default buttons are mounted and overrides remain available.
## Report
Report: reports/2026-10-20-gaid-workflow-model/index.md
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--views-20261020T142545.403242Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/work/gaid-workflow-model--views/playwright/screenshots.json"],"reason":"Temporary browser server intentionally stopped after UI QA; final evidence is preserved in screenshots.json.","recorded":"2026-10-20T14:47:59Z","state":"cancelled"}
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--views-20261020T142600.100164Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-14s5xnxk.log"],"reason":"Pre-final full check failed the seam-owner allowlist, now corrected and verified. Final task finish checks replace this superseded run.","recorded":"2026-10-20T14:48:18Z","state":"cancelled"}
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--views-20261020T143040.142590Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/work/gaid-workflow-model--views/playwright/screenshots.json"],"reason":"Temporary isolated browser test server stopped after all six mounted views and 14 Korean screenshots were verified; evidence is preserved under work/gaid-workflow-model--views/playwright.","recorded":"2026-10-20T14:34:36Z","state":"cancelled"}
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
