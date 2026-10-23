"""Build a Pocheon-like SYNTHETIC example dataset for a PGI magnetite Workflow.

Everything here is synthetic except the published statistics it imitates (Heo et al. 2025, Geosciences Journal
29:946-956: class means/variances, borehole table, IGRF at the site, survey design). Outputs (EPSG:5186):

  aeromag_lines.csv    drone TMI along lines (total field incl. IGRF, diurnal variation, noise, spikes)
  base_station.csv     base-station total field for diurnal correction
  dem.tif              real terrain: Copernicus GLO-30 DSM resampled to 25 m
  boreholes.csv        collar and end points (paper Table 1)
  core_samples.csv     271 core samples with class and susceptibility (99 ore, 36 low-grade, 136 host)
  truth/               true susceptibility model + ore body volume (for validation only, not for the analysis)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

RNG = np.random.default_rng(20251223)

# Paper values
CLASSES = {"host": (0.0045, 2.0403e-4, 136), "low_grade": (0.1587, 3.0031e-3, 36), "ore": (0.2828, 7.5616e-3, 99)}
BOREHOLES_PAPER = [
    ("KM20-1", (220306.67, 612838.08, 350.00), (220488.54, 612913.45, 315.27)),
    ("KM20-2", (220274.25, 612823.83, 350.00), (220451.84, 612831.58, 318.66)),
    ("KM21-1", (220305.00, 612840.00, 350.00), (220506.72, 612956.46, 241.39)),
]
BOREHOLES = []  # filled in main(): collar moved onto the DEM, drop kept
IGRF = dict(inc=55.102, dec=-8.850, amp=51473.6)
X0, X1, Y0, Y1 = 219650.0, 221250.0, 612050.0, 613550.0  # 1.6 km x 1.5 km survey block around the paper window


_DEM = None


def load_dem(path):
    """Real terrain: Copernicus GLO-30 DSM resampled to 25 m in EPSG:5186 (see README for attribution)."""
    global _DEM
    import rasterio
    from scipy.interpolate import RegularGridInterpolator

    with rasterio.open(path) as r:
        z = r.read(1).astype(float)[::-1]
        t = r.transform
        xs = t.c + t.a * (np.arange(r.width) + 0.5)
        ys = t.f + t.e * (np.arange(r.height)[::-1] + 0.5)
    _DEM = RegularGridInterpolator((ys, xs), z, bounds_error=False, fill_value=None)


def terrain(x, y):
    x, y = np.broadcast_arrays(np.asarray(x, float), np.asarray(y, float))
    return _DEM(np.c_[y.ravel(), x.ravel()]).reshape(x.shape)


def ore_bodies():
    """Return a function giving true susceptibility at points (x, y, z) and per-body descriptors."""
    # Target lens around the boreholes: dipping NE-trending tabular body, ~0.47 Mm3.
    bodies = [
        dict(name="target", cx=220400, cy=612880, cz=None, depth=18, L=300, W=115, T=26, strike=20, dip=15,
             kappa=0.80),
        dict(name="neighbour_sw", cx=220180, cy=612520, cz=None, depth=22, L=280, W=110, T=22, strike=60, dip=25,
             kappa=0.60),
    ]
    halo = dict(extra=40, kappa=0.12)  # low-grade disseminated halo around each lens
    for b in bodies:
        b["cz"] = float(terrain(np.array(b["cx"]), np.array(b["cy"]))) - b["depth"]

    def local(b, x, y, z):
        s, d = np.radians(b["strike"]), np.radians(b["dip"])
        dx, dy, dz = x - b["cx"], y - b["cy"], z - b["cz"]
        u = dx * np.sin(s) + dy * np.cos(s)  # along strike
        v = dx * np.cos(s) - dy * np.sin(s)  # across strike
        vv = v * np.cos(d) + dz * np.sin(d)
        w = -v * np.sin(d) + dz * np.cos(d)  # normal to the lens
        return u, vv, w

    def kappa(x, y, z):
        k = np.full(x.shape, CLASSES["host"][0])
        for b in bodies:
            u, v, w = local(b, x, y, z)
            e = (u / (b["L"] / 2)) ** 2 + (v / (b["W"] / 2)) ** 2
            halo_m = (e <= ((1 + halo["extra"] / b["W"]) ** 2)) & (np.abs(w) <= b["T"] / 2 + halo["extra"] / 2)
            k = np.where(halo_m, np.maximum(k, halo["kappa"]), k)
            core = (e <= 1) & (np.abs(w) <= b["T"] / 2)
            k = np.where(core, b["kappa"], k)
        return k

    return kappa, bodies, local


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--truth-cell", type=float, default=10.0)
    ap.add_argument("--dem", type=Path, required=True)
    args = ap.parse_args()
    out: Path = args.out
    (out / "truth").mkdir(parents=True, exist_ok=True)

    import discretize
    import rasterio
    from rasterio.transform import from_origin
    from simpeg import maps
    from simpeg.potential_fields import magnetics as mag

    load_dem(args.dem)
    for n, a, b in BOREHOLES_PAPER:
        zc = float(terrain(a[0], a[1]))
        BOREHOLES.append((n, (a[0], a[1], round(zc, 2)), (b[0], b[1], round(zc - (a[2] - b[2]), 2))))
    kappa_fn, bodies, local = ore_bodies()

    # DEM 25 m
    dx = 25.0
    xs = np.arange(X0 - 500, X1 + 500 + dx, dx)
    ys = np.arange(Y0 - 500, Y1 + 500 + dx, dx)
    XX, YY = np.meshgrid(xs, ys)
    ZZ = terrain(XX, YY)
    with rasterio.open(out / "dem.tif", "w", driver="GTiff", height=ZZ.shape[0], width=ZZ.shape[1], count=1,
                       dtype="float32", crs="EPSG:5186",
                       transform=from_origin(xs[0] - dx / 2, ys[-1] + dx / 2, dx, dx)) as dst:
        dst.write(ZZ[::-1].astype("float32"), 1)

    # Flight lines: E-W lines 55 m apart, sample every 6 m, 60 m above terrain (+ tree-top climbs near target).
    t0 = np.datetime64("2022-05-17T01:00:00")
    rows = []
    line_y = np.arange(Y0, Y1 + 1, 55.0)
    t = 0.0
    for li, ly in enumerate(line_y):
        lx = np.arange(X0, X1 + 1, 2.0)
        if li % 2:
            lx = lx[::-1]
        ly_arr = ly + RNG.normal(0, 2.0, lx.size)
        h = 60.0 + RNG.normal(0, 1.5, lx.size)
        # Part of the target area flown high (paper Fig. 2b): NE of the target, 95-130 m AGL.
        hi = ((lx - 220520) ** 2 / 200**2 + (ly_arr - 612980) ** 2 / 160**2) < 1
        h = np.where(hi, 110 + 15 * np.sin(lx / 40.0), h)
        z = terrain(lx, ly_arr) + h
        for k in range(lx.size):
            rows.append((li + 1, len(rows), t, lx[k], ly_arr[k], z[k], h[k]))
            t += 0.25  # 8 m/s, 2 m spacing (MagArrow output decimated to 4 Hz)
        t += 40.0  # turn
    rows = np.array(rows)
    rx = rows[:, 3:6]

    # Truth mesh for forward modelling (fine; forward-only, no stored sensitivities)
    h = args.truth_cell
    cx0, cx1, cy0, cy1 = 219650.0, 220700.0, 612150.0, 613150.0
    nx, ny = int((cx1 - cx0) / h), int((cy1 - cy0) / h)
    zbot, ztop = 150.0, 520.0
    nz = int((ztop - zbot) / h)
    mesh = discretize.TensorMesh([np.full(nx, h), np.full(ny, h), np.full(nz, h)], origin=[cx0, cy0, zbot])
    cc = mesh.cell_centers
    active = cc[:, 2] < terrain(cc[:, 0], cc[:, 1])
    k_true = kappa_fn(cc[:, 0], cc[:, 1], cc[:, 2])
    # Forward only the anomalous part (background host is near-uniform; add its regional trend analytically = 0)
    anomalous = active & (k_true > CLASSES["host"][0] + 1e-9)
    k_anom = (k_true - CLASSES["host"][0])[anomalous]
    print("truth mesh", mesh.n_cells, "anomalous cells", anomalous.sum(), "receivers", rx.shape[0])

    import datetime as _dt0

    import ppigrf as _pp
    from pyproj import Transformer as _Tr

    _lon, _lat = _Tr.from_crs(5186, 4326, always_xy=True).transform(220450.0, 612812.5)
    _be, _bn, _bu = _pp.igrf(_lon, _lat, 0.45, _dt0.datetime(2022, 5, 17))
    _inc, _dec = _pp.get_inclination_declination(_be, _bn, _bu)
    IGRF.update(inc=float(np.ravel(_inc)[0]), dec=float(np.ravel(_dec)[0]),
                amp=float(np.sqrt(_be**2 + _bn**2 + _bu**2).ravel()[0]))
    receivers = mag.receivers.Point(rx, components="tmi")
    src = mag.sources.UniformBackgroundField(receiver_list=[receivers], amplitude=IGRF["amp"],
                                             inclination=IGRF["inc"], declination=IGRF["dec"])
    survey = mag.Survey(src)
    sim = mag.Simulation3DIntegral(mesh=mesh, survey=survey, chiMap=maps.IdentityMap(nP=int(anomalous.sum())),
                                   active_cells=anomalous, store_sensitivities="forward_only", engine="choclo")
    d_anom = sim.dpred(k_anom)

    # Ore volumes (truth)
    vol = {}
    cell_v = h**3
    for b in bodies:
        u, v, w = local(b, cc[:, 0], cc[:, 1], cc[:, 2])
        e = (u / (b["L"] / 2)) ** 2 + (v / (b["W"] / 2)) ** 2
        vol[b["name"]] = float(((e <= 1) & (np.abs(w) <= b["T"] / 2) & active).sum() * cell_v)

    # Total field = IGRF (slowly varying with position, approx gradient) + diurnal + anomaly + noise + spikes
    tt = rows[:, 2]
    diurnal = 4.0 * np.sin(2 * np.pi * tt / 7200.0) + 1.2 * np.sin(2 * np.pi * tt / 900.0)
    import datetime as _dt

    import ppigrf
    from pyproj import Transformer

    lon, lat = Transformer.from_crs(5186, 4326, always_xy=True).transform(rows[:, 3], rows[:, 4])
    Be, Bn, Bu = ppigrf.igrf(lon, lat, rows[:, 5] / 1000.0, _dt.datetime(2022, 5, 17))
    igrf_total = np.sqrt(Be**2 + Bn**2 + Bu**2).ravel()
    noise = RNG.normal(0, 2.0, tt.size)
    spikes = np.zeros(tt.size)
    idx = RNG.choice(tt.size, size=tt.size // 400, replace=False)
    spikes[idx] = RNG.choice([-1, 1], idx.size) * RNG.uniform(150, 600, idx.size)
    tmi = igrf_total + diurnal + d_anom + noise + spikes

    times = t0 + (tt * 1000).astype("timedelta64[ms]")
    with open(out / "aeromag_lines.csv", "w") as f:
        f.write("line,fid,time_utc,x,y,z_asl_m,height_agl_m,tmi_nT\n")
        for r, ts, v in zip(rows, times, tmi):
            f.write(f"L{int(r[0]):03d},{int(r[1])},{ts}Z,{r[3]:.2f},{r[4]:.2f},{r[5]:.2f},{r[6]:.2f},{v:.2f}\n")

    bt = np.arange(-1800, tt.max() + 1800, 10.0)
    bdiur = 4.0 * np.sin(2 * np.pi * bt / 7200.0) + 1.2 * np.sin(2 * np.pi * bt / 900.0)
    with open(out / "base_station.csv", "w") as f:
        f.write("time_utc,total_field_nT\n")
        for b_t, v in zip(t0 + (bt * 1000).astype("timedelta64[ms]"), 50518.6 + bdiur + RNG.normal(0, 0.3, bt.size)):
            f.write(f"{b_t}Z,{v:.2f}\n")

    with open(out / "boreholes.csv", "w") as f:
        f.write("hole_id,start_x,start_y,start_z,end_x,end_y,end_z\n")
        for n, a, b in BOREHOLES:
            f.write(f"{n},{a[0]},{a[1]},{a[2]},{b[0]},{b[1]},{b[2]}\n")

    # Core samples along the holes: class from the TRUE model at the sample, susceptibility drawn from the
    # paper's class distribution (clipped at 1e-4). Counts are adjusted to the paper's 99 / 36 / 136.
    samples = []
    for n, a, b in BOREHOLES:
        a, b = np.array(a), np.array(b)
        L = np.linalg.norm(b - a)
        for s in np.arange(1.0, L, 0.25):
            p = a + (b - a) * s / L
            samples.append((n, s, *p, float(kappa_fn(*[np.array([c]) for c in p])[0])))
    samples = np.array(samples, dtype=object)
    cls = np.where(np.array(samples[:, 5], float) >= 0.25, "ore",
                   np.where(np.array(samples[:, 5], float) >= 0.1, "low_grade", "host"))
    chosen = []
    for c, (mu, var, n_target) in CLASSES.items():
        ids = np.flatnonzero(cls == c)
        if ids.size < n_target:
            raise SystemExit(f"not enough {c} positions: {ids.size} < {n_target}")
        pick = np.sort(RNG.choice(ids, n_target, replace=False))
        # log-normal with the paper's class mean and variance (susceptibility is positive and right-skewed)
        s2 = np.log(1 + var / mu**2)
        vals = RNG.lognormal(np.log(mu) - s2 / 2, np.sqrt(s2), n_target)
        for i, v in zip(pick, vals):
            chosen.append((samples[i][0], float(samples[i][1]), *[float(q) for q in samples[i][2:5]], c, v))
    chosen.sort(key=lambda r: (r[0], r[1]))
    litho = {"host": ["gabbro", "quartz-monzodiorite", "monzodiorite", "dyke"], "low_grade": ["low-grade ore"],
             "ore": ["magnetite ore"]}
    with open(out / "core_samples.csv", "w") as f:
        f.write("hole_id,depth_along_hole_m,x,y,z,lithology,class,susceptibility_SI,density_g_cc\n")
        for r in chosen:
            lith = RNG.choice(litho[r[5]])
            dens = {"host": 2.85, "low_grade": 3.15, "ore": 3.6}[r[5]] + RNG.normal(0, 0.08)
            f.write(f"{r[0]},{r[1]:.2f},{r[2]:.2f},{r[3]:.2f},{r[4]:.2f},{lith},{r[5]},{r[6]:.5f},{dens:.3f}\n")

    # Reference ore body for validation (the paper's role: the drill-interpreted ore body, 468,853 m3). Here it is the
    # synthetic truth of the target lens, as 10 m cell centres, so the analysis can compare volume, depth and overlap.
    tb = next(b for b in bodies if b["name"] == "target")
    u, v, w = local(tb, cc[:, 0], cc[:, 1], cc[:, 2])
    inside = ((u / (tb["L"] / 2)) ** 2 + (v / (tb["W"] / 2)) ** 2 <= 1) & (np.abs(w) <= tb["T"] / 2) & active
    with open(out / "orebody_reference.csv", "w") as f:
        f.write(f"# synthetic target ore body (truth), cell size {h} m; volume {inside.sum() * h**3:.0f} m3\n")
        f.write("x,y,z,cell_m\n")
        for x_, y_, z_ in cc[inside]:
            f.write(f"{x_:.1f},{y_:.1f},{z_:.1f},{h:g}\n")
    np.save(out / "truth" / "kappa_true.npy", np.where(active, k_true, np.nan).astype("float32"))
    json.dump(dict(mesh=dict(h=h, origin=[cx0, cy0, zbot], shape=[nx, ny, nz]), bodies=bodies, volumes_m3=vol,
                   igrf=IGRF, note="synthetic truth for validation; not an analysis input"),
              open(out / "truth" / "truth.json", "w"), indent=1)
    print("volumes", vol, "max anomaly nT", float(d_anom.max()), "min", float(d_anom.min()))


if __name__ == "__main__":
    main()
