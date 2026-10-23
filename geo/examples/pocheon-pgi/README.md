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

Reference result on PC74 (2026-10-23, SimPEG 0.25.2): 82,807 active cells, 620 data, both variants in 218 s.
PGI-full, property isovalue (ore mean): target body 578,125 m³ (truth 488,000 m³). PGI-none: the learned means
collapse towards the host value (0.003 / 0.006 / 0.036 SI) with the paper's fixed proportions (0.9 / 0.075 / 0.025),
so its isovalue selects several Mm³. This is a known sensitivity of mean learning without confidence in the prior
(kappa = 0) and is reported, not tuned away.
