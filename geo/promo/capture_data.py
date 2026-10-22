"""Build the curated GAID_HOME for the promo capture from the review app's data (read-only source).

Copies only what the shots need, never credentials, and applies copy-only label clean-ups
(project names, test-persona names). Values, results and content are not changed.

    uv run --no-project python geo/promo/capture_data.py [--src ~/.geoaidesk] [--home <GAID_HOME>]

Writes <home>/../capture-v1-data.json (copied paths, adaptations, source file hashes).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

WORK = Path.home() / "data/geoaidesk/work/gaid-promo-video"

# Projects the shots use, with their copy-only display names (source name in comments).
PROJECTS = {
    "proj-ca300f": "문헌 근거 공간 교차검증",  # 검토용 - 수용 시험 문헌 근거
    "proj-bc576f": "25/9-1 검층 그림",  # 검토용 - 수용 시험 그림
    "api-80e71c": "25/9-1 LAS 점검",  # 검토용 - 수용 시험 개인 API 키 경로
    "proj-035916": "Yilgarn 니켈 탐사 우선순위",  # 검토용 - 허브 방법 재시험
    "review-notebook": "서울 지질도 암상 면적",  # 검토용 - 연구노트 (지질도 암상 면적)
    "default": "Default",  # Default (map samples)
}

# Test personas of the review sessions -> neutral names. Exact string values/keys only.
PERSONAS = {"새연구자": "연구자 이", "새연구자2": "연구자 박", "새연구자3": "연구자 최", "Test": "연구자 정"}

# Never copied (credentials, environments, caches).
SKIP_NAMES = {
    "auth.json",
    "config.env",
    "mcp-auth.json",
    "connection.json",
    ".venv",
    "node_modules",
    "secrets",
    "zotero.json",
}

PI_AGENT_DIRS = ["skill-hub", "research"]

# Library folders named after the acceptance test -> research name (copy-only).
LIBRARY_FOLDERS = {"수용 시험 - 공간 검증": "공간 검증"}

# Authoring drafts whose working title was a placeholder -> display title (copy-only).
AUTHORING_TITLES = {"ap-04567077-100": "PU 학습 광상 부존 가능성 논문"}  # my-paper


def ignore(_dir, names):
    return [n for n in names if n in SKIP_NAMES]


def rename_personas(obj):
    if isinstance(obj, dict):
        return {PERSONAS.get(k, k): rename_personas(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [rename_personas(v) for v in obj]
    if isinstance(obj, str):
        return PERSONAS.get(obj, obj)
    return obj


def adapt_hub_json(root: Path) -> list[str]:
    changed = []
    for path in sorted(root.rglob("*.json")) + sorted(root.rglob("*.jsonl")):
        text = path.read_text(encoding="utf-8")
        if not any(f'"{p}"' in text for p in PERSONAS):
            continue
        if path.suffix == ".jsonl":
            rows = [json.dumps(rename_personas(json.loads(l)), ensure_ascii=False) for l in text.splitlines() if l.strip()]
            new = "\n".join(rows) + "\n"
        else:
            new = json.dumps(rename_personas(json.loads(text)), ensure_ascii=False, indent=2) + "\n"
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed.append(str(path.relative_to(root)))
    return changed


def rehome_sessions(project: Path, old_sandbox: str) -> int:
    """Pi lists a session only when its header cwd is the sandbox; rewrite that one header field."""
    n = 0
    for f in sorted((project / "sandbox/.pi/sessions").glob("*.jsonl")):
        lines = f.read_text(encoding="utf-8").split("\n")
        head = json.loads(lines[0])
        if head.get("type") == "session" and head.get("cwd") == old_sandbox:
            head["cwd"] = str(project / "sandbox")
            lines[0] = json.dumps(head, ensure_ascii=False, separators=(",", ":"))
            f.write_text("\n".join(lines), encoding="utf-8")
            n += 1
    return n


def tree_digest(root: Path) -> str:
    h = hashlib.sha256()
    for p in sorted(root.rglob("*")):
        if set(p.relative_to(root).parts) & SKIP_NAMES:
            continue
        if p.is_file() and not p.is_symlink():
            h.update(str(p.relative_to(root)).encode())
            h.update(hashlib.sha256(p.read_bytes()).digest())
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", type=Path, default=Path.home() / ".geoaidesk")
    ap.add_argument("--home", type=Path, default=WORK / "home")
    args = ap.parse_args()
    src, home = args.src.expanduser(), args.home.expanduser()
    if home.exists():
        raise SystemExit(f"{home} exists; remove it first (it is a disposable copy)")
    (home / "pi-agent").mkdir(parents=True)
    (home / "projects").mkdir()

    copied = []
    for name in PI_AGENT_DIRS:
        shutil.copytree(src / "pi-agent" / name, home / "pi-agent" / name, ignore=ignore, symlinks=True)
        copied.append(f"pi-agent/{name}/")
    hub_changed = adapt_hub_json(home / "pi-agent" / "skill-hub")
    cols = home / "pi-agent/research/library/collections.json"
    folders = json.loads(cols.read_text(encoding="utf-8"))
    for c in folders:
        c["name"] = LIBRARY_FOLDERS.get(c["name"], c["name"])
    cols.write_text(json.dumps(folders, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    titles = {}
    for aid, title in AUTHORING_TITLES.items():
        pj = home / "pi-agent/skill-hub/authoring/projects" / aid / "project.json"
        meta = json.loads(pj.read_text(encoding="utf-8"))
        titles[aid] = {"from": meta["title"], "to": title}
        meta["title"] = title
        pj.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    index = json.loads((src / "projects/index.json").read_text(encoding="utf-8"))
    kept, renamed, rehomed = {}, {}, {}
    for pid, label in PROJECTS.items():
        shutil.copytree(src / "projects" / pid, home / "projects" / pid, ignore=ignore, symlinks=True)
        copied.append(f"projects/{pid}/ (without .venv)")
        rehomed[pid] = rehome_sessions(home / "projects" / pid, str(src / "projects" / pid / "sandbox"))
        meta = dict(index["projects"][pid])
        if meta["name"] != label:
            renamed[pid] = {"from": meta["name"], "to": label}
        meta["name"] = label
        kept[pid] = meta
        pj = home / "projects" / pid / "project.json"
        if pj.exists():
            pmeta = json.loads(pj.read_text(encoding="utf-8"))
            pmeta["name"] = label
            pj.write_text(json.dumps(pmeta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    hidden = sorted(set(index["projects"]) - set(PROJECTS))
    index["projects"] = kept
    (home / "projects/index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    record = {
        "source": str(src),
        "home": str(home),
        "copied": copied,
        "excluded_names": sorted(SKIP_NAMES),
        "adaptations": {
            "project_names": renamed,
            "projects_hidden": hidden,
            "authoring_titles": titles,
            "library_folders": LIBRARY_FOLDERS,
            "session_header_cwd_rewritten": rehomed,
            "personas": PERSONAS,
            "persona_files": hub_changed,
        },
        "source_digests": {
            f"pi-agent/{n}": tree_digest(src / "pi-agent" / n) for n in PI_AGENT_DIRS
        },
    }
    out = home.parent / "capture-v1-data.json"
    out.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
