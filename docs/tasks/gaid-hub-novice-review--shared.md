---
format: 1
status: done
updated: 2026-10-18T09:38:15Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"b4c674e6-3330-4284-8f14-ab1e619c6fe4","pid":1905277,"provider":"codex","session":"01a14e0c-9ac1-7a22-84f7-fe396a47cfb5","start":"19875020","token":"c8527c7072114ae3c43b788a5371371c2e5e7835f8bb261a59ddaafbccd0b63b"}
branch: task/gaid-hub-novice-review--shared
target: task/gaid-hub-novice-review
parent: gaid-hub-novice-review
---
# gaid-hub-novice-review--shared

## Goal and done criteria
Request from the starter:

# Child unit gaid-hub-novice-review--shared: shared hub search, entry status and trial scope

Parent: gaid-hub-novice-review (first-time-user review of the GAID hub). Round-1 evidence (read it):
pc74:~/data/geoaidesk/work/gaid-hub-novice-review/novice1/summary.md findings 2, 6 and 7 (and log.md steps 2, 13, 18, 21).
Read AGENTS.md (GAID hub, UI guide, copy rules), docs/design/ui-guide.md sections 1, 8, 9 and G/F, geo/copy/gaid-writing.md.

## Goal
A first-time researcher browsing the shared hub (1) finds methods by ordinary words, (2) sees whether a method is
instructions only or includes run code, and (3) is not misled by trial counts.

## Work
1. Search (`GET /geo/hub/entries?q=`, server/src/geo/hub-shared/routes.ts; put the matching in a small new module, e.g.
   server/src/geo/hub-shared/search.ts, with unit tests): the round-1 user searched "니켈" and got nothing because the
   methods say "Ni". Split the query into words (every word must match somewhere); expand each word with a small
   alias table for commodities/elements (Korean name ↔ element symbol ↔ English name: 니켈/Ni/nickel, 구리/Cu/copper,
   금/Au/gold, 은/Ag, 아연/Zn, 납/Pb, 리튬/Li, 코발트/Co, 백금족/PGE, 희토류/REE, 철/Fe, 우라늄/U, 텅스텐/W, 몰리브덴/Mo,
   주석/Sn, 흑연/graphite ...) matching short ASCII symbols on word boundaries only (so "ni" does not match "unlabelled");
   also search the registered draft's description, input/output labels and limitations text. Keep the sort.
   Empty result (web/src/geo/hub/shared-browse.tsx): keep the reset button and add one short line of search tips
   (for example "원소 기호(Ni)나 방법 이름(PU)으로도 찾을 수 있습니다"), within UI guide W4.
2. Implementation state: add `implementation: "descriptive" | "implemented"` to `HubEntry`
   (web/src/geo/contracts/hub-shared.ts) from the entry's latest snapshot draft (`codeFiles.length ? "implemented" :
   "descriptive"`, as server/src/geo/authoring/package.ts decides). Show it on the shared entry page
   (web/src/geo/hub/shared-entry.tsx / shared-method.tsx) near the lifecycle/trial line, using these hub locale ids
   (the parent writer uses the same ids on authoring screens; add them to web/src/geo/locales/hub/{ko,en}.json if they
   are not there yet when you start, exactly with this text):
   - `draft.implementation.descriptive`: ko "분석 지침만 · 실행 코드 없음", en "Instructions only · no run code"
   - `draft.implementation.implemented`: ko "실행 코드 포함", en "Includes run code"
   - `draft.implementation.descriptiveHint`: ko "시험하면 AI agent가 이 지침에 따라 분석 코드를 새로 씁니다.",
     en "When you try it, the AI agent writes the analysis code from these instructions."
   Optionally also as a small badge on browse cards (UI guide: at most 3 badges per row).
3. Trial scope: the entry shows "GAID 시험 기록 {count}회 (검토 결과 아님)"; the user's input-only check counted as a
   trial, so a count alone suggests the method ran. Make the number honest: either (preferred, if bounded and cheap)
   also report how many recorded trials produced every required expected result file (the trial records already
   compare expected vs observed files, server/src/geo/methods/trials.ts) and show e.g. "시험 {count}회 · 결과 파일까지
   만든 시험 {done}회", or rename it to say these are started trials ("시험 시작 {count}회"). Keep "(검토 결과 아님)" meaning.
   Do not scan unbounded provenance per list request; the entry detail may do a bounded check.
4. Tests: server vitest for search and entry fields (test/geo-hub-shared*.test.ts or similar), web vitest for the
   browse empty state / entry badge. Run `node geo/copy/validate-copy.mjs web/src/geo/locales` and `node geo/ui/check-ui.mjs`.

## Scope
Own: server/src/geo/hub-shared/**, web/src/geo/contracts/hub-shared.ts, web/src/geo/hub/{shared-browse,shared-entry,
shared-method,shared-api}.*, their tests, and in web/src/geo/locales/hub/{ko,en}.json only keys under `shared.*`,
`home.browse.*` and the three `draft.implementation.*` ids above. Read-only: server/src/geo/methods/** (you may add
one small exported helper to trials.ts if needed; say so). Do not touch other web/src/geo/hub files, the authoring
server, hub-dialogs.tsx (registration preview is the parent's) or TaskSetup/workspace files.

## Evidence for the finish
Changed strings table (id, ko/en before → after), UI rule ids followed, test commands and results, Korean screenshots
of the entry page and an empty search at 1440x900 and 1280x800 (your own dev instance with a copy of
~/data/geoaidesk/work/gaid-hub-novice-review/home, own ports, data outside the repo; never use ports 3000/18000/3370/18370).
Record all of it in your task document. Server tests: run with `env -u VITEST_MAX_WORKERS taskset -c 0-7` if timing
tests flake under load. raw.githubusercontent.com is blocked on this network.

## Current state
- Delivered snapshot-grounded commodity-alias AND-word search (including description, bilingual IO labels and limitations), unchanged star/date/id ranking, explicit implementation state, empty-search tip and honest started-trial wording.
- Delivered shared install → NewProject → useProjects().create → selected new project → install flow using the parent's common component. Creation and install cannot run concurrently; the newly created name/id remains available while project props refresh.
- Focused server tests: 30/30 passed. Focused web tests: 8/8 passed. Server and frontend TypeScript checks passed. Copy/UI checks passed (0 errors; 57 existing copy warnings, 102 accepted UI debt).
- Actual copied-data QA: 니켈 / Ni / nickel returned the same three entries in the same order; adding an absent word returned none. Two entries report implemented, the paper-only entry descriptive. Created proj-7da5c2, selected it, installed the shown registered revision and reached its InputPrep screen. No analysis/model request was sent.
- Korean screenshots were visually checked at both required sizes; no horizontal overflow, implementation/trial lines readable, entry primary action visible, empty-state reset visible and keyboard Enter resets the query. Browser closed and QA services stopped. Parent integration and deployment are separate; no deployment was performed.
- The final declared scripts/check result is enforced and recorded by task finish: only a passing snapshot may be published ready for the parent.

## Next steps
<!-- task:closed -->
Closed 2026-10-18T09:38:15Z: integrated into gaid-hub-novice-review; closed with it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First task sync merged parent b32f43b9 but scripts/check failed at production TypeScript checking: a new test used unsupported getByRole option exact. Replaced it with an anchored name regex. Frontend tsc --noEmit and all 8 focused web tests then passed.
- Initial focused tests could not run because this fresh worktree had no npm dependencies. Installed both lockfiles with npm ci; no source workaround. task job run refused the dirty source before starting or issuing any job receipt; these short dependency installs ran locally.
- Extended integration fixture initially omitted the skill-description trigger, causing the existing format gate to reject it. Preserved the original trigger and appended Ni text. The next run exposed an obsolete phrase-search expectation: “이 연구원” now matches words across fields. Used a unique author surname and verified the intended AND-word semantics in the unit test.
- Initial isolated browser API calls failed CORS because its backend lacked KADY_FRONTEND_PORT=3380; restarted only that QA backend with its matching UI port.
## Notes and decisions
- UI rules: P1/B1 (one install task; secondary inline project creation), P3/W5/G2 (implementation is plain text beside trial scope, no extra badge row), F3 (empty result retains reset and adds one search hint), W4 (all new strings within 140/280 chars), R2 (creation failure detail remains collapsed), A1 (labeled name and project controls).
- Initial focused checks: backend typecheck passed; server focused tests passed 30/30; browse/method web tests passed 6/6; copy validator passed with 0 errors / 58 warnings (parent subsequently changed descriptiveHint to “스킬 지침” to remove its added warning); UI validator passed 0 errors / 102 existing accepted debt.

### Changed strings owned by this child
| Id | Korean before → after | English before → after |
| --- | --- | --- |
| hub.home.browse.search.hint | absent → 원소 기호(Ni)나 방법 이름(PU)으로도 찾을 수 있습니다. | absent → You can also search by element symbol (Ni) or method name (PU). |
| hub.shared.trials | GAID 시험 기록 {count}회 (검토 결과 아님) → GAID 시험 시작 {count}회 (검토 결과 아님) | {count, plural, one {# GAID trial record} other {# GAID trial records}} (not a review) → {count, plural, one {# GAID trial started} other {# GAID trials started}} (not a review) |
| hub.draft.implementation.descriptive | absent → 분석 지침만 · 실행 코드 없음 | absent → Instructions only · no run code |
| hub.draft.implementation.implemented | absent → 실행 코드 포함 | absent → Includes run code |
| hub.draft.implementation.descriptiveHint | absent → 시험하면 AI agent가 스킬 지침에 따라 분석 코드를 새로 씁니다. | absent → When you try it, the AI agent writes the analysis code from these instructions. |

- Parent expanded scope in this tab: add new-project creation to the shared install dialog using the existing POST /projects client; reuse the parent's NewProject component from draft-step.tsx and useProjects().create, then select it for installation (P1/B1). Parent owns trial.newProject.* strings; no new shared creation strings remain. Parent confirms the preview caller is hub-screen.tsx and already supplies implementation there.
- Sequential plan: settle search/API semantics → update shared entry/empty state → focused tests → isolated UI QA → declared checks and finish. Owned files follow the starter contract; no independent package warrants a reader, and nested child units are not supported.
- Trial scope uses the explicitly allowed “started trials” wording. Current observation reads whole provenance logs; no cheap bounded completeness aggregate exists. Do not introduce provenance scans into list/detail requests for a count.
- HubEntry implementation is required in API responses and derived at read time; stored entries need no migration. SharedMethodView accepts an optional implementation for the parent's registration-preview caller in hub-screen.tsx; parent confirmed that it now supplies the derived value. Shared entry always supplies it.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
### Verification evidence
- Backend: `cd server && env -u VITEST_MAX_WORKERS taskset -c 0-7 npm test -- test/geo-hub-shared.test.ts test/geo-hub-shared-search.test.ts` → 2 files / 30 tests passed.
- Web: `cd web && npm test -- src/geo/hub/shared-entry.test.tsx src/geo/hub/shared-method.test.tsx src/geo/hub/shared-browse.test.tsx` → 3 files / 8 tests passed after the type fix.
- `cd server && npm run typecheck`; `cd web && npx --no-install tsc --noEmit` → both passed.
- `node geo/copy/validate-copy.mjs web/src/geo/locales` → 0 errors / 57 warnings in the declared check. The new descriptiveHint warning was removed by the parent's exact wording correction; hub-only rerun has one pre-existing user.body warning.
- `node geo/ui/check-ui.mjs` → 11,210 strings, 0 errors, 102 existing accepted debt; no new baseline entry.
- First declared check via `env -u VITEST_MAX_WORKERS taskset -c 0-7 task sync`: backend 172 passed files / 1 skipped, 1905 passed tests / 11 skipped; web 163 files / 1076 tests passed; GAID tests, environment imports and launch checks passed. Two mzML tests were excluded by the existing PSI-MS network probe. Production smoke failed solely on the test type error noted above; final finish reruns the required gate after that fix.
- QA instance: UI http://localhost:3380; backend 18380; copy of the parent's novice-review home under pc74:/home/seongin3/data/geoaidesk/work/gaid-hub-novice-review--shared/home (config/credential files excluded). Original parent's ports/data were untouched. Systemd QA units and browser are stopped.
- UI requests observed: POST /projects 201, sandbox/init 200, installation 201, methods/tree 200. Console: 0 errors, two existing DialogContent description warnings. No new UI-rule exception was introduced.
- Section 10 visual review: P1/B1 one install primary with secondary creation form; L1/L6 no horizontal overflow and try/reset actions visible; S1/S3 role colours and textual states; A1/A2 named controls, visible focus, keyboard reset; R1/R2 no machinery/raw errors in the changed researcher view; W4/W5 no extra badge row and short state strings. Existing researcher-provided titles/notes are excluded from the body-copy budget. The 1280 empty-state capture scrolls the browse surface into view.
- API fixture evidence: pc74:/home/seongin3/data/geoaidesk/work/gaid-hub-novice-review--shared/api-search.json.

### Korean screenshots for the parent's report
Locator prefix: pc74:/home/seongin3/data/geoaidesk/work/gaid-hub-novice-review--shared/playwright/.

| File | SHA-256 |
| --- | --- |
| descriptive-1440x900.png | 33afd0537f4ccfc74aa4650a506f3322b756181d17b8e28fca449a47b09fa0c8 |
| descriptive-1280x800.png | c54c715fad669fa156f94034bab0cf01768fc55a258000a96ddbc4435fce5d40 |
| implemented-1440x900.png | a1e6cf8f1383014ddcafc7efebca37cbfebe2b5eba125071206118001d4af227 |
| implemented-1280x800.png | 3f7e003e01168698dfd0c6839c7fadeeec17ec048e5480684b45276fc533f6ad |
| empty-1440x900.png | 430e56bc9fdc9db84dfa2d4c1ef337b3f0188e4439e9fc6e636dad7c5bdc36ae |
| empty-1280x800.png | 943d1cc2c6d8933ba7ec9b5d5199c29838312b365cdf175cf59d78ad79f6aa39 |
| project-selected-1440x900.png | 04afd3da0bd65237460b4cf751151f423580f77027cbe9747b9e68c9801ac925 |
| project-selected-1280x800.png | 40fa5783dda294d4d3a736e9ac90f99735d94b268c137255a7d97b0b1b486057 |

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
