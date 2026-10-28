"""Read-only collector executed on the VPS by the local status script."""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/root/book_listing_automator')
MANIFEST = Path('/root/migrations/vps6-manual-20261027T075310Z/sessions.json')
BLOCK = re.compile(r'blocked|captcha|robot check|access denied|too many requests|http\s*(?:403|429|503)', re.I)


def text(value):
    return str(value or '')


def summarize(records):
    counts = dict(blocked=0, errors=0, matched=0, found=0, in_stock=0, out_of_stock=0, not_listed=0, isbn_mismatch=0)
    statuses = {}
    for row in records:
        status = text(row.get('stock_status')) or 'Unknown'
        statuses[status] = statuses.get(status, 0) + 1
        listings = row.get('listings') if isinstance(row.get('listings'), list) else []
        listings = [x for x in listings if isinstance(x, dict)]
        message = ' '.join(text(row.get(k)) for k in ('stock_status', 'error_code', 'error'))
        nested = ' '.join(' '.join(text(x.get(k)) for k in ('stock_status', 'error_code', 'error')) for x in listings)
        blocked = bool(BLOCK.search(message + ' ' + nested))
        failed = not blocked and (bool(row.get('error')) or status.lower() == 'error' or any(text(x.get('price')).lower() == 'error' or x.get('error') for x in listings))
        counts['blocked'] += blocked
        counts['errors'] += bool(failed)
        counts['matched'] += row.get('isbn_matched') is True or row.get('isbn_match') is True or any(x.get('isbn_match') is True or x.get('isbn_matched') is True for x in listings)
        found = row.get('found') is True
        counts['found'] += found
        # A rejected candidate can have a stock flag; it is not stock for the input ISBN.
        counts['in_stock'] += found and (row.get('in_stock') is True or status.lower() == 'in stock')
        counts['out_of_stock'] += found and ((row.get('in_stock') is False and bool(re.search(r'out.of.stock|sold.out|unavailable', status, re.I))) or status.lower() == 'out of stock')
        counts['not_listed'] += bool(re.search(r'not listed|not found',status,re.I))
        counts['isbn_mismatch'] += 'isbn mismatch' in status.lower()
    return counts, statuses


def read_output(file, total):
    if not file.exists():
        return [], 0, None, False
    records, invalid = {}, 0
    with file.open('rb') as stream:
        for number, raw in enumerate(stream):
            if not raw.endswith(b'\n'):
                break  # A writer may be in the middle of appending the last line.
            if not raw.strip():
                continue
            try:
                row = json.loads(raw)
                if not isinstance(row, dict):
                    raise ValueError('Expected an object')
                index = row.get('input_index', number)
                if isinstance(index, bool) or not isinstance(index, int) or index < 0 or index >= total:
                    raise ValueError('Invalid input index')
                records[index] = row
            except (ValueError, UnicodeDecodeError):
                invalid += 1
    mtime = datetime.fromtimestamp(file.stat().st_mtime, timezone.utc).isoformat()
    return list(records.values()), invalid, mtime, True


def memory_info():
    fields = {}
    try:
        for line in Path('/proc/meminfo').read_text().splitlines():
            name, _, value = line.partition(':')
            if name in ('MemTotal', 'MemAvailable', 'SwapTotal', 'SwapFree'):
                fields[name] = int(value.split()[0]) * 1024
        return {'total_bytes': fields.get('MemTotal'), 'available_bytes': fields.get('MemAvailable'),
                'swap_total_bytes': fields.get('SwapTotal'),
                'swap_used_bytes': fields['SwapTotal'] - fields['SwapFree'] if 'SwapTotal' in fields and 'SwapFree' in fields else None}
    except (OSError, ValueError):
        return None


def parse_processes(output, total_memory=None, limit=500):
    processes = {}
    for line in output.splitlines():
        parts = line.split(None, 4)
        if len(parts) < 4:
            continue
        try:
            pid, parent_pid, rss_kib = map(int, parts[:3])
        except ValueError:
            continue
        args = parts[4] if len(parts) > 4 else ''
        scraper = re.search(r'(?:^|[\s/])scrapers/([\w-]+)/[^\s]*\.js(?:\s|$)', args)
        shared = bool(re.search(r'(?:^|[\s/])scripts/run-shared-scrapers\.js(?:\s|$)', args))
        browser_type = re.search(r'(?:^|\s)--type=([\w-]+)', args)
        processes[pid] = {'pid': pid, 'parent_pid': parent_pid, 'name': os.path.basename(parts[3]),
                          'browser_type': browser_type.group(1) if browser_type else None,
                          'rss_bytes': rss_kib * 1024, 'scraper': scraper.group(1) if scraper else 'shared-pool' if shared else None}
    for process in processes.values():
        current, seen = process, set()
        while current and current['pid'] not in seen:
            seen.add(current['pid'])
            if current['scraper']:
                process['scraper'] = current['scraper']
                break
            current = processes.get(current['parent_pid'])
        process['memory_percent'] = round(process['rss_bytes'] / total_memory * 100, 2) if total_memory else None
    groups = {}
    for process in processes.values():
        if process['scraper']:
            group = groups.setdefault(process['scraper'], {'scraper': process['scraper'], 'rss_bytes': 0, 'process_count': 0})
            group['rss_bytes'] += process['rss_bytes']
            group['process_count'] += 1
    return {'processes': sorted(processes.values(), key=lambda item: (-item['rss_bytes'], item['pid']))[:limit],
            'process_count': len(processes), 'scraper_groups': sorted(groups.values(), key=lambda item: -item['rss_bytes'])}


def process_info(total_memory=None):
    try:
        result = subprocess.run(['ps', '-eo', 'pid=,ppid=,rss=,comm=,args=', '--sort=-rss'], capture_output=True, text=True, timeout=12, check=True)
        return parse_processes(result.stdout, total_memory)
    except (OSError, subprocess.SubprocessError):
        return {'processes': None, 'process_count': None, 'scraper_groups': [], 'process_error': 'Process information is unavailable on VPS 6.'}


def collect(root=ROOT, manifest=MANIFEST):
    sessions = json.loads(manifest.read_text())
    try:
        tmux = subprocess.run(['tmux', 'list-sessions', '-F', '#{session_name}'], capture_output=True, text=True, timeout=8)
        known = tmux.returncode == 0 or 'no server running' in tmux.stderr.lower() or 'failed to connect to server' in tmux.stderr.lower()
        active = set(tmux.stdout.splitlines()) if known else None
    except (OSError, subprocess.TimeoutExpired):
        active = None
    result, runtimes = [], {}
    for name, entry in sessions.items():
        total = entry['total_inputs']
        output = Path(entry['output'])
        if output.is_absolute() or '..' in output.parts:
            raise ValueError('Invalid output path in session manifest')
        rows, invalid, modified, exists = read_output(root / output, total)
        counts, statuses = summarize(rows)
        # Shared runs keep blocked attempts separate so pending inputs stay resumable.
        blocked_rows, _, _, _ = read_output(Path(str(root / output) + '.blocked.jsonl'), total)
        counts['blocked'] += len(blocked_rows)
        running = entry['session'] in active if active is not None else None
        exit_path = Path(entry['exit_file'])
        try:
            code = int(exit_path.read_text().strip()) if exit_path.exists() else None
        except (OSError, ValueError):
            code = None
        runtime_row = None
        if entry.get('runtime_status'):
            runtime_path = Path(entry['runtime_status'])
            if runtime_path.is_absolute() or '..' in runtime_path.parts:
                raise ValueError('Invalid shared runtime status path')
            key = str(runtime_path)
            if key not in runtimes:
                try:
                    runtimes[key] = json.loads((root / runtime_path).read_text())
                except (OSError, ValueError):
                    runtimes[key] = {}
            runtime_row = runtimes[key].get('scrapers', {}).get(name)
        complete = len(rows) >= total
        state = 'Running' if running is True else 'Finished' if complete else 'Unknown' if running is None else 'Stopped'
        session_alive = running
        if runtime_row and running is True:
            candidate_state = runtime_row.get('state')
            if candidate_state in ('Running', 'Queued', 'Finished', 'Blocked', 'Failed', 'Stopped'):
                state = candidate_state
                running = state == 'Running'
        result.append({'id': name, 'name': {'atlanticbooks':'Atlantic Books', 'bookswagon':'BooksWagon', 'flipkart':'Flipkart', 'mypustak':'MyPustak', 'sapnaonline':'SapnaOnline', 'abebooks':'AbeBooks', 'ompublication':'Om Publications', 'bookchor':'BookChor'}.get(name, name),
                       'session': entry['session'], 'state': state, 'running': running, 'session_alive': session_alive, 'processed': len(rows), 'total': total,
                       'invalid_lines': invalid, 'output_exists': exists, 'exit_code': code, 'last_updated': modified,
                       'last_isbn': rows[-1].get('searched_isbn') if rows else None, 'output': str(output),
                       'counts': counts, 'statuses': statuses})
    memory = memory_info()
    return {'vps': 'VPS 6', 'checked_at': datetime.now(timezone.utc).isoformat(), 'input': 'input-data/manual-search/2026-10-27/input.txt',
            'memory': memory, 'scrapers': result, 'shared_runtime': next((value.get('runtime') for value in runtimes.values() if value.get('runtime')), None),
            **process_info(memory.get('total_bytes') if memory else None)}


if __name__ == '__main__':
    try:
        print(json.dumps(collect()))
    except Exception as error:
        print(json.dumps({'error': 'Could not collect VPS status: ' + str(error)}))
        sys.exit(1)
