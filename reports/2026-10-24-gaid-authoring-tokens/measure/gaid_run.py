"""Drive one GAID hub authoring run over HTTP: one PDF, analyze, answer every question by a fixed rule, draft.

Usage: uv run --no-project python gaid_run.py --base http://127.0.0.1:18732 --pdf <paper.pdf> --out <dir> [--label before]
Answer rule: the model's recommended option, else the first option; trial-scale = quick-and-full; hub-skills = none.
The answers are written to <out>/answers.json so the CLI baselines get the same decisions.
"""
import argparse
import base64
import json
import pathlib
import time
import urllib.request
import uuid

ap = argparse.ArgumentParser()
ap.add_argument("--base", required=True)
ap.add_argument("--pdf", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--model", default="openai/gpt-6.1-sol")
ap.add_argument("--thinking", default="high")
ap.add_argument("--answers", help="reuse answers.json from an earlier run (matched by question key)")
args = ap.parse_args()
out = pathlib.Path(args.out)
out.mkdir(parents=True, exist_ok=True)


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(args.base + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def wait(pid, attempt_id):
    while True:
        p = call("GET", f"/geo/authoring/projects/{pid}")
        a = next(x for x in p["attempts"] if x["id"] == attempt_id)
        if a["outcome"] != "running":
            return p, a
        time.sleep(10)


t0 = time.time()
project = call("POST", "/geo/authoring/projects", {"title": "토큰 측정", "target": "workflow", "model": args.model, "thinkingLevel": args.thinking})
pid = project["id"]
pdf = pathlib.Path(args.pdf)
call("POST", f"/geo/authoring/projects/{pid}/sources", {"name": pdf.name, "mediaType": "application/pdf", "kind": "pdf", "contentBase64": base64.b64encode(pdf.read_bytes()).decode()})
a = call("POST", f"/geo/authoring/projects/{pid}/analyze", {"opId": f"an-{uuid.uuid4().hex[:8]}", "target": "workflow", "model": args.model, "thinkingLevel": args.thinking})
p, a = wait(pid, a["id"])
print("analyze", a["outcome"], a.get("usage"), round(time.time() - t0), "s", flush=True)
if a["outcome"] == "failed":
    raise SystemExit(json.dumps(a, ensure_ascii=False))

previous = {}
if args.answers:
    previous = {x["key"]: x for x in json.loads(pathlib.Path(args.answers).read_text())}
answers, record = [], []
for q in p["questions"]:
    if q["status"] != "open":
        continue
    opts = [o["id"] for o in q.get("options", [])]
    prev = previous.get(q["key"])
    if prev and (prev.get("optionId") in opts or not prev.get("optionId")):
        choice = prev.get("optionId")
    elif q["key"] == "trial-scale" and "quick-and-full" in opts:
        choice = "quick-and-full"
    elif q["key"] == "hub-skills" and "none" in opts:
        choice = "none"
    else:
        choice = q.get("recommended") if q.get("recommended") in opts else (opts[0] if opts else None)
    item = {"questionId": q["id"], "questionRevision": q["revision"]}
    if choice:
        item["optionId"] = choice
    else:
        item["response"] = (prev or {}).get("response") or "논문에 적힌 대로 합니다."
    answers.append(item)
    label = next((o["label"] for o in q.get("options", []) if o["id"] == choice), None)
    record.append({"key": q["key"], "text": q["text"], "optionId": choice, "label": label, "response": item.get("response"), "recommended": q.get("recommended")})
(out / "answers.json").write_text(json.dumps(record, ensure_ascii=False, indent=2))
r = call("POST", f"/geo/authoring/projects/{pid}/answers", {"opId": f"ans-{uuid.uuid4().hex[:8]}", "answers": answers, "draft": True, "model": args.model, "thinkingLevel": args.thinking})
p, a = wait(pid, r["attempt"]["id"])
print("draft", a["outcome"], a.get("usage"), round(time.time() - t0), "s", flush=True)
(out / "project.json").write_text(json.dumps(p, ensure_ascii=False, indent=2))
if p["drafts"]:
    rev = p["drafts"][-1]["revision"]
    try:
        check = call("GET", f"/geo/authoring/projects/{pid}/drafts/{rev}/check")
        (out / "check.json").write_text(json.dumps(check, ensure_ascii=False, indent=2))
        print("check", check.get("ok", check.get("status")), flush=True)
    except Exception as e:  # the check is informative only
        print("check failed", e, flush=True)
(out / "summary.json").write_text(json.dumps({"projectId": pid, "seconds": round(time.time() - t0), "attempts": [{k: x.get(k) for k in ("id", "op", "outcome", "usage", "promptVersion")} for x in p["attempts"]]}, ensure_ascii=False, indent=2))
print("done", pid, flush=True)
