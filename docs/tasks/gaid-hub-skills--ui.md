---
format: 1
status: waiting
updated: 2026-10-22T06:03:08Z
writer: {"host":"seongin3","reserved":"b43fd525741ba4dfc4306e8a53ecc93b452a07e41bd222c5e954043676b60fc0"}
branch: task/gaid-hub-skills--ui
target: task/gaid-hub-skills
parent: gaid-hub-skills
---
# gaid-hub-skills--ui

## Goal and done criteria
Request from the starter:

Child unit `ui` of gaid-hub-skills (geoaidesk). Goal: researcher-facing screens for hub-managed skills, phase 1.

Read first (in your worktree): AGENTS.md (especially "UI copy and locales", "UI guide v2", "Names in visible copy");
docs/design/ui-guide.md sections 1, 2, 10 and those for components you touch; geo/copy/gaid-writing.md and
geo/copy/terminology.csv (new term 허브 스킬); docs/adr/2026-10-22-hub-managed-skills.md; web/src/geo/contracts/hub-skills.ts
(settled contract and HTTP API; the server is being built in parallel by sibling child `store` — code against the contract
with mocked fetch in tests; after the parent integrates `store`, run `task sync` and check against the real server);
reports/2026-10-22-gaid-hub-skills/index.md §3.6 "화면 위치". Design every screen as an impeccable + design-taste-frontend +
brand-guide expert (user rule; skills in skill_hub `.claude/skills/`, read them with gh api if not local).

Scope (you own these; other files: ask the parent first):
- New `web/src/geo/hub-skills/**` and locale namespace `web/src/geo/locales/hubSkills/{ko,en}.json` (Korean first).
- Hub: a "스킬" group in the hub sidebar below the Workflow groups (`hub-sidebar.tsx`), routes `#hub/skills` (shelf list,
  search, topic folder filter) and `#hub/s/<id>` (detail) in `location.ts`/`hub-screen.tsx`/`hub-shell.tsx` (seams, keep
  narrow). Detail uses the Workflow detail's frame: SKILL.md (read-only, rendered), file list with read-only text view,
  origin (own / taken from Workflow «title» n판 / GitHub source·ref·commit·fetched date), licence state, findings grouped
  by kind (worded as "볼 곳", never as safe/unsafe), revision history with review state per revision and reviewer name
  marked "이름 확인 안 됨", "쓰는 Workflow" list linking to `#hub/e/<entry>`, stars and comments like Workflows,
  "프로젝트에 설치" through the existing project picker + install preview + acknowledgement pattern (see
  `web/src/geo/skill-hub/install-preview.tsx`), review actions (확인함 / 더 쓰지 않음 + 대신 쓸 스킬 / 사용 중지) with a
  note, hidden for the registrant's own `checked`.
- Register flow ("스킬 올리기"): choose source (내 프로젝트의 스킬 / 허브 Workflow에서 꺼내기 / GitHub 등에서), preview
  (files, licence, findings, existing name → 다음 판 or refused, blocked reason), note + folder (+ optional tags/formats),
  then register. Author-only visibility explained when the licence is not shareable. From the hub Workflow detail of an
  entry you may add an entry point "스킬만 올리기" only if it fits the layout; otherwise skip and note it.
- Settings → Skills (`web/src/components/skills-panel.tsx` seam, add yourself to geo/integration-boundaries.json for it with
  owner gaid-hub-skills--ui): in "스킬 추가", a "GAID 허브에서" source next to GitHub that searches the shelf and installs
  through the same preview/consent; rows of installed hub skills show "허브 스킬 · n판", a newer-revision notice with an
  explicit "n판으로 바꾸기" action (install of that revision), "고친 내용 있음" when edited, and the suspended warning.
  Rows come from `GET /skills` with the new `hubSkill` field (`InstalledHubSkill`).
- No hard-coded colours or text in JSX; tokens and `t()` only; `node geo/ui/check-ui.mjs` and
  `node geo/copy/validate-copy.mjs web/src/geo/locales` must pass with no new baseline entries.
- Tests: vitest for the shelf list, detail (findings wording, unverified reviewer), register preview states, Settings row
  states. Screenshots (Korean, both styles 계측/도폭 and both themes at 1440×900 and 1280×800) of shelf, detail, register
  preview and Settings rows, saved under ~/data/geoaidesk/work/gaid-hub-skills--ui/shots/ with a few chosen small PNGs
  copied into reports/2026-10-22-gaid-hub-skills/figures/ (≤ 1600 px wide). Run the app with your own GAID_HOME/
  KADY_PROJECTS_ROOT under ~/data/geoaidesk/work/gaid-hub-skills--ui/; never touch ~/.geoaidesk.

Out of scope: server code (sibling `store`), Workflow readiness/install/authoring (parent). List the string ids with ko/en
text and the UI guide rule ids followed or broken in a section for the parent report in your task document; no report of
your own. Checks before finish: `cd web && npx tsc --noEmit && npx vitest run src/geo/hub-skills src/components/skills-panel.test.tsx`,
the two node checks above. Finish with `task finish`.

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
