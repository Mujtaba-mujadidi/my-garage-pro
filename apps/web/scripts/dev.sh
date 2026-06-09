#!/usr/bin/env sh
set -eu

WEB="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB"

# Production `next build` leaves BUILD_ID + standalone; mixing with `next dev` causes stuck loading / 500.
if [ -f .next/BUILD_ID ] || [ -d .next/standalone ]; then
  echo "Clearing production .next cache before dev…"
  rm -rf .next
fi

exec pnpm exec next dev --port 3011
