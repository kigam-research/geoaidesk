"""Tally authoring runs per call: uncached input, cache read/write, output, list price, time, cache ratio.

Usage: uv run --no-project python tally.py <label>=<run dir> [...] > tally.json
A run dir holds projects/default/sandbox/.kady/runs/gaid-hub-authoring/costs.jsonl (ledger rows, one per call) and, for runs
of this unit, authoring/projects/<id>/attempts/*.json with `calls[]` (start, duration, raw usage, cache plan, payload).
List price: GPT-6.1 Sol API rates per 1M tokens (Pi catalogue): input $2, cache read $0.1, cache write $2.5, output $10.
"""
import glob
import json
import pathlib
import sys

RATE = {"input": 2.0, "cacheRead": 0.1, "cacheWrite": 2.5, "output": 10.0}


def price(u):
    return sum(u[k] * RATE[k] for k in RATE) / 1e6


def run(label, root):
    root = pathlib.Path(root)
    ledger = [json.loads(l) for l in open(next(root.glob("projects/default/sandbox/.kady/runs/gaid-hub-authoring/costs.jsonl")))]
    records = []
    for f in sorted(root.glob("authoring/projects/*/attempts/*.json")):
        d = json.loads(f.read_text())
        for i, c in enumerate(d.get("calls") or []):
            records.append({"op": d["op"], "step": "first" if i == 0 else "repair", **c})
    records.sort(key=lambda c: c["startedAt"])
    calls = []
    for i, row in enumerate(ledger):
        u = {
            "input": row["promptTokens"],
            "cacheRead": row.get("cachedTokens", 0),
            "cacheWrite": row.get("cacheWriteTokens", 0),
            "output": row["completionTokens"],
        }
        c = {"n": i + 1, **u, "listUsd": round(price(u), 4), "endedAt": row["ts"]}
        if i < len(records):
            r = records[i]
            c.update(
                op=r["op"],
                step=r["step"],
                seconds=round(r["ms"] / 1000),
                firstEventSeconds=round((r.get("firstEventMs") or 0) / 1000, 1),
                path=r["cache"]["path"],
                history=r.get("history"),
                prefixSha=(r.get("payload") or {}).get("prefixSha"),
                sourcesMarker=((r.get("payload") or {}).get("sources") or {}).get("marker"),
                transport=r.get("transport"),
                responseId=r.get("responseId"),
                rawUsage=r.get("rawUsage"),
            )
        elif i > 0:
            c["seconds"] = round(row["ts"] - ledger[i - 1]["ts"])
        calls.append(c)
    tot = {k: sum(c[k] for c in calls) for k in ("input", "cacheRead", "cacheWrite", "output")}
    whole = tot["input"] + tot["cacheRead"] + tot["cacheWrite"]
    summary = {
        **tot,
        "wholeInput": whole,
        "cacheRatio": round(tot["cacheRead"] / whole, 4) if whole else 0,
        "listUsd": round(price(tot), 4),
    }
    summary_file = root / "result" / "summary.json"
    if summary_file.exists():
        summary["seconds"] = json.loads(summary_file.read_text()).get("seconds")
    return {"label": label, "calls": calls, "total": summary}


out = [run(*a.split("=", 1)) for a in sys.argv[1:]]
json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
for r in out:
    t = r["total"]
    print(f"\n{r['label']}: uncached {t['input']:,} read {t['cacheRead']:,} write {t['cacheWrite']:,} out {t['output']:,} "
          f"ratio {t['cacheRatio']:.1%} ${t['listUsd']} {t.get('seconds')} s", file=sys.stderr)
    for c in r["calls"]:
        print(f"  {c.get('op','?'):8} {c.get('step','?'):6} in {c['input']:>7,} read {c['cacheRead']:>7,} write {c['cacheWrite']:>5,} "
              f"out {c['output']:>6,} ${c['listUsd']:.3f} {c.get('seconds')} s {c.get('sourcesMarker') or ''} {c.get('transport') or ''}",
              file=sys.stderr)
