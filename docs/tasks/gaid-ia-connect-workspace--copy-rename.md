---
format: 1
status: waiting
updated: 2026-10-24T06:35:13Z
writer: {"host":"seongin3","reserved":"eb92e9d2636de378ea79a8a04d9e6f61f7cc7146a51b50e547fadd07a2f678b8"}
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
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
