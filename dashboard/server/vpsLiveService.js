import fs from 'node:fs/promises';
import path from 'node:path';
import { sanitize } from './vpsSanitize.js';
export class VpsLiveService {
  constructor(root, operate, getConnectionState = () => ({ state: 'Disconnected' })) {
    Object.assign(this, { root, operate, getConnectionState }); this.cache = new Map(); this.activity = new Map(); this.clients = new Set(); this.closed = false; this.lastActivities=new Map();this.historyLoads=new Map();this.connectionListeners=new Map();
  }
  async secrets(server) {
    let text = ''; try { text = await fs.readFile(path.join(this.root, '.env'), 'utf8'); } catch {}
    return [server.password, ...text.split('\n').filter(line => /^\s*[^#=]+=/i.test(line)).map(line => line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')).filter(value => value.length >= 4)];
  }
  async record(server, event, message, level = 'info') {
    const dedup=`${server.id}:${event}:${message}`;if(Date.now()-(this.lastActivities.get(dedup)||0)<30000)return;this.lastActivities.set(dedup,Date.now());if(this.lastActivities.size>1000)this.lastActivities.delete(this.lastActivities.keys().next().value);
    const row = sanitize({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, timestamp: new Date().toISOString(), event, level, message }, await this.secrets(server));
    await this.history(server);
    const entries = this.activity.get(server.id) || []; entries.push(row); this.activity.set(server.id, entries.slice(-200));
    const folder = path.join(this.root, 'logs/vps-activity'); const file = path.join(folder, `${server.id}.jsonl`);
    try { await fs.mkdir(folder, { recursive: true }); const stat = await fs.stat(file).catch(() => null); if (stat?.size > 10 * 1024 * 1024) { await fs.rm(file + '.1', { force: true }); await fs.rename(file, file + '.1'); } await fs.appendFile(file, JSON.stringify(row) + '\n', { mode: 0o600 }); } catch { /* Read-side monitoring remains available if local disk is unavailable. */ }
  }
  async history(server) {
    if(this.activity.has(server.id))return this.activity.get(server.id);
    if(this.historyLoads.has(server.id))return this.historyLoads.get(server.id);
    const pending=(async()=>{
      let rows=[];
      try {const handle=await fs.open(path.join(this.root,'logs/vps-activity',`${server.id}.jsonl`));try{const stat=await handle.stat();const buffer=Buffer.alloc(Math.min(stat.size,65536));await handle.read(buffer,0,buffer.length,Math.max(0,stat.size-buffer.length));rows=buffer.toString().split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});}finally{await handle.close();}}catch{}
      this.activity.set(server.id,rows.slice(-200));return this.activity.get(server.id);
    })().finally(()=>this.historyLoads.delete(server.id));
    this.historyLoads.set(server.id,pending);return pending;
  }
  connectionChanged(id,state) { for(const {ids,send} of this.connectionListeners.values())if(ids.includes(id))send('connection',{server:id,...state}); }
  async run(server, request, force = false) {
    if (request.op === 'activity') return { entries: await this.history(server) };
    const cache = this.cache.get(server.id) || {};
    if (request.op === 'status') {
      if (cache.pending) return cache.pending;
      if (!force && cache.value && Date.now() - cache.at < 9000) return cache.value;
      const pending = this.call(server, request).then(value => { this.cache.set(server.id, { value, at: Date.now() }); return value; }).finally(() => { const entry = this.cache.get(server.id); if (entry?.pending === pending) { delete entry.pending; } });
      this.cache.set(server.id, { ...cache, pending }); return pending;
    }
    const value = await this.call(server, request);
    if (!['files', 'logs'].includes(request.op)) this.cache.delete(server.id);
    return value;
  }
  async call(server, request) {
    const start = Date.now();
    try {
      const value = sanitize(await this.operate(this.root, server, request), await this.secrets(server));
      if (!['status', 'files', 'logs'].includes(request.op)) await this.record(server, request.op, value.message || `${request.op} completed`);
      else if (request.op === 'status') { const old = this.cache.get(server.id)?.value?.jobs || []; for (const job of value.jobs || []) { const previous = old.find(row => row.id === job.id); if (['Blocked', 'Failed'].includes(job.state) && (!previous || previous.state !== job.state)) await this.record(server, 'scraper_' + job.state.toLowerCase(), `${job.scraper}: ${job.failure?.message || job.pause_reason || 'Failure reason unavailable'}`, 'error'); } }
      value.request_ms = Date.now() - start; return value;
    } catch (error) { if (request.op !== 'logs') await this.record(server, request.op + '_failed', error.message, 'error'); throw new Error(sanitize(error.message, await this.secrets(server))); }
  }
  async stream(req, res, servers, url) {
    const ids = [...new Set((url.searchParams.get('servers') || '').split(',').filter(Boolean))];
    if (!ids.length || ids.some(id => !servers.some(server => server.id === id))) throw new Error('Choose configured VPS servers.');
    const selected = url.searchParams.get('selected');
    if (selected && !ids.includes(selected)) throw new Error('Selected VPS must be subscribed.');
    const attempt=url.searchParams.get('attempt')||'current';if(!/^[\w-]{1,100}$/.test(attempt))throw new Error('Invalid attempt.');
    const job = url.searchParams.get('job'), scraper = url.searchParams.get('scraper'), source = url.searchParams.get('source') || 'auto';
    if (job && (!/^[\w-]{1,100}$/.test(job) || !/^[-a-z0-9]{1,64}$/.test(scraper || '') || !['auto', 'events', 'console'].includes(source))) throw new Error('Invalid log subscription.');
    let cursor = req.headers['last-event-id']?.startsWith('log:') ? req.headers['last-event-id'].slice(4) : url.searchParams.get('cursor') || null;
    if (cursor && cursor.length > 1024) throw new Error('Invalid log cursor.');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    res.flushHeaders?.();
    const maxBufferBytes = 4 * 1024 * 1024;
    let closed = false, active = false, ticks = 0, drainWake = null, interval;
    const cleanup = () => { if (closed) return; closed = true; clearInterval(interval); drainWake?.(); res.end(); this.clients.delete(cleanup); this.connectionListeners.delete(cleanup); };
    const send = (event, data, id) => {
      if (closed) return true;
      if (res.writableLength > maxBufferBytes) { cleanup(); res.destroy?.(); return false; }
      return res.write(`${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const waitDrain = () => {
      if (closed || (!res.writableNeedDrain && !(res.writableLength > 65536))) return Promise.resolve();
      return new Promise(resolve => {
        let settled = false;
        const finish = (timedOut = false) => {
          if (settled) return;
          settled = true;
          if (drainWake === onDrain) drainWake = null;
          res.off?.('drain', onDrain);
          clearTimeout(timer);
          if (timedOut && res.writableLength > 256000) { cleanup(); res.destroy?.(); }
          resolve();
        };
        const onDrain = () => finish(false);
        drainWake = onDrain;
        const timer = setTimeout(() => finish(true), 2000);
        timer.unref?.();
        res.once?.('drain', onDrain);
      });
    };
    const tick = async () => {
      if (closed || active || this.closed) return; active = true;
      try {
        const ordered = selected ? [selected, ...ids.filter(id => id !== selected)] : ids;
        const cached = [], stale = [];
        for (const id of ordered) {
          const server = servers.find(item => item.id === id); const entry = this.cache.get(id);
          const refreshMs = id === selected ? 10000 : 30000;
          if (!entry?.value || Date.now() - entry.at >= refreshMs) stale.push(server);
          else cached.push({ id, data: entry.value });
        }
        const pendingStale = Promise.all(stale.map(async server => {
          try { const data = await this.run(server, { op: 'status' }); send('status', { server: server.id, data }); }
          catch (error) { send('connection', { server: server.id, ...this.getConnectionState(server.id), error: error.message }); }
          send('connection', { server: server.id, ...this.getConnectionState(server.id) });
        }));
        if (ticks === 0) {
          for (const item of cached) {
            if (closed) break;
            const ok = send('status', { server: item.id, data: item.data });
            send('connection', { server: item.id, ...this.getConnectionState(item.id) });
            if (!ok || res.writableLength > 65536) await waitDrain();
          }
        } else {
          for (const item of cached) send('connection', { server: item.id, ...this.getConnectionState(item.id) });
        }
        await pendingStale;
        const server = servers.find(item => item.id === selected);
        if (server && !closed) {
          send('activity', { server: selected, entries: await this.history(server) });
          if (job) try { const data = await this.run(server, { op: 'logs', job, scraper, source, cursor, attempt }); cursor = data.cursor || cursor; send('logs', { server: selected, job, data }, cursor ? 'log:' + cursor : null); } catch (error) { send('logs', { server: selected, job, data: { available: false, message: error.message, entries: [] } }); }
        }
        ticks++; if (!closed) res.write(': heartbeat\n\n');
      } finally { active = false; }
    };
    interval = setInterval(() => { void tick().catch(() => {}); }, 2000); interval.unref();
    req.on('close', cleanup); res.on('close', cleanup); res.on('error', cleanup); this.clients.add(cleanup); this.connectionListeners.set(cleanup, { ids, send });
    void tick().catch(() => { cleanup(); });
  }
  close() { this.closed = true; for (const cleanup of this.clients) cleanup(); this.clients.clear(); }
}
