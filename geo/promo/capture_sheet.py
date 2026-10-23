"""Contact sheet of a capture take: first/middle/last frame (or --every N) per shot, outside Git.

    uv run --no-project --with pillow==12.3.0 python geo/promo/capture_sheet.py [--take <dir>] [--only H1] [--every 0]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

WORK = Path.home() / "data/geoaidesk/work/gaid-promo-video"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--take", type=Path, default=WORK / "capture-v1")
    ap.add_argument("--only", default="")
    ap.add_argument("--every", type=int, default=0)
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    take = args.take.expanduser()
    cap = json.loads((take / "capture.json").read_text())
    shots = [s for s in cap["shots"] if not args.only or s["id"] in args.only.split(",")]
    tw, th = 480, 270
    rows = []
    for s in shots:
        n = s["frames"]
        idx = list(range(0, n, args.every)) + [n - 1] if args.every else [0, n // 2, n - 1]
        rows.append((s, sorted(set(idx))))
    cols = max(len(i) for _, i in rows)
    sheet = Image.new("RGB", (cols * tw, len(rows) * (th + 18)), "white")
    d = ImageDraw.Draw(sheet)
    for r, (s, idx) in enumerate(rows):
        for c, i in enumerate(idx):
            im = Image.open(take / s["pattern"].replace("%05d", f"{i:05d}")).convert("RGB")
            im.thumbnail((tw, th))
            sheet.paste(im, (c * tw, r * (th + 18) + 18))
            d.text((c * tw + 4, r * (th + 18) + 3), f"{s['id']} frame {i} ({i / 30:.2f} s)", fill="black")
    out = args.out or take / f"contact-sheet{'-' + args.only.replace(',', '-') if args.only else ''}.jpg"
    sheet.save(out, quality=88)
    print(out)


if __name__ == "__main__":
    main()
