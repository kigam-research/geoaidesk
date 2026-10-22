---
format: 1
status: waiting
updated: 2026-10-22T08:56:11Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"296db605-1ded-4568-85a9-d88131ee086d","pid":1897852,"provider":"codex","session":"01a162d3-531f-74e0-a6cc-70513e565e83","start":"54731792","token":"31944935f7308d8bb3ccfd634f7b22d86730ddd9cc5fac4b5b0e8ab3ad5685f0"}
branch: task/gaid-visuals-next--journals
target: task/gaid-visuals-next
parent: gaid-visuals-next
---
# gaid-visuals-next--journals

## Goal and done criteria
Request from the starter:

Goal: fill the AGU and 자원환경지질 (Economic and Environmental Geology, EEG) journal figure profiles in
geo/skills/gaid-figures/assets/journals.json from the journals' OFFICIAL author pages, read in a real browser.
This answers open item gaid-research-visuals#2 가) (user: "남은 항목 중 정해야 하는 항목은 권장 방식으로 진행하자.").

Context: the previous attempt (docs/tasks/gaid-research-visuals--skill.md, near line 140-180) used direct curl:
AGU https://www.agu.org/publications/authors/journals/text-graphics-requirements and
https://www.agu.org/Publications/Authors/Resources-FAQs returned HTTP 403; EEG pages
https://www.kseeg.org/content/authors/guide_for_authors.html , https://www.kseeg.org/content/authors/publication_ethics.html ,
https://www.kseeg.or.kr/content/journal/editor_rule.php returned empty replies. The current agu/eeg entries keep
everything "확인 안 됨"/null/unknown. Read the other profiles (elsevier, copernicus, gsa, jgsk) for the expected shape,
the schema `JournalProfile` in web/src/geo/contracts/figures.ts, and the profile test in geo/tests/figures-helper.test.mjs.

Scope and rules:
- Use the playwright-cli skill (pinned `playwright-cli`, headless, on PC74) to open the official pages (AGU's own site;
  AGU journals are published by Wiley, so AGU-specific author guidelines on agupubs.onlinelibrary.wiley.com author
  guidelines pages are also acceptable as official; EEG: the journal/society sites kseeg.org / kseeg.or.kr / the
  journal's own homepage, including official PDFs linked from them). If headless access is blocked, try a normal
  (headed-like) user agent through playwright-cli. If a page needs the user's login, or stays blocked, the aside skill
  (PC71) is the fallback, but the PC71 MCP currently times out; if aside is unavailable, stop on that page and report it.
- Do NOT guess. Fill a field only from text you read on an official page; keep null / "unknown" / "확인 안 됨" for the rest.
  Record every page used in `sources` (url, title, checkedAt 2026-10-22 or the actual date) and update `rulesCheckedAt`.
  Write short English `notes` saying what is a requirement vs recommendation, conflicts, and what stayed unverified
  (follow the tone of the elsevier/gsa notes). Remove the old "curl 403/empty reply" notes once superseded; keep a note if
  a page still could not be read.
- AI policy per kind (data-figure, code-diagram, ai-picture, ai-graphical-abstract, image-edit): use only allowed values of
  the schema; map conservatively, as the other profiles do.
- Owned files: geo/skills/gaid-figures/assets/journals.json (agu and eeg entries only); geo/tests/figures-helper.test.mjs
  only if an expectation must change. Do not touch other profiles, UI code or locales.
- Network: KIGAM network blocks raw.githubusercontent.com; do not use it.
- Checks: `node --test geo/tests/figures-helper.test.mjs` and the server figure tests
  (`cd server && npx vitest run test/geo-figure*`), plus `node geo/copy/validate-copy.mjs web/src/geo/locales` is not
  needed (no copy change). Do not run full scripts/check (the parent runs it).
- Evidence for your finish summary: each page opened (url, title, date, how: playwright-cli/aside), the values adopted with
  the quoted source sentence, which fields stayed null and why. Keep a short section in your task document.
- Save with `task save`, then `task finish`.

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
