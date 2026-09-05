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
  # If a previous deploy failed mid-migration, Prisma marks it as 'failed'
  # in its internal tracking table (_prisma_migrations) and blocks all future
  # migrations with P3009. The migration SQL is idempotent
  # (ADD COLUMN IF NOT EXISTS), so we resolve the failed migration as 'applied'
  # and then ensure the column exists via a raw query as a safety net.
  npx prisma migrate deploy 2>&1 | tee /dev/stderr | grep -q "P3009" && {
    echo "[START] Detected P3009 — resolving failed migration"
    npx prisma migrate resolve --applied "20260905234926_add_report_ai_summary" 2>/dev/null || true
    # After resolving as 'applied', migrate deploy won't re-run the migration SQL.
    # Ensure the column actually exists with an idempotent raw query via Prisma client.
    node -e 'const { PrismaClient } = require("@prisma/client"); const p = new PrismaClient(); p.$queryRawUnsafe("ALTER TABLE \"Report\" ADD COLUMN IF NOT EXISTS \"aiSummary\" JSONB;").then(() => console.log("[START] Ensured aiSummary column exists")).catch(e => console.error("[START] Column check failed:", e.message)).finally(() => p.$disconnect());' 2>/dev/null || true
  } || true
else
  echo "[START] Skipping prisma migrate deploy (RUN_MIGRATIONS_ON_START=false)"
fi

if [ "$PROCESS_TYPE" = "worker" ]; then
  echo "[START] Starting worker (node dist/worker.js)"
  exec node dist/worker.js
fi

echo "[START] Starting API (node dist/server.js)"
exec node dist/server.js
