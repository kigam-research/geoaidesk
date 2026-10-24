---
format: 1
status: active
updated: 2026-10-24T06:56:10Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"c0846cc2-2d3c-4451-a536-928158b01728","pid":1419314,"provider":"codex","session":"01a16c9f-037c-7000-9c73-3a2648766336","start":"71166182","token":"eb92e9d2636de378ea79a8a04d9e6f61f7cc7146a51b50e547fadd07a2f678b8"}
branch: task/gaid-ia-connect-workspace--copy-rename
target: task/gaid-ia-connect-workspace
parent: gaid-ia-connect-workspace
---
# gaid-ia-connect-workspace--copy-rename

## Goal and done criteria
Request from the starter:

# Goal: gaid-ia-connect-workspace--copy-rename — rename visible place copy and update the docs

Apply the rename table of the parent report §3.6 with the user's decisions to existing visible copy, and update the docs.

- Locale strings (web/src/geo/locales/<ns>/{ko,en}.json) in every namespace EXCEPT `places` and `devPlaces` (the parent owns those) and EXCEPT the `library` namespace keys the library-panels child adds: GAID 허브 / 허브 (naming the place or the shared catalogue) → GAID Connect / Connect; 내 연구 (naming the place) → Workspace (or the specific screen); 허브에 등록 / 등록된 / 등록됨 → Connect에 공유 / 공유된 / 공유됨 (version wording unchanged); 허브 스킬 → Connect 스킬; 기관 GAID 허브 / 기관 허브 → 기관 Connect 서버 (Settings → 서비스, hub feeds, ORCID, removal notices); 허브 목록 → Connect 목록; authoringPreview "연구 공간" → Workspace; app `settings.workspace` English "Workspace" → "App" (Korean 작업 환경 stays); "작업 공간" sentences in workspace/files only where they read as the place name. Leave the external skill_hub "외부 허브" strings and code identifiers, routes, locale ids and namespaces as they are. English mirrors Korean (GAID Connect, GAID Workspace, Share, Shared, Institute Connect server).
- Particles after English names: Connect에/Connect에서/Connect의, Workspace로/Workspace에서 (Korean reading of the last syllable).
- Upstream (non-geo) strings live in the same catalogues (app, settings, …); change only those that name GAID's places.
- Fix tests that assert renamed strings (web and server). Run the copy validator and check-ui (W limits: buttons ≤ 16 Korean chars, titles ≤ 30).
- Docs: `geo/copy/terminology.csv` (rows GAID Workspace, GAID Connect, 서재 with definitions from the report §3.7; old place names as forbidden_ko where the validator allows; update 허브 스킬 → Connect 스킬), `docs/glossary.md`, AGENTS.md (place names, "Projects/GAID hub header switch" → Workspace/Connect switch + 서재 entry, "내 연구 → 서재" lines, institute server naming in visible copy only; keep code paths), `docs/design/ui-guide.md` L2, N1, N5, D6 per report §3.7, ADR `docs/adr/2026-10-24-gaid-connect-workspace.md` status → accepted 2026-10-24 with the verbatim decision, a one-line "superseded in part by" note in `docs/adr/2026-10-21-research-hub-library.md`, `docs/design/hub-authoring-service.md` place naming. Do not rewrite docs/tasks or history.
- Deliverable for the parent report: `~/data/geoaidesk/work/gaid-ia-connect-workspace--copy-rename/copy-changes.md` listing every changed string id with ko/en before → after (AGENTS.md requires this in the change report); mention its path and count in your task document.
- Owned files: locale JSON files (except places/devPlaces and the library-panels child's new library keys), tests asserting them, the docs listed above.

Context: parent unit gaid-ia-connect-workspace (geoaidesk) reframes GAID as GAID Workspace (analysis framework: projects, installed Workflows, AI agent, files, viewers, research notes) + GAID Connect (formerly GAID 허브: make/share Workflows) with 서재 as the researcher's personal literature space opened from either place. Read the parent report reports/2026-10-24-gaid-ia-connect-workspace/index.md (mockups, §3.6 rename table) and ADR docs/adr/2026-10-24-gaid-connect-workspace.md in your worktree. User decision 2026-10-24 (verbatim): "모두 권장대로 하자." (approve mockups; app bar shows Workspace/Connect; institute hub server is "기관 Connect 서버" in visible copy; "등록" becomes "공유": 공유된 Workflow, Connect에 공유, 공유됨, version wording unchanged).
Rules: follow AGENTS.md of your worktree (UI guide v2 sections 1, 2, 10 before UI work; copy rules: strings in locale catalogues, Korean first, English with the same meaning). Network: the KIGAM network blocks raw.githubusercontent.com; use NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt for npm. Server tests: unset VITEST_MAX_WORKERS or use 1. Python only via uv. Stay inside your owned files; if you must touch another file, keep the hunk minimal and say so in your task document. Do not touch the review app (gaid-review unit, ports 3000/18000) or any hub server.
Evidence: run the relevant checks (cd server && npm run typecheck && npm test -- <your tests>; cd web && npx tsc --noEmit && npm test -- <your tests>; node geo/copy/validate-copy.mjs web/src/geo/locales; node geo/ui/check-ui.mjs). Full scripts/check is run by the parent after integration; you may run it if time allows. Record in your task document what you changed and the check results, then task finish.

## Current state
- Ready for parent integration: renamed GAID Connect / Workspace and Workflow sharing copy (147 locale ids + 8 server copy entries), reconciled terminology/current docs, accepted the ADR with the verbatim decision, and updated affected assertions. No runtime interfaces, identifiers, routes, storage or external skill_hub copy changed.
- All required child checks passed: server/web typechecks; server 3 suites / 19 tests; web 18 suites / 171 tests; copy validator 0 errors (101 existing warnings); UI checker 0 errors (78 accepted debt, unchanged baseline); `git diff --check`.
- Parent deliverable: `/home/seongin3/data/geoaidesk/work/gaid-ia-connect-workspace--copy-rename/copy-changes.md` lists all 155 copy entries with Korean/English before → after, scope exceptions and verification. Parent should add it to its canonical report. Full integrated `scripts/check` belongs to the parent.
- Verification source: `dc1af6c8bd99`; job 3 exited 0. Its receipt/log are recorded under Running jobs. Dependency install jobs 1/2 also exited 0; checks reused their modules against identical lockfiles, without changing dependencies.
- Parent extended ownership on 2026-10-24 to researcher-visible server place copy. Changed `server/src/geo/authoring/hub-skills.ts` (standard question/reason/option) and `server/src/geo/routes/orcid.ts` (bilingual callback page). Inspected `orcid/service.ts`, `hub-client/{client,connection,remote-store}.ts` and `routes/hub-server.ts`: their errors appear only in technical disclosures (`orcid-card.tsx`, `hub-server/parts.tsx`, `hub-feeds/feeds.tsx`) and remain unchanged as instructed. Model prompts/logs/codes are unchanged.
- Parent owns `places`/`devPlaces`; library-panels owns its new library keys. This child changes only existing `library.tabs.label` and `library.detail.usesTitle`. Files are otherwise inside the original owned locale/docs/assertion scope. Existing upstream test seams are already listed in `geo/integration-boundaries.json`.
- UI guide sections 1, 2 and 10, copy guidelines, terminology, parent report §3.6–3.7 and relevant ADRs were read before changes. Domain-modeling and humanizer file mode were applied to the current docs. Historical ADR content and user quotations remain intact.
## Next steps
<!-- task:closed -->
Closed 2026-10-24T06:47:19Z: ready; the parent gaid-ia-connect-workspace integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- `task job run` refused dependency installation while source edits were dirty (`job source dirty; save first`); checkpoint reviewed changes before launching checks. No install job started.
- First `task finish` merged parent interim work and ran full `scripts/check`. Backend: 2,322 passed, 8 skipped, one unchanged `geo-workspace.test.ts:349` session-exposure test exceeded its 5,000 ms timeout (6,233 ms). Log: `/home/seongin3/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-hlsg1kbw.log`; output: `/home/seongin3/data/geoaidesk/work/checks/e02b11668196-20261024T064719.269546Z`. An immediate isolated rerun of that whole file passed 19/19 in 4.75 s, without code edits. Retry finish once with `VITEST_MAX_WORKERS=1`; do not weaken assertions or increase timeouts for a copy-only change.
## Notes and decisions
- Follow UI rules L2, N1, N5, D6 and W1–W4. Shorten the import action to `Connect에서 가져오기` / `Import from Connect` (the Workflow panel supplies the object), version-install action to `version {revision} 설치`, and the busy handoff action to `초안 만드는 중` to keep W1's 16/32-character button limits. Pure wording changes need no screenshots (UI guide §0.3).
- Terminology forbids unambiguous `GAID 허브` / `GAID 시스템`; bare `허브` and `내 연구` cannot be forbidden globally by the substring-based validator because external skill_hub and ordinary research language remain valid.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Parent canonical report: `reports/2026-10-24-gaid-ia-connect-workspace/index.md`; no separate child report. Contribution inventory: external `copy-changes.md` locator above.

(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-ia-connect-workspace--copy-rename-20261024T064203.376855Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-ia-connect-workspace--copy-rename-20261024T064217.311938Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-ia-connect-workspace--copy-rename-20261024T064408.558164Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
