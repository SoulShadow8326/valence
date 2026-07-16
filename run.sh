#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_ADDR="${GATEWAY_ADDR:-127.0.0.1:8080}"
UI_PORT="${UI_PORT:-3000}"
MODE="${1:-prod}"

if [ -f "$ROOT/.env" ]; then
  set -a
  . "$ROOT/.env"
  set +a
fi

command -v go >/dev/null   || { echo "error: 'go' not found on PATH"; exit 1; }
command -v npm >/dev/null  || { echo "error: 'npm' not found on PATH"; exit 1; }

free_port() {
  local pids
  pids="$(lsof -ti:"$1" 2>/dev/null || true)"
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
}

cleanup() {
  echo
  echo "==> shutting down"
  [ -n "${UI_PID:-}" ] && kill "$UI_PID" 2>/dev/null || true
  [ -n "${GW_PID:-}" ] && kill "$GW_PID" 2>/dev/null || true
  free_port "${GATEWAY_ADDR##*:}"   # go run leaks its child; free the port to be sure
  free_port "$UI_PORT"
}
trap cleanup EXIT INT TERM

# clear anything left from a previous run
free_port "${GATEWAY_ADDR##*:}"
free_port "$UI_PORT"

echo "==> starting gateway on ${GATEWAY_ADDR}"
( cd "$ROOT/node" && go run ./gateway -addr "$GATEWAY_ADDR" ) &
GW_PID=$!

printf "==> waiting for gateway (first compile can take ~20s)"
for _ in $(seq 1 60); do
  if curl -sf "http://${GATEWAY_ADDR}/health" >/dev/null 2>&1; then
    echo " up"
    break
  fi
  printf "."
  sleep 0.5
done
curl -sf "http://${GATEWAY_ADDR}/health" >/dev/null 2>&1 || { echo; echo "error: gateway never came up"; exit 1; }

# NEXT_PUBLIC_* is inlined at BUILD time, so it must be set for the build (dev reads it live).
export NEXT_PUBLIC_NODE_URL="http://${GATEWAY_ADDR}"

if [ "$MODE" = "dev" ]; then
  echo "==> starting UI (dev) on http://localhost:${UI_PORT}"
  ( cd "$ROOT/ui" && npm run dev -- -p "$UI_PORT" ) &
else
  echo "==> building UI"
  ( cd "$ROOT/ui" && npm run build )
  echo "==> starting UI on http://localhost:${UI_PORT}"
  ( cd "$ROOT/ui" && npm run start -- -p "$UI_PORT" ) &
fi
UI_PID=$!

cat <<EOF

======================================================
  Valence is running
    App:      http://localhost:${UI_PORT}
    Gateway:  http://${GATEWAY_ADDR}

  Convergence demo — open TWO windows with DIFFERENT
  Node IDs (same-profile tabs share one):
    - a normal window
    - an incognito / private window
  Publish a NEED in one and a matching CAPACITY in the
  other; both snap to "Answered by the network".

  Ctrl+C stops everything.
======================================================
EOF

wait
