#!/bin/bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
python3 - "$PROJECT_DIR" "$NODE_BIN" <<'PY'
import os, pathlib, subprocess, sys
root = pathlib.Path(sys.argv[1])
run = root / 'keepa_batches'
run.mkdir(exist_ok=True)
pid_file = run / 'runner.pid'
if pid_file.exists():
    pid = pid_file.read_text().strip()
    if pid.isdigit():
        check = subprocess.run(['/bin/ps', '-p', pid, '-o', 'state=,command='], capture_output=True, text=True)
        if check.returncode == 0 and not check.stdout.strip().startswith('Z') and str(root / 'scripts/keepa-batches.cjs') in check.stdout:
            print('Batch sequence already running (PID ' + pid + ').')
            sys.exit(0)
env = os.environ.copy()
env['DOTENV_CONFIG_PATH'] = str(root / '.env')
with (run / 'runner.log').open('ab', buffering=0) as log:
    process = subprocess.Popen(
        ['/usr/bin/caffeinate', '-i', sys.argv[2], '-r', str(root / 'node_modules/dotenv/config'), str(root / 'scripts/keepa-batches.cjs')],
        cwd=root, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
pid_file.write_text(str(process.pid) + '\n')
print('Started batch sequence (PID ' + str(process.pid) + ').')
print('Check progress: node keepa --status --batches')
print('Log: ' + str(run / 'runner.log'))
PY
