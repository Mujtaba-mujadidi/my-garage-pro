#!/usr/bin/env sh
set -eu

WEB="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB"

# A stale .next (e.g. after `pnpm build`) causes Internal Server Error / missing vendor-chunks.
if [ -d .next ]; then
  echo "Clearing .next cache before dev…"
  rm -rf .next
fi

exec pnpm exec next dev --port 3011
