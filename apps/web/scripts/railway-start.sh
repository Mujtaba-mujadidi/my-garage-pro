#!/usr/bin/env sh
set -eu

WEB="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:?PORT is not set}"

cd "$WEB"

STANDALONE="$WEB/.next/standalone/apps/web/server.js"

if [ -f "$STANDALONE" ]; then
  # Next standalone output (monorepo) — copy assets the standalone bundle expects
  mkdir -p "$WEB/.next/standalone/apps/web/.next"
  cp -R "$WEB/.next/static" "$WEB/.next/standalone/apps/web/.next/static"
  if [ -d "$WEB/public" ]; then
    cp -R "$WEB/public" "$WEB/.next/standalone/apps/web/public"
  fi
  echo "Starting Next.js standalone on 0.0.0.0:${PORT}"
  cd "$WEB/.next/standalone/apps/web"
  HOSTNAME=0.0.0.0 PORT="$PORT" exec node server.js
fi

if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: Missing production build (.next/BUILD_ID or standalone server.js)."
  echo "Check Railway web build logs. Root Directory must be repo root (empty), not apps/web."
  ls -la .next 2>/dev/null || echo "(no .next folder)"
  exit 1
fi

echo "Starting Next.js on 0.0.0.0:${PORT} (cwd=$(pwd))"
HOSTNAME=0.0.0.0 PORT="$PORT" exec pnpm exec next start -H 0.0.0.0 -p "$PORT"
