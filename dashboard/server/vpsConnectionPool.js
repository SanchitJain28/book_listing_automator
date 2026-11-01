import { Client } from 'ssh2';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
const execFileAsync = promisify(execFile);
export async function trustedKeys(host) {
  let stdout;
  try { ({ stdout } = await execFileAsync('ssh-keygen', ['-F', host, '-f', path.join(os.homedir(), '.ssh/known_hosts')], { timeout: 5000 })); }
  catch { throw new Error('SSH host key is not trusted. Verify this server in your terminal first.'); }
  const lines = stdout.split('\n').filter(line => line && !line.startsWith('#'));
  if (lines.some(line => line.startsWith('@revoked'))) throw new Error('SSH host key is revoked.');
  const keys = lines.filter(line => !line.startsWith('@')).map(line => Buffer.from(line.trim().split(/\s+/)[2] || '', 'base64')).filter(key => key.length);
  if (!keys.length) throw new Error('No supported trusted SSH host key was found.');
  return keys;
}
export class VpsConnectionPool {
  constructor({ createClient = () => new Client(), loadKeys = trustedKeys, idleMs = 600000, maxChannels = 4, now = Date.now, onState = () => {} } = {}) {
    Object.assign(this, { createClient, loadKeys, idleMs, maxChannels, now, onState });
    this.entries = new Map(); this.closed = false;
    this.timer = setInterval(() => this.sweep(), 30000); this.timer.unref();
  }
  entry(server) {
    const key = createHash('sha256').update(`${server.ip}\0${server.password}`).digest('hex');
    let entry = this.entries.get(server.id);
    if (entry && entry.key !== key) { entry.retired = true; entry.client?.end(); this.entries.delete(server.id); entry = null; }
    if (!entry) { entry = { id: server.id, key, state: 'Disconnected', lastUsed: this.now(), active: 0, queue: [], failures: 0, retryAt: 0 }; this.entries.set(server.id, entry); }
    return entry;
  }
  state(id) { const e = this.entries.get(id); return { state: e?.state || 'Disconnected', error: e?.error || null, retry_at: e?.retryAt || null }; }
  publish(e, state, error = null) { e.state = state; e.error = error; this.onState(e.id, this.state(e.id)); }
  async ready(server, e) {
    if (this.closed) throw new Error('VPS connection manager is closed.');
    if (e.state === 'Connected') return e.client;
    if (e.connecting) return e.connecting;
    if (e.state === 'Authentication failed' || e.state === 'Host key rejected') throw new Error(e.error);
    if (e.retryAt > this.now()) throw new Error('SSH reconnect backoff is active. Retrying shortly.');
    this.publish(e, e.failures ? 'Reconnecting' : 'Connecting');
    e.connecting = (async () => {
      let keys;
      try { keys = await this.loadKeys(server.ip); }
      catch (error) { this.publish(e, 'Host key rejected', error.message); throw error; }
      if (this.closed) throw new Error('VPS connection manager is closed.');
      const client = this.createClient(); e.client = client;
      return new Promise((resolve, reject) => {
        let settled = false, rejectedKey = false;
        const fail = error => {
          if (e.client !== client || e.retired) return;
          const auth = error?.level === 'client-authentication';
          e.failures++; e.retryAt = this.now() + Math.min(60000, 1000 * 2 ** Math.min(e.failures, 6)) + Math.floor(Math.random() * 500);
          this.publish(e, rejectedKey ? 'Host key rejected' : auth ? 'Authentication failed' : 'Disconnected', rejectedKey ? 'SSH host key changed or is not trusted.' : auth ? 'SSH authentication failed. Check the configured credentials.' : 'SSH connection interrupted. Waiting to reconnect.');
          if (!settled) { settled = true; reject(new Error(e.error)); }
        };
        client.once('ready', () => { if (settled || this.closed) { client.end(); return; } settled = true; e.failures = 0; e.retryAt = 0; this.publish(e, 'Connected'); resolve(client); });
        client.on('error', fail);
        client.once('close', () => { if (!['Authentication failed', 'Host key rejected'].includes(e.state)) fail(new Error('closed')); });
        client.connect({ host: server.ip, username: 'root', password: server.password, readyTimeout: 15000, keepaliveInterval: 15000, keepaliveCountMax: 3,
          hostVerifier: key => { const ok = keys.some(trusted => trusted.equals(key)); if (!ok) rejectedKey = true; return ok; } });
      });
    })().finally(() => { e.connecting = null; });
    return e.connecting;
  }
  async exec(server, command, input, { timeout = 120000, maxBytes = 3000000 } = {}) {
    const e = this.entry(server); e.lastUsed = this.now();
    if (e.queue.length >= 20) throw new Error('VPS command queue is full.');
    if (e.active >= this.maxChannels) await new Promise((resolve, reject) => e.queue.push({ resolve, reject }));
    else e.active++;
    try {
      const client = await this.ready(server, e);
      return await new Promise((resolve, reject) => {
        let channel, out = '', stderr = '', bytes = 0, done = false;
        const finish = (error, value) => { if (done) return; done = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
        const timer = setTimeout(() => { finish(new Error('VPS command timed out. Its remote outcome may be unknown; refresh status before retrying.')); channel?.close(); }, timeout);
        client.exec(command, (error, stream) => {
          if (error) return finish(new Error('Could not open an SSH command channel. Refresh status before retrying an action.'));
          channel = stream; if (done) { stream.close(); return; }
          stream.on('error', () => finish(new Error('SSH command interrupted; remote action outcome is unknown. Refresh status before retrying.')));
          stream.on('data', data => { bytes += data.length; if (bytes > maxBytes) { finish(new Error('VPS response exceeded the size limit.')); stream.close(); } else out += data.toString(); });
          stream.stderr.on('data', data => { if (stderr.length < 4000) stderr += data.toString(); });
          stream.once('close', (code, signal) => { if (code == null) finish(new Error('SSH channel closed without an exit status. Refresh status before retrying an action.')); else finish(null, { stdout: out, stderr, code, signal }); });
          stream.end(input);
        });
      });
    } finally { e.lastUsed = this.now(); const waiter=e.queue.shift(); if(waiter)waiter.resolve();else e.active--; }
  }
  reset(server) { const e=this.entries.get(server.id); if(e && e.state!=='Connected' && !e.active && !e.connecting) {e.retired=true;e.client?.end();this.entries.delete(server.id);} }
  sweep() { for (const [id, e] of this.entries) if (!e.active && !e.queue.length && !e.connecting && this.now() - e.lastUsed > this.idleMs) { e.retired=true; e.client?.end(); this.entries.delete(id); this.onState(id, { state: 'Disconnected', error: null }); } }
  close() { this.closed = true; clearInterval(this.timer); for (const e of this.entries.values()) { e.retired=true; for (const waiter of e.queue) waiter.reject(new Error('VPS backend closed.')); e.queue = []; e.client?.end(); } this.entries.clear(); }
}
let sharedPool;
export function getConnectionPool() { if (!sharedPool || sharedPool.closed) sharedPool = new VpsConnectionPool(); return sharedPool; }
