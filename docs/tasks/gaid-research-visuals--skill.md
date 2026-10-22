---
format: 1
status: active
updated: 2026-10-22T02:39:11Z
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
Implemented the shipped gaid-figures skill, checker and journal snapshots (final source verification still in progress).
Generalised note-style seeding into SHIPPED_SKILLS with old receipt compatibility, independent state, and Python cache
exclusion so executing a helper does not mark the project copy as user-edited. Both skills are always offered; explicit
model invocation disablement is preserved. Added FIGURE_RULE and cmcrameri/SciencePlots/pypdf to helper/new-project environments.

Verified so far: 43 tests across geo-note-style, geo-shipped-skills, geo-environments, geo-provision and geo-context;
8 node figure-helper tests; server typecheck; web tsc; environment smoke (all required modules including the three new
packages imported in helper and new sandbox); UI checker (0 errors, 112 existing debt); copy validator (0 errors, 61
existing warnings); skill quick_validate (helper environment); exporter demo and palette-audit CLI. Full scripts/check
belongs to the parent. No UI component changed or screenshots required for this child.

Synthetic evidence under /home/seongin3/data/geoaidesk/work/gaid-research-visuals--skill/synthetic/:
- jet.png: nominal 90 mm / 300 dpi, actual 1062×590 px, 299.7 effective dpi, 9 pt plot metadata, rainbow/jet warning,
  three CVD previews; PNG format fails the Elsevier submission-format snapshot as expected.
- small.svg: 5 pt live text, fails the 7 pt planning floor, unembedded live SVG fonts warn.
- vector.pdf: 9 pt live text, embedded PDF fonts and PDF format pass; raster DPI/CVD remain not-measured.
All three are data-figure checks against Elsevier single width; AI-use disclosure remains a warning. Font figures are
synthetic and do not demonstrate real-journal compliance.

## Next steps
1. Waiting for recorded discovery job job-geoaidesk-gaid-research-visuals--skill-1 (Oracle session
   find-only-current-official-author); do not rerun or poll it. When its relay notice arrives, read its result,
   curl every adopted page and remove
   temporary in-progress notes from profiles. Record unknowns and opened URLs in this document.
2. Re-run focused checker tests and typechecks after final fixes, review the complete diff, then task finish.
## Failed approaches
- Initial focused-test invocation lacked installed npm dependencies (vitest not found); npm ci completed successfully in both targets.
  All tests/typechecks ran. The initial provisioning count assertion still expected
  one shipped skill; updated it to two, then all 43 focused tests passed.
- Skill validator in a no-project Python lacked PyYAML; reran using the helper environment, where it passed.
- The official Machado matrix-table URL returned HTTP 403 via curl and timed out through web.open. The implementation
  uses the published standard full-severity coefficients and records that limitation; no runtime network fetch exists.
## Notes and decisions
Phase plan: keep the settled FigureCheck/JournalProfile interfaces; source verification and helper implementation
are independent of shipped-skill plumbing. This child owns only the files enumerated in the goal (plus focused tests).
Integration order: shipped-skill plumbing → dependency locks → skill/checker/profiles → focused checks. The work is
tightly coupled enough to implement here without additional workers. The parent runs the full scripts/check.
Parent instruction adopted: CVD previews use `<sha256>-cvd-{deuteranopia,protanopia,tritanopia}.png` beside the check JSON
(default `.kady/geo/figure-checks/<sha256>.json`); no contract change. THIRD_PARTY_NOTICES also includes the map child's
React Flow 12.12.0 and dagre 3.1.1. Added --artwork as an optional CLI-only DPI-class selector (FigureKind is not a DPI
class); absent classification is checked conservatively against every verified resolution floor. pypdf is an additive
pure-Python dependency to make PDF checks available in the default helper, not an optional permanently missing feature.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Evidence is recorded here for the parent to integrate into its canonical report; this child has no separate report.
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-research-visuals--skill-20261022T022833.455464Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
