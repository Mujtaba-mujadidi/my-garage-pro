#!/usr/bin/env sh
set -eu

# Run from repo root: sh apps/web/scripts/railway-start.sh
WEB="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:?PORT is not set}"

cd "$WEB"

if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: Missing apps/web/.next/BUILD_ID — web build did not complete."
  echo "Check Railway web build logs. Root Directory must be empty (repo root), not apps/web."
  ls -la .next 2>/dev/null || echo "(no .next folder)"
  exit 1
fi

echo "Starting Next.js on 0.0.0.0:${PORT} (cwd=$(pwd))"
exec pnpm exec next start -H 0.0.0.0 -p "$PORT"
