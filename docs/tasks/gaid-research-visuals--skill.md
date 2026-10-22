---
format: 1
status: waiting
updated: 2026-10-22T02:27:27Z
writer: {"host":"seongin3","reserved":"a17b856789d20005e88c5a087fb7ac9f7714ba77d14d07c5d05c814580c51853"}
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
