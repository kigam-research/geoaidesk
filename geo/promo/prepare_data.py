"""Collect the real numbers the promo charts show into one JSON file (outside Git).

Sources, all read-only:
- the pinned geo catalogue archive (configs/inputs.toml `geo_catalogue`),
- one registered GAID hub entry from a hub store (the capture copy or the review app data),
- the citation check of the 2026-10-22 acceptance test (reports/2026-10-22-gaid-user-acceptance, section 3.1).

Run: uv run --no-project python geo/promo/prepare_data.py --hub <skill-hub/shared> --out <dir>/data.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tarfile
import tomllib
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ENTRY = "entry-ap-a135f290-1c4"  # PU-컨포멀 탐사 우선순위 존 분류, 판 2 with concept pictures
SOURCE_GROUPS = {
    "korea": "국내 기관",
    "acquisition-cases": "자료 수집 사례",
    "global-geology": "해외 지질 기관",
    "rs-climate-ocean": "원격탐사·기후·해양",
    "petroleum-geothermal": "석유·지열",
    "hydrogeology": "수리지질",
    "geochemistry": "지구화학",
}
# reports/2026-10-22-gaid-user-acceptance/index.md, 3.1: 46 citations split into 212 check units;
# 1 unit not on the cited page, 0 contradicting the source; 6 recomputed values all correct.
ACCEPTANCE = {
    "date": "2026-10-22",
    "papers": 3,
    "citations": 46,
    "units": 212,
    "notOnPage": 1,
    "contradicted": 0,
    "recomputed": 6,
    "recomputedCorrect": 6,
    "source": "reports/2026-10-22-gaid-user-acceptance/index.md#31",
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def catalogue() -> dict:
    spec = next(
        i for i in tomllib.loads((REPO / "configs/inputs.toml").read_text())["input"]
        if i["name"] == "geo_catalogue"
    )
    root = Path(os.environ.get("TASK_ASSETS_DIR", Path.home() / "assets")) / spec["path"]
    archive = root / f"geo-catalogue-{spec['version']}.tar.gz"
    digest = sha256(archive)
    if digest != spec["sha256"][archive.name]:
        raise ValueError("catalogue archive hash differs from configs/inputs.toml")
    with tarfile.open(archive) as tar:
        read = lambda name: json.load(tar.extractfile(name))  # noqa: E731
        index, workflows, sources = (
            read("catalogue/index.json"), read("workflows.json"), read("data-sources.json")
        )
    skills = index["skills"]
    groups = Counter(s["group"] for s in sources["sources"])
    return {
        "version": spec["version"],
        "archiveSha256": digest,
        "workflows": [w["title"]["ko"] for w in workflows],
        "skills": len(skills),
        "skillsBySource": dict(Counter(s["id"].split("/")[0] for s in skills)),
        "dataSources": len(sources["sources"]),
        "dataSourcesByGroup": [
            {"label": SOURCE_GROUPS.get(g, g), "count": n} for g, n in groups.most_common()
        ],
    }


def hub_entry(shared: Path) -> dict:
    path = shared / "entries" / ENTRY / "entry.json"
    record = json.loads(path.read_text())
    entry = record["entry"]
    latest = str(entry["latestRevision"])
    draft = record["snapshots"][latest]["draft"]
    workflow = draft["workflow"]
    nodes = draft["profile"]["procedure"]["nodes"]
    stars = json.loads((path.parent / "stars.json").read_text())
    comments = (path.parent / "comments.jsonl").read_text().splitlines()
    return {
        "path": str(path),
        "sha256": sha256(path),
        "title": entry["title"],
        "author": entry["author"],
        "revisions": [
            {"revision": r["revision"], "at": r["registeredAt"], "note": r.get("note", "")}
            for r in entry["revisions"]
        ],
        "installs": [{"at": i["installedAt"], "project": i["projectId"]} for i in record["installs"]],
        "stars": sum(1 for v in stars.values() if v),
        "comments": sum(1 for line in comments if line.strip()),
        "steps": [
            {"id": n["id"], "label": n["label"]["ko"], "researcher": n["id"].startswith("human-")}
            for n in nodes
        ],
        "choices": [
            {"label": c["label"]["ko"], "options": [
                c.get("optionLabels", {}).get(o, {}).get("ko", o) for o in c.get("options", [])
            ]}
            for c in workflow["requiredScientificChoices"]
        ],
        "inputs": [r["label"]["ko"] for r in workflow["inputRoles"]],
        "outputs": [a["label"]["ko"] for a in workflow.get("expectedArtifacts", [])],
        "codeFiles": len(draft.get("codeFiles") or []),
        "references": len(draft.get("references") or []),
        "decisions": len(draft.get("decisionIds") or []),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hub", type=Path, required=True, help="skill-hub/shared directory")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    data = {
        "schema": "gaid-promo-data-v1",
        "catalogue": catalogue(),
        "hubEntry": hub_entry(args.hub),
        "acceptance": ACCEPTANCE,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(args.out)


if __name__ == "__main__":
    main()
