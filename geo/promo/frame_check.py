"""Draw highlight rects (CSS px) on capture frames for box checks (v5).

uv run --no-project --with pillow==12.3.0 python geo/promo/frame_check.py --capture <capture dir> --out <png> \
  SHOT:FRAME[:x,y,w,h[;x,y,w,h...][:cx,cy,cw,ch]] ...

Each argument is one tile: the frame at 1280×720 with every rect drawn in red and its CSS coordinates printed, plus a
light 40 px CSS grid with labels so a new rect can be read off the frame. An optional crop (CSS px) enlarges that part of
the frame to the tile with a 10 px grid, to read edges exactly. Tiles are stacked two per row.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

TW, TH = 1280, 720


def tile(capture: Path, spec: str, grid: bool) -> Image.Image:
    shot, frame, *rest = spec.split(":")
    take = json.loads((capture / "capture.json").read_text())
    info = next(s for s in take["shots"] if s["id"] == shot)
    css_w = take["css"]["width"]
    px = take["width"] / css_w
    cx, cy, cw, ch = (float(v) for v in rest[1].split(",")) if len(rest) > 1 else (0, 0, css_w, take["css"]["height"])
    k = min(TW / cw, TH / ch)
    with Image.open(capture / (info["pattern"] % int(frame))) as src:
        part = src.convert("RGB").crop((round(cx * px), round(cy * px), round((cx + cw) * px), round((cy + ch) * px)))
        img = Image.new("RGB", (TW, TH), "white")
        img.paste(part.resize((round(cw * k), round(ch * k)), Image.Resampling.LANCZOS), (0, 0))
    draw = ImageDraw.Draw(img)
    X = lambda v: (v - cx) * k
    Y = lambda v: (v - cy) * k
    step, major = (40, 200) if cw > 600 else (10, 50)
    if grid:
        for x in range(int(cx) // step * step, int(cx + cw) + 1, step):
            draw.line([(X(x), 0), (X(x), TH)], fill=(120, 200, 255) if x % major else (40, 140, 255), width=1)
            if x % major == 0:
                draw.text((X(x) + 2, 2), str(x), fill=(0, 90, 220))
        for y in range(int(cy) // step * step, int(cy + ch) + 1, step):
            draw.line([(0, Y(y)), (TW, Y(y))], fill=(120, 200, 255) if y % major else (40, 140, 255), width=1)
            if y % major == 0:
                draw.text((2, Y(y) + 2), str(y), fill=(0, 90, 220))
    for r in (rest[0].split(";") if rest and rest[0] else []):
        x, y, w, h = (float(v) for v in r.split(","))
        draw.rectangle([X(x), Y(y), X(x + w), Y(y + h)], outline=(230, 0, 40), width=2)
        draw.text((X(x) + 4, Y(y + h) + 4), f"{x:.0f},{y:.0f},{w:.0f},{h:.0f}", fill=(230, 0, 40))
    draw.rectangle([0, 0, 300, 18], fill=(255, 255, 255))
    draw.text((4, 3), f"{shot} frame {frame}", fill=(0, 0, 0))
    return img


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--grid", action="store_true")
    parser.add_argument("specs", nargs="+")
    args = parser.parse_args()
    tiles = [tile(args.capture, s, args.grid) for s in args.specs]
    cols = min(2, len(tiles))
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * TW, rows * TH), "white")
    for i, t in enumerate(tiles):
        sheet.paste(t, (i % cols * TW, i // cols * TH))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.out)


if __name__ == "__main__":
    main()
