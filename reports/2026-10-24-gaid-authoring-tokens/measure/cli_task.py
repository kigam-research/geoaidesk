"""Write the CLI baseline task from a GAID draft attempt record, so the CLIs get the same target and decisions.

Usage: uv run --no-project python cli_task.py <attempt.json> <paper.pdf> <out-dir>
TASK.md = the GAID draft instructions (system prompt) + the draft request without the GAID-only parts (verified findings,
analysis scope, sources text): project, requested output, researcher's decisions, vocabularies. The CLI reads paper.pdf itself.
"""
import json
import pathlib
import re
import shutil
import sys

attempt, pdf, out = sys.argv[1], pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
rec = json.loads(pathlib.Path(attempt).read_text())
system = next(m["content"] for m in rec["messages"] if m["role"] == "system")
user = next(m["content"] for m in rec["messages"] if m["role"] == "user")
sections = re.split(r"\n\n(?=## )", user)
drop = ("## Verified findings", "## Scope proposed", "## Sources", "## Open questions")
kept = [s for s in sections if not s.startswith(drop)]
note = """## Differences from the GAID hub (read first)
- You read the paper yourself: paper.pdf in this folder (S1). There is no separate findings list; where the format asks for
  findingIds in "evidence", cite the paper instead as {"field": "...", "pages": [n, ...]}.
- Write the JSON object to draft.json in this folder (UTF-8). Do not write anything else except scratch files you need.
- The researcher's decisions below are final; do not ask questions."""
out.mkdir(parents=True, exist_ok=True)
shutil.copyfile(pdf, out / "paper.pdf")
(out / "TASK.md").write_text(f"# Task\n\n{system}\n\n{note}\n\n" + "\n\n".join(kept) + "\n")
print(out / "TASK.md", len((out / "TASK.md").read_text()), "chars")
