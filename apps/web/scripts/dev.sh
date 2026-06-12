#!/usr/bin/env sh
set -eu

WEB="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB"

PORT=3011

# Multiple dev servers or a stale .next (e.g. after `pnpm build` while dev runs) cause
# "__webpack_modules__[moduleId] is not a function" and missing vendor-chunks errors.
if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -ti:"$PORT" 2>/dev/null || true)"
  if [ -n "$PIDS" ]; then
    echo "Stopping existing process on port $PORT…"
    # shellcheck disable=SC2086
    kill -9 $PIDS 2>/dev/null || true
  fi
fi

if [ -d .next ]; then
  echo "Clearing .next cache before dev…"
  rm -rf .next
fi

exec pnpm exec next dev --port "$PORT"
