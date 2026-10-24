"""Render the GAID 45-second product film (plan: PLAN.md): frames from the code-only scene, soundtrack from soundtrack.py.

uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 --with numpy==2.3.4 \
  python geo/promo/day45/render.py --out <new dir> [--stills-only] [--times 1,2]

Every frame is a pure function of film time (window.motion.frame). Frame 0 shows the poster (a settled frame) so every
player's thumbnail shows it; duration and audio sync are unchanged. Output: gaid-day45.mp4 (H.264 + AAC), poster.jpg,
soundtrack.wav, share-copy.txt, stills/, contact-sheet.jpg, manifest.json.
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
import sys
import threading
from datetime import UTC, datetime
from pathlib import Path

FPS, WIDTH, HEIGHT = 30, 1920, 1080
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SHARE = "논문 한 편이 내 자료에서 도는 Workflow가 되고, 결과는 근거와 함께 다음 연구로 이어집니다 — GAID, 지구과학 연구자를 위한 AI agent 연구 지원 플랫폼. (내부 검토용)\n"


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
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}/index.html"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def prepare(root: Path) -> None:
    root.mkdir(parents=True, exist_ok=True)
    for name in ("index.html", "scene.js", "scene.css"):
        shutil.copy2(HERE / "scene" / name, root / name)
    shutil.copytree(REPO / "geo/promo/scene/icons", root / "icons", dirs_exist_ok=True)
    (root / "fonts").mkdir(exist_ok=True)
    shutil.copy2(REPO / "web/public/fonts/PretendardVariable.woff2", root / "fonts")
    (root / "brand").mkdir(exist_ok=True)
    shutil.copy2(REPO / "geo/brand/logo/horizontal-color.svg", root / "brand")


def contact_sheet(stills: dict, out: Path) -> Path:
    from PIL import Image, ImageDraw

    cols, tw, th, pad = 4, 460, 259, 14
    rows = (len(stills) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + 34) + pad), "#e7eaee")
    draw = ImageDraw.Draw(sheet)
    for i, (name, entry) in enumerate(stills.items()):
        x, y = pad + i % cols * (tw + pad), pad + i // cols * (th + 34)
        with Image.open(out / entry["path"]) as src:
            sheet.paste(src.convert("RGB").resize((tw, th), Image.Resampling.LANCZOS), (x, y))
        draw.text((x, y + th + 8), f"{entry['time']:.2f} s  {name}", fill="#171b23")
    path = out / "contact-sheet.jpg"
    sheet.save(path, quality=88)
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path(os.environ.get("TASK_OUTPUT_DIR", "")) or None)
    parser.add_argument("--stills-only", action="store_true")
    parser.add_argument("--times", help="comma-separated preview times instead of the standard stills")
    parser.add_argument("--threads", type=int, default=8)
    args = parser.parse_args()
    if not args.out:
        parser.error("--out (or TASK_OUTPUT_DIR) is required")
    out = args.out.resolve()
    video = out / "gaid-day45.mp4"
    if video.exists():
        raise FileExistsError("Use a new output directory")
    prepare(out / "web")

    import imageio_ffmpeg
    from PIL import Image
    from playwright.sync_api import sync_playwright

    sys.path.insert(0, str(HERE))
    import soundtrack

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    still_dir = out / "stills"
    still_dir.mkdir(exist_ok=True)
    errors: list[str] = []
    stills: dict = {}
    with serve(out / "web") as url, sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True,
                                     args=["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"])
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1, locale="ko-KR")
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(url)
        page.wait_for_function("window.motion && window.motion.ready || window.motionError", timeout=60000)
        if page.evaluate("window.motionError || null"):
            raise RuntimeError(page.evaluate("window.motionError"))
        seconds = page.evaluate("window.motion.duration")
        poster_t = page.evaluate("window.motion.poster")
        frames_total = round(seconds * FPS)
        times = page.evaluate("window.motion.stills") if not args.times else {f"t{float(t):06.2f}": float(t) for t in args.times.split(",")}

        def shot(t: float) -> bytes:
            page.evaluate("t => window.motion.frame(t)", t)
            return page.screenshot(type="png", animations="disabled")

        for name, t in times.items():
            (still_dir / f"{name}.png").write_bytes(shot(t))
            stills[name] = {"time": t, "path": f"stills/{name}.png"}
        poster_png = shot(poster_t)
        (out / "poster.png").write_bytes(poster_png)
        with Image.open(out / "poster.png") as im:
            im.convert("RGB").save(out / "poster.jpg", quality=90)
        if not args.stills_only:
            silent = out / "picture.mp4"
            cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-", "-an",
                   "-c:v", "libx264", "-threads", str(args.threads), "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "17",
                   "-tune", "animation", str(silent)]
            enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            try:
                for k in range(frames_total):
                    enc.stdin.write(poster_png if k == 0 else shot(k / FPS))
                    if k % 150 == 0:
                        print(f"frame {k}/{frames_total}", flush=True)
                enc.stdin.close()
                if enc.wait() != 0:
                    raise RuntimeError("H.264 encode failed")
            except BaseException:
                enc.kill()
                enc.wait()
                raise
        browser.close()
    if errors:
        raise RuntimeError("Browser errors: " + "; ".join(errors))
    sheet = contact_sheet(stills, out)
    wav = out / "soundtrack.wav"
    sound = soundtrack.render(wav, seconds)
    (out / "share-copy.txt").write_text(SHARE)
    manifest = {
        "schema": "gaid-day45/v1",
        "created_utc": datetime.now(UTC).isoformat(),
        "source_sha": os.environ.get("TASK_SOURCE_SHA", "unrecorded-preview"),
        "width": WIDTH, "height": HEIGHT, "fps": FPS, "seconds": seconds, "poster_time": poster_t,
        "stills": stills, "contact_sheet": sheet.name, "sound": sound,
        "use": "Internal review video (user decision 2026-10-22); music and effects only, no narration.",
    }
    if not args.stills_only:
        cmd = [ffmpeg, "-y", "-loglevel", "error", "-i", str(out / "picture.mp4"), "-i", str(wav), "-map", "0:v", "-map", "1:a",
               "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(video)]
        subprocess.run(cmd, check=True)
        count, secs = imageio_ffmpeg.count_frames_and_secs(str(video))
        if count != frames_total or abs(secs - seconds) > 1 / FPS:
            raise ValueError(f"Wrong length: {count} frames, {secs} s")
        (out / "picture.mp4").unlink()
        manifest["frames"] = frames_total
        manifest["video"] = {"path": video.name, "sha256": digest(video), "bytes": video.stat().st_size}
    manifest["files"] = {p.name: digest(p) for p in (out / "poster.jpg", wav, out / "share-copy.txt")}
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(out / "manifest.json", flush=True)


if __name__ == "__main__":
    main()
