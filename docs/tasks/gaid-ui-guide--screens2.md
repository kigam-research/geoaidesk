---
format: 1
status: active
updated: 2026-10-16T14:13:08Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"9e5573c7-0899-4c21-9d60-48b4df645c01","pid":3776156,"provider":"codex","session":"01a1450f-065c-7781-81fa-b6be4aba848c","start":"4791385","token":"f03dffd1c7b13a0465fac0934a127ab80e5556a92d2f59cc934fcadd51c1db09"}
branch: task/gaid-ui-guide--screens2
target: task/gaid-ui-guide
parent: gaid-ui-guide
---
# gaid-ui-guide--screens2

## Goal and done criteria
Request from the starter:

# Child brief: gaid-ui-guide--screens2 (geoaidesk) — revise the three reference mockups after review

Parent: gaid-ui-guide (Claude writer). The earlier child `gaid-ui-guide--screens` delivered `docs/design/mockups/{setup,map,method}.html`,
`docs/design/mockups/README.md` and 11 PNGs in `reports/2026-10-16-gaid-ui-guide/figures/` (read its README first; its capture
notes, sample data and browser method still apply: Playwright via the `playwright-cli` skill, route fulfilment for the static HTML,
1440×900 and 1280×800, Korean, each PNG < 400 KB, no external requests). Three reviews followed; the parent revised the guide
(`docs/design/ui-guide.md`, read the current Q, G, MAP, F, W and R rows). Reviews (read them):
`~/data/geoaidesk/work/gaid-ui-guide/reviews/{researcher-persona.md,claude-advanced-review.md,codex-review.md}`.

Goal: update the mockups and figures so they follow the revised guide and fix the agreed review findings. Before images stay as they are.

Agreed changes:
Map (`map.html`, figures 02-map-after*.png):
1. Legend uses the panel's free height; if classes still overflow, show the count (`범례 14개` or `3 / 14`) and a `모두 보기` control
   (MAP1). Keep the data value `0` as it is (it is a real LITHONAME value; do not relabel data).
2. Attribute table shows at least 6 rows at 1280×800: reduce map height and/or add a draggable map/table divider (MAP5).
3. Column menu: 5 default columns, any further selection allowed (no 1–8 cap), overflow scrolls inside the table (X2; Codex N3).
4. `KIGAM 1:5만 지질도` overlay toggle and `레이어 추가` visible in the panel without opening a disclosure (MAP4).
5. Scale bar, cursor coordinates (display CRS), zoom-to-layer control, and a visible highlight on the selected feature (MAP6).
6. CRS row: the sample returned only `Transverse_Mercator` with no authority; show it as `Transverse_Mercator · 투영법만 기록됨` (MAP2);
   never invent an EPSG code. Filter icons large enough (≥ 24 px target, A3). Readable column labels with the field name in a tooltip
   (e.g. `암상명` with `LITHONAME` on hover), consistent between legend title, popup and table.
Setup (`setup.html`, figures 01-*.png):
7. One sequence only (Q5): drop the separate four-box flow or make the step tabs carry the stage names; no two different sequences.
8. Step 1: no `권장` on the only available file (show it as a fact); under the chosen layer show its CRS and feature count; `기타` for a
   file input opens a project file list/file chooser, not a typed path (Q2, Q3).
9. Readiness blocker (missing skills/environment, as captured) appears on step 1 with a fixing action such as `필요한 스킬 켜기`
   (it may be a non-functional button in the mockup), and remains next to the disabled final action (Q4).
10. Step 4 area method: the question for layers without CRS information stays in the flow conditionally; state why the area method
    matters in one line; `권장` only with its reason (the earlier README notes geodesic is a proposed default — say so honestly,
    e.g. reason `계산용 CRS를 지정하지 않았을 때`).
11. One term per concept: use one Korean name for the setup flow/draft/start action across setup and method screens (pick from the
    current app's terms or `geo/copy/terminology.csv`; record the choice in README). Disclosure labels say what they open
    (`예상 결과와 한계 보기`, not bare `자세히`).
12. Add a figure of step 4 (`01c-setup-after-area.png`, 1440×900) so steps 2–4 are judged too.
Method (`method.html`, figures 03-*.png):
13. Show method detail as a right-side panel next to the workflow list (light shadow, no dim) instead of a modal (D1, D3, P4; Codex N4).
14. One visible specific limit line (from the source: validated only in the Yilgarn Ni case), full boundary behind `해석 한계 보기` (F5).
15. Separate the researcher's assessment (`연구자 평가: 수정 필요`) from package badges; badges `초안`, `코드 포함` get tooltips (G2).
16. Trial summary: say why it stopped only if the gaid-hub-integration report states a cause; otherwise `중단 사유는 기록에 없습니다` style
    honesty. Add `채팅 열기` and a `기록 보기` view that shows the model used (read-only, copyable) — take the model name from the
    before figure (R4). Replace the bare `skill_hub` label with a researcher-readable source label (check terminology.csv / the
    app's existing hub wording). Spell out PU/CV once (tooltip or first use).

Deliverables you own: `docs/design/mockups/*`, `reports/2026-10-16-gaid-ui-guide/figures/*` (after figures replaced, new 01c), README
updated (per-screen rule ids, what changed in this revision, first-view character counts re-measured, review findings addressed with
ids). Do not edit the guide, rules, checks, app code or locales; if a guide rule seems wrong, say so in your task document.
Constraints: no paid model runs, no new dependencies, no throwaway app instance needed (static mockups only). Network: KIGAM blocks
raw.githubusercontent.com. Keep the worktree clean of caches. Checks: `node geo/ui/check-ui.mjs` and
`node --test geo/tests/ui-check.test.mjs`. Write the result (files, rule ids, re-measured counts, what was not done and why) under
`## Current state` in your task document, then `task finish`.

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
