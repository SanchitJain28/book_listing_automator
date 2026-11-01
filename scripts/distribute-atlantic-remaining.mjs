import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { serversFromInfo } from '../dashboard/server/vpsManager.js';
import { VpsConnectionPool } from '../dashboard/server/vpsConnectionPool.js';

// This migration uses the existing CLI, not the new batch platform.
const root = fileURLToPath(new URL('../', import.meta.url));
const remote = '/root/book_listing_automator';
const batch = 'atlantic-remaining-2026-10-31';
const inputFolder = `input-data/manual-search/2026-10-27/${batch}`;
const auditFolder = path.join(root, 'output/migrations', batch);
const sourceInput = 'input-data/manual-search/2026-10-27/input.txt';
const sourceOutput = 'output/atlanticbooks/manual-search/2026-10-27/results.jsonl';
const expectedInputSha = 'e008d9ea66de595d8feda6c22d4f766468baf75cefeefd33e9df732d2eae2b75';
const ids = ['12', '13', '14', '15', '16'];
const servers = serversFromInfo(await fs.readFile(path.join(root, 'VPSInfo.md'), 'utf8'));
const pool = new VpsConnectionPool();
const sha = value => createHash('sha256').update(value).digest('hex');
const server = id => { const s = servers.find(s => s.id === id); if (!s) throw new Error(`VPS ${id} missing from inventory`); return s; };
async function exec(id, code, request = {}) {
  const r = await pool.exec(server(id), 'python3 -', `request=${JSON.stringify(JSON.stringify(request))}\nimport json\nrequest=json.loads(request)\n${code}`, { timeout: 45000, maxBytes: 12000 });
  if (r.code) throw new Error(`VPS ${id}: ${r.stderr || r.stdout}`);
  return JSON.parse(r.stdout);
}
async function sftp(id, fn) {
  const client = await pool.ready(server(id), pool.entry(server(id)));
  const channel = await new Promise((resolve, reject) => client.sftp((e, s) => e ? reject(e) : resolve(s)));
  try { return await fn(channel); } finally { channel.end(); }
}
const readRemote = (id, file) => sftp(id, s => new Promise((resolve, reject) => s.readFile(`${remote}/${file}`, (e, b) => e ? reject(e) : resolve(b))));
const writeRemote = (id, file, data) => sftp(id, s => new Promise((resolve, reject) => s.writeFile(`${remote}/${file}`, data, { flag: 'wx', mode: 0o600 }, e => e ? reject(e) : resolve())));
const manifestPath = path.join(auditFolder, 'manifest.json');

async function prepare() {
  try { await fs.access(manifestPath); throw new Error('Manifest already exists. Use --start or --status; preparation never overwrites a migration.'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const status = await exec('6', `import hashlib\nr='${remote}/'\ns=json.load(open(r+'output/shared-runs/aec3b3552433.status.json'))['scrapers']['atlanticbooks']\nprint(json.dumps({'state':s['state'],'processed':s['processed'],'outputSha256':hashlib.sha256(open(r+'${sourceOutput}','rb').read()).hexdigest()}))`);
  if (status.state !== 'Blocked' || status.processed !== 3383) throw new Error('Source progress changed; reconcile before splitting.');
  const [input, output] = await Promise.all([readRemote('6', sourceInput), readRemote('6', sourceOutput)]);
  if (sha(input) !== expectedInputSha || sha(output) !== status.outputSha256) throw new Error('Source changed during snapshot.');
  const local = await fs.readFile(path.join(root, sourceInput));
  if (sha(local) !== sha(input)) throw new Error('Local and VPS input differ.');
  const terms = input.toString().split('\n').map(s => s.trim()).filter(Boolean);
  const saved = output.toString().split('\n').filter(s => s.trim()).map(s => JSON.parse(s));
  if (terms.length !== 14777 || saved.length !== 3383) throw new Error('Unexpected source count.');
  saved.forEach((row, i) => {
    if (row.searched_isbn !== terms[i] || row.input_index !== i) throw new Error(`Saved output is not a contiguous prefix at row ${i + 1}.`);
  });
  const remaining = terms.slice(saved.length), chunks = [];
  let offset = saved.length;
  await fs.mkdir(auditFolder, { recursive: true });
  await fs.mkdir(path.join(root, inputFolder), { recursive: true });
  await fs.writeFile(path.join(auditFolder, 'completed-vps6.jsonl'), output, { flag: 'wx' });
  for (const [i, id] of ids.entries()) {
    const count = Math.floor(remaining.length / ids.length) + (i < remaining.length % ids.length ? 1 : 0);
    const content = terms.slice(offset, offset + count).join('\n') + '\n';
    const input = `${inputFolder}/chunk-vps${id}.txt`;
    const outputSubdir = `manual-search/2026-10-27/${batch}/vps-${id}`;
    const output = `output/atlanticbooks/${outputSubdir}/results.jsonl`;
    const command = ['node', 'scripts/run-shared-scrapers.js', input, '--headless', '--platforms', 'atlanticbooks', '--browsers', '1', '--concurrency', '1', '--batch-size', '100', '--resources', 'block-assets', '--output-subdir', outputSubdir];
    const chunk = { vps: id, count, originalStartRow: offset + 1, originalEndRow: offset + count, input, inputSha256: sha(content), output, log: path.posix.join(path.posix.dirname(output), 'run.log'), session: `atlantic_remaining_20261031_vps${id}`, command };
    await fs.writeFile(path.join(root, input), content, { flag: 'wx' });
    await fs.writeFile(path.join(root, input + '.rows.json'), JSON.stringify(terms.slice(offset, offset + count).map((isbn, index) => ({ chunkIndex: index, originalInputIndex: offset + index, isbn })), null, 2) + '\n', { flag: 'wx' });
    chunks.push(chunk); offset += count;
  }
  if (offset !== terms.length) throw new Error('Partition does not cover the input.');
  const manifest = { batch, createdAt: new Date().toISOString(), sourceVps: '6', sourceInput, sourceOutput, inputSha256: sha(input), completedOutputSha256: sha(output), total: terms.length, completed: saved.length, remaining: remaining.length, chunks };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(manifest, null, 2));
}

async function start(manifest) {
  // Preflight all five before starting any, and never alter their repositories.
  for (const c of manifest.chunks) {
    const content = await fs.readFile(path.join(root, c.input));
    if (sha(content) !== c.inputSha256) throw new Error(`Local chunk ${c.vps} changed.`);
    await exec(c.vps, `import pathlib,subprocess,os\nr=pathlib.Path('${remote}')\nc=request\nassert not (r/c['input']).exists(), 'Chunk already uploaded; inspect status before retrying'\nassert not (r/c['output']).exists(), 'Output already exists'\nassert subprocess.run(['tmux','has-session','-t',c['session']],capture_output=True).returncode!=0, 'Session already exists'\nmem={l.split(':')[0]:int(l.split()[1]) for l in open('/proc/meminfo') if ':' in l and len(l.split())>1 and l.split()[1].isdigit()}\nassert mem['MemAvailable']>1200000, 'Insufficient available RAM'\np=subprocess.run(['node','-e',"const r=require('./scripts/run-shared-scrapers.js');if(!r.registry().atlanticbooks)process.exit(1)"],cwd=r,capture_output=True,text=True)\nassert p.returncode==0,p.stderr\n(r/c['input']).parent.mkdir(parents=True,exist_ok=True)\n(r/c['output']).parent.mkdir(parents=True,exist_ok=True)\nprint(json.dumps({'ready':True}))`, c);
  }
  const results = [];
  for (const c of manifest.chunks) {
    await writeRemote(c.vps, c.input, await fs.readFile(path.join(root, c.input)));
    const result = await exec(c.vps, `import pathlib,subprocess,hashlib,shlex\nr=pathlib.Path('${remote}');c=request\nassert hashlib.sha256((r/c['input']).read_bytes()).hexdigest()==c['inputSha256'], 'Upload checksum mismatch'\nlauncher=(r/c['output']).parent/'run.sh'\ncommand=shlex.join(c['command'])\nlauncher.write_text('#!/bin/bash\\ncd '+shlex.quote(str(r))+' || exit 1\\n'+command+' >> '+shlex.quote(c['log'])+' 2>&1\\nresult=$?\\nprintf "%s\\\\n" "$result" > '+shlex.quote(str((r/c['output']).parent/'exit-code.txt'))+'\\nexit "$result"\\n')\nlauncher.chmod(0o700)\np=subprocess.run(['tmux','new-session','-d','-s',c['session'],'bash '+shlex.quote(str(launcher))],capture_output=True,text=True)\nassert p.returncode==0,p.stderr\nprint(json.dumps({'vps':c['vps'],'session':c['session'],'started':True,'output':c['output']}))`, c);
    results.push(result);
    await fs.writeFile(path.join(auditFolder, 'launches.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(result));
  }
}

async function status(manifest) {
  const rows = await Promise.all(manifest.chunks.map(c => exec(c.vps, `import pathlib,subprocess,glob\nr=pathlib.Path('${remote}');c=request\nstates=[]\nfor f in glob.glob(str(r/'output/shared-runs/*.status.json')):\n try:\n  s=json.load(open(f));row=s.get('scrapers',{}).get('atlanticbooks')\n  if row and row.get('output')==str(r/c['output']): states.append(row)\n except (ValueError,OSError): pass\nlog=r/c['log'];lines=log.read_text().splitlines()[-5:] if log.exists() else []\noutput=r/c['output'];saved=[json.loads(line) for line in output.read_text().splitlines() if line.strip()] if output.exists() else []\nprint(json.dumps({'vps':c['vps'],'processed':len(saved),'matched':sum(row.get('isbn_matched') is True for row in saved),'sessionAlive':subprocess.run(['tmux','has-session','-t',c['session']],capture_output=True).returncode==0,'total':c['count'],'status':states,'logTail':lines}))`, c)));
  await fs.writeFile(path.join(auditFolder, 'status.json'), JSON.stringify({ checkedAt: new Date().toISOString(), rows }, null, 2) + '\n');
  rows.forEach(r => console.log(JSON.stringify(r)));
}

try {
  const mode = process.argv[2];
  if (mode === '--prepare') await prepare();
  else if (mode === '--start' || mode === '--status') {
    const m = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (mode === '--start') await start(m); else await status(m);
  } else throw new Error('Use --prepare, --start or --status. --start is intentionally not a resume command.');
} finally { pool.close(); }
