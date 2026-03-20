#!/bin/sh
set -eu

truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|y|Y|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

PROCESS_TYPE="${PROCESS_TYPE:-api}"

if truthy "${RUN_MIGRATIONS_ON_START:-true}"; then
  echo "[START] Running prisma migrate deploy"
  npx prisma migrate deploy
else
  echo "[START] Skipping prisma migrate deploy (RUN_MIGRATIONS_ON_START=false)"
fi

if [ "$PROCESS_TYPE" = "worker" ]; then
  echo "[START] Starting worker (node dist/worker.js)"
  exec node dist/worker.js
fi

echo "[START] Starting API (node dist/server.js)"
exec node dist/server.js
