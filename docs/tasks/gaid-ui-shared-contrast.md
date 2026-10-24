---
format: 1
status: active
updated: 2026-10-24T04:28:01Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"de68e451-97f8-4d7d-b9dd-6dd12ceee4d8","pid":2621511,"provider":"claude","session":"f940d4c6-cc49-4d80-8904-a915a4b5d7ac","start":"70284572","token":"0fe8e40f1ea359a56f63a8022e870ac31a328d0a3a949ee5845ab1c5ed4fdbf6"}
branch: task/gaid-ui-shared-contrast
target: main
parent: 
---
# gaid-ui-shared-contrast

## Goal and done criteria
Request from the starter:

# Goal: gaid-ui-shared-contrast — fix the shared-part findings of the UI quality kit before scenario A

## User decision (verbatim, 2026-10-24)

> gaid-ui-quality-kit#1 가로 진행하자.

Option 가 of `reports/2026-10-24-gaid-ui-quality-kit/index.md` §6: before the next screen work (scenario A, hub stage diagrams), one small
fix unit for the problems the first check found in shared parts — five contrast failures (S4; the table in §3.3) and the focus ring
(today 3 px at 50% opacity; guide S7 wants a 2 px ring with a 2 px gap, S4 wants ≥ 3:1 ring contrast). Change only the colour roles of the
shared button, tabs, sidebar and input (tokens in `web/src/app/globals.css`, parts in `web/src/components/ui/`, `web/src/geo/shell/`),
and update the 부품 상태 견본 page and the baseline screenshots together.

## Done

- The five contrast findings and the focus ring meet S4/S7 in all four combos (계측/도폭 × light/dark); the quality kit's impeccable/axe/
  shadcn checks show them resolved (report the before/after counts).
- No layout change, no screen-specific changes; colours only through role tokens; both styles keep their identity.
- Baselines of the quality kit updated; report with rule ids and Korean before/after screenshots (four combos, 1440×900; spot-check
  1280×800). Checks: scripts/check.
- Note whether the quality-kit steps can switch from report-only to blocking now (the kit's own rule), and recommend; do not switch
  without the user's decision.

Do not touch the review app or the hub server. Running in parallel: gaid-promo-video-v4-lemo (video only). After this unit the hub
starts scenario A. Outside check: none.

## Current state
- Done (single writer, no child units: small, tightly coupled colour-role change). Tokens: new `--gaid-signal-hover`
  (#1a54e8 / #2f60df), dark `--ring`/`--sidebar-ring` = `--gaid-signal-ink`, base outline `outline-ring` (was /50).
  Parts: link button text `text-gaid-signal-ink` (pressed `text-gaid-ink`), filled hover `bg-gaid-signal-hover`, tab
  inactive `text-muted-foreground`, sidebar count `text-gaid-ink-2`, dark field fill `dark:bg-gaid-face-2` (input,
  textarea, select, input-group). Focus ring = `focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-ring` on every shared ui/ part with the old 3 px /50 ring and on SidebarItem (scroll area inset).
  Parts page: contrast rows `onSignalHover`, `ringChrome`. Guide token table/S1/S7 and ui-rules roles updated.
- Kit (PC74, ~/data/geoaidesk/work/gaid-ui-shared-contrast/): before shadcn 248 / impeccable 7 / visual 0 / axe 11;
  after (after2, baselines updated) 248 / 0 / 0 / 0. 1280x800 four combos: no horizontal overflow (shots/).
- Report: reports/2026-10-24-gaid-ui-shared-contrast/index.md (figures from old vs new baselines).
- scripts/check passed on PC74 (exit 0; backend 2322 pass/8 skip, frontend 1326, distribution 58/59 + 1 skip, kit 248/0/0/0);
  log ~/data/geoaidesk/work/gaid-ui-shared-contrast/check.log.
- Re-verify: `node geo/ui/quality/run.mjs --out <dir>` (after `npm ci` in geo/ui/quality and web), `scripts/check`.
## Next steps
1. task finish (report done, humanizer pass done, review copy made).
## Failed approaches
- Raising 도폭 dark `--gaid-ink-3` to fix the placeholder: would need ~ink-2 brightness, erasing the ink-2/ink-3 split.
## Notes and decisions
- Scope: the focus-ring rule was applied to all shared ui/ primitives that drew the 3 px /50 ring (switch, select,
  textarea, badge, accordion, scroll-area, input-group too), not only button/tabs/sidebar/input, so S7 holds for every
  shared part; screen files untouched. Dark outline button and active tab keep `dark:bg-input/30` (they pass S4).
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
- [결정] 대비 결과가 0건이 된 impeccable과 axe를 언제 막는 단계로 바꿀까요? — 가) 다른 PC 한 대에서 전체 점검을 한 번 돌려 같은 결과(0건)가 나오면 두 도구를 막는 단계로 바꾸고, 화면 비교와 shadcn 검사기는 보고만 하는 단계로 둔다 — 나) 지금은 모두 보고만 하고 실제 화면까지 점검 대상에 넣은 뒤 함께 바꾼다 — 권장: 가) 전환 규칙의 남은 조건 하나만 채우면 되고 두 도구는 글꼴 차이에 덜 민감하다 — 막힌 일: 없음 — 조건: 다른 PC에서 점검 실행 — 근거: reports/2026-10-24-gaid-ui-shared-contrast/index.md#6-결정할-일
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-24-gaid-ui-shared-contrast/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
