---
format: 1
status: ready
updated: 2026-10-22T09:04:08Z
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
The agu/eeg profiles now contain official-browser-verified rules dated 2026-10-22. AGU has revision figure
formats, combined-panel files, accessibility advice and Methods disclosure for AI-assisted data figures,
code diagrams and pictures. EEG has 300/500/1000 dpi floors and EPS/TIFF/JPEG; its English/Korean PDF
format conflict is explicit. Unspecified dimensions, colour requirements and AI permissions remain unknown.
The helper suite passed all 8 tests. After npm ci supplied the missing dependencies from the unchanged
lockfile, server figure tests passed all 10 tests. git diff --check passed; a structural comparison with
HEAD confirmed every profile other than agu/eeg is identical. Both named browser sessions are closed.
No UI/locales, test files, dependency manifests or locks changed. Ready to save and finish.
## Next steps
<!-- task:closed -->
Closed 2026-10-22T09:04:08Z: ready; the parent gaid-visuals-next integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Default headless user agent: AGU returned Cloudflare 403 and EEG returned a web-firewall message. Both
  succeeded after Chrome DevTools Network.setUserAgentOverride used a normal Linux Chrome user agent.
- Aside fallback availability check: `aside guide repl` failed with SSH connection refused on localhost:17122.
  No Aside session was created; no login claim or extra retry was made.
- The Korean page's hidden editorial tab could not be clicked; the actual linked editorial PDF was read instead.
- A PDF navigation did not emit a Playwright download event (Chrome opened the PDF URL). Read its bytes with
  same-origin browser fetch, verified HTTP 200/application-pdf and rendered locally with Poppler instead.
- Server test startup failed once due to absent node_modules, not a source defect; npm ci resolved it and the rerun passed.
## Notes and decisions
Sequential decisions: confirm readable official sources before choosing values or per-kind AI mappings.
Owned file: geo/skills/gaid-figures/assets/journals.json (agu/eeg only); no shared interface or UI changes.
This is one small, coupled source-verification package; no workers are needed. The parent owns integration
and its canonical report. Browser evidence is external under ~/data/geoaidesk/work/gaid-visuals-next--journals/playwright/.

### Official-source evidence (2026-10-22)

Every page below was opened using the pinned playwright-cli on PC74 with a normal Linux Chrome user agent.
PDF bytes were fetched in that browser context, then text-extracted and visually read with the pdf skill.
Sources are also recorded in the two profiles with checkedAt/rulesCheckedAt 2026-10-22.

| Source | Title / use | External evidence file |
| --- | --- | --- |
| https://www.agu.org/publications/authors/journals/text-graphics-requirements | Text & Graphics Requirements \| AGU Publications; panels, accessibility, AI disclosure | agu-graphics.json / agu-graphics-body.txt |
| https://www.agu.org/publications/authors/journals/submission-checklists | Journals Submission Checklists \| AGU Publications; revision formats and panels; opened Figures and tables accordion | agu-checklists.json / agu-checklists-expanded.txt |
| https://www.agu.org/Publications/Authors/Resources-FAQs | Resources & FAQs \| AGU; related author resources, no additional numerical rules adopted | agu-faq.json |
| https://www.kseeg.org/content/authors/guide_for_authors.html | Guide for Authors \| Economic and Environmental Geology; artwork formats, dpi and column classes | eeg-authors.json / eeg-authors-body.txt |
| https://www.kseeg.org/content/authors/publication_ethics.html | Publication Ethics \| Economic and Environmental Geology; no explicit per-kind AI rule | eeg-ethics.json / eeg-ethics-body.txt |
| https://www.kseeg.or.kr/content/journal/editor_rule.php | 규정안내 \| 대한자원환경지질학회; links to the three PDFs below | eeg-korean.json |
| https://www.kseeg.or.kr/content/journal/file/rule01_2026.pdf | 투고 규정; §3 one-page limit, legibility and non-PDF figure file | eeg-rule01-2026.pdf / eeg-rule01-2026.png |
| https://www.kseeg.or.kr/content/journal/file/rule03.pdf | 편집 규정; scanned single-page PDF, no additional artwork/AI rule | eeg-rule03.pdf / eeg-rule03.png |
| https://www.kseeg.or.kr/content/journal/file/rule04.pdf | 대한자원환경지질학회 연구윤리 규정; no explicit AI-kind rule, amendment 2021-03-11 | eeg-rule04.pdf / eeg-rule04-body.txt |

Adopted values and source excerpts:

- AGU revision formats EPS/PDF/JPEG/TIFF: the checklist states, "Appropriate figure formats are: eps, pdf,
  jpg, or tif." The in-depth guide also recommends PS; use the intersection, not a PS ban.
- AGU panelsInOneFile=true: "Separate files for different parts of a figure cannot be accommodated."
- AGU accessibility advice comes from the strong encouragement for accessible colours and the advice to
  add patterns/symbols, contrast and spacing. This is a recommendation, not a verified mandatory simulation.
- AGU AI disclosure: the authorship section explicitly covers "production of images or graphical elements"
  and "collection and analysis of data", requires the tool and how it was used, and locates disclosure in
  "Materials and Methods (or similar section)". Map data-figure/code-diagram/ai-picture to disclose; do not
  infer unconditional permission or an explicit AI-edit/graphical-abstract policy.
- EEG raster floors: "TIFF (or JPG): Color or grayscale photographs (halftones): always use a minimum of
  300 dpi." The next two sentences set line drawings to a minimum of 1000 dpi and combinations to 500 dpi.
- EEG vector formats: "EPS (or PDF): Vector drawings. Embed the font or save the text as 'graphics'."
  Korean §3(f) says "단 그림 파일 작성 시 PDF 파일 이외의 파일이어야 한다." EPS/TIFF/JPEG are common to
  both; exclude PDF from the unambiguous list and preserve the conflict in notes instead of guessing priority.
- EEG single/1.5/2-column classes have no mm values. The Korean rule says a printed figure must fit one
  page and remain legible after reduction; A4/margins refer to the manuscript, not final figure dimensions.

Fields intentionally unchanged/unknown:
- AGU: all width mm, minFontPt, maxHeightMm and dpi values; colour.mode and cvdRequired; AI graphical
  abstract and image-edit. Opened pages contain no numerical floors or explicit policy for those uses.
- EEG: width mm, minFontPt, maxHeightMm, every colour field and panelsInOneFile; all five aiPolicy values
  and aiDisclosure. The author/ethics rules give no verified mapping. General anti-fabrication rules are
  not permission to generate or alter research imagery.
- The earlier curl failure notes are superseded by successful browser reads; no page remains blocked.

### Checks
- `node --test geo/tests/figures-helper.test.mjs`: passed 8/8 on 2026-10-22.
- `(cd server && npx vitest run test/geo-figure*)`: passed 1 file / 10 tests after npm ci on 2026-10-22.
- `git diff --check`: passed. Structural JSON comparison confirms all five unowned profiles are identical.
- No UI/locales changed. No test expectation change is needed; the existing profile-schema check passed.
- The parent requested no manual full scripts/check; task finish itself enforces scripts/check through the
  backbone CLI with no scoped override. No guard/check implementation will be changed to avoid that gate.
## Open items
None for this child. The target profile explicitly preserves unverified rules and the journal's PDF
conflict; no user decision is required to apply the verified subset. The parent owns the original ledger item.
## Report
No separate child report. The parent includes this verified subset and the source evidence above in its
canonical result report.
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
