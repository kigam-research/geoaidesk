---
format: 1
status: active
updated: 2026-10-22T03:02:44Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"36df4108-f453-465d-a831-81e522b2aacb","pid":2574688,"provider":"codex","session":"01a1616f-6d1d-7983-b8a8-befed5c6ce74","start":"52399367","token":"a17b856789d20005e88c5a087fb7ac9f7714ba77d14d07c5d05c814580c51853"}
branch: task/gaid-research-visuals--skill
target: task/gaid-research-visuals
parent: gaid-research-visuals
---
# gaid-research-visuals--skill

## Goal and done criteria
Request from the starter:

Child A — gaid-research-visuals--skill: the shipped journal-figure skill, its check script, journal profiles and the
shipped-skill mechanism.

Goal (user decision 2026-10-22, recommended options of the proposal): researchers get figures drawn at a target journal's
final size and checked against that journal's figure rules; the rules ship with GAID as a skill.

Build:
1. geo/skills/gaid-figures/ adapted from the K-Dense `scientific-visualization` skill (MIT, v1.4; local copy at
   ~/assets/k-dense-scientific-agent-skills/92ace75a/skills/scientific-visualization/; keep its LICENSE/attribution, add a
   SOURCE note). SKILL.md in English for the model: draw data figures with code from the data at the final width (mm) and
   font size (pt) of the target journal (project target in `.kady/geo/figure-target.json`, contract FigureTarget); scientific
   colour maps by default (cmcrameri: batlow etc., never jet/rainbow for continuous data); save editable vector + raster
   as the journal wants; copy shown figures into the research note's figures/ as RESEARCH_NOTE_RULE says; run the check
   script and fix what it reports; never claim journal compliance; for diagrams prefer code (Mermaid/SVG/draw.io) over image
   generation; when an image-generation tool is used, say so in the note caption as research text. Keep upstream scripts
   that help (export_plan, figure_export, palette_audit, image_metadata) if they run in the helper venv; drop what needs
   network or OpenRouter.
2. geo/skills/gaid-figures/assets/journals.json, schema gaid-journal-figures/v1, profiles per contract JournalProfile for:
   elsevier, copernicus, agu, springer (covers Geosciences Journal), gsa, jgsk (대한지질학회지 / Journal of the Geological
   Society of Korea), eeg (자원환경지질 / Economic and Environmental Geology). Fill values ONLY from the journal's own pages
   you open now (curl the official pages; record url, title, checkedAt). Starting points already verified by the parent:
   Elsevier GenAI policy https://www.elsevier.com/about/policies-and-standards/generative-ai-policies-for-journals
   (explanatory images: disclose in caption; data visualisations only derived from data, Methods; "General-purpose
   generative AI image tools must not be used to create graphical abstracts"; cover art needs permission), Copernicus
   https://publications.copernicus.org/for_authors/ai_policy.html (AI illustrations/schematics permitted when the tool is
   cited, Methods or Acknowledgements) and
   https://publications.copernicus.org/for_authors/manuscript_preparation.html (300 dpi, panels in one file, CVD check,
   Scientific colour maps). Web-research values in the proposal §3.3 (Elsevier widths 90/140/190 mm, 7 pt, 300/500/1000 dpi;
   Springer 39/84/129/174 mm, 8–12 pt, 300/600/1200 dpi; GSA 59/122.8/185 mm, 7–12 pt; Copernicus min width 80 mm) must be
   re-checked on the official page before you use them; anything you cannot open stays null with a note. Never guess.
3. geo/skills/gaid-figures/scripts/check_figure.py: `check_figure.py <figure> --journals <journals.json> [--journal ID]
   [--width ID] [--kind KIND] [--use figure|graphical-abstract] --out <json>`; writes a FigureCheck (contract) JSON: pixel
   size, dpi at target width, smallest text size at final size when measurable (SVG/PDF text; PNG with Matplotlib metadata
   if available; else not-measured), fonts embedded (PDF/EPS/SVG), format vs journal formats, colour-map finding
   (detect rainbow/jet-like hue ramps; heuristic, `warn` not `fail`), CVD previews (deuteranopia/protanopia/tritanopia
   simulation PNGs next to the out file; implement the Machado 2009 matrices yourself with numpy — no new dependency),
   ai-policy item from the journal profile and the kind. Exit codes follow the helper contract (0 ok, 3 deps missing, 4 not
   found, 5 bad value, 1 other). Must run with the helper venv (server/src/helpers: numpy, pillow, matplotlib present;
   pypdf if present). Add a node --test or vitest fixture test with synthetic figures generated in a temp dir (no binary
   fixtures in Git).
4. server/src/geo/shipped-skills.ts generalising server/src/geo/note-style.ts for a list [gaid-note-style, gaid-figures]:
   same seed-once / follow-unedited / keep-deleted-or-disabled semantics, per-skill state (keep reading the existing
   `.kady/geo/note-style.json` so existing projects are not re-seeded), exported constant for the list; keep
   NOTE_STYLE_SKILL/seedNoteStyleSkill as thin wrappers or update their callers (provision.ts, session.ts, context.ts
   applyExposure must always offer both). Update the existing note-style tests; add tests for the figures skill.
5. FIGURE_RULE in server/src/geo/instructions.ts (GEO_INSTRUCTIONS): one compact paragraph telling the lead to read the
   gaid-figures skill before drawing a figure meant for a note, a paper or a slide. Keep it short (context budget).
6. Environments: add cmcrameri (and SciencePlots if it installs cleanly for Python >= 3.12 on the four shipped platforms) to
   the helper venv (server/src/helpers/pyproject.toml + uv.lock; you are the dependency-lock owner for these two files, update
   that boundary entry) and to the pyproject seeded into new geo project sandboxes (server/src/geo/environments.ts; existing
   projects are never rewritten). Verify with geo/tests/environments-smoke.mjs.
7. THIRD_PARTY_NOTICES.md: K-Dense scientific-visualization adaptation (MIT), cmcrameri (MIT; colour maps by F. Crameri,
   cite Crameri 2018 / Crameri et al. 2020), SciencePlots (MIT) if added. AGENTS.md: one bullet under the GeoAIDesk section
   describing the shipped figure skill, journals.json and the check script (keep it short).

Owned files: geo/skills/gaid-figures/**, server/src/geo/shipped-skills.ts, server/src/geo/note-style.ts,
server/src/geo/provision.ts, server/src/geo/session.ts, server/src/geo/context.ts (applyExposure only),
server/src/geo/instructions.ts, server/src/geo/environments.ts, server/src/helpers/pyproject.toml, server/src/helpers/uv.lock,
THIRD_PARTY_NOTICES.md, AGENTS.md (one bullet), related tests, geo/integration-boundaries.json entries for these.
Evidence in your finish summary: the journals.json sources you opened (url + date), which fields stayed null and why, the
check script output on three synthetic figures (a 90 mm 300 dpi PNG with jet, an SVG with 5 pt text, a vector PDF), tests run.
Common rules for this child of gaid-research-visuals (GeoAIDesk, repo kigam-research/geoaidesk):
- Read AGENTS.md of your worktree, the parent ADR docs/adr/2026-10-22-figure-records-and-connection-map.md, the parent
  proposal reports/2026-10-21-gaid-research-visuals/index.md (§3.3, §3.5, §3.7) and the IO-free contracts
  web/src/geo/contracts/figures.ts and web/src/geo/contracts/connections.ts. The contracts are settled; if you need a change,
  make the smallest additive change and say so in your finish summary.
- Work only in the files you own (listed below). Do not edit web/src/geo/notes/research-notes-panel.tsx, the library
  unit's files (server/src/geo/library/**, web/src/geo/library/**, contracts/library.ts) or other children's dirs.
- Any edit to an upstream (non-geo) file must first be listed in geo/integration-boundaries.json with owner
  gaid-research-visuals and a one-line responsibility.
- UI (if any): read docs/design/ui-guide.md v2 sections 0–2, 10, 11 and the parts you touch. Role tokens only (`--gaid-*`,
  Tailwind `gaid-*`), shared parts in web/src/geo/shell/, never branch on the style; figures/maps/images keep original
  pixels (I6, V6). Every visible string in web/src/geo/locales/<namespace>/{ko,en}.json read with t(); Korean first; read
  geo/copy/gaid-writing.md and terminology.csv; no model/tool names or ids in researcher views (R1), record-view strings end
  in `.record` (R4). `node geo/ui/check-ui.mjs` and `node geo/copy/validate-copy.mjs web/src/geo/locales` must pass.
- Network: the KIGAM network blocks raw.githubusercontent.com; use `gh api repos/OWNER/REPO/contents/PATH?ref=REF -H "Accept:
  application/vnd.github.v3.raw"` or codeload.github.com. Python only via `uv run` / the helper venv; no pip install.
- Tests: add focused vitest tests next to the existing geo tests (server/test/geo-*.test.ts, web *.test.ts(x)); run the ones
  you touch plus `cd server && npm run typecheck` and `cd web && npx tsc --noEmit`. The full scripts/check is the parent's.
- Report in your task document: what you built, owned files, checks run with results, anything not verified. Finish with
  `task finish`.

## Current state
Delivered gaid-figures: final-mm/pt plotting guidance, scientific colour maps, editable vector/raster export,
content-keyed FigureCheck JSON, CVD previews and seven dated journal profiles. Seed/update keeps the legacy note-style
receipt and user edits/deletion/disablement; ignores Python caches; both shipped skills stay offered. Added FIGURE_RULE,
cmcrameri/SciencePlots/pypdf and notices (including the map child's React Flow/dagre). No contract change.

Verified: 43 focused server tests, 8 synthetic checker tests; full backend 2,077 passed/8 skipped, frontend 1,144
passed, GAID Node 57 passed/1 skipped; typechecks, both environment smoke targets, UI/copy checks, skill validator and
retained helper CLIs. Direct production smoke passes after updating its obsolete singleton-skill assertion. All
individual checks have passed; task finish reruns the complete gate on the final snapshot. No UI components changed.

Official sources were curled on 2026-10-22. Verified Elsevier/Copernicus/Geosciences Journal/GSA/JGSK; AGU pages returned
403 and EEG pages returned empty replies, so their unverified rules remain null/unknown. GSA full width/page height
remain null due to conflicting units. Source list, limitations and synthetic evidence are below.

## Next steps
1. Direct production smoke exited 0. Run task finish in place; parent completes/integrates the checked child.
## Failed approaches
- Second task finish passed backend (2,077 passed, 8 skipped), frontend (1,144 passed), GAID Node tests (57 passed,
  1 skipped), UI/copy/environment/launcher checks, and actual production start/stop/restart. It failed only the old
  production-smoke singleton assumption: the new gaid-figures skill was treated as upstream catalogue leakage.
  Updated the related test to require and exclude exactly both app-shipped skills; no catalogue-leakage relaxation.
  The direct production-smoke recheck reports PASS (13 pinned skills, both shipped skills, excluded document skills
  absent, restart preserves data/build). Full log: check-8v7zp_md.log under the same check-log folder below.
- First task finish failed at the distribution owner allow-list (the same independently confirmed failure as the map
  child); parent explicitly authorised adding gaid-research-visuals. Added only that owner, no boundary relaxation.
  Full check log: /home/seongin3/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-y6nzbawi.log.
- Initial focused-test invocation lacked installed npm dependencies (vitest not found); npm ci completed successfully in both targets.
  All tests/typechecks ran. The initial provisioning count assertion still expected
  one shipped skill; updated it to two, then all 43 focused tests passed.
- Skill validator in a no-project Python lacked PyYAML; reran using the helper environment, where it passed.
- The official Machado matrix-table URL returned HTTP 403 via curl and timed out through web.open. The implementation
  uses the published standard full-severity coefficients and records that limitation; no runtime network fetch exists.
## Notes and decisions

### Source verification (2026-10-22)
Discovery job job-geoaidesk-gaid-research-visuals--skill-1 completed successfully (exit 0); its answer was used only to
locate official pages. Oracle session: find-only-current-official-author. Saved evidence:
`웹 조사/geoaidesk/2026-10-22-find-only-current-official-author--71831fdbdd.md` in the cmd-main vault.
Direct curl, not the discovery answer, determined adopted profile values.

Opened and read official pages (all checkedAt 2026-10-22):

- elsevier: Artwork sizing — https://www.elsevier.com/about/policies-and-standards/author/artwork-and-media-instructions/artwork-sizing (2026-10-22).
- elsevier: Artwork formats checklist — https://www.elsevier.com/about/policies-and-standards/author/artwork-and-media-instructions/artwork-formats-checklist (2026-10-22).
- elsevier: Generative AI policies for journals — https://www.elsevier.com/about/policies-and-standards/generative-ai-policies-for-journals (2026-10-22).
- copernicus: Manuscript preparation — https://publications.copernicus.org/for_authors/manuscript_preparation.html (2026-10-22).
- copernicus: AI policy — https://publications.copernicus.org/for_authors/ai_policy.html (2026-10-22).
- agu: Using AI tools in your research — https://www.wiley.com/en-us/publishing/article/ai-guidelines (2026-10-22).
- springer: Submission guidelines | Geosciences Journal — https://link.springer.com/journal/12303/submission-guidelines (2026-10-22).
- springer: Editorial policies: Artificial intelligence (AI) — https://www.springer.com/us/editorial-policies/artificial-intelligence--ai-/25428500 (2026-10-22).
- gsa: Figure Guidelines — https://www.geosociety.org/publications/author-information/figure-guidelines (2026-10-22).
- gsa: Authorship and Artificial Intelligence Tools Policy — https://www.geosociety.org/publications/policies/ai-policy (2026-10-22).
- jgsk: Instructions for Authors — https://www.jgsk.or.kr/_common/do.php?a=html&b=31 (2026-10-22).
- jgsk: Ethics Guideline — https://jgsk.or.kr/_common/do.php?a=html&b=32 (2026-10-22).

Unknowns and scope:
- Elsevier: max height, mandatory CVD simulation and panel composition unknown; 7 pt is a normal-text rule of thumb
  (6 pt subscripts), not an absolute prohibition. RGB is preferred. Journal-specific guides override the snapshot.
- Copernicus: 80 mm is a minimum, not a column class. Font floor, max height, required colour mode, AI image-edit and
  graphical-abstract rules unknown. CVD checking, 300 dpi and combined panels verified.
- AGU: both https://www.agu.org/publications/authors/journals/text-graphics-requirements and
  https://www.agu.org/Publications/Authors/Resources-FAQs returned HTTP 403. All AGU-specific numeric/format/colour/panel
  and per-kind policy fields remain unverified. Readable Wiley publisher AI guidance is linked as related guidance only;
  it was not promoted to an AGU-specific verdict. Historical AGU/Wiley general dimensions were not imported.
- Springer: the actual Geosciences Journal page lists 84/174 mm and 234 mm height for large-format journals, not the
  proposal's 39/84/129/174. Small format is separately 119×195 mm, noted but not mixed into this large-format profile.
  The 8–12 pt range is recommended. CVD simulation/panels and per-kind AI verdicts remain unverified under the linked
  publisher risk framework. EPS/TIFF are preferred; format lists are not exhaustive prohibitions.
- GSA: 59/122.8/148.2 mm, 7–12 pt, photo 300–600 ppi and line-art 1200 ppi verified. Full width 7.125 in versus 18.5 cm
  conflicts, as does page height 9.5 in versus 22.5 cm: full mm/maxHeightMm stay null. Combination DPI, colour mode,
  mandatory CVD simulation/panel composition and explicit AI edit/graphical-abstract permissions unknown. Disclosure
  of AI-created figures in a separate section is verified, not unconditional acceptance.
- JGSK: JPG is recommended; A4 fit/legibility and English captions verified. Width/font/DPI/height/colour/CVD/panels
  have no numeric rules in the opened page. AI-use purpose/scope/method disclosure verified; no specific AI image-edit
  or graphical-abstract permission is inferred.
- EEG: https://www.kseeg.org/content/authors/guide_for_authors.html ,
  https://www.kseeg.org/content/authors/publication_ethics.html and
  https://www.kseeg.or.kr/content/journal/editor_rule.php all returned curl 52 (empty reply). Every numerical/format/
  colour/panel/AI rule stays unknown; the required rulesCheckedAt string records only the attempted snapshot date,
  explicitly noted in the profile. The discovered possible English/Korean PDF-policy disagreement was not adopted as
  a verified fact. Empty format lists mean unverified, never unrestricted.

### Synthetic check evidence
Files and JSON reports are under /home/seongin3/data/geoaidesk/work/gaid-research-visuals--skill/synthetic/ (not Git).
- jet.png: nominal 90 mm / 300 dpi, actual 1062×590 px, 299.7 effective dpi, 9 pt plot metadata. A rainbow/jet-like
  ramp warns; three CVD previews exist. PNG is not in the Elsevier snapshot, so format warns rather than claiming a ban.
- small.svg: 5 pt live text fails the 7 pt planning floor; live unembedded fonts warn. Raster DPI/CVD stay unmeasured.
- vector.pdf: 9 pt live text, embedded font programs and PDF format pass; raster DPI/CVD stay unmeasured.
All three are synthetic data-figure checks against Elsevier single width; AI-use disclosure warns. They do not
establish real-journal compliance. The report's axis units and panel labels stay unmeasured for manual review.

### Implementation decisions
Phase plan: keep the settled FigureCheck/JournalProfile interfaces; source verification and helper implementation
are independent of shipped-skill plumbing. This child owns only the files enumerated in the goal (plus focused tests).
Integration order: shipped-skill plumbing → dependency locks → skill/checker/profiles → focused checks. The work is
tightly coupled enough to implement here without additional workers. Although the planned full check belonged to the
parent, task finish automatically ran scripts/check for this child. The owner allow-list fix is also in this child
under the parent's explicit instruction (2026-10-22); identical-line integration is owned by the parent.
Parent instruction adopted: CVD previews use `<sha256>-cvd-{deuteranopia,protanopia,tritanopia}.png` beside the check JSON
(default `.kady/geo/figure-checks/<sha256>.json`); no contract change. THIRD_PARTY_NOTICES also includes the map child's
React Flow 12.12.0 and dagre 3.1.1. Added --artwork as an optional CLI-only DPI-class selector (FigureKind is not a DPI
class); absent classification is checked conservatively against every verified resolution floor. pypdf is an additive
pure-Python dependency to make PDF checks available in the default helper. The checker uses a warning for formats absent
from a profile because several official lists are preferred/non-exhaustive. Failure would invent a prohibition.
CVD matrices preserve neutral endpoints; vector-only raster DPI/CVD remain unmeasured without adding a renderer.
Four-platform uv resolution succeeded; runtime imports were tested on Linux only. Existing sandboxes are not rewritten.
## Open items
None requiring a user decision for this child. Unknown journal rules are explicitly represented as unknown, as requested.
## Report
Evidence is recorded here for the parent to integrate into its canonical report; this child has no separate report.
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-research-visuals--skill-20261022T022833.455464Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
