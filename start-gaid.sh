#!/usr/bin/env bash
# GeoAIDesk (GAID) entry point: make sure Node exists, then run the GAID
# launcher (geo/start.mjs), which starts the production build with user data
# outside this checkout. Windows users run start-gaid.cmd instead.
set -e
cd "$(dirname "$0")"

if ! command -v node &>/dev/null; then
    echo "Node.js not found. Install Node.js >= 22 from https://nodejs.org/" >&2
    echo "(or via your version manager, e.g. 'nvm install 22'), then run ./start-gaid.sh again." >&2
    exit 1
fi

exec node geo/start.mjs "$@"
