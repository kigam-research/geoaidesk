#!/usr/bin/env bash
# Start an isolated GAID backend for one measurement run: model login from AGENT_DIR (read through Pi, never copied),
# every GAID store and the projects root under RUN_DIR. Usage: serve.sh <unit-name> <port> <run-dir> <server-dir>
set -euo pipefail
unit=$1 port=$2 run=$3 server=$4
agent=${AGENT_DIR:-$HOME/.geoaidesk/pi-agent}
mkdir -p "$run/projects" "$run/authoring" "$run/hub-shared" "$run/library"
systemd-run --user --unit="$unit" --collect -p WorkingDirectory="$server" \
  -E PATH="$PATH" -E KADY_PORT="$port" -E KADY_PROJECTS_ROOT="$run/projects" -E KADY_PI_AGENT_DIR="$agent" \
  -E GAID_AUTHORING_DIR="$run/authoring" -E GAID_HUB_SHARED_DIR="$run/hub-shared" -E GAID_LIBRARY_DIR="$run/library" \
  -E KADY_SKILLS_AUTO_SYNC=0 \
  --property=StandardOutput="file:$run/server.log" --property=StandardError="file:$run/server.log" \
  "$(command -v npx)" tsx src/index.ts
for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$port/health" >/dev/null && exit 0; sleep 2; done
echo "server did not start; see $run/server.log" >&2
exit 1
