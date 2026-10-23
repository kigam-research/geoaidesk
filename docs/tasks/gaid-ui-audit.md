---
format: 1
status: done
updated: 2026-10-23T16:11:02Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"07ebb9d0-f814-4f6d-b9a5-645bc5f63caf","pid":1787710,"provider":"claude","session":"3df14864-ec0f-4f87-934c-dfb313401438","start":"65687147","token":"baba760f0e777618475bfc83f39f8b969255847d56462aba6ba7f9ef2c283e10"}
branch: task/gaid-ui-audit
target: main
parent: 
---
# gaid-ui-audit

## Goal and done criteria
Request from the starter:

# Goal: gaid-ui-audit — audit and fix every screen changed 2026-10-22/23 against UI guide v2, in the integrated review app

## User request (verbatim, 2026-10-23)

> 모든 작업이 완료된 후 메인에서 병합되고 검토용 앱에 통합된 후에 ui/ux 가이드 지침으로 개선한 시스템들의 개선 및 구현 상태를 점검해야한다. 이유는 구현할 때 이러한 가이드를 충분히 숙지하지 못하고 워커들이 작업했을 수 있기 때문이다. 사용자의 피드백이 올바른지 먼저 확인받자.

Confirmed after the hub's evidence and plan: "맞다. 점검 작업도 opus 5.5 high fast로 진행하자."

## Evidence the hub showed (from the units' reports)

Uneven guide compliance: gaid-hub-versions report cites no rule ids and has no 도폭/dark screenshots; gaid-note-library and
gaid-workflow-start-ui have no 도폭/dark screenshots; gaid-workflow-example and gaid-authoring-sources few rule ids. `geo/ui/check-ui.mjs`
checks only proxies (hard-coded colours, small text, copy length, slop proxies); nobody checked cross-screen consistency in the integrated app.

## Done

1. Inventory: the screens changed by the 2026-10-22/23 units (reports under reports/2026-10-22-* and reports/2026-10-23-*: hub-feeds,
   hub-server-trial, orcid, project-resume, note-library, workflow-example, authoring-sources, hub-versions, library-pdf-panel,
   authoring-evidence-view, workflow-start-ui, pocheon-trial fixes, workflow-cite-scope, workflow-stages). At least: 서재 (papers / 정리
   노트 switch, PDF side panel, ORCID card), Workflow start window (소개, stage pages, 근거 논문, example data, summary), hub authoring
   (multi-source intake, data files, question + evidence viewer, example data attach, register dialog with shared-example notice), hub
   lists/entries (version, removal/restore, 자료 소식), Settings → 기관 GAID 허브 (admin: invites, feeds sources), project switch/resume.
2. Capture each in both styles (계측 default, 도폭) and both themes (light, dark) at 1440×900 and 1280×800, Korean UI. Read
   `docs/design/ui-guide.md` §1, §2, §10, §12 and the component sections first; values in `geo/ui/ui-rules.json`.
3. Check against §12 and the relevant rules; list every deviation with its rule id, screen, severity (blocks use / visible
   inconsistency / polish) and fix it. Cross-screen consistency is in scope (same parts, headers, buttons, spacing, empty/loading/
   error states, step rails, side viewers). Copy follows `geo/copy/gaid-writing.md` and `terminology.csv` ("version", never 판).
4. Report (result first) with before/after Korean screenshots as small tracked PNGs, rule ids followed/broken, and remaining debt
   (added to `geo/ui/ui-baseline.json` only with a reason). Checks: scripts/check (incl. check-ui and copy validator).

## Notes

- Use an own GAID instance for captures/fixes (copy what you need from `~/.geoaidesk` into `~/data/geoaidesk/work/gaid-ui-audit/`), own
  ports (not 3000/8000/8700/18000). The review app (PC74, main d17b6216, loopback-only) and the institute hub server (7703739a) are
  deployed by the hub after integration; do not restart or change them. You may read the review app at http://127.0.0.1:3000 to compare.
- Design stance (user rule): impeccable + design-taste-frontend + brand-guide expert; no new imagery (the user chose to keep the
  existing design after gaid-visual-benchmark). Colours only through tokens; original pixels for figures/maps/PDFs.
- Workers: child writers only via `task start --parent`, readers via `task reader`. Example analyses, if any: coarse/loose, ≤10 min per
  run, method kept whole (user rule). After this unit the hub updates the review app and starts promo video v3. Outside check: none.

## Current state
- Own instance: unit `gaid-audit-app` (`~/data/geoaidesk/work/gaid-ui-audit/run-dev.sh`, next dev on 3410, backend 18410), data copied
  from `~/.geoaidesk` to `~/data/geoaidesk/work/gaid-ui-audit/home` (logged in to the institute hub server as admin: read only, never
  register/remove/restore from this instance). Capture harness `cap.mjs` + `scenarios.mjs` + `montage.py` in the same folder
  (`node cap.mjs <out> <scenarios> all|base`); before shots `shots/before/`, explore `shots/explore*/`.
- Inventory and first pass done (base + 4 variants of hub, feeds, skills, removed, drafts, entry, authoring sources/questions/draft,
  register preview, remove dialog, library papers/detail/PDF/notes, workspace notes, start window Yilgarn + Pocheon, switcher,
  settings hub card + admin).
- Fixed so far (rule ids): S3/I2 blue on status/decoration (note 검토 전 badges, draft stage chip, registered chip colour, Workflow
  kind pill, blue callouts in draft/source/trial/editing notice, flow number circles, method-flow chips, 권장 reason text);
  hub page headers unified with `web/src/geo/shell/page-header.tsx` (feeds, skills, removed; hub home uses it; T3 no Hangul
  tracking); registered list version cell number only (X1/I5); authoring sources: one-option 만들 종류 removed (Q2), sticky action
  footer (L7); draft: duplicate 초안 label (W5), disabled install says why (S7), installed line success colour; copy: 에이전트 →
  AI agent (terminology), hub → 허브, hub skills 별표 → star; start window: summary heading 요약 (Q4), purpose one line (W6),
  stage reason names missing inputs (S7); library: title first at page-title size, sync line under it (L4/T1), uses clamp (G1/T5),
  note table date format; segmented controls unified via `web/src/geo/shell/segmented.ts` (admin, auth, example source, figure
  tabs); guide text 판 → version (I5, G2, C3, R3); example-data attach form no longer a card in a card (V5); authoring sources
  footer sticks into the pane padding (1280 check). After shots: `shots/after/` (184, all variants), montages `shots/after-m*`.
- Checks: web vitest for touched areas 33 files / 187 passed; check-ui 0 errors (78 accepted debt, none added); copy validator
  0 errors (100 pre-existing warnings, none on changed strings); scripts/check passed (exit 0, `check-1.log` in the work folder).
- Report written and humanized: reports/2026-10-24-gaid-ui-audit/index.md (31 deviations, 26 fixed, 5 left as debt).
- Instance `gaid-audit-app` stopped before scripts/check (next build shares web/.next).
## Next steps
<!-- task:closed -->
Closed 2026-10-23T16:11:02Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: open items carried to docs/open-items/gaid-ui-audit.md.

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
- [부채 gaid-ui-audit#1] UI 가이드 점검 후 남은 다듬기 5건(허브 저작 단계 표시가 StepScale과 다름, 브라우저 기본 선택 상자 63곳, 서재 오른쪽 열 글자량, 시험 기록의 "실패한 도구 호출" 문구, 시작 창 아래 줄 위치 표시 형식)을 언제 고칠지 — 가) 다음 UI 작업 단위에 묶어 고침 — 나) 지금 상태 유지 — 권장: 가) 모두 화면 불일치·다듬기 수준이라 한 단위로 묶는 편이 빠릅니다 — 막힌 일: 없음 — 조건: 없음 — 근거: reports/2026-10-24-gaid-ui-audit#5-한계
## Report
Report: reports/2026-10-24-gaid-ui-audit/index.md

(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
