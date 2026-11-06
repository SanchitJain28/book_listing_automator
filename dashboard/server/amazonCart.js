import fs from 'node:fs/promises';
import path from 'node:path';
import { fork } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { sanitize } from './vpsSanitize.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const active = session => session && !['completed', 'stopped', 'failed'].includes(session.status);
const publicData = value => {
  if (Array.isArray(value)) return value.map(publicData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/^(offerId|productUrl|password|cookie|token|apiKey|credentials)$/i.test(key))
    .map(([key, item]) => [key, publicData(item)]));
  return typeof value === 'string' ? sanitize(value).replace(/([?&](?:oid|key|token|offerlistingid)=)[^&\s]+/gi, '$1[REDACTED]') : value;
};

export class AmazonCartService extends EventEmitter {
  constructor(root, options = {}) {
    super();
    this.root = root;
    this.spawn = options.fork || fork;
    this.killGroup = options.killGroup || ((pid, signal) => process.kill(process.platform === 'win32' ? pid : -pid, signal));
    this.session = null;
    this.child = null;
    this.stopTimer = null;
    this.launching = false;
    this.version = 0;
  }
  snapshot() { return { version: this.version, session: this.session ? structuredClone(this.session) : null }; }
  changed() { this.version++; this.emit('change'); }
  async catalog() {
    const directory = path.join(this.root, 'sheet_configs');
    const files = (await fs.readdir(directory)).filter(name => name.endsWith('.json'));
    const entries = await Promise.all(files.map(async file => {
      try {
        const config = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'));
        if (!config.tabName || !Array.isArray(config.items)) return null;
        return { file, name: config.tabName, total: config.items.length, cursor: config.latestCursor?.batchNumber ?? null,
          startRow: config.latestCursor?.sheetRowNumber ?? null };
      } catch { return null; }
    }));
    return entries.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  }
  async start(body) {
    if (this.launching || active(this.session)) throw fail('An Amazon session is already open. Stop it before starting another.', 409);
    this.launching = true;
    try {
      if (!['1', '2'].includes(String(body.profile))) throw fail('Choose Profile 1 or Profile 2.');
      if (!['manual', 'auto', 'login'].includes(body.mode)) throw fail('Choose manual, auto, or sign-in mode.');
      if (body.cursor && !/^[1-9]\d{0,5}$/.test(String(body.cursor))) throw fail('Cursor must be a positive batch number.');
      const tabs = await this.catalog();
      const tab = tabs.find(item => item.file === body.config);
      if (body.mode !== 'login' && !tab) throw fail('Choose a listed sheet tab.');
      const args = [`--profile=${body.profile}`, '--dashboard'];
      if (body.mode === 'login') args.push('--login');
      else {
        args.push(`--config=${path.join(this.root, 'sheet_configs', tab.file)}`);
        if (body.cursor) args.push(`--cursor=${body.cursor}`);
        if (body.mode === 'auto') args.push('--auto');
      }
      this.session = { id: randomUUID(), status: 'starting', phase: body.mode === 'login' ? 'Opening Amazon sign-in' : 'Reading PO ISBNs',
        profile: String(body.profile), mode: body.mode, tabName: tab?.name || 'Amazon sign-in', startedAt: new Date().toISOString(),
        configuration: null, account: null, book: null, evaluation: null, prompt: null,
        records: [], logs: [], processed: 0, added: 0, review: 0, batchAdded: 0, error: null };
      const child = this.spawn(path.join(this.root, 'scripts', 'amazon-cart-automator.js'), args, {
        cwd: this.root, execArgv: [], detached: process.platform !== 'win32',
        env: { ...process.env, FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      this.child = child;
      this.session.pid = child.pid;
      const sessionId = this.session.id;
      const current = () => this.session?.id === sessionId;
      const logStream = (stream, level) => {
        let buffer = '';
        stream?.setEncoding('utf8');
        stream?.on('data', chunk => {
          if (!current()) return;
          buffer += chunk;
          const lines = buffer.split(/\r?\n/); buffer = lines.pop();
          for (const line of lines) this.log(line, level);
          if (buffer.length > 8192) { this.log(buffer.slice(0, 8192), level); buffer = ''; }
        });
        stream?.on('end', () => { if (current() && buffer) this.log(buffer, level); });
      };
      logStream(child.stdout, 'info'); logStream(child.stderr, 'warning');
      child.on('message', message => { if (current()) this.onMessage(message); });
      child.on('error', error => {
        if (!current()) return;
        this.session.status = 'failed'; this.session.error = error.message; this.session.prompt = null; this.changed();
      });
      child.on('exit', (code, signal) => {
        if (!current()) return;
        clearTimeout(this.stopTimer);
        this.child = null;
        this.session.prompt = null;
        this.session.status = this.session.status === 'stopping' ? 'stopped' : code === 0 ?
          this.session.finished === false ? 'stopped' : 'completed' : 'failed';
        this.session.endedAt = new Date().toISOString();
        if (this.session.status === 'failed' && !this.session.error) this.session.error = `Session exited (${signal || code}). See live activity for details.`;
        this.changed();
      });
      this.changed();
      return this.snapshot();
    } catch (error) {
      if (this.session?.status === 'starting' && !this.child) {
        this.session.status = 'failed'; this.session.error = error.message; this.changed();
      }
      throw error;
    } finally { this.launching = false; }
  }
  log(line, level) {
    const message = publicData(line).slice(0, 8192);
    if (!message.trim()) return;
    this.session.logs.push({ id: randomUUID(), time: new Date().toISOString(), level, message });
    this.session.logs = this.session.logs.slice(-300);
    this.changed();
  }
  onMessage(message) {
    if (!active(this.session) || message?.type !== 'amazon-cart') return;
    const data = publicData(message.data || {});
    switch (message.event) {
      case 'configuration': this.session.configuration = data; this.session.phase = 'Opening saved browser profile'; break;
      case 'account': this.session.account = data; break;
      case 'book': if (!['pausing', 'paused', 'stopping'].includes(this.session.status)) this.session.status = 'running'; this.session.book = data; this.session.evaluation = null; this.session.phase = 'Searching and evaluating offers'; this.session.batchAdded = data.cartItemsThisBatch; break;
      case 'evaluation': this.session.evaluation = data; this.session.phase = 'Evaluation complete'; break;
      case 'phase': this.session.phase = data.phase; break;
      case 'prompt': this.session.prompt = { ...data, id: `${this.session.id}:${data.id}`, childId: data.id };
        this.session.status = 'waiting'; this.session.phase = 'Waiting for your decision'; break;
      case 'state': if (['running', 'paused', 'pausing', 'stopping'].includes(data.status) && this.session.status !== 'stopping') this.session.status = data.status; break;
      case 'record':
        this.session.evaluation = data;
        this.session.records.unshift(Object.fromEntries(['isbn', 'sheetRowNumber', 'expectedTitle', 'status', 'reason', 'cartAddedSuccess', 'userConfirmedAddToCart', 'timestamp'].map(key => [key, data[key]])));
        this.session.records = this.session.records.slice(0, 100);
        this.session.processed++; this.session.added += data.cartAddedSuccess ? 1 : 0;
        this.session.review += data.reason === 'FOR REVIEW' ? 1 : 0; this.session.batchAdded = data.cartItemsThisBatch; this.session.phase = 'Book recorded'; break;
      case 'failure': this.session.error = data.message; break;
      case 'finished': this.session.finished = data.completed; break;
      default: return;
    }
    this.changed();
  }
  reply(body) {
    const prompt = this.session?.prompt;
    if (!this.child?.connected || !prompt || body.sessionId !== this.session.id || body.promptId !== prompt.id) throw fail('This prompt has changed. Use the current controls.', 409);
    const value = body.value;
    if (typeof value !== 'string' || value.length > 4000 || /[\r\n\0]/.test(value)) throw fail('Enter a single response of at most 4,000 characters.');
    const upper = value.trim().toUpperCase();
    const valid = prompt.kind === 'command' ? /^(?:START|RESET|LOGIN|QUIT|GOTO \d{1,13}[Xx]?)$/.test(upper) :
      prompt.kind === 'add' ? ['YES', 'NO'].includes(upper) :
      prompt.kind === 'next' ? ['', 'RETRY', 'MENU', 'QUIT'].includes(upper) :
      prompt.kind === 'batch' ? ['', 'QUIT'].includes(upper) : prompt.kind === 'continue' ? value === '' : prompt.kind === 'feedback';
    if (!valid) throw fail('Choose one of the actions offered for this prompt.');
    this.child.send({ type: 'dashboard:reply', id: prompt.childId, value });
    this.session.prompt = null; this.session.status = 'running'; this.changed();
    return this.snapshot();
  }
  control(body) {
    if (!this.child || !active(this.session) || body.sessionId !== this.session.id) throw fail('No matching running session.', 409);
    if (body.op === 'stop') return this.stop();
    if (!['pause', 'resume'].includes(body.op)) throw fail('Unknown session action.');
    if (this.session.prompt || this.session.status === 'stopping') throw fail('Answer the current prompt before changing the session state.', 409);
    if (body.op === 'resume' && !['paused', 'pausing'].includes(this.session.status)) throw fail('Session is not paused.', 409);
    this.child.send({ type: `dashboard:${body.op}` });
    this.session.status = body.op === 'pause' ? 'pausing' : 'running'; this.changed();
    return this.snapshot();
  }
  stop() {
    if (!this.child || !active(this.session)) return this.snapshot();
    const child = this.child;
    this.session.status = 'stopping'; this.session.prompt = null;
    child.kill('SIGTERM');
    this.stopTimer = setTimeout(() => { try { this.killGroup(child.pid, 'SIGKILL'); } catch {} }, 6000);
    this.stopTimer.unref?.();
    this.changed(); return this.snapshot();
  }
  close() { this.stop(); this.removeAllListeners(); }
}

export function amazonCartMiddleware(service) {
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!['/api/amazon-cart', '/api/amazon-cart/events'].includes(url.pathname)) return next();
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const host = req.headers.host || '';
      if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) || req.headers['sec-fetch-site'] === 'cross-site' ||
          (req.headers.origin && req.headers.origin !== `http://${host}`)) throw fail('Use the local dashboard for Amazon sessions.', 403);
      if (url.search) throw fail('Unexpected query parameters.');
      if (url.pathname.endsWith('/events')) {
        if (req.method !== 'GET') throw fail('Use GET for session updates.');
        res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders?.();
        let timer;
        const send = () => {
          clearTimeout(timer); timer = null;
          if (!res.write(`event: snapshot\ndata: ${JSON.stringify(service.snapshot())}\n\n`)) res.end();
        };
        const change = () => { if (!timer) timer = setTimeout(send, 150); };
        const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 15000);
        service.on('change', change); send();
        res.on('close', () => { clearTimeout(timer); clearInterval(heartbeat); service.off('change', change); });
        return;
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (req.method === 'GET') return res.end(JSON.stringify({ tabs: await service.catalog(), ...service.snapshot() }));
      if (req.method !== 'POST' || req.headers.origin !== `http://${host}` || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw fail('Submit actions from the local Amazon tab.', 403);
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 8192) throw fail('Request too large.', 413); }
      const body = JSON.parse(raw);
      const result = body.op === 'start' ? await service.start(body) : body.op === 'reply' ? service.reply(body) : service.control(body);
      res.end(JSON.stringify(result));
    } catch (error) { res.statusCode = error.status || 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: error.message || 'Amazon session action failed.' })); }
  };
}

export function amazonCartPlugin(root) {
  const install = server => {
    const service = new AmazonCartService(root);
    server.middlewares.use(amazonCartMiddleware(service));
    server.httpServer?.once('close', () => service.close());
  };
  return { name: 'local-amazon-cart', configureServer: install, configurePreviewServer: install };
}
