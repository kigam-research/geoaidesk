# ADR 2026-10-22: Figure records derived from provenance, journal figure skill shipped with GAID, connection map over existing links

Status: accepted 2026-10-22 (user chose the recommended option for all five decisions of
reports/2026-10-21-gaid-research-visuals §6, verbatim: "gaid-research-visuals 설계안 5건 권장 방안으로 진행하자.").
Context: reports/2026-10-21-gaid-research-visuals §3; sibling ADR 2026-10-21-research-hub-library.

## Context

None of the four research inputs names a figure-generation tool; journals now rule on figures by how they were made
(Elsevier 2026-08: explanatory images may use AI with caption disclosure, data visualisations must derive reproducibly from
data, "General-purpose generative AI image tools must not be used to create graphical abstracts"; Copernicus: AI
illustrations/schematics allowed when the tool is cited, figures must work for colour-vision deficiency, Scientific colour
maps recommended). GAID already records, per project, which step wrote a file, its inputs (observed or inferred), the
environment and the version consumed (`server/src/provenance/`, `walkLineage`), and research notes copy their figures into
`연구노트/<id>/figures/`. The upstream K-Dense `scientific-visualization` skill (MIT, v1.4) has publisher profiles and
export/palette/metadata tools but no geoscience journals, and the geo catalogue (0.2.1) drops it. The web app has no graph
library; the library unit already computes note citations and "쓰인 곳" per library item.

## Decision

1. **Scope of this unit**: phase 1 (figure record, redraw, journal-sized figures, figure checks, scientific colour maps by
   default, AI picture marking and disclosure draft) and phase 2 (connection map). The idea board (phase 3) is designed, not
   built; its file format is fixed now (decision 6).
2. **Figure record = derived view, no new master store.** A figure record is computed on request from the note file and
   provenance: the figure file, its kind, the producing step (chat, script, inputs, environment), whether inputs or the
   figure changed since (`staleness`, `changedSinceUse`), the latest check result, the target journal. A note figure that is
   a copy resolves to its source by provenance edge first and by identical sha256 among recorded outputs second. Nothing
   the model declares sets provenance; the kind is derived (below) and the researcher may override it (stored per figure
   path + sha256 in `.kady/geo/figures.json`).
3. **Figure kinds** (`data-figure`, `code-diagram`, `ai-picture`, `ai-graphical-abstract`, `image-edit`, `unknown`) are
   derived from the producing step: `generate_image` or an image-generation tool → `ai-picture`; a script/command step whose
   inputs include non-image data → `data-figure`; a `write`/`edit` of `.svg`/`.mmd`/`.drawio`/`.dot`/`.tex` diagrams, or a
   rendered output of such a source → `code-diagram`; an image output whose only inputs are images and whose step used an
   AI image tool → `image-edit`; otherwise `unknown`. `ai-graphical-abstract` comes only from the researcher's override or
   the figure's declared use in the check request.
4. **Journal figure rules ship as data in a GAID skill.** `geo/skills/gaid-figures/` adapts the K-Dense
   `scientific-visualization` skill (MIT; notice kept) with GAID rules: draw at the final width in mm and font size in pt,
   scientific colour maps by default (cmcrameri), record the figure kind in the note caption only as text the researcher
   reads, run the check script and save its JSON result. Journal profiles (`geo/skills/gaid-figures/assets/journals.json`,
   schema `gaid-journal-figures/v1`) carry, per journal: widths, minimum font size, dpi by figure type, formats, colour and
   CVD rules, and AI-image policy per figure kind (`allowed` / `disclose` / `forbidden` / `permission` / `unknown`), each
   with source URL and checked date; unverified values stay `null`, never guessed. First set: Elsevier, Copernicus (EGU),
   AGU, Springer (incl. Geosciences Journal), GSA, 대한지질학회지, 자원환경지질 (decision 3).
5. **Shipped skills are a list, not one module.** `server/src/geo/shipped-skills.ts` generalises `note-style.ts` (seed
   once, follow new versions only while unedited, deleted/disabled copies stay, state per skill) for `gaid-note-style`
   and `gaid-figures`; the library's literature skills (open item gaid-research-hub#8) can be added the same way. Both are
   always offered by `applyExposure`. The catalogue archive is unchanged (decision 5).
6. **Figure checks are deterministic and versioned by content.** One check script ships in the skill
   (`scripts/check_figure.py`); the server runs it with the helper Python for the record's 점검 action (no model call) and
   the agent may run the same script. It writes
   `.kady/geo/figure-checks/<sha256>.json` (schema `gaid-figure-check/v1`): target journal/width, measured pixel size, dpi at
   the target width, smallest text size at final size (vector sources and Matplotlib metadata; `null` when not measurable),
   embedded fonts, format, colour-map findings (rainbow/jet), CVD simulation previews, missing axis units when detectable,
   and the AI-policy verdict for the kind. A changed figure has a new sha256, so an old check never describes a new figure.
   Model-based visual critique, when added, is stored as `advice` and never changes a check result. Checks never claim
   compliance: the record says "점검 결과", with the date of the journal rules.
7. **AI pictures stay allowed, marked and disclosed** (decision 2). An `ai-picture` record shows the target journal's
   policy for its use and a disclosure draft (tool, model, date, purpose) built from the step; the model name appears only in
   the record view (UI guide R4, `.record` locale ids). Hub concept pictures keep their "개념 그림" label.
8. **Connection map reads existing links only.** `GET /geo/connections?focus=<kind>:<id>&depth=1|2` returns typed nodes
   (`paper`, `note`, `figure`, `file`, `chat`, `workflow`) and edges (`cites`, `wrote`, `contains`, `drew`, `used`,
   `started-from`, `made-from`) from: note citations and library uses (library unit), note ↔ chat sessions
   (`.kady/geo/notes.json`), note figures, provenance lineage (figure ← script ← data), method trials and Workflow
   provenance (paper → Workflow). Bounded (≤ 80 nodes, depth ≤ 2), computed per request, no graph store. The web view uses
   React Flow (`@xyflow/react`, MIT) with dagre (MIT) layout; it opens from a note, a figure record and a library item.
   Manuscript nodes join when the library unit's phase 2 exists.
9. **Idea board format (phase 3, not built)**: one JSON Canvas 1.0 file per board under `아이디어/<name>.canvas` in the
   project sandbox; cards reference project files (notes, figures) and library items by link; edge labels from the fixed
   relation set (지지함, 반박함, 조건을 붙임, 필요함). Obsidian opens it unchanged (decision 4).

## Alternatives considered

- *A figure store written by the agent* (a tool that registers figures with kind and sources): simpler queries, but makes
  provenance model-declared, which GAID refuses (provenance is what the model is checked against). Rejected.
- *Embed the record into the Markdown renderer* (badge over every image in notes and chat): one place, but the renderer
  is shared with chat and upstream. Rejected for a note-scoped figure list + record pane.
- *Ship the figure skill through a new geo catalogue version* (decision 5 option 나): one distribution path, but needs a
  catalogue release and leaves the literature skills debt separate. Rejected.
- *Keep AI pictures out of the paper-figure flow* (decision 2 option 나): simplest, but Copernicus and AGU accept disclosed
  AI schematics and the policy table can mark the forbidden uses. Rejected.
- *Cytoscape.js or sigma.js* for the map: better for thousands of nodes; the map is bounded and card-like, and React Flow
  also serves the later board. *elkjs* (EPL-2.0) and *tldraw* (licence key) not used.
- *showyourwork / DVC / DataLad* for figure reproducibility: duplicate GAID's provenance. Not used.

## Consequences

- New contracts `web/src/geo/contracts/figures.ts` and `web/src/geo/contracts/connections.ts` (IO-free), server modules
  `server/src/geo/figures/` and `server/src/geo/connections/`, web `web/src/geo/figures/` and `web/src/geo/connections/`.
- New web dependencies `@xyflow/react` and `@dagrejs/dagre`; new geo environment packages `cmcrameri` (and SciencePlots)
  for new project sandboxes and the helper venv; existing project environments are never rewritten.
- `THIRD_PARTY_NOTICES.md` gains the K-Dense skill adaptation, cmcrameri, React Flow, dagre.
- Figure kind detection is heuristic; `unknown` is shown as such and the researcher can set it.
- Open: AGU and the Korean journals have few verified numbers; their profile fields stay `null` until checked.
