#!/bin/sh
# One-command rebuild of the GAID 40 s promo: picture -> mix -> master.
#   sh geo/promo-lemo-40/build.sh <new output dir>     (or set TASK_OUTPUT_DIR, as `task job run` does)
# Needs: uv, /usr/bin/google-chrome, the lemo-opuscar asset (LIB) and the two GAID capture folders (see README.md).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${1:-$TASK_OUTPUT_DIR}
[ -n "$OUT" ] || { echo "usage: build.sh <new output dir>"; exit 2; }
LIB=${LIB:-$HOME/assets/lemo-opuscar/3961ddb/lib}
export LIB
[ -f "$LIB/core/audio/sampler.py" ] || { echo "set LIB to the lemo-opuscar library folder"; exit 1; }
WORKERS=${WORKERS:-4}
uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python "$HERE/render.py" --out "$OUT" --workers "$WORKERS"
uv run --no-project --with numpy==2.5.4 --with scipy==1.18.1 --with soundfile==0.14.0 --with soxr==1.1.0 \
  python "$HERE/mix.py" "$OUT"
uv run --no-project --with imageio-ffmpeg==0.6.0 --with numpy==2.5.4 python "$HERE/master.py" "$OUT"
