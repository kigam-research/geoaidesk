"""Master the GAID promo film, lemo edition: picture.mp4 + mix.wav -> film MP4 at about -14 LUFS.

uv run --no-project --with imageio-ffmpeg==0.6.0 python geo/promo-lemo/master.py --picture <dir>/picture.mp4 \
  --mix <dir>/mix.wav --out <dir>/gaid-promo-lemo.mp4

Port of lemo-opuscar core/render/mux.sh with imageio-ffmpeg's bundled ffmpeg (this PC has no system ffmpeg/ffprobe):
two-pass loudnorm to -14 LUFS / true peak -1.2 dB, then a -3 dBFS limiter as headroom for AAC overshoot,
AAC 256 kb/s 48 kHz stereo, the H.264 picture copied unchanged (grain 0: vector style). Prints and writes the measured loudness of the finished file (ebur128) and a blackdetect scan.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def run(cmd: list[str]) -> str:
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr[-2000:])
    return p.stderr


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--picture", type=Path, required=True)
    ap.add_argument("--mix", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    import imageio_ffmpeg

    ff = imageio_ffmpeg.get_ffmpeg_exe()
    if args.out.exists():
        raise FileExistsError(args.out)
    log = run([ff, "-hide_banner", "-nostats", "-i", str(args.mix), "-af", "loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json", "-f", "null", "-"])
    m = json.loads(log[log.rindex("{"): log.rindex("}") + 1])
    if any(v in ("-inf", "inf", "nan") for v in (m["input_i"], m["input_tp"])):
        raise ValueError(f"Mix is silent or unreadable: {m}")
    ln = (f"loudnorm=I=-14:TP=-1.2:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    tmp = args.out.with_suffix(".tmp.mp4")
    run([ff, "-y", "-loglevel", "error", "-i", str(args.picture), "-i", str(args.mix),
         "-filter_complex", f"[1:a]{ln},aresample=48000,alimiter=limit=0.708:attack=2:release=60:level=disabled[a]", "-map", "0:v", "-map", "[a]",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ac", "2", "-movflags", "+faststart", "-shortest", str(tmp)])
    tmp.rename(args.out)
    eb = run([ff, "-hide_banner", "-nostats", "-i", str(args.out), "-af", "ebur128=peak=true", "-f", "null", "-"])
    summary = eb[eb.rfind("Summary:"):]
    loud = {
        "integrated_lufs": float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1)),
        "lra_lu": float(re.search(r"LRA:\s+(-?[\d.]+) LU", summary).group(1)),
        "true_peak_dbfs": float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary).group(1)),
    }
    bd = run([ff, "-hide_banner", "-nostats", "-i", str(args.out), "-vf", "blackdetect=d=0.1:pix_th=0.02", "-an", "-f", "null", "-"])
    black = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bd)
    count, seconds = imageio_ffmpeg.count_frames_and_secs(str(args.out))
    report = {
        "film": args.out.name, "sha256": digest(args.out), "bytes": args.out.stat().st_size,
        "frames": count, "seconds": seconds, "loudness": loud, "first_pass": m, "black_segments": black,
        "picture_sha256": digest(args.picture), "mix_sha256": digest(args.mix),
    }
    (args.out.parent / "master.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if not (-15 <= loud["integrated_lufs"] <= -13) or loud["true_peak_dbfs"] > -1.0:
        print("warning: loudness outside -14 +/- 1 LU or true peak above -1 dBFS")


if __name__ == "__main__":
    main()
