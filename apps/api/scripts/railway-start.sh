#!/usr/bin/env sh
set -eu

API="$(cd "$(dirname "$0")/.." && pwd)"
cd "$API"

echo "Running prisma migrate deploy…"
if ! pnpm exec prisma migrate deploy; then
  echo "Migration deploy failed — attempting recover for demo_garage_modules_and_admin (wrong table name in first attempt)."
  pnpm exec prisma migrate resolve --rolled-back 20260609170000_demo_garage_modules_and_admin 2>/dev/null || true
  echo "Retrying prisma migrate deploy…"
  pnpm exec prisma migrate deploy
fi

echo "Starting API on PORT=${PORT:-4000}"
exec node dist/apps/api/src/main.js
