# Pocheon PGI example (synthetic) and reference run

Default example data for the hub Workflow that applies Heo et al. (2025), *Application of petrophysically and
geologically guided inversion to aeromagnetic and drilling data for investigation of magnetite ore in Pocheon, Korea*
(Geosciences Journal 29:946–956, doi:10.1007/s12303-025-00067-8). The paper's data are not public, so the example is
synthetic at the real site; see the data README in the asset for provenance and licence.

- `make_example.py` builds the dataset: real terrain (Copernicus GLO-30 DSM cropped to EPSG:5186 at 25 m), IGRF from
  ppigrf, the paper's borehole table and class statistics, synthetic ore lenses, SimPEG forward-modelled drone lines,
  base-station diurnal record, core samples, reference ore body and the truth model.
- `pgi_reference.py` is the writer's yardstick for the trial (not shipped in the Workflow): diurnal correction → 25 m
  bins with Z-score rejection → IGRF removal → the paper's core window → GMM from core samples → SimPEG PGI-full and
  PGI-none (25 m tensor mesh with topography and sensitivity weighting, as in the paper's ESM1) → ore by property
  isovalue and P(ore) > 0.99 inside a sensitivity mask → connected body nearest the boreholes → volume, depth, and
  IoU/precision/recall against the truth.

The asset is `pocheon_pgi_example` in `configs/inputs.toml` (`~/assets/gaid-pocheon-pgi-example/2026-10-23/`).

```sh
DEPS="--with simpeg --with choclo --with rasterio --with scipy --with ppigrf --with pyproj --with pandas --with scikit-learn --with matplotlib"
uv run --no-project $DEPS python geo/examples/pocheon-pgi/pgi_reference.py \
  --data ~/assets/gaid-pocheon-pgi-example/2026-10-23 --out ~/data/geoaidesk/work/<slug>/ref-run
```

Reference results on PC74 (2026-10-23, SimPEG 0.25.2; 82,807 active cells of 25 m, 620 data; truth target body
488,000 m³):

| Run | Learned GMM means (SI) | Target body, property isovalue | Target body, P(ore) > 0.99 | Time |
|---|---|---|---|---|
| PGI-full, paper proportions 0.9/0.075/0.025 | fixed 0.0064 / 0.172 / 0.290 | 578,125 m³ | 109,375 m³ | 106 s |
| PGI-none, paper proportions | 0.0032 / 0.0065 / 0.036 (collapsed) | 3.86 Mm³ (isovalue 0.036) | 250,000 m³ | 112 s |
| PGI-none, proportions 0.985/0.01/0.005 (`--weights`) | 0.0034 / 0.017 / 0.208 | 1,359,375 m³ | 953,125 m³ | 128 s |

The GMM proportions are volume fractions over the whole active mesh, padding included. With the paper's 2.5 % ore
share the ore component has to hold far more volume than the ore body, so learning the means (kappa = 0) drags the
ore mean down to the host level. A share closer to the expected ore fraction of the mesh keeps the learned means
apart; the paper's own proportions worked on its data (anomaly > 3,000 nT). Core-sample fractions (136 / 36 / 99) are
biased towards ore because the holes target it and are not a substitute.
