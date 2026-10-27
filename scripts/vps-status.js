#!/usr/bin/env node
// Read-only VPS 6 status client. Credentials remain local to the SSH subprocess.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const info = path.join(root, 'VPSInfo.md');
const collector = path.join(__dirname, 'vps-status', 'collector.py');

function vps6Credentials(contents) {
  const section = contents.split(/^##\s+VPS\s+6\s*$/im)[1]?.split(/^##\s+VPS\s+\d+\s*$/im)[0];
  const host = section?.match(/^\s*-\s*IP\s*:\s*(\d{1,3}(?:\.\d{1,3}){3})\s*$/im)?.[1];
  const password = section?.match(/^\s*-\s*PASSWORD\s*:\s*(.*?)\s*$/im)?.[1]?.replace(/^`|`$/g, '');
  if (!host || !password) throw new Error('VPS 6 credentials are missing from VPSInfo.md.');
  if (host !== '200.234.32.63') throw new Error('VPS 6 address differs from the configured batch. Update the status configuration before connecting.');
  return { host, password };
}
function findSshpass() {
  for (const candidate of ['sshpass', '/opt/homebrew/bin/sshpass', '/usr/local/bin/sshpass', '/usr/bin/sshpass']) {
    if (candidate === 'sshpass') continue;
    try { fs.accessSync(candidate, fs.constants.X_OK); return candidate; } catch {}
  }
  return 'sshpass';
}
async function fetchStatus() {
  const { host, password } = vps6Credentials(fs.readFileSync(info, 'utf8'));
  const source = fs.readFileSync(collector, 'utf8');
  return new Promise((resolve, reject) => {
    let output = '', errors = '', settled = false;
    const child = spawn(findSshpass(), ['-e', 'ssh', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=10', '-o', 'NumberOfPasswordPrompts=1', `root@${host}`, 'python3', '-'],
      { env: { ...process.env, SSHPASS: password }, stdio: ['pipe', 'pipe', 'pipe'] });
    function fail(message) { if (!settled) { settled = true; clearTimeout(timer); reject(new Error(message)); } }
    const timer = setTimeout(() => { child.kill('SIGKILL'); fail('VPS status request timed out. Check the SSH connection.'); }, 40000);
    child.on('error', err => fail(err.code === 'ENOENT' ? 'sshpass or ssh is not installed. Install sshpass and ensure ssh is available.' : 'Could not start the SSH status check.'));
    child.stdin.on('error', () => {});
    child.stdout.on('data', data => { output += data; if (output.length > 2_000_000) { child.kill('SIGKILL'); fail('VPS status response was too large.'); } });
    child.stderr.on('data', data => { if (errors.length < 4000) errors += data; });
    child.on('close', code => {
      if (settled) return;
      if (code !== 0) {
        if (/host key verification failed|host key is not cached|authenticity of host/i.test(errors)) return fail('SSH host key is not trusted or has changed. Verify VPS 6’s host key in your terminal.');
        if (/permission denied|password/i.test(errors) || code === 5) return fail('SSH authentication failed. Check VPS 6 credentials or SSH access.');
        return fail('Could not reach VPS 6 or read the batch manifest. Check SSH access and the remote batch.');
      }
      try {
        const data = JSON.parse(output);
        if (!Array.isArray(data.scrapers)) throw new Error('Invalid response');
        settled = true; clearTimeout(timer); resolve(data);
      } catch { fail('VPS returned an invalid status response.'); }
    });
    child.stdin.end(source);
  });
}
if (require.main === module) fetchStatus().then(data => {
  if (process.argv.includes('--json')) console.log(JSON.stringify(data));
  else {
    console.log(`${data.vps} · ${data.input} · checked ${data.checked_at}`);
    console.table(data.scrapers.map(row => ({ scraper: row.name, status: row.state, progress: `${row.processed}/${row.total}`, matched: row.counts.matched, blocked: row.counts.blocked, errors: row.counts.errors, not_listed: row.counts.not_listed })));
    if (data.memory) console.log(`Available RAM: ${(data.memory.available_bytes / 1024 ** 3).toFixed(1)} GiB; swap used: ${(data.memory.swap_used_bytes / 1024 ** 3).toFixed(1)} GiB.`);
  }
}).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { fetchStatus, vps6Credentials, findSshpass };
