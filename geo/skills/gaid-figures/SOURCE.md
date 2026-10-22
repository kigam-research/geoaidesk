# Source and adaptation

- Upstream: K-Dense-AI/scientific-agent-skills, revision `92ace75a`, skill
  `skills/scientific-visualization`, version 1.4 (2026-10-01).
  https://github.com/K-Dense-AI/scientific-agent-skills/tree/92ace75a/skills/scientific-visualization
- Copyright (c) 2025 K-Dense Inc., MIT. Full upstream repository license retained in `LICENSE`.
- GAID adaptation (2026-10-22): rewrote the entry point for final-size geoscience journal figures,
  cmcrameri defaults, code diagrams, research notes and AI disclosure. Retained the network-free
  `figure_export.py`, `palette_audit.py`, `image_metadata.py`, `_common.py` and
  `assets/color_palettes.py`; the exporter additionally
  writes PNG plot-font metadata; removed its old publisher-profile convenience API and
  preset-dependent demo to avoid shipping stale rule snapshots. Replaced `export_plan.py` with a planner using GAID's verified
  journal profiles; added `check_figure.py`. No upstream OpenRouter/network path is shipped.
- Journal rules are independently rechecked official-page facts, not inherited numeric profiles;
  each source and check date lives in `assets/journals.json`. No publisher text is redistributed.
- CVD simulation: Machado, Oliveira & Fernandes (2009), “A Physiologically-based Model for
  Simulation of Color Vision Deficiency”, IEEE TVCG 15(6), 1291–1298,
  https://doi.org/10.1109/TVCG.2009.113. Full-severity 3×3 matrices from the authors' table:
  https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
  The matrix multiplication, sRGB transfer and preview generation are implemented in GAID with NumPy.
