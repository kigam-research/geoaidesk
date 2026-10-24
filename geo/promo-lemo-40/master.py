"""Mux and master the GAID 40 s promo: picture.mp4 + mix.wav -> gaid-promo-40s.mp4, two-pass loudnorm to -14 LUFS.

uv run --no-project --with imageio-ffmpeg==0.6.0 --with numpy==2.5.4 python geo/promo-lemo-40/master.py <out dir>

Ports the logic of lemo-opuscar core/render/mux.sh to imageio-ffmpeg's bundled ffmpeg (no system ffmpeg or ffprobe here):
first pass measures, second pass applies loudnorm with the measured values (linear), true peak -1.2 dBTP, LRA 11. No grain
(vector style). Then measures the final file (ebur128 integrated loudness, LRA, true peak), checks for pure-black frames
(blackdetect) and for empty frames (every frame must show drawn content above the stage), and writes master-manifest.json.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
NAME = "gaid-promo-40s.mp4"


def run(args: list[str]) -> str:
    p = subprocess.run([FF, "-hide_banner", "-nostats", *args], capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr[-2000:])
    return p.stderr


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as s:
        for b in iter(lambda: s.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main():
    out = Path(sys.argv[1]).resolve()
    video, wav, final = out / "picture.mp4", out / "mix.wav", out / NAME
    if final.exists():
        raise FileExistsError(final)
    err = run(["-i", str(wav), "-af", "loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json", "-f", "null", "-"])
    m = json.loads(err[err.rindex("{"):err.rindex("}") + 1])
    ln = ("loudnorm=I=-14:TP=-1.2:LRA=11:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:"
          "measured_thresh={input_thresh}:offset={target_offset}:linear=true").format(**m)
    tmp = out / (".tmp-" + NAME)
    run(["-y", "-i", str(video), "-i", str(wav), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
         "-af", ln + ",aresample=48000", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest",
         "-movflags", "+faststart", str(tmp)])
    tmp.rename(final)

    # loudness of the final file
    err = run(["-i", str(final), "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"])
    summary = err[err.rindex("Summary:"):]
    loud = {
        "integrated_lufs": float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1)),
        "lra_lu": float(re.search(r"LRA:\s+(-?[\d.]+) LU", summary).group(1)),
        "true_peak_dbtp": float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary).group(1)),
    }
    # pure-black frames
    err = run(["-i", str(final), "-map", "0:v:0", "-vf", "blackdetect=d=0.03:pix_th=0.02:pic_th=0.98", "-an", "-f", "null", "-"])
    black = re.findall(r"black_start:(\S+) black_end:(\S+)", err)
    # empty frames: nothing drawn above the stage (luma > stage + 40 on fewer than 0.05 % of pixels)
    reader = imageio_ffmpeg.read_frames(str(final), output_params=["-vf", "scale=480:270"])
    meta = next(reader)
    counts = []
    for fr in reader:
        a = np.frombuffer(fr, np.uint8).reshape(270, 480, 3).max(axis=2)
        counts.append(float((a > 52).mean()))
    counts = np.array(counts)
    empty = [round(i / 30, 3) for i in np.flatnonzero(counts < 0.0005)]
    frames, secs = imageio_ffmpeg.count_frames_and_secs(str(final))
    manifest = {
        "schema": "gaid-promo-lemo-40-master-v1",
        "created_utc": datetime.now(UTC).isoformat(),
        "inputs": {"picture": {"path": video.name, "sha256": digest(video)}, "mix": {"path": wav.name, "sha256": digest(wav)}},
        "loudnorm_first_pass": m,
        "film": {"path": final.name, "sha256": digest(final), "bytes": final.stat().st_size, "frames": frames, "seconds": round(secs, 3),
                 "size": list(meta.get("source_size")), "fps": meta.get("fps")},
        "loudness": loud,
        "black_segments": black,
        "empty_frames": empty,
        "min_content_fraction": round(float(counts.min()), 5),
        "ffmpeg": imageio_ffmpeg.get_ffmpeg_version(),
    }
    (out / "master-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: manifest[k] for k in ("film", "loudness", "black_segments", "empty_frames", "min_content_fraction")}, ensure_ascii=False, indent=1))
    ok = abs(loud["integrated_lufs"] + 14) <= 1 and loud["true_peak_dbtp"] <= -1.0 and not black and not empty
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
