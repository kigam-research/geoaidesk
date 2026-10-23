"""Reference PGI pipeline (writer's yardstick for the Pocheon trial; follows Heo et al. 2025 + its ESM1 script).

Steps: diurnal correction -> 25 m binning with Z-score > 3 rejection -> IGRF removal (ppigrf) -> crop to the
paper's core window -> GMM from core-sample susceptibility -> SimPEG PGI-full and PGI-none on a 25 m tensor mesh
with topography and sensitivity weighting -> ore by property isovalue and by P(ore) > 0.99 inside a sensitivity
mask -> connected body nearest the boreholes -> volume, depth.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import time
from pathlib import Path

import numpy as np

T0 = time.time()


def log(*a):
    print(f"[{time.time() - T0:7.1f}s]", *a, flush=True)


def process(d: Path, cell: float, window):
    import pandas as pd
    import ppigrf
    from pyproj import Transformer

    lines = pd.read_csv(d / "aeromag_lines.csv", parse_dates=["time_utc"])
    base = pd.read_csv(d / "base_station.csv", parse_dates=["time_utc"])
    epoch = pd.Timestamp("1970-01-01", tz="UTC")
    tl = ((lines.time_utc - epoch) / pd.Timedelta(seconds=1)).to_numpy()  # unit-safe (pandas may parse as us)
    tb = ((base.time_utc - epoch) / pd.Timedelta(seconds=1)).to_numpy()
    b = base.total_field_nT.to_numpy()
    dvc = np.interp(tl, tb, b) - b.mean()
    tmi = lines.tmi_nT.to_numpy() - dvc
    log("diurnal correction range", round(float(dvc.min()), 2), round(float(dvc.max()), 2))

    x, y, z = lines.x.to_numpy(), lines.y.to_numpy(), lines.z_asl_m.to_numpy()
    x0, x1, y0, y1 = window
    ix = np.floor((x - x0) / cell).astype(int)
    iy = np.floor((y - y0) / cell).astype(int)
    nx, ny = int(round((x1 - x0) / cell)), int(round((y1 - y0) / cell))
    keep = (ix >= 0) & (ix < nx) & (iy >= 0) & (iy < ny)
    key = ix[keep] * ny + iy[keep]
    df = pd.DataFrame(dict(k=key, t=tmi[keep], z=z[keep], tt=tl[keep]))
    g = df.groupby("k").t
    mu, sd = g.transform("mean"), g.transform("std").fillna(0)
    zs = np.where(sd > 0, (df.t - mu).abs() / sd.replace(0, np.nan), 0)
    rejected = int((zs > 3).sum())
    df = df[zs <= 3]
    agg = df.groupby("k").agg(t=("t", "mean"), s=("t", "std"), z=("z", "mean"), n=("t", "size"), tt=("tt", "mean"))
    agg = agg[agg.n >= 3]
    kx, ky = agg.index.to_numpy() // ny, agg.index.to_numpy() % ny
    gx, gy = x0 + (kx + 0.5) * cell, y0 + (ky + 0.5) * cell
    log("binned", len(agg), "points; Z-score rejected", rejected)

    lon, lat = Transformer.from_crs(5186, 4326, always_xy=True).transform(gx, gy)
    date = dt.datetime.fromtimestamp(float(np.median(agg.tt)), dt.timezone.utc).replace(tzinfo=None)
    Be, Bn, Bu = ppigrf.igrf(lon, lat, agg.z.to_numpy() / 1000.0, date)
    F = np.sqrt(Be**2 + Bn**2 + Bu**2).ravel()
    anom = agg.t.to_numpy() - F
    # paper: the standard deviation of the values in each 25 m bin; a 2 nT floor keeps quiet bins from dominating
    std = np.maximum(np.nan_to_num(agg.s.to_numpy()), 2.0)
    return np.c_[gx, gy, agg.z.to_numpy()], anom, std, date


def gmm_from_samples(d: Path):
    import pandas as pd

    s = pd.read_csv(d / "core_samples.csv")
    order = ["host", "low_grade", "ore"]
    means = np.array([s[s["class"] == c].susceptibility_SI.mean() for c in order])
    var = np.array([s[s["class"] == c].susceptibility_SI.var() for c in order])
    n = np.array([(s["class"] == c).sum() for c in order])
    return order, means, var, n


def run_pgi(mode, mesh, active, rx, dobs, std, ifield, means, var, weights, max_iter, sens_cache):
    from simpeg import data, data_misfit, directives, inverse_problem, inversion, maps, optimization, regularization, utils
    from simpeg.potential_fields import magnetics

    nC = int(active.sum())
    rec = magnetics.receivers.Point(rx, components=["tmi"])
    src = magnetics.sources.UniformBackgroundField(receiver_list=[rec], **ifield)
    survey = magnetics.survey.Survey(src)
    dat = data.Data(survey=survey, dobs=dobs, standard_deviation=std)
    sim = magnetics.simulation.Simulation3DIntegral(survey=survey, mesh=mesh, model_type="scalar",
                                                    chiMap=maps.IdentityMap(nP=nC), active_cells=active,
                                                    store_sensitivities="ram", engine="choclo")
    G = sim.G
    sens = np.sqrt((G**2).sum(axis=0)) / mesh.cell_volumes[active]
    sens /= sens.max()
    sens_cache["sens"] = sens
    dmis = data_misfit.L2DataMisfit(data=dat, simulation=sim)

    gmm = utils.WeightedGaussianMixture(n_components=3, mesh=mesh, actv=active, covariance_type="diag")
    gmm.fit(np.random.randn(nC, 1))
    gmm.means_ = means.reshape(3, 1)
    gmm.covariances_ = var.reshape(3, 1)
    gmm.compute_clusters_precisions()
    gmm.weights_ = weights
    m0 = np.full(nC, means[0])
    reg = regularization.PGI(gmmref=gmm, mesh=mesh, wiresmap=maps.Wires(("sus", nC)), maplist=[maps.IdentityMap(nP=nC)],
                             active_cells=active, alpha_pgi=1.0, alpha_x=1.0, alpha_y=1.0, alpha_z=1.0,
                             alpha_xx=0.0, alpha_yy=0.0, alpha_zz=0.0,
                             reference_model=utils.mkvc(gmm.means_[gmm.predict(m0.reshape(nC, -1))]),
                             weights_list=[sens])
    opt = optimization.ProjectedGNCG(maxIter=max_iter, maxIterLS=20, cg_maxiter=50, cg_rtol=1e-3, lower=1e-9, upper=0.5)
    invp = inverse_problem.BaseInvProblem(dmis, reg, opt)
    kappa = np.full((3, 1), 1e10 if mode == "full" else 0.0)  # (n_components, n_props); ESM1 used (1, 3), which fails in SimPEG 0.25
    dirs = [
        directives.AlphasSmoothEstimate_ByEig(alpha0_ratio=0.5),
        directives.BetaEstimate_ByEig(beta0_ratio=1.0),
        directives.PGI_UpdateParameters(update_gmm=(mode == "none"), kappa=kappa),
        directives.MultiTargetMisfits(chifact=1.0, chiSmall=1.0),
        directives.PGI_BetaAlphaSchedule(coolingFactor=2.0, tolerance=0.2, progress=0.2),
        directives.PGI_AddMrefInSmooth(wait_till_stable=True),
        directives.UpdatePreconditioner(),
    ]
    inv = inversion.BaseInversion(invp, directiveList=dirs)
    m = inv.run(m0)
    learned = reg.objfcts[0].gmm
    phi_d = float(dmis(m))
    return m, learned, phi_d, sim


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--cell", type=float, default=25.0)
    ap.add_argument("--zthick", type=float, default=400.0)
    ap.add_argument("--npad", type=int, default=8)
    ap.add_argument("--max-iter", type=int, default=30)
    ap.add_argument("--sens-mask", type=float, default=0.02)
    ap.add_argument("--weights", default="0.9,0.075,0.025", help="GMM proportions host,low,ore (paper ESM1)")
    ap.add_argument("--modes", default="full,none")
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    np.random.seed(518936)

    import discretize
    import rasterio
    from discretize.utils import active_from_xyz
    from scipy import ndimage

    cell = args.cell
    window = (220012.5, 220012.5 + 35 * 25, 612362.5, 612362.5 + 36 * 25)  # paper ESM1 core window (35 x 36 cells)
    rx, dobs, std, date = process(args.data, cell, window)
    log("anomaly range nT", round(float(dobs.min()), 1), round(float(dobs.max()), 1), "n", dobs.size)

    order, means, var, n = gmm_from_samples(args.data)
    weights = np.array([float(w) for w in args.weights.split(",")])
    log("GMM means", means.round(4), "var", var.round(6), "n", n)

    # topography
    with rasterio.open(args.data / "dem.tif") as r:
        zt = r.read(1)
        t = r.transform
        X, Y = np.meshgrid(t.c + t.a * (np.arange(r.width) + 0.5), t.f + t.e * (np.arange(r.height) + 0.5))
    topo = np.c_[X.ravel(), Y.ravel(), zt.ravel()]

    # mesh as in ESM1: core = window, padding expanding by 1.25, z from above max topo to zthick below min topo
    x0, x1, y0, y1 = window
    ncx, ncy = int(round((x1 - x0) / cell)), int(round((y1 - y0) / cell))
    from scipy.interpolate import NearestNDInterpolator

    zf = NearestNDInterpolator(topo[:, :2], topo[:, 2])
    xc = x0 + (np.arange(ncx) + 0.5) * cell
    yc = y0 + (np.arange(ncy) + 0.5) * cell
    zcore = zf(*np.meshgrid(xc, yc))
    zmax, zmin = float(zcore.max()) + cell, float(zcore.min())
    nz = int(np.ceil((zmax - zmin + args.zthick) / cell))
    p = args.npad
    hx = [(cell, p, -1.25), (cell, ncx), (cell, p, 1.25)]
    hy = [(cell, p, -1.25), (cell, ncy), (cell, p, 1.25)]
    hz = [(cell, p, -1.25), (cell, nz)]
    padw = sum(cell * 1.25 ** (i + 1) for i in range(p))
    mesh = discretize.TensorMesh([hx, hy, hz], origin=[x0 - padw, y0 - padw, zmax - nz * cell - padw])
    active = active_from_xyz(mesh, topo)
    log("mesh", mesh.shape_cells, "cells", mesh.n_cells, "active", int(active.sum()), "data", dobs.size)

    import ppigrf
    from pyproj import Transformer

    lon, lat = Transformer.from_crs(5186, 4326, always_xy=True).transform((x0 + x1) / 2, (y0 + y1) / 2)
    Be, Bn, Bu = ppigrf.igrf(lon, lat, float(zcore.mean()) / 1000, date)
    inc, dec = ppigrf.get_inclination_declination(Be[0], Bn[0], Bu[0])
    ifield = dict(amplitude=float(np.sqrt(Be**2 + Bn**2 + Bu**2).ravel()[0]), inclination=float(np.ravel(inc)[0]),
                  declination=float(np.ravel(dec)[0]))
    log("IGRF", ifield)

    results = {}
    cc = mesh.cell_centers[active]
    truth_ore = None
    tdir = args.data.parent / (args.data.name + "-truth")
    tdir = tdir if tdir.exists() else args.data / "truth"
    if (tdir / "truth.json").exists():  # validation only: never used by the inversion
        tj = json.load(open(tdir / "truth.json"))
        kt = np.load(tdir / "kappa_true.npy")
        h, o, shp = tj["mesh"]["h"], np.array(tj["mesh"]["origin"]), tj["mesh"]["shape"]
        ijk = np.floor((cc - o) / h).astype(int)
        ok = np.all((ijk >= 0) & (ijk < np.array(shp)), axis=1)
        truth_ore = np.zeros(len(cc), bool)
        idx = np.ravel_multi_index(ijk[ok].T, shp, order="F")
        truth_ore[ok] = np.nan_to_num(kt[idx]) >= 0.25
    holes = np.loadtxt(args.data / "boreholes.csv", delimiter=",", skiprows=1, usecols=range(1, 7))
    hole_mid = holes[:, :3] * 0.5 + holes[:, 3:] * 0.5
    for mode in args.modes.split(","):
        cache = {}
        log(f"PGI-{mode} start")
        m, learned, phi_d, sim = run_pgi(mode, mesh, active, rx, dobs, std, ifield, means, var, weights,
                                          args.max_iter, cache)
        sens = cache["sens"]
        lm = learned.means_.ravel()
        proba = learned.predict_proba(m.reshape(-1, 1))
        reliable = sens >= args.sens_mask
        res = dict(phi_d=phi_d, n_data=int(dobs.size), learned_means=lm.tolist(), original_means=means.tolist())
        cv = cell**3
        full_index = np.flatnonzero(active)
        for crit, sel in (("property", m >= (means[2] if mode == "full" else lm[2])),
                          ("probability", proba[:, 2] > 0.99)):
            sel = sel & reliable
            if truth_ore is not None:
                tp = int((sel & truth_ore).sum())
                res[f"{crit}_vs_truth"] = dict(iou=tp / max(int((sel | truth_ore).sum()), 1),
                                              precision=tp / max(int(sel.sum()), 1),
                                              recall=tp / max(int(truth_ore.sum()), 1),
                                              truth_cells=int(truth_ore.sum()))
            vol3 = np.zeros(mesh.n_cells, bool)
            vol3[full_index[sel]] = True
            lab, nlab = ndimage.label(vol3.reshape(mesh.shape_cells, order="F"))
            lab = lab.reshape(-1, order="F")[full_index]
            body = {}
            if nlab:
                # component closest to the borehole midpoints = target body
                best, bd = None, np.inf
                for k in range(1, nlab + 1):
                    pts = cc[lab == k]
                    dmin = np.min(np.linalg.norm(pts[:, None, :] - hole_mid[None], axis=2))
                    if dmin < bd:
                        best, bd = k, dmin
                pts = cc[lab == best]
                ground = zf(pts[:, 0], pts[:, 1])
                body = dict(volume_m3=float(len(pts) * cv), n_bodies=int(nlab), distance_to_holes_m=float(bd),
                            depth_top_m=float(np.min(ground - pts[:, 2]) - cell / 2),
                            depth_centroid_m=float(np.mean(ground - pts[:, 2])),
                            total_selected_m3=float(sel.sum() * cv))
            res[crit] = body
        results[f"PGI-{mode}"] = res
        np.save(args.out / f"model_pgi_{mode}.npy", m.astype("float32"))
        log(f"PGI-{mode} done", json.dumps(res))
    np.save(args.out / "sensitivity.npy", sens.astype("float32"))
    results["elapsed_s"] = time.time() - T0
    results["mesh"] = dict(shape=list(mesh.shape_cells), active=int(active.sum()), cell=cell)
    json.dump(results, open(args.out / "summary.json", "w"), indent=1)
    log("total", round(results["elapsed_s"], 1), "s")


if __name__ == "__main__":
    main()
