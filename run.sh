#!/usr/bin/env bash
# Launch MachUpX Aircraft Designer: starts the local server and opens the browser.
cd "$(dirname "$0")"
export MPLCONFIGDIR="${TMPDIR:-/tmp}/mpl"
URL="http://127.0.0.1:8000"

# Open the browser as soon as the server is healthy
(
  for _ in $(seq 1 50); do
    if curl -sf "$URL/api/health" >/dev/null 2>&1; then
      xdg-open "$URL" >/dev/null 2>&1 || true
      exit 0
    fi
    sleep 0.2
  done
) &

exec .venv/bin/python -m uvicorn server.app:app --host 127.0.0.1 --port 8000
