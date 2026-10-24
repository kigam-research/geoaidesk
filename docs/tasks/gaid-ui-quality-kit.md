---
format: 1
status: active
updated: 2026-10-24T03:05:40Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"8903c027-bae6-4d62-be5f-363a50e7cd24","pid":1209415,"provider":"claude","session":"75265567-6398-46a1-800a-916e466ecb73","start":"69452397","token":"e8629b2b35ed6c90a1d8703ce6bad2bc0e6d8d0733cee71031a1026cfc73221f"}
branch: task/gaid-ui-quality-kit
target: main
parent: 
---
# gaid-ui-quality-kit

## Goal and done criteria
Request from the starter:

# Goal: gaid-ui-quality-kit — scenario D of gaid-uiux-skills-scan: the UI quality kit

Forwarded, user-confirmed goal (full text below). This unit implements item 1 (scenario D) only. Items 2 (scenario A) and 3 (scenario C) follow as separate units after this one; item 4 (scenario B) is not to be implemented; item 5 (design-skill refresh) runs as unit gaid-design-skills-refresh in parallel.

Done: the development-only 부품 상태 견본 page; shadcn lint mapped onto UI guide rules; impeccable detect with DO_NOT_TRACK; Playwright screenshot comparison of 계측/도폭 × light/dark at 1440×900 and axe-core checks, added to scripts/check as report-only first (blocking later, after false positives are settled — record the rule for switching); fix the --on-signal / --primary-foreground mismatch (guide S1 vs globals.css), add the button press (active) style (S7), check tool-activity.tsx BrainIcon/WandSparklesIcon against V2. Report with rule ids and Korean screenshots. Report source of the scenario: reports/2026-10-24-gaid-uiux-skills-scan/index.md (branch task/gaid-uiux-skills-scan until integrated; git show origin/task/gaid-uiux-skills-scan:<path>), mockups pc74:~/data/geoaidesk/work/gaid-uiux-skills-scan/mockups-src.tgz and shots/. No generated imagery; the current system is the visual authority. Licences: shadcn-ui/lint MIT, impeccable Apache-2.0 — record them in THIRD_PARTY_NOTICES.md if code or rules are vendored. Do not touch the review app or hub server. Outside check: none.

## Forwarded goal (verbatim)

Goal from gaid-uiux-skills-scan (user-confirmed follow-up units).

User answer (verbatim, 2026-10-24) to the two decisions in reports/2026-10-24-gaid-uiux-skills-scan/index.md section 6:
"모두 권장으로 진행하자."

That means:
1. Implement scenario D first: UI quality kit. A development-only "부품 상태 견본" page (shared parts pinned in every state with
   the shadcn skill's data-preview custom variants, live token contrast table), shadcn lint (`shadcn-ui/lint`, MIT) mapped onto
   UI guide V1 rules, impeccable detect (Apache-2.0, telemetry off via DO_NOT_TRACK), Playwright screenshot comparison of the
   four combos (계측/도폭 × light/dark, 1440×900) and axe-core checks, added to scripts/check first as report-only, blocking
   later after false positives are settled. Fix the two facts found while drawing the kit: UI guide S1 names an `--on-signal`
   role that globals.css does not define (buttons use `--primary-foreground`); `web/src/components/ui/button.tsx` has no press
   (active) style although S7 requires one. Also check `web/src/components/tool-activity.tsx` BrainIcon/WandSparklesIcon against V2.
2. Then scenario A: hub recommended cards without a concept picture draw the Workflow's own analysis stages (from WorkflowDoc
   steps[]) plus input/output formats instead of the title-guessed icon; list rows show a stage-count readout; pictures keep
   precedence. Decide how this sits with UI guide I10 (scales only where they show a position).
3. Then scenario C: 서재 right-rail cards (ORCID, 서재 상태, Zotero) consolidate into one header connection-status button + popover;
   the right side becomes the selected paper's inspector; empty library explains connections in one line (F4).
4. Scenario B (chat analysis plan using shadcn AI Elements patterns, orbit instead of shimmer) is NOT to be implemented yet:
   first a separate discussion of where the plan signal comes from (Workflow steps vs an agent-declared plan, R1, provenance).
5. Decision 2: refresh the read-only design-skill copies GAID agents read (currently skill_hub `.claude/skills/`:
   impeccable 4.3.1, design-taste-frontend v1) to impeccable skill-v4.7.0 and taste-skill v2.1.4, telemetry off, no global
   install. Route to wherever those copies should live now (skill_hub is legacy since 2026-10-20).

Mockups (code-built from the real tokens/components, no generated images) and their source:
`pc74:~/data/geoaidesk/work/gaid-uiux-skills-scan/mockups-src.tgz`, shots in `.../shots/`. Report: reports/2026-10-24-gaid-uiux-skills-scan/index.md
(branch task/gaid-uiux-skills-scan until integrated). Lesson to keep: no generated imagery; the current system is the visual authority.

## Current state
Result for the requester (scenario D, UI quality kit): done on the task branch. The development-only 부품 상태 견본 page
`/dev/parts` (absent from production builds), the report-only UI quality kit in scripts/check (shadcn lint, impeccable
detect with telemetry off, Playwright screenshots of 계측/도폭 × light/dark at 1440×900 against baselines, axe-core; every
finding mapped to a UI guide id; switch rule to blocking in geo/ui/ui-rules.json quality.switchRule), `--gaid-on-signal`
(S1) and pressed fills for every Button variant (S7), tool-activity icons fixed (V2). First kit run: 5 pre-existing S4
contrast issues in shared parts plus the Button focus ring vs S7, left for the user's decision (open item). Report:
reports/2026-10-24-gaid-ui-quality-kit/index.md. Scenario A and C units can start after this one integrates.

Details (2026-10-24):
- P1: `--gaid-on-signal` (+ `--gaid-press`, `--gaid-danger-press`) in globals.css, shadcn preview-state variants;
  Button pressed fills per variant; tool-activity skill row ScrollTextIcon, reasoning without BrainIcon; guide S1/S7 text.
- P2: `/dev/parts` page (web/src/geo/dev/parts-page.tsx, locale devParts), 404 in production (assert in production-smoke).
- P3: geo/ui/quality/ (own lock): run.mjs + shadcn lint config + Playwright config/spec; ui-rules.json `quality`
  (modes report, switchRule, guide maps); baselines in geo/ui/quality/baseline/; scripts/check last step.
- Kit run on PC74 twice: visual 0 diffs on the second run; impeccable/axe find 5 pre-existing S4 issues in shared parts
  (link button text-primary, primary hover /90, tabs inactive, sidebar count on hover, mapsheet-dark placeholder).
- Report: reports/2026-10-24-gaid-ui-quality-kit/index.md (complete).
- Checks by step on PC74 (2026-10-24): backend 2297 passed/8 skipped (one vitest worker exit under load), frontend
  1289 passed, geo 58 pass, copy/ui 0 errors, environments, launcher, production smoke PASS (incl. /dev/parts 404), kit ran.
Re-verify: `cd geo/ui/quality && npm ci && cd ../../.. && node geo/ui/quality/run.mjs --out /tmp/x` (report-only, ~1 min).

## Next steps
<!-- task:closed -->
Closed 2026-10-24T02:52:10Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: open items carried to docs/open-items/gaid-ui-quality-kit.md.

## Failed approaches
- First full scripts/check (check-1.log, 2026-10-24): backend sandbox-upload.test.ts failed 8 tests with "Cannot find
  module 'abstract-logging' / 'light-my-request'" while the kit and a dev server ran in parallel (import phase 312 s);
  the file passes alone (8/8) and the modules exist. Likely cause: `task sync` (started 11:20) ran its own scripts/check
  in this worktree at the same time, so its `npm ci` replaced server/node_modules under the running tests. Do not run a
  manual scripts/check while task sync/finish runs one. Server code is untouched by this unit.
- Second full run (check.log): backend 2297 passed / 8 skipped, 0 failed, but "Worker exited unexpectedly" (vitest fork)
  → exit 1. PC74 load average ~30/32 threads from other units (ffmpeg, chrome). Remaining steps run separately
  (check-rest.log); task finish reruns scripts/check.
- check-rest.log: frontend 1289/1289 passed, launcher --check passed, geo distribution test failed: the new seam owner
  gaid-ui-quality-kit was missing from the owners allowlist in geo/tests/distribution.test.mjs (fixed; 58 pass, 0 fail).
- check-tail.log: copy 0 errors, check-ui 0 errors, environments smoke passed, launcher passed; production smoke failed
  on the new assertion: /dev/parts answered 200 (a dynamic notFound() renders the 404 page with status 200 here).
  Fixed with page.dev.tsx + dev-only pageExtensions; fresh next start answers 404, next dev serves the page (kit-run3,
  visual 0 diffs). Leftover manual next servers (mine) were killed; earlier "still 200" was a stale server.
## Notes and decisions
Orchestration (2026-10-24):
- Sequential decisions: route `/dev/parts` (Next app route, dev-only: 404 unless `NODE_ENV!=production` or
  `GAID_DEV_PAGES=1` at request time; changed: `page.dev.tsx` + dev-only pageExtensions in web/next.config.ts, because
  a dynamic notFound() answered 200 in production); combos set through localStorage `gaid:style` + next-themes `theme` before load.
- Packages, all done by this writer (tightly coupled; the tooling is tuned against the page):
  P1 app fixes: `--on-signal` token in globals.css (shadcn `--primary-foreground` maps onto it), data-preview custom
  variants (shadcn skill preview-states, MIT), Button pressed style, tool-activity icons (V2), guide S1/S7 text.
  P2 parts page: `web/src/geo/dev/` specimen (+ locale namespace) and `web/src/app/dev/parts/page.dev.tsx`.
  P3 tooling: `geo/ui/quality/` own package + lock (not in web/: researchers' installs stay unchanged): shadcn lint
  config with rule → guide id map, impeccable detect (DO_NOT_TRACK=1, IMPECCABLE_NO_TELEMETRY=1), Playwright 1.63.0
  (matches the cached chromium-1243) screenshots of 4 combos at 1440×900 against baselines + axe-core; one report-only
  runner appended to scripts/check.
- Integration order: P1 → P2 → P3 → baselines → report.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
- [결정 gaid-ui-quality-kit#1] 첫 점검이 찾은 공용 부품 문제(대비 미달 다섯 곳, 초점 고리 모양)를 어떻게 할까요? — 가) 다음 화면 작업(A) 전에 작은 수정 작업 하나로 고친다 — 나) 점검 결과로만 두고 해당 화면을 다룰 때 고친다 — 권장: 가) 모든 화면에 쓰이는 부품이라 효과가 넓고 막는 단계 전환이 쉬워진다 — 막힌 일: 점검 도구의 막는 단계 전환 — 조건: 없음 — 근거: reports/2026-10-24-gaid-ui-quality-kit/index.md#6-결정할-일
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-24-gaid-ui-quality-kit/index.md

(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
