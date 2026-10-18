---
format: 1
status: active
updated: 2026-10-18T08:07:02Z
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
