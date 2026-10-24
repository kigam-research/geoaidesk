"""Token tally for the GAID runs and the CLI baselines, at list price.

Usage: uv run --no-project python tally.py <work-dir>
GAID: per call from the ledger (<run>/projects/default/sandbox/.kady/runs/gaid-hub-authoring/costs.jsonl) matched in order to
the attempt records (<run>/authoring/projects/<id>/attempts/*.json: op, message sizes). Codex CLI: turn.completed usage in
events.jsonl. Claude Code: result.json usage + total_cost_usd.
Prices (Pi catalogue, USD per 1M tokens): GPT-6.1 Sol input 2, cached input 0.1, output 10 (input over 272K: 4/0.2/15);
Claude Opus 5.5 input 4, cache read 0.2, cache write 5, output 20.
"""
import glob
import json
import pathlib
import sys

work = pathlib.Path(sys.argv[1])


def sol(prompt, cached, completion, tier_check=True):
    # The 272K tier applies per request; CLI totals sum many requests, each under it, so they use the base rate.
    tier = tier_check and prompt > 272_000
    i, c, o = (4, 0.2, 15) if tier else (2, 0.1, 10)
    return ((prompt - cached) * i + cached * c + completion * o) / 1e6


def gaid(run):
    ledger = run / "projects/default/sandbox/.kady/runs/gaid-hub-authoring/costs.jsonl"
    if not ledger.exists():
        return None
    rows = [json.loads(l) for l in ledger.read_text().splitlines() if l.strip()]
    project = json.loads(next((run / "result").glob("project.json")).read_text()) if (run / "result/project.json").exists() else None
    calls = []
    if project:
        for a in project["attempts"]:
            rec_path = next(iter(glob.glob(str(run / "authoring/projects" / project["id"] / a["record"]))), None)
            if not rec_path:
                continue
            rec = json.loads(pathlib.Path(rec_path).read_text())
            user_msgs = [m for m in rec["messages"] if m["role"] != "system"]
            system = sum(len(m["content"]) for m in rec["messages"] if m["role"] == "system")
            for n, resp in enumerate(rec["responses"]):
                prior = sum(len(m["content"]) for m in user_msgs[: 2 * n + 1])
                calls.append({"op": a["op"], "call": "first" if n == 0 else "repair", "systemChars": system, "userChars": prior, "replyChars": len(resp["content"]), "errors": len(rec["errors"][n]) if n < len(rec["errors"]) else None})
    out = []
    for i, r in enumerate(rows):
        c = calls[i] if i < len(calls) else {}
        # The ledger's promptTokens exclude cached input (Pi subtracts cached_tokens from input_tokens).
        k = r.get("cachedTokens") or 0
        p, o = r["promptTokens"] + k, r["completionTokens"]
        out.append({**c, "prompt": p, "cached": k, "completion": o, "listUsd": round(sol(p, k, o), 4), "ledgerListUsd": r.get("listPriceUsd")})
    return out


def codex(d):
    ev = d / "events.jsonl"
    if not ev.exists():
        return None
    turns = []
    for line in ev.read_text().splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get("type") == "turn.completed":
            u = e["usage"]
            turns.append(u)
    p = sum(u.get("input_tokens", 0) for u in turns)
    k = sum(u.get("cached_input_tokens", 0) for u in turns)
    o = sum(u.get("output_tokens", 0) for u in turns)
    return {"prompt": p, "cached": k, "completion": o, "reasoning": sum(u.get("reasoning_output_tokens", 0) for u in turns), "listUsd": round(sol(p, k, o, tier_check=False), 4), "turns": turns}


def claude(d):
    f = d / "result.json"
    if not f.exists() or not f.read_text().strip():
        return None
    r = json.loads(f.read_text())
    u = r.get("usage", {})
    p = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
    return {"prompt": p, "cached": u.get("cache_read_input_tokens", 0), "cacheWrite": u.get("cache_creation_input_tokens", 0), "completion": u.get("output_tokens", 0), "listUsd": r.get("total_cost_usd"), "turns": r.get("num_turns"), "modelUsage": r.get("modelUsage")}


report = {}
for run in sorted(work.iterdir()):
    if not run.is_dir():
        continue
    if (run / "projects").exists():
        calls = gaid(run)
        if calls:
            tot = {k: sum(c[k] for c in calls) for k in ("prompt", "cached", "completion")}
            tot["listUsd"] = round(sum(c["listUsd"] for c in calls), 4)
            report[run.name] = {"kind": "gaid", "total": tot, "calls": calls}
    elif (run / "events.jsonl").exists():
        report[run.name] = {"kind": "codex", **codex(run)}
    elif (run / "result.json").exists():
        report[run.name] = {"kind": "claude", **(claude(run) or {})}
print(json.dumps(report, ensure_ascii=False, indent=2))
