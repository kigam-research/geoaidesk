"""Read-only LAS 2.0 windows. Numeric data never enters raw-text preview.

Display reduction: each contiguous valid-depth run is split into buckets;
retain endpoints and each selected curve's finite extrema, missing boundaries.
When topology cannot fit the cap, stop at a source-order prefix, visibly truncated.
No scientific anomaly inference, depth substitution, sorting or conditioning.
"""
import argparse
import json
import math
import sys
import warnings
from pathlib import Path

MAX_BYTES = 64 * 1024 * 1024
MAX_ROWS = 1_000_000
MAX_CURVES = 128
TOL = 0.001


def finite(v):
    try:
        return float(v) if math.isfinite(float(v)) else None
    except (TypeError, ValueError):
        return None


def read_log(filename):
    import lasio
    p = Path(filename)
    if p.stat().st_size > MAX_BYTES:
        raise ValueError("LAS preview supports files up to 64 MiB; use a format-aware analysis script for larger files.")
    with p.open('rb') as f:
        header = f.read(256 * 1024)
    if header.startswith(b'LASF'):
        raise ValueError("Binary LiDAR LAS is not a well log; point-cloud preview is unsupported.")
    # Header-only read validates version before reading any numerical table.
    with warnings.catch_warnings(record=True):
        meta = lasio.read(str(p), ignore_data=True)
    version = str(meta.version['VERS'].value)
    if finite(version) != 2.0:
        raise ValueError(f"LAS {version} numerical tables are unsupported; supply a verified LAS 2.0 export.")
    if not meta.curves or len(meta.curves) > MAX_CURVES:
        raise ValueError("LAS needs 1–128 explicitly named curves.")
    if any(not str(c.original_mnemonic).strip() for c in meta.curves):
        raise ValueError("Missing curve mnemonic: column meaning is ambiguous.")
    # lasio 0.32 leaves the index NULL sentinel untouched and can infer one
    # column for valid two-curve wrapped files. Read the LAS 2 numeric section
    # strictly using the declared curve count, retaining logical row identity.
    import array
    import numpy as np
    numbers = array.array('d')
    section = ''
    tables = 0
    wrapped = str(meta.version['WRAP'].value).upper() == 'YES'
    delimiter = str(meta.version['DLM'].value).upper() if 'DLM' in meta.version else 'SPACE'
    if delimiter not in ('SPACE', 'TAB', 'COMMA'):
        raise ValueError('Unsupported LAS delimiter: ' + delimiter)
    width = len(meta.curves)
    with p.open(encoding='utf-8-sig', errors='replace') as stream:
        for physical in stream:
            line = physical.strip()
            if not line or line.startswith('#'):
                continue
            if line.startswith('~'):
                section = line[1:].strip().upper()
                if section.startswith('A'):
                    tables += 1
                continue
            if not section.startswith('A'):
                continue
            tokens = line.split(',') if delimiter == 'COMMA' else line.split()
            if not wrapped and len(tokens) != width:
                raise ValueError('Unwrapped LAS row does not match the declared curve count; no samples were repaired.')
            try:
                numbers.extend(float(v.replace('D', 'E').replace('d', 'e')) for v in tokens)
            except ValueError as exc:
                raise ValueError('LAS numerical token is invalid; no values were guessed.') from exc
            if len(numbers) > min(MAX_ROWS * width, 8_000_000):
                raise ValueError('LAS preview exceeds 1,000,000 samples or 8,000,000 values.')
    if tables != 1 or not numbers or len(numbers) % width:
        raise ValueError('Expected one complete LAS 2.0 numerical table with the declared curve count.')
    values = np.frombuffer(numbers, dtype=np.float64).copy().reshape(-1, width)
    sentinel = finite(meta.well['NULL'].value) if 'NULL' in meta.well else None
    if sentinel is not None:
        values[values == sentinel] = np.nan
    meta.set_data(values)
    return meta, []


def window(filename, request):
    import numpy as np
    log, parser_warnings = read_log(filename)
    data = log.data
    n, width = data.shape
    preferred = [i for name in ('GR', 'RHOB', 'NPHI', 'DTC', 'RDEP', 'CALI', 'BS') for i, c in enumerate(log.curves) if i and str(c.original_mnemonic).upper() == name]
    cols = request.get('columns', (preferred or list(range(1, width)))[:4])
    if not cols:
        cols = [0]
    if len(cols) > 8 or len(set(cols)) != len(cols) or any(type(c) is not int or c < 0 or c >= width for c in cols):
        raise ValueError("Choose 1–8 distinct existing curve columns.")
    mode = request.get('mode', 'display')
    if mode not in ('display', 'rows'):
        raise ValueError("mode must be display or rows")
    limit = request.get('limit', 1200 if mode == 'display' else 100)
    if type(limit) is not int or limit < 1:
        raise ValueError("limit must be a positive integer")
    limit = min(limit, 2000 if mode == 'display' else 200)
    start = request.get('startRow', 1)
    if type(start) is not int or start < 1:
        raise ValueError("startRow must be a positive 1-based logical sample")
    lo, hi = request.get('minDepth'), request.get('maxDepth')
    if any(v is not None and (type(v) not in (int, float) or finite(v) is None) for v in (lo, hi)) or (lo is not None and hi is not None and lo > hi):
        raise ValueError("Depth window must be finite and ordered")
    d = data[:, 0]
    diff = np.diff(d)
    fd = diff[np.isfinite(diff) & (np.abs(diff) > TOL)]
    step = float(np.median(fd)) if len(fd) else 0
    direction = 'unknown' if not len(fd) else 'mixed' if np.any(fd > 0) and np.any(fd < 0) else 'increasing' if fd[0] > 0 else 'decreasing'
    breaks = np.zeros(n, dtype=bool)
    breaks[0] = True
    bad = ~np.isfinite(d)
    duplicate = np.zeros(n, dtype=bool)
    duplicate[1:] = np.isfinite(diff) & (np.abs(diff) <= TOL)
    # Catch non-adjacent duplicates as well; never sort source samples.
    seen = set()
    for i, v in enumerate(d):
        if np.isfinite(v):
            if float(v) in seen:
                duplicate[i] = True
            seen.add(float(v))
    gap = np.zeros(n, dtype=bool)
    reversal = np.zeros(n, dtype=bool)
    declared_step = finite(log.well['STEP'].value) if 'STEP' in log.well else None
    spacing = abs(declared_step) if declared_step and abs(declared_step) > TOL else abs(step)
    if spacing:
        gap[1:] = np.isfinite(diff) & (np.abs(diff) > spacing * 1.5 + TOL)
    if step:
        reversal[1:] = np.isfinite(diff) & (diff * step < -TOL * abs(step))
    breaks[1:] = bad[1:] | bad[:-1] | duplicate[1:] | gap[1:] | reversal[1:]
    issues = []
    def issue(code, message, severity='warning'):
        issues.append(dict(code=code, message=message, severity=severity))
    for code, mask in [('depth-missing', bad), ('depth-duplicate', duplicate), ('depth-gap', gap), ('depth-reversal', reversal)]:
        if np.any(mask):
            issue(code, f"{int(np.sum(mask))} samples; source order preserved.")
    def header(key, default=''):
        return log.well[key].value if key in log.well else log.params[key].value if key in log.params else default
    for key, value in [('STRT', d[0]), ('STOP', d[-1]), ('STEP', step)]:
        declared = finite(header(key, None))
        if declared is not None and finite(value) is not None and abs(declared - value) > TOL:
            issue('header-' + key.lower() + '-mismatch', f"{key}: declared {declared}, observed {float(value)} (tolerance {TOL} in index units).")
    unit = str(log.curves[0].unit)
    if unit.lower() not in ('m', 'ft', 'f', 'feet', 'meter', 'metre'):
        issue('depth-unit-unknown', 'Depth unit is missing or unresolved; no unit conversion was applied.')
    basis_raw = str(header('BASIS', '')).strip()
    basis = next((v for v in ('MD', 'TVD', 'elevation') if v.lower() == basis_raw.lower()), 'unknown')
    curves = []
    originals = [str(c.original_mnemonic) for c in log.curves]
    if len(set(originals)) != len(originals):
        issue('curve-duplicate', 'Duplicate mnemonics remain separate by column number and parser-renamed mnemonic.')
    for j, c in enumerate(log.curves):
        values = data[:, j]
        valid = values[np.isfinite(values)]
        curves.append(dict(column=j, mnemonic=str(c.mnemonic), originalMnemonic=str(c.original_mnemonic), unit=str(c.unit), description=str(c.descr), nullCount=int(np.sum(~np.isfinite(values))), finiteCount=len(valid), min=float(np.min(valid)) if len(valid) else None, max=float(np.max(valid)) if len(valid) else None))
        if not str(c.unit).strip():
            issue('curve-unit-unknown', f"Column {j} ({c.mnemonic}): unit not declared; numeric screening unassessed.", 'info')
    for message in parser_warnings:
        issue('las-parser-warning', message)
    issue('screening-unassessed', 'Range, spike and borehole-enlargement screening is not run by the viewer. Manifest flags are review candidates, not rejected values.', 'info')
    eligible = np.arange(n)
    if lo is not None:
        eligible = eligible[d[eligible] >= lo]
    if hi is not None:
        eligible = eligible[d[eligible] <= hi]
    matched = len(eligible)
    eligible = eligible[eligible >= start - 1]
    truncated = False
    if mode == 'rows':
        selected = eligible[:limit]
        truncated = len(eligible) > limit
        method = 'Exact 1-based logical sample rows; original order and values'
    else:
        # Mandatory topology boundaries and missing transitions, then bucket extrema.
        mandatory = set()
        if len(eligible):
            mandatory.update([int(eligible[0]), int(eligible[-1])])
        eligible_set = set(eligible.tolist())
        for i in eligible:
            if breaks[i]:
                mandatory.add(int(i))
                if i - 1 in eligible_set:
                    mandatory.add(int(i - 1))
            for c in cols:
                if i and np.isfinite(data[i, c]) != np.isfinite(data[i - 1, c]):
                    mandatory.add(int(i))
                    if i - 1 in eligible_set:
                        mandatory.add(int(i - 1))
        if len(mandatory) > limit:
            # Never connect across omitted topology: contiguous prefix only.
            selected = eligible[:limit]
            truncated = len(eligible) > limit
        else:
            chosen = set(mandatory)
            buckets = max(0, (limit - len(chosen)) // (2 * len(cols) + 2))
            if len(eligible) <= limit:
                chosen.update(eligible.tolist())
            elif buckets:
                for bucket in np.array_split(eligible, buckets):
                    if not len(bucket):
                        continue
                    chosen.update([int(bucket[0]), int(bucket[-1])])
                    for c in cols:
                        valid = bucket[np.isfinite(data[bucket, c])]
                        if len(valid):
                            chosen.add(int(valid[np.argmin(data[valid, c])]))
                            chosen.add(int(valid[np.argmax(data[valid, c])]))
            else:
                # No room for extrema: show an exact prefix instead of hiding spikes.
                chosen = set(eligible[:limit].tolist())
                truncated = len(eligible) > limit
            selected = np.array(sorted(chosen), dtype=int)
        method = 'Source-order min/max bucket envelope with endpoints and missing/depth-break boundaries; exact prefix if topology exceeds display cap'
    rows = [dict(row=int(i + 1), depth=finite(d[i]), values=[finite(data[i, c]) for c in cols], breakBefore=bool(breaks[i] or (k > 0 and np.any(breaks[selected[k-1]+1:i+1])))) for k, i in enumerate(selected)]
    # Preserve breaks when an entire missing-depth record lies between selected samples.
    valid_depth = d[np.isfinite(d)]
    return dict(schemaVersion='geo-series/v1', well=str(header('WELL')), run=str(header('RUN')), version=str(log.version['VERS'].value), nullValue=finite(header('NULL', None)), wrapped=str(log.version['WRAP'].value).upper() == 'YES', depth=dict(column=0, mnemonic=str(log.curves[0].mnemonic), basis=basis, datum=str(header('DATUM')) or None, unit=unit, start=float(np.min(valid_depth)) if len(valid_depth) else None, stop=float(np.max(valid_depth)) if len(valid_depth) else None, step=step, direction=direction), curves=curves, selectedColumns=cols, issues=issues[:150], sourceRows=n, matchedRows=matched, displayedRows=len(rows), sampled=len(rows) < matched, truncated=truncated, method=method, rows=rows, nextRow=int(selected[-1] + 2) if truncated and len(selected) and selected[-1] < n - 1 else None)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('path')
    parser.add_argument('--request', default='{}')
    args = parser.parse_args()
    try:
        result = window(args.path, json.loads(args.request))
        print(json.dumps(result, allow_nan=False, separators=(',', ':')))
    except ImportError:
        print('LAS helper dependencies missing; prepare the helper environment.', file=sys.stderr)
        return 3
    except FileNotFoundError:
        print('File not found', file=sys.stderr)
        return 4
    except Exception as e:
        print(str(e)[:1000], file=sys.stderr)
        return 5
    return 0

if __name__ == '__main__':
    sys.exit(main())
