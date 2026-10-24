"""Picture for the GAID 40 s promo (lemo-opuscar Dark Tech Keynote): stills, events, reading check and the silent video.

uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo-lemo-40/render.py --out <new dir> [--stills-only] [--times 1,2 | --range a:b:step] [--workers 4]

The page (scene/) follows lemo-opuscar's page contract: window.DUR, async window.render(t), window.READY, window.EV,
window.CUES, window.TEXTS(t), window.STILLS, plus window.textSpans(step) for the reading check. Real GAID takes are
read-only inputs (capture-v3 = PGI example, capture-v2 = Yilgarn example); only the frames each station window shows are
copied, downscaled once to the window's size. Each frame is a Chrome screenshot piped to H.264 with imageio-ffmpeg's
bundled ffmpeg (no system ffmpeg); workers render contiguous frame ranges joined losslessly. Outputs never go into Git.
"""

from __future__ import annotations

import argparse
import contextlib
import functools
import hashlib
import http.server
import json
import os
import shutil
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

FPS, WIDTH, HEIGHT = 30, 1920, 1080
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
DATA = Path.home() / "data/geoaidesk/work"
CAPTURES = {"pgi": DATA / "gaid-promo-video-v3/capture-v3", "yilgarn": DATA / "gaid-promo-video-v2/capture-v2"}
# station window -> (capture, shot, first frame); each window shows TAKE_FRAMES consecutive frames, whole, at one scale
TAKES = {
    "lib": ("pgi", "L1", 0), "wf": ("pgi", "A3", 0), "hub": ("pgi", "H2", 0),
    "run": ("yilgarn", "R2", 54), "note": ("yilgarn", "N1", 36), "back": ("pgi", "L3", 0),
}
TAKE_FRAMES, TAKE_W, TAKE_H = 72, 776, 436


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


@contextlib.contextmanager
def serve(root: Path):
    handler = functools.partial(QuietHandler, directory=str(root))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}/index.html"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def prepare_takes(root: Path, captures: dict[str, Path]) -> dict:
    from PIL import Image

    manifest, jobs = {}, []
    for key, (cap, shot, first) in TAKES.items():
        meta = json.loads((captures[cap] / "capture.json").read_text())
        if meta.get("schema") != "gaid-promo-capture-v2":
            raise ValueError(f"Unexpected capture schema in {cap}")
        entry = next(s for s in meta["shots"] if s["id"] == shot)
        n = min(TAKE_FRAMES, entry["frames"] - first)
        out = root / "takes" / key
        out.mkdir(parents=True, exist_ok=True)
        for i in range(n):
            jobs.append((captures[cap] / (entry["pattern"] % (first + i)), out / f"{i:03d}.jpg"))
        manifest[key] = {"pattern": f"takes/{key}/%03d.jpg", "n": n, "capture": cap, "shot": shot, "first": first}

    def one(job):
        src, dst = job
        if dst.exists():
            return
        with Image.open(src) as im:
            im.convert("RGB").resize((TAKE_W, TAKE_H), Image.Resampling.LANCZOS).save(dst, quality=92)

    with ThreadPoolExecutor(8) as pool:
        list(pool.map(one, jobs))
    return manifest


def prepare(root: Path, captures: dict[str, Path]) -> dict:
    root.mkdir(parents=True, exist_ok=True)
    shutil.copy2(HERE / "scene/film.js", root / "film.js")
    shutil.copytree(HERE / "scene/icons", root / "icons", dirs_exist_ok=True)
    (root / "fonts").mkdir(exist_ok=True)
    shutil.copy2(REPO / "web/public/fonts/PretendardVariable.woff2", root / "fonts")
    (root / "brand").mkdir(exist_ok=True)
    for name in ("horizontal-on-dark.svg", "mark-on-dark.svg"):
        shutil.copy2(REPO / "geo/brand/logo" / name, root / "brand")
    takes = prepare_takes(root, captures)
    html = (HERE / "scene/index.html").read_text().replace("@@TAKES@@", json.dumps(takes, ensure_ascii=False))
    (root / "index.html").write_text(html)
    return takes


def open_page(pw, url: str, errors: list[str]):
    browser = pw.chromium.launch(
        executable_path="/usr/bin/google-chrome", headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
    )
    page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1, locale="ko-KR")
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(url)
    page.wait_for_function("window.READY || window.RENDER_ERROR", timeout=120000)
    if page.evaluate("window.RENDER_ERROR || null"):
        raise RuntimeError(page.evaluate("window.RENDER_ERROR"))
    return browser, page


def shot(page, t: float, fmt: str = "png") -> bytes:
    page.evaluate("t => window.render(t)", t)
    if fmt == "jpeg":
        return page.screenshot(type="jpeg", quality=95, animations="disabled")
    return page.screenshot(type="png", animations="disabled")


def read_check(spans: list[dict]) -> list[dict]:
    """lemo readcheck rule: hold >= hangul/4.5 + other non-space/15 + 1.5 s (min 1.5 s)."""
    rows = []
    for s in spans:
        text = s["text"]
        hangul = sum(1 for ch in text if "가" <= ch <= "힣")
        other = sum(1 for ch in text if not ch.isspace()) - hangul
        need = max(1.5, hangul / 4.5 + other / 15 + 1.5)
        hold = s["b"] - s["a"]
        rows.append({**s, "hold": round(hold, 2), "need": round(need, 2), "short": hold < need - 1e-6})
    return rows


def contact_sheet(stills: dict, out: Path, name: str = "contact-sheet.jpg") -> Path:
    from PIL import Image, ImageDraw

    cols, tw, th, pad = 4, 480, 270, 14
    rows = (len(stills) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + 34) + pad), "#000000")
    draw = ImageDraw.Draw(sheet)
    for i, (key, entry) in enumerate(stills.items()):
        x, y = pad + i % cols * (tw + pad), pad + i // cols * (th + 34)
        with Image.open(out / entry["path"]) as src:
            sheet.paste(src.convert("RGB").resize((tw, th), Image.Resampling.LANCZOS), (x, y))
        draw.text((x, y + th + 8), f"{entry['time']:.2f} s  {key}", fill="#e7e9ee")
    path = out / name
    sheet.save(path, quality=88)
    return path


def render_range(url: str, a: int, b: int, path: Path, threads: int) -> list[str]:
    import imageio_ffmpeg
    from playwright.sync_api import sync_playwright

    errors: list[str] = []
    with sync_playwright() as pw:
        browser, page = open_page(pw, url, errors)
        cmd = [
            imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
            "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
            "-an", "-c:v", "libx264", "-threads", str(threads), "-pix_fmt", "yuv420p",
            "-preset", "slow", "-crf", "16", "-tune", "animation", str(path),
        ]
        enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        try:
            for k in range(a, b):
                enc.stdin.write(shot(page, k / FPS, "jpeg"))
                if (k - a) % 150 == 0:
                    print(f"{path.name} {k - a}/{b - a}", flush=True)
            enc.stdin.close()
            if enc.wait() != 0:
                raise RuntimeError("H.264 encode failed")
        except BaseException:
            enc.kill()
            enc.wait()
            raise
        browser.close()
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path(os.environ["TASK_OUTPUT_DIR"]) if os.environ.get("TASK_OUTPUT_DIR") else None)
    parser.add_argument("--pgi", type=Path, default=CAPTURES["pgi"])
    parser.add_argument("--yilgarn", type=Path, default=CAPTURES["yilgarn"])
    parser.add_argument("--stills-only", action="store_true")
    parser.add_argument("--times", help="comma-separated preview times instead of the standard stills")
    parser.add_argument("--range", help="a:b:step preview stills")
    parser.add_argument("--sheet", default="contact-sheet.jpg")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    if not args.out:
        parser.error("--out (or TASK_OUTPUT_DIR) is required")
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    video = out / "picture.mp4"
    if video.exists() and not args.stills_only:
        raise FileExistsError("Use a new output directory")
    captures = {"pgi": args.pgi.resolve(), "yilgarn": args.yilgarn.resolve()}
    takes = prepare(out / "web", captures)

    import imageio_ffmpeg
    from playwright.sync_api import sync_playwright

    still_dir = out / "stills"
    still_dir.mkdir(exist_ok=True)
    errors: list[str] = []
    stills: dict = {}
    with serve(out / "web") as url:
        with sync_playwright() as pw:
            browser, page = open_page(pw, url, errors)
            dur = page.evaluate("window.DUR")
            spans = page.evaluate("window.textSpans(0.04)")
            events = {"dur": dur, "fps": FPS, "ev": page.evaluate("window.EV"), "cues": page.evaluate("window.CUES"), "texts": spans}
            (out / "events.json").write_text(json.dumps(events, ensure_ascii=False, indent=1) + "\n")
            checks = read_check(spans)
            (out / "readcheck.json").write_text(json.dumps(checks, ensure_ascii=False, indent=1) + "\n")
            if args.times:
                times = {f"t{float(t):06.2f}": float(t) for t in args.times.split(",")}
            elif args.range:
                a, b, step = (float(x) for x in args.range.split(":"))
                n = int(round((b - a) / step)) + 1
                times = {f"t{a + i * step:06.2f}": round(a + i * step, 3) for i in range(n)}
            else:
                times = page.evaluate("window.STILLS")
            for name, t in times.items():
                path = still_dir / f"{name}.png"
                path.write_bytes(shot(page, t))
                stills[name] = {"time": t, "path": str(path.relative_to(out))}
            browser.close()
        frames_total = round(dur * FPS)
        if not args.stills_only:
            parts, jobs = [], []
            per = -(-frames_total // args.workers)
            for w in range(args.workers):
                a, b = w * per, min(frames_total, (w + 1) * per)
                if a < b:
                    parts.append(out / f".part-{w}.mp4")
                    jobs.append((a, b, parts[-1]))
            with ThreadPoolExecutor(len(jobs)) as pool:
                for errs in pool.map(lambda j: render_range(url, j[0], j[1], j[2], 3), jobs):
                    errors.extend(errs)
            listing = out / ".parts.txt"
            listing.write_text("".join(f"file '{p.name}'\n" for p in parts))
            subprocess.run([
                imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(video),
            ], check=True, cwd=out)
            for p in parts:
                p.unlink()
            listing.unlink()
            count, _ = imageio_ffmpeg.count_frames_and_secs(str(video))
            if count != frames_total:
                raise ValueError(f"Wrong length: {count} frames, expected {frames_total}")
    if errors:
        raise RuntimeError("Browser errors: " + "; ".join(errors))
    sheet = contact_sheet(stills, out, args.sheet)
    manifest = {
        "schema": "gaid-promo-lemo-40-picture-v1",
        "created_utc": datetime.now(UTC).isoformat(),
        "source_sha": os.environ.get("TASK_SOURCE_SHA", "unrecorded-preview"),
        "width": WIDTH, "height": HEIGHT, "fps": FPS, "seconds": dur,
        "frames": 0 if args.stills_only else frames_total,
        "captures": {k: {"path": str(v / "capture.json"), "sha256": digest(v / "capture.json")} for k, v in captures.items()},
        "takes": takes,
        "events": {"path": "events.json", "sha256": digest(out / "events.json")},
        "stills": stills,
        "contact_sheet": str(sheet.relative_to(out)),
        "short_texts": [c["id"] for c in checks if c["short"]],
        "video": None if args.stills_only else {"path": video.name, "sha256": digest(video), "bytes": video.stat().st_size},
    }
    (out / "picture-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(out / "picture-manifest.json", flush=True)


if __name__ == "__main__":
    main()
