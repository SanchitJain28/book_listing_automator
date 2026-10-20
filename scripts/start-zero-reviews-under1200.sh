#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$PROJECT_DIR/keepa_zero_reviews_under1200"
mkdir -p "$RUN_DIR"
cd "$RUN_DIR"

if [ -f collector.pid ]; then
  collector_pid="$(cat collector.pid)"
  if ps -p "$collector_pid" -o command= 2>/dev/null | grep -q 'keepa_collect.js'; then
    echo "Collector already running (PID $collector_pid)."
    exit 0
  fi
fi

NODE_BIN="$(command -v node)"
python3 - "$PROJECT_DIR" "$NODE_BIN" <<'PY'
import os, pathlib, subprocess, sys
root = pathlib.Path(sys.argv[1])
run = root / 'keepa_zero_reviews_under1200'
env = os.environ.copy()
env.update(PASS='2', PRICE_BELOW='1200', TOKEN_RATE='120',
           DOTENV_CONFIG_PATH=str(root / '.env'))
with (run / 'runner.log').open('ab', buffering=0) as log:
    process = subprocess.Popen(
        ['/usr/bin/caffeinate', '-i', sys.argv[2], '-r',
         str(root / 'node_modules/dotenv/config'), str(root / 'keepa_collect.js')],
        cwd=run, env=env, stdin=subprocess.DEVNULL, stdout=log,
        stderr=subprocess.STDOUT, start_new_session=True)
(run / 'collector.pid').write_text(str(process.pid) + '\n')
PY
echo "Started collector (PID $(cat collector.pid))."
echo "Output: $RUN_DIR/books.csv"
echo "Log: $RUN_DIR/runner.log"
