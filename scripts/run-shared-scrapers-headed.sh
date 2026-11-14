#!/usr/bin/env bash
set -euo pipefail

if [[ $# == 0 ]]; then
  echo "Usage: bash scripts/run-shared-scrapers-headed.sh <input-file> [shared runner options]" >&2
  exit 1
fi

for argument in "$@"; do
  if [[ $argument == --headless ]]; then
    echo "The headed launcher requires omitting --headless." >&2
    exit 1
  fi
done

for dependency in xvfb-run xauth; do
  if ! command -v "$dependency" >/dev/null 2>&1; then
    echo "Headed scraping requires $dependency." >&2
    exit 1
  fi
done
if [[ ! -x /opt/google/chrome/chrome ]]; then
  echo "Google Chrome Stable is required. Install it with npx playwright install chrome." >&2
  exit 1
fi

exec xvfb-run -a node scripts/run-shared-scrapers.js "$@"
