"""Optional local asset check: LAS reader vs FORCE independently exported CSV.
Run with --asset (configs/inputs.toml force2020_welllogs) --output outside Git.
No source conversion, no acquired-truth claim, no assumed MD basis for DEPT.
"""
import argparse
import hashlib
import importlib.util
import json
import os
import tomllib
from pathlib import Path
import zipfile
import numpy as np
import pandas as pd

spec = importlib.util.spec_from_file_location('las_helper', Path(__file__).resolve().parents[2] / 'server/src/geo/well/las_helper.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
p = argparse.ArgumentParser()
p.add_argument('--asset', type=Path, help='Override the named force2020_welllogs asset')
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
if a.asset is None:
    root = Path(__file__).resolve().parents[2]  # also works in a job src/ without .git
    inputs = tomllib.loads((root / 'configs/inputs.toml').read_text())['input']
    spec_input = next(i for i in inputs if i['name'] == 'force2020_welllogs')
    a.asset = Path(os.environ.get('TASK_ASSETS_DIR', str(Path.home() / 'assets'))) / spec_input['path']
source = a.asset / 'las/25_9-1.las'
log, _ = helper.read_log(source)
raw = pd.DataFrame(log.data, columns=[c.mnemonic for c in log.curves])
parts = []
with zipfile.ZipFile(a.asset / 'train.zip') as z:
    with z.open('train.csv') as stream:
        for chunk in pd.read_csv(stream, sep=';', chunksize=100000):
            parts.append(chunk.loc[chunk.WELL == '25/9-1'])
csv = pd.concat(parts, ignore_index=True)
idx = np.flatnonzero(raw.DEPTH_MD.notna())
idx = idx[np.argsort(raw.DEPTH_MD.iloc[idx])]
depths = raw.DEPTH_MD.to_numpy()[idx]
ref = csv.DEPTH_MD.to_numpy()
pos = np.searchsorted(depths, ref)
left, right = np.clip(pos-1, 0, len(idx)-1), np.clip(pos, 0, len(idx)-1)
nearest = np.where(abs(depths[left]-ref) <= abs(depths[right]-ref), left, right)
delta = abs(depths[nearest]-ref)
assert np.all(delta <= .001), 'unmatched reference depths'
assert len(set(nearest)) == len(csv), 'nonunique join'
curves = ['GR', 'RHOB', 'NPHI', 'DTC', 'RDEP', 'CALI', 'BS']
checks = []
for c in curves:
    x = raw[c].to_numpy()[idx[nearest]]
    y = csv[c].to_numpy()
    valid = np.isfinite(x) & np.isfinite(y)
    diff = float(np.max(np.abs(x[valid]-y[valid])))
    null_mismatch = int(np.sum(np.isfinite(x) != np.isfinite(y)))
    assert diff <= 1e-4 and null_mismatch == 0, c
    checks.append(dict(curve=c, maxAbsDifference=diff, nullMaskDisagreements=null_mismatch, unit=str(log.curves[c].unit)))
window = helper.window(source, dict(columns=[list(raw.columns).index(c) for c in curves], limit=1200, minDepth=1800, maxDepth=2400))
assert window['sourceRows'] == 16132
assert 'header-stop-mismatch' in [i['code'] for i in window['issues']]
# Compare every displayed point against its exact original logical source row.
for row in window['rows']:
    original = log.data[row['row']-1]
    assert row['depth'] == helper.finite(original[0])
    assert row['values'] == [helper.finite(original[c]) for c in window['selectedColumns']]
result = dict(sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(), sourceBytes=source.stat().st_size, sourceRows=len(raw), matchedRows=len(csv), maxDepthMatchDifference=float(delta.max()), checks=checks, displayRows=window['displayedRows'], displayTruncated=window['truncated'], headerStopDifference=float(log.well.STOP.value-log.data[-1,0]), depthBasis=window['depth']['basis'], statement='Same-provider exports agree on matched rows; not independent measurements or geological interpretation.')
a.output.mkdir(parents=True, exist_ok=True)
(a.output/'force-concordance.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, indent=2))
