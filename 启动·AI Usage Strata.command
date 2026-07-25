#!/bin/zsh
set -euo pipefail

PROJECT_DIR="${0:A:h}"
PORT="${AI_USAGE_STRATA_PORT:-8770}"
URL="http://127.0.0.1:${PORT}/index.html"

if ! /usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  (
    cd "$PROJECT_DIR"
    exec /usr/bin/python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1
  ) &
  sleep 0.4
fi

/usr/bin/open "$URL"
