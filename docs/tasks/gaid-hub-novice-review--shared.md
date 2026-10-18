---
format: 1
status: active
updated: 2026-10-18T08:13:34Z
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
   - `draft.implementation.descriptiveHint`: ko "시험하면 AI agent가 스킬 지침에 따라 분석 코드를 새로 씁니다.",
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
- Shared hub search, code-availability labels and started-trial wording are implemented. Server focused tests pass (30/30); browse/method web tests pass (6/6). New-project creation wiring awaits the parent's saved NewProject export for integration/QA.
- Resumed the assigned writer in the original printed worktree; read the task, project rules, UI guide and round-1 evidence.
- Implemented snapshot-grounded multiword commodity-alias search, latest-snapshot implementation state and empty-search hint; verification pending.
- Codegraph has no index for this exact worktree; used native reads as instructed.
## Next steps
1. Add focused server/web tests, run declared checks, then capture Korean entry/empty-search screenshots on isolated ports.
## Failed approaches
- Initial focused tests could not run because this fresh worktree had no npm dependencies. Installed both lockfiles with npm ci; no source workaround. task job run refused the dirty source before starting or issuing any job receipt; these short dependency installs ran locally.
- Extended integration fixture initially omitted the skill-description trigger, causing the existing format gate to reject it. Preserved the original trigger and appended Ni text. The next run exposed an obsolete phrase-search expectation: “이 연구원” now matches words across fields. Used a unique author surname and verified the intended AND-word semantics in the unit test.
- Initial isolated browser API calls failed CORS because its backend lacked KADY_FRONTEND_PORT=3380; restarted only that QA backend with its matching UI port.
## Notes and decisions
- UI rules: P1/B1 (one install task; secondary inline project creation), P3/W5/G2 (implementation is plain text beside trial scope, no extra badge row), F3 (empty result retains reset and adds one search hint), W4 (all new strings within 140/280 chars), R2 (creation failure detail remains collapsed), A1 (labeled name and project controls).
- Checks so far: backend typecheck passed; server focused tests passed 30/30; browse/method web tests passed 6/6; copy validator passed with 0 errors / 58 warnings (parent subsequently changed descriptiveHint to “스킬 지침” to remove its added warning); UI validator passed 0 errors / 102 existing accepted debt.

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
