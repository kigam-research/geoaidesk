"""Find the drawn capture pointer (#14213d arrow, geo/promo/capture.py DRAW) in every frame of a capture.

Used by render.py: per shot, a list of [x_css, y_css] (arrow tip) or None per frame. CLI: pointer_track.py capture_dir out.json [shot ...]
"""
import sys, json, os
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image

def find(path):
    a = np.asarray(Image.open(path).convert('RGB'), dtype=np.int16)
    m = (np.abs(a[..., 0] - 20) < 8) & (np.abs(a[..., 1] - 33) < 8) & (np.abs(a[..., 2] - 61) < 8)
    ys, xs = np.nonzero(m)
    if len(xs) < 150:
        return None
    # largest blob: keep pixels near the median
    mx, my = np.median(xs), np.median(ys)
    k = (np.abs(xs - mx) < 80) & (np.abs(ys - my) < 100)
    if k.sum() < 150:
        return None
    x0, y0 = xs[k].min(), ys[k].min()
    return [round(x0 / 2.25 - 1, 1), round(y0 / 2.25 - 1, 1)]

def track(cap: str, shots: list[dict], workers: int = 16) -> dict:
    out = {}
    with ProcessPoolExecutor(workers) as ex:
        for s in shots:
            paths = [os.path.join(cap, s['pattern'] % i) for i in range(s['frames'])]
            out[s['id']] = list(ex.map(find, paths, chunksize=4))
    return out


if __name__ == '__main__':
    cap, out = sys.argv[1], sys.argv[2]
    want = set(sys.argv[3:])
    d = json.load(open(os.path.join(cap, 'capture.json')))
    res = json.load(open(out)) if os.path.exists(out) else {}
    with ProcessPoolExecutor(16) as ex:
        for s in d['shots']:
            if want and s['id'] not in want:
                continue
            paths = [os.path.join(cap, s['pattern'] % i) for i in range(s['frames'])]
            res[s['id']] = list(ex.map(find, paths, chunksize=4))
            n = sum(p is not None for p in res[s['id']])
            print(s['id'], f'{n}/{len(paths)}', flush=True)
    json.dump(res, open(out, 'w'))
