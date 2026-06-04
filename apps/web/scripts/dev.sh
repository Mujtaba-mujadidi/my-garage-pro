#!/usr/bin/env sh
set -eu

WEB="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB"

# Production `next build` leaves BUILD_ID; mixing with `next dev` causes 500 / missing chunk errors.
if [ -f .next/BUILD_ID ]; then
  echo "Clearing production .next cache before dev…"
  rm -rf .next
fi

exec pnpm exec next dev --port 3011
