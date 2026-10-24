"""Render GAID promo v4_brag (100.8 s, 1920x1080, 30 fps, stereo soundtrack) — the brag-slim deliverables.

uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  --with numpy==2.5.4 --with scipy==1.18.1 \
  python geo/promo/brag/render.py --capture <capture-v3> --out <new dir> [--stills-only] [--times 1,2] [--transitions]

Same page mechanics as geo/promo/render.py (v4): the brag scene (geo/promo/brag/scene.js) draws film second t
deterministically; each frame is a Chrome screenshot piped to H.264. The soundtrack is synthesised from the page's cues
(soundtrack.py) and muxed as AAC. Frame 0 is the poster frame (brag: replace frame 0, so length and sync stay). Writes
brag.mp4, brag.jpg, share-copy.txt, brag-plan.md and manifest.json; intermediates (web page, stills, cues, soundtrack,
stems, checks) go to work/.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROMO = HERE.parent
REPO = PROMO.parents[1]
sys.path.insert(0, str(HERE))
import soundtrack  # noqa: E402

_spec = importlib.util.spec_from_file_location("promo_render_v4", PROMO / "render.py")  # the v4 renderer's helpers
_v4 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_v4)
FPS, WIDTH, HEIGHT = _v4.FPS, _v4.WIDTH, _v4.HEIGHT
contact_sheet, digest, serve, validate_capture = _v4.contact_sheet, _v4.digest, _v4.serve, _v4.validate_capture


def prepare(root: Path, capture: Path | None) -> dict | None:
    root.mkdir(parents=True, exist_ok=True)
    shutil.copy2(HERE / "scene.js", root / "scene.js")
    shutil.copy2(PROMO / "scene" / "scene.css", root / "scene.css")
    shutil.copytree(PROMO / "scene" / "icons", root / "icons", dirs_exist_ok=True)
    (root / "fonts").mkdir(exist_ok=True)
    shutil.copy2(REPO / "web/public/fonts/PretendardVariable.woff2", root / "fonts")
    shutil.copy2(REPO / "web/public/fonts/PRETENDARD-LICENSE.txt", root / "fonts")
    (root / "brand").mkdir(exist_ok=True)
    shutil.copy2(REPO / "geo/brand/logo/horizontal-color.svg", root / "brand")
    take = validate_capture(capture) if capture else None
    link = root / "capture"
    if link.is_symlink():
        link.unlink()
    if capture:
        link.symlink_to(capture.resolve(), target_is_directory=True)
    html = (PROMO / "scene/index.html").read_text()
    html = html.replace("@@DATA@@", "{}").replace("@@CAPTURE@@", json.dumps(take, ensure_ascii=False))
    (root / "index.html").write_text(html)
    return take


def decode_audio(ffmpeg: str, video: Path):
    import numpy as np

    raw = subprocess.run([ffmpeg, "-loglevel", "error", "-i", str(video), "-vn", "-f", "s16le", "-ac", "2", "-ar", "48000", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<i2").reshape(-1, 2).T.astype(float) / 32768


def sync_check(ffmpeg: str, video: Path, wav: Path) -> dict:
    """Decoded AAC against the synthesised WAV: length and the offset of best alignment (AAC priming must be trimmed)."""
    import wave

    import numpy as np

    got = decode_audio(ffmpeg, video)
    with wave.open(str(wav)) as w:
        ref = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2).T.astype(float) / 32768
    a, b = got[0, 48000:48000 * 21], ref[0, 48000:48000 * 21]
    lags = range(-2400, 2401, 1)
    seg = b[2400:-2400]
    best = max(lags, key=lambda k: float(np.dot(seg, a[2400 + k: 2400 + k + len(seg)])))
    return {"decoded_samples": int(got.shape[1]), "reference_samples": int(ref.shape[1]), "offset_samples": int(best),
            "offset_ms": round(best / 48, 2)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", type=Path)
    parser.add_argument("--out", type=Path, default=Path(os.environ.get("TASK_OUTPUT_DIR", "")) or None)
    parser.add_argument("--stills-only", action="store_true")
    parser.add_argument("--times", help="comma-separated preview times instead of the standard stills")
    parser.add_argument("--transitions", action="store_true", help="also write the mid-transition stills")
    parser.add_argument("--threads", type=int, default=8)
    args = parser.parse_args()
    if not args.out:
        parser.error("--out (or TASK_OUTPUT_DIR) is required")
    if not args.stills_only and not args.capture:
        parser.error("The film needs the real capture; no placeholder footage")
    out = args.out.resolve()
    work = out / "work"
    video = out / "brag.mp4"
    if video.exists():
        raise FileExistsError("Use a new output directory")
    take = prepare(work / "web", args.capture.resolve() if args.capture else None)

    import imageio_ffmpeg
    from PIL import Image
    from playwright.sync_api import sync_playwright

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    still_dir = work / "stills"
    still_dir.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    stills: dict = {}
    with serve(work / "web") as url, sync_playwright() as pw:
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
        motion = page.evaluate("({duration: window.motion.duration, cues: window.motion.cues, grid: window.motion.grid,"
                               " poster: window.motion.poster, stills: window.motion.stills,"
                               " transitions: window.motion.transitions, segments: window.motion.segments})")
        seconds_total = motion["duration"]
        frames_total = round(seconds_total * FPS)
        if abs(seconds_total - soundtrack.DURATION) > 1e-6 or motion["grid"]["bpm"] != soundtrack.BPM:
            raise ValueError("Scene and soundtrack disagree on the grid")
        (work / "cues.json").write_text(json.dumps(motion["cues"], indent=1) + "\n")
        times = dict(motion["stills"]) if not args.times else {f"t{float(t):06.2f}": float(t) for t in args.times.split(",")}
        if args.transitions:
            times.update(motion["transitions"])

        def shot(t: float) -> bytes:
            page.evaluate("t => window.motion.frame(t)", t)
            return page.screenshot(type="png", animations="disabled")

        for name, t in times.items():
            path = still_dir / f"{name}.png"
            path.write_bytes(shot(t))
            stills[name] = {"time": t, "path": str(path.relative_to(out))}
        poster_png = shot(motion["poster"])
        (work / "poster.png").write_bytes(poster_png)
        with Image.open(work / "poster.png") as im:
            im.convert("RGB").save(out / "brag.jpg", quality=92)
        sound = None
        if not args.stills_only:
            sound = soundtrack.render(motion["cues"], work / "sound", work / "sound" / "stems")
            wav = work / "sound" / "soundtrack.wav"
            cmd = [
                ffmpeg, "-y", "-loglevel", "error",
                "-f", "image2pipe", "-framerate", str(FPS), "-i", "-",
                "-i", str(wav),
                "-map", "0:v", "-map", "1:a",
                "-c:v", "libx264", "-threads", str(args.threads), "-pix_fmt", "yuv420p",
                "-preset", "slow", "-crf", "17", "-tune", "animation",
                "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
                "-movflags", "+faststart", str(video),
            ]
            enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            try:
                for k in range(frames_total):
                    # brag: frame 0 is the poster, so every thumbnail shows it; the length and audio sync stay
                    enc.stdin.write(poster_png if k == 0 else shot(k / FPS))
                    if k % 150 == 0:
                        print(f"frame {k}/{frames_total}", flush=True)
                enc.stdin.close()
                if enc.wait() != 0:
                    raise RuntimeError("H.264/AAC encode failed")
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
    shutil.move(str(sheet), work / "contact-sheet.jpg")
    for name in ("brag-plan.md", "share-copy.txt"):
        shutil.copy2(HERE / name, out / name)
    sync = None
    if not args.stills_only:
        sync = sync_check(ffmpeg, video, work / "sound" / "soundtrack.wav")
        if abs(sync["offset_samples"]) > 48 or abs(sync["decoded_samples"] - sync["reference_samples"]) > 2048:
            raise ValueError(f"Audio out of sync: {sync}")
    manifest = {
        "schema": "gaid-promo-video-v4-brag",
        "created_utc": datetime.now(UTC).isoformat(),
        "source_sha": os.environ.get("TASK_SOURCE_SHA", "unrecorded-preview"),
        "brag": {"skill": "brag-slim", "repo": "https://github.com/latent-spaces/brag",
                 "commit": "669ab9286aa28b6c3ee30e75f181ee74319d012a", "license": "MIT",
                 "options": "--tone polished --format landscape --duration 100.8"},
        "width": WIDTH, "height": HEIGHT, "fps": FPS, "seconds": seconds_total,
        "frames": 0 if args.stills_only else frames_total, "grid": motion["grid"], "poster_time": motion["poster"],
        "capture": None if not take else {
            "path": str(args.capture / "capture.json"), "sha256": digest(args.capture / "capture.json"),
        },
        "audio": None if not sound else {
            "codec": "aac", "bitrate": "256k", "sample_rate": 48000, "channels": 2,
            "soundtrack": {k: sound[k] for k in ("sha256", "samples", "seconds", "bpm", "bars", "key", "provenance", "levels")},
            "sync": sync,
        },
        "stills": stills,
        "contact_sheet": "work/contact-sheet.jpg",
        "poster": {"path": "brag.jpg", "sha256": digest(out / "brag.jpg")},
        "video": None if args.stills_only else {"path": video.name, "sha256": digest(video), "bytes": video.stat().st_size},
        "use": "Internal review video (user decisions 2026-10-22 internal review; 2026-10-24 v4_brag with music and effects, no narration)",
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(out / "manifest.json", flush=True)


if __name__ == "__main__":
    main()
