#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 1 ]]; then
  echo "Usage: bash scripts/run-amazon-india-headed.sh <input-file|--check>" >&2
  exit 1
fi

for dependency in xvfb-run xauth; do
  if ! command -v "$dependency" >/dev/null 2>&1; then
    echo "Headed Amazon India scraping requires $dependency." >&2
    exit 1
  fi
done
if [[ ! -x /opt/google/chrome/chrome ]]; then
  echo "Google Chrome Stable is required. Install it with npx playwright install chrome." >&2
  exit 1
fi

if [[ $1 == --check ]]; then exit 0; fi

exec xvfb-run -a node utils/watcher.js scrapers/amazon-isbn/amazon-isbn.js "$1" --chrome
