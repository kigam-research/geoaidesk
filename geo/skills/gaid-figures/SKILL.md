---
name: gaid-figures
description: Draw and check scientific data figures and code diagrams for research notes, papers or slides, at the target journal's final physical size. Use for plotting, multi-panel figures, scientific colour maps, figure export and figure checks; not for generating research data or editing primary observations with AI.
license: MIT
metadata:
  version: "1.0"
  upstream: "K-Dense scientific-visualization v1.4"
---

# Scientific figures for GAID

Adapted from K-Dense's `scientific-visualization` (MIT); see `SOURCE.md` and `LICENSE`.
Preserve the data, transformations, units, missing values and uncertainty definition. Do not
invent observations, remove inconvenient points, hide gaps, interpolate without explanation,
upsample as if detail increased, or choose axes to manufacture a result.

## Draw at the destination size

1. Read the project's `.kady/geo/figure-target.json` (`journalId`, `width`) when present.
   Resolve it against `assets/journals.json`. Ask for an exact journal/width when it materially
   affects the output and is missing. Otherwise label the working size provisional; do not
   turn an unknown profile value into a requirement. Check the official journal's current
   article-type and submission-phase rules before submission. Profiles are dated snapshots.
2. Create data figures reproducibly with code from the source data. Set `figsize` using the
   final width in **mm / 25.4**, and text sizes in **pt** before drawing. Use the profile's
   minimum font size when known (including ticks, legends and colour bars); record any
   justified exception. Never shrink a slide or screen figure into a paper figure afterward.
   Preserve source data, plotting code, exclusions, normalization, bins, seeds and uncertainties.
3. Choose a palette by data meaning. Default to `cmcrameri.cm.batlow` for sequential values,
   `vik` for signed deviations with a scientifically justified centre, and `romaO` for cyclic
   data. Never use jet/rainbow for continuous data. Add markers, line styles, hatching or direct
   labels so colour is not the only cue. Describe units, sample size and uncertainty; distinguish
   missing values from zero. Avoid decorative 3-D and unjustified dual axes.
4. Use scoped Matplotlib styles. `scienceplots` is installed; if used, select `['science',
   'no-latex']` unless a working TeX installation was verified. Set PDF/PS font type 42. Use
   constrained layout; do not combine it with `tight_layout()`. Keep physical output size:
   do not use `bbox_inches='tight'` unless a changed page width is deliberate and rechecked.
5. Export editable vector **and** raster files as the journal requests. Keep an editable SVG
   with live text or the plotting source alongside an embedded-font PDF/EPS submission export.
   `scripts/figure_export.py` provides `export_figure(fig, base, formats=('pdf', 'png'), dpi=...)`:
   add this skill's `scripts/` to `sys.path` and import it. PNG exports with no cropping contain
   plot-derived minimum-font metadata for the checker. This metadata is a self-report, not OCR.
   Use `scripts/export_plan.py` to resolve dimensions and pixel counts from the verified profiles.
6. Run the checker below on delivered files. Fix failures and actionable warnings, then run it
   again on the **final bytes**. Inspect the raster, vector and three CVD previews at final size;
   check axes, units, panel labels, data fidelity and legibility manually. A script result is
   not proof of accessibility, scientific correctness or journal compliance. Report unchecked
   facts as unchecked. `references/checker.md` explains measurement limits and exit codes.

## Check and attach to the research note

Run from the project sandbox with its Python environment (`uv run python`). Substitute this
skill's actual directory, the file, the target and its content hash:

```bash
uv run python <skill>/scripts/check_figure.py figures/plot.png \
  --journals <skill>/assets/journals.json --journal elsevier --width single \
  --kind data-figure --artwork combination \
  --out .kady/geo/figure-checks/<sha256>.json
```

`--artwork photo|combination|lineArt` is a resolution class, not the figure's provenance kind.
Omitting `--out` uses `.kady/geo/figure-checks/<sha256>.json`; preview files stay next to it as
`<sha256>-cvd-deuteranopia.png`, `<sha256>-cvd-protanopia.png` and `<sha256>-cvd-tritanopia.png`.
Omit it if uncertain; the checker then compares against all known resolution classes without
assuming one. `--use graphical-abstract` applies the appropriate AI policy. Without a target,
measure what is possible and leave journal-specific checks unmeasured. SHA-256 must be computed
from the checked file; never reuse a report for different bytes.

Follow `RESEARCH_NOTE_RULE`: copy every figure actually shown into that note's `figures/`, use
Markdown paths relative to the note, and keep source scripts/data linked as evidence. A copied
file with identical bytes has the same check hash. When the note shows an AI-generated picture
or AI image edit, state that fact in its caption as research text (for example, “AI-generated
conceptual illustration; not measured data”), and provide the journal's disclosure details.
Never present an AI picture as measured data. Describe tool/model/version, date, purpose and
extent in the disclosure where required, without implying that the checker verified the history.

For flowcharts, concepts and relationships prefer editable code diagrams (Mermaid, SVG, draw.io,
DOT or TikZ). Image generation is an explicit alternative, subject to the journal's policy:
Elsevier explanatory pictures require disclosure, AI graphical abstracts are forbidden, and AI
alterations of primary research images are forbidden. Unknown journal policy means unverified,
not permission. Code diagrams are not automatically AI-generated pictures merely because an AI
agent wrote their code. Do not use AI to modify primary observations for appearance.

Additional network-free upstream helpers: `scripts/palette_audit.py` checks an explicit palette;
`scripts/image_metadata.py` inspects file metadata. They are advisory and do not identify the
journal or replace the GAID checker. Colour-map references: F. Crameri (2018),
https://doi.org/10.5194/gmd-11-2541-2018; Crameri, Shephard & Heron (2020),
https://doi.org/10.1038/s41467-020-19160-7. Cite the colour maps used in the manuscript.
