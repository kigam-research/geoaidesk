#!/bin/sh
# One-command build of the lemo edition into $TASK_OUTPUT_DIR (task job run) or $1.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
O=${1:-$TASK_OUTPUT_DIR}
[ -n "$O" ] || { echo "usage: build.sh <new output dir> (or run under task job run)"; exit 2; }
D=${PROMO_CAPTURES:-$HOME/data/geoaidesk/work}
uv run --no-project --with playwright==1.63.0 --with imageio-ffmpeg==0.6.0 --with pillow==12.3.0 \
  python "$HERE/render.py" --capture "$D/gaid-promo-video-v3/capture-v3" --capture-y "$D/gaid-promo-video-v2/capture-v2" --out "$O" --workers "${WORKERS:-4}"
uv run --no-project --with numpy==2.3.4 --with scipy==1.16.3 --with soundfile==0.13.1 --with soxr==1.0.0 \
  python "$HERE/mix.py" --events "$O/events.json" --out "$O"
uv run --no-project --with imageio-ffmpeg==0.6.0 python "$HERE/master.py" --picture "$O/picture.mp4" --mix "$O/mix.wav" --out "$O/gaid-promo-lemo.mp4"
