"""Render the GAID promo film (v5, ~100 s, 1920x1080, 30 fps, silent) from the scene and the captures.

uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python geo/promo/render.py --capture v3=<capture-v3> [--capture v5=<capture-v5>] --out <new dir> [--stills-only] [--times 1,2]

The page draws film second t deterministically (window.motion.frame); each frame is a Chrome screenshot piped to
H.264 (imageio-ffmpeg). The captures are merged into one shot list (patterns prefixed with their name); the final video
refuses to render without both real captures (no placeholder footage). The film length and the standard stills come
from the page (window.motion.duration / .stills): the demo lasts as long as the takes.
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
from datetime import UTC, datetime
from pathlib import Path

FPS, WIDTH, HEIGHT = 30, 1920, 1080
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


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


def validate_capture(root: Path) -> dict:
    take = json.loads((root / "capture.json").read_text())
    if take.get("schema") != "gaid-promo-capture-v2":
        raise ValueError("Unexpected capture schema")
    for shot in take["shots"]:
        for i in (0, shot["frames"] - 1):
            if not (root / (shot["pattern"] % i)).is_file():
                raise FileNotFoundError(f"{shot['id']} frame {i}")
    return take


REQUIRED = ("v3", "v5")


def merge(captures: dict[str, Path]) -> dict | None:
    merged = None
    for name, root in captures.items():
        take = validate_capture(root)
        if merged is None:
            merged = {k: v for k, v in take.items() if k not in ("shots", "stills")} | {"shots": []}
        if take["css"] != merged["css"]:
            raise ValueError(f"{name}: different CSS viewport")
        ids = {s["id"] for s in merged["shots"]}
        for shot in take["shots"]:
            if shot["id"] in ids:
                raise ValueError(f"{name}: duplicate shot {shot['id']}")
            merged["shots"].append(shot | {"pattern": f"{name}/{shot['pattern']}", "capture": name})
    return merged


def prepare(root: Path, data: Path | None, captures: dict[str, Path]) -> tuple[dict, dict | None]:
    root.mkdir(parents=True, exist_ok=True)
    for name in ("scene.js", "scene.css", "icons"):
        src = HERE / "scene" / name
        if src.is_dir():
            shutil.copytree(src, root / name, dirs_exist_ok=True)
        else:
            shutil.copy2(src, root / name)
    (root / "fonts").mkdir(exist_ok=True)
    shutil.copy2(REPO / "web/public/fonts/PretendardVariable.woff2", root / "fonts")
    shutil.copy2(REPO / "web/public/fonts/PRETENDARD-LICENSE.txt", root / "fonts")
    (root / "brand").mkdir(exist_ok=True)
    shutil.copy2(REPO / "geo/brand/logo/horizontal-color.svg", root / "brand")
    world = json.loads(data.read_text()) if data else {}
    take = merge(captures)
    links = root / "capture"
    links.mkdir(exist_ok=True)
    for name, capture in captures.items():
        link = links / name
        if link.is_symlink():
            link.unlink()
        link.symlink_to(capture.resolve(), target_is_directory=True)
    html = (HERE / "scene/index.html").read_text()
    html = html.replace("@@DATA@@", json.dumps(world, ensure_ascii=False))
    html = html.replace("@@CAPTURE@@", json.dumps(take, ensure_ascii=False))
    (root / "index.html").write_text(html)
    return world, take


def contact_sheet(stills: dict, out: Path) -> Path:
    from PIL import Image, ImageDraw

    cols, tw, th, pad = 3, 620, 349, 18
    rows = (len(stills) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + 40) + pad), "#e7eaee")
    draw = ImageDraw.Draw(sheet)
    for i, (name, entry) in enumerate(stills.items()):
        x, y = pad + i % cols * (tw + pad), pad + i // cols * (th + 40)
        with Image.open(out / entry["path"]) as src:
            sheet.paste(src.convert("RGB").resize((tw, th), Image.Resampling.LANCZOS), (x, y))
        draw.text((x, y + th + 10), f"{entry['time']:.1f} s  {name}", fill="#171b23")
    path = out / "contact-sheet.jpg"
    sheet.save(path, quality=88)
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, help="unused by the v2/v3 scenes; kept for v1 reproduction")
    parser.add_argument("--capture", action="append", default=[], metavar="NAME=DIR")
    parser.add_argument("--out", type=Path, default=Path(os.environ.get("TASK_OUTPUT_DIR", "")) or None)
    parser.add_argument("--stills-only", action="store_true")
    parser.add_argument("--times", help="comma-separated preview times instead of the standard stills")
    parser.add_argument("--threads", type=int, default=8)
    args = parser.parse_args()
    if not args.out:
        parser.error("--out (or TASK_OUTPUT_DIR) is required")
    captures = {}
    for spec in args.capture:
        name, _, path = spec.partition("=")
        if name not in REQUIRED or not path:
            parser.error(f"--capture takes NAME=DIR with NAME in {REQUIRED}")
        captures[name] = Path(path).expanduser().resolve()
    if not args.stills_only and set(captures) != set(REQUIRED):
        parser.error("The film needs both real captures (v3, v5); no placeholder footage")
    out = args.out.resolve()
    video = out / "gaid-promo-v5.mp4"
    if video.exists():
        raise FileExistsError("Use a new output directory")
    world, take = prepare(out / "web", args.data.resolve() if args.data else None, captures)

    import imageio_ffmpeg
    from playwright.sync_api import sync_playwright

    still_dir = out / "stills"
    still_dir.mkdir(exist_ok=True)
    errors: list[str] = []
    stills: dict = {}
    with serve(out / "web") as url, sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path="/usr/bin/google-chrome", headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
        )
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1, locale="ko-KR")
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(url)
        page.wait_for_function("window.motion && window.motion.ready || window.motionError", timeout=60000)
        if page.evaluate("window.motionError || null"):
            raise RuntimeError(page.evaluate("window.motionError"))
        seconds_total = page.evaluate("window.motion.duration")
        frames_total = round(seconds_total * FPS)
        times = (
            page.evaluate("window.motion.stills") if not args.times
            else {f"t{float(t):06.2f}": float(t) for t in args.times.split(",")}
        )

        def shot(t: float) -> bytes:
            page.evaluate("t => window.motion.frame(t)", t)
            return page.screenshot(type="png", animations="disabled")

        for name, t in times.items():
            path = still_dir / f"{name}.png"
            path.write_bytes(shot(t))
            stills[name] = {"time": t, "path": str(path.relative_to(out))}
        if not args.stills_only:
            cmd = [
                imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
                "-f", "image2pipe", "-framerate", str(FPS), "-i", "-",
                "-an", "-c:v", "libx264", "-threads", str(args.threads), "-pix_fmt", "yuv420p",
                "-preset", "slow", "-crf", "17", "-tune", "animation", "-movflags", "+faststart", str(video),
            ]
            enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            try:
                for k in range(frames_total):
                    enc.stdin.write(shot(k / FPS))
                    if k % 150 == 0:
                        print(f"frame {k}/{frames_total}", flush=True)
                enc.stdin.close()
                if enc.wait() != 0:
                    raise RuntimeError("H.264 encode failed")
            except BaseException:
                enc.kill()
                enc.wait()
                raise
            count, seconds = imageio_ffmpeg.count_frames_and_secs(str(video))
            if count != frames_total or abs(seconds - seconds_total) > 1 / FPS:
                raise ValueError(f"Wrong length: {count} frames, {seconds} s")
        browser.close()
    if errors:
        raise RuntimeError("Browser errors: " + "; ".join(errors))
    sheet = contact_sheet(stills, out)
    manifest = {
        "schema": "gaid-promo-video-v5",
        "created_utc": datetime.now(UTC).isoformat(),
        "source_sha": os.environ.get("TASK_SOURCE_SHA", "unrecorded-preview"),
        "width": WIDTH, "height": HEIGHT, "fps": FPS, "seconds": seconds_total,
        "frames": 0 if args.stills_only else frames_total, "audio": False,
        "data": None if not args.data else {"path": str(args.data), "sha256": digest(args.data)},
        "captures": {
            name: {"path": str(root / "capture.json"), "sha256": digest(root / "capture.json")}
            for name, root in captures.items()
        },
        "stills": stills,
        "contact_sheet": str(sheet.relative_to(out)),
        "video": None if args.stills_only else {"path": video.name, "sha256": digest(video), "bytes": video.stat().st_size},
        "use": "Internal review video (user decision 2026-10-22: 무음이고 내부검토용 영상이다.)",
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(out / "manifest.json", flush=True)


if __name__ == "__main__":
    main()
