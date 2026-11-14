const fs = require('fs');
const path = require('path');
const { closeExtraPages } = require('./managedBrowser');
const MAX_STATE_BYTES = 2 * 1024 * 1024;
function boundedState(state) {
  const cookies = Array.isArray(state?.cookies) ? state.cookies.filter(cookie => Buffer.byteLength(JSON.stringify(cookie)) <= 16384).slice(0, 200) : [];
  const origins = [];
  for (const origin of Array.isArray(state?.origins) ? state.origins : []) {
    if (!/^https?:\/\//.test(origin.origin || '')) continue;
    const localStorage = []; let bytes = 0;
    for (const entry of Array.isArray(origin.localStorage) ? origin.localStorage : []) {
      if (typeof entry.name !== 'string' || typeof entry.value !== 'string') continue;
      const size = Buffer.byteLength(entry.name + entry.value);
      if (size > 65536 || bytes + size > 262144) continue;
      localStorage.push({ name: entry.name, value: entry.value }); bytes += size;
    }
    if (localStorage.length) origins.push({ origin: origin.origin, localStorage });
    if (origins.length === 4) break;
  }
  const result = { cookies, origins };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_STATE_BYTES) return { cookies: cookies.slice(0, 50), origins: [] };
  return result;
}
function browserLifecycleError(error) {
  return error?.code === 'browser_lifecycle' || /(?:target (?:page|context|browser).*closed|browser.*(?:disconnected|closed)|page closed before saving|context cleanup|context.*has been closed)/i.test(error?.message || '');
}
function deadline(promise, ms, label, onLate) {
  let expired = false, timer;
  const task = Promise.resolve(promise).then(value => { if (expired) { onLate?.(value); throw Object.assign(new Error(label), { code: 'browser_lifecycle' }); } return value; });
  return Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(Object.assign(new Error(label), { code: 'browser_lifecycle' })); }, ms); })]).finally(() => clearTimeout(timer));
}
class SharedBrowserPool {
  constructor({ browserCount = 2, concurrency = 4, stateDir, headless = false, resources = 'cache',
    contextTimeout = 30000, launch = options => require('playwright').chromium.launch(options), logger = console.log } = {}) {
    if (![browserCount, concurrency].every(value => Number.isInteger(value) && value > 0) || browserCount > concurrency) throw new Error('Use positive browser/concurrency counts with browsers <= concurrency.');
    if (!['block-media', 'block-assets', 'cache'].includes(resources)) throw new Error('Resources must be block-media or cache (block-assets is a legacy alias for block-media).');
    this.slots = Array.from({ length: browserCount }, (_, id) => ({ id, browser: null, active: 0, generation: 0, retiring: false }));
    Object.assign(this, { concurrency, stateDir, headless, resources, launch, logger, contextTimeout });
    this.queue = []; this.active = new Set(); this.owners = new Set(); this.closed = false; this.draining = false;
  }
  loadState(file, owner) {
    if (!file || !fs.existsSync(file)) return null;
    try {
      if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Session state must not be a symbolic link.');
      const size = fs.statSync(file).size;
      if (size > MAX_STATE_BYTES) {
        const backup = `${file}.oversized-${Date.now()}.bak`;
        fs.renameSync(file, backup);
        this.logger(`[Browser pool] Preserved oversized ${owner} state (${size} bytes) at ${backup}; starting a fresh context.`);
        return null;
      }
      return boundedState(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (error) {
      if (fs.lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) throw error;
      if (fs.existsSync(file)) fs.renameSync(file, `${file}.invalid-${Date.now()}.bak`);
      this.logger(`[Browser pool] Preserved invalid ${owner} state; starting a fresh context.`); return null;
    }
  }
  acquire(owner, stateKey = owner) {
    if (!/^[a-z0-9_-]+$/i.test(owner) || !/^[a-z0-9_-]+$/i.test(stateKey)) return Promise.reject(new Error('Invalid browser session identity.'));
    if (this.closed) return Promise.reject(new Error('Browser pool is closed.'));
    return new Promise((resolve, reject) => { this.queue.push({ owner, stateKey, resolve, reject }); this.kick(); });
  }
  kick() { if (!this.draining && !this.closed) this.drainTask = this.drain(); }
  async drain() {
    if (this.draining || this.closed) return;
    this.draining = true;
    try {
      while (!this.closed && this.queue.length && this.active.size < this.concurrency) {
        const slot = this.slots.filter(slot => !slot.retiring).sort((a, b) => a.active - b.active)[0];
        if (!slot) break;
        const task = this.queue.shift();
        if (this.owners.has(task.owner)) { task.reject(new Error(`A context for ${task.owner} is already active.`)); continue; }
        let context, stateFile, storageState;
        try {
          stateFile = this.stateDir ? path.join(this.stateDir, `${task.stateKey}.json`) : null;
          storageState = this.loadState(stateFile, task.owner);
          if (!slot.browser || !slot.browser.isConnected()) {
            slot.browser = await this.launch({ headless: this.headless, channel: 'chrome' }); slot.generation++;
            const browser = slot.browser;
            browser.on?.('disconnected', () => { if (!this.closed) this.logger(`[Browser pool] Browser slot ${slot.id} generation ${slot.generation} disconnected; affected scrapers: ${[...this.active].filter(l => l.browser === browser).map(l => l.owner).join(', ') || 'context creation'}.`); });
          }
          if (this.closed) throw new Error('Browser pool is closed.');
          context = await deadline(slot.browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', ...(storageState ? { storageState } : {}) }), this.contextTimeout,
            `Browser context creation timed out for ${task.owner}.`, late => late.close().catch(() => {}));
          if (this.resources !== 'cache') await context.route('**/*', route => route.request().resourceType() === 'media' ? route.abort() : route.continue());
          const page = await context.newPage();
          context.on('page', opened => { if (context.pages().length > 2) Promise.resolve().then(() => opened.close()).catch(() => {}); });
          if (this.closed) throw new Error('Browser pool is closed.');
          const lease = { owner: task.owner, context, page, slot, browser: slot.browser, stateFile, released: false };
          this.active.add(lease); this.owners.add(task.owner); slot.active++;
          task.resolve({ page, context, release: () => this.release(lease), clean: async () => {try{return await closeExtraPages(context,page);}catch(error){error.code='browser_lifecycle';throw error;}}, healthy: () => !page.isClosed() && lease.browser.isConnected() });
        } catch (error) {
          await context?.close().catch(() => {});
          if (storageState && stateFile && fs.existsSync(stateFile) && browserLifecycleError(error)) {
            fs.renameSync(stateFile, `${stateFile}.restore-failed-${Date.now()}.bak`);
            this.logger(`[Browser pool] Preserved failed ${task.owner} session state; the next context starts fresh.`);
          }
          if (error.code === 'browser_lifecycle' && /timed out/.test(error.message)) { slot.retiring = true; if (!slot.active) await this.retire(slot); }
          task.reject(error);
        }
      }
    } finally { this.draining = false; }
  }
  async saveState(lease) {
    // Do not serialize IndexedDB/ad caches. Read only a bounded amount of localStorage from the main origin.
    let state;
    if (lease.context.cookies && lease.page.evaluate) {
      const cookies = await lease.context.cookies();
      const origin = await lease.page.evaluate(() => {
        if (!/^https?:$/.test(location.protocol)) return null;
        const localStorage = []; let bytes = 0;
        for (let i = 0; i < window.localStorage.length; i++) {
          const name = window.localStorage.key(i), value = window.localStorage.getItem(name);
          if (name.length + value.length > 32768 || bytes + name.length + value.length > 131072) continue;
          localStorage.push({ name, value }); bytes += name.length + value.length;
        }
        return { origin: location.origin, localStorage };
      });
      state = boundedState({ cookies, origins: origin ? [origin] : [] });
    } else state = boundedState(await lease.context.storageState());
    fs.mkdirSync(path.dirname(lease.stateFile), { recursive: true, mode: 0o700 });
    const temporary = `${lease.stateFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 }); fs.renameSync(temporary, lease.stateFile);
  }
  async retire(slot) {
    const browser = slot.browser;
    if (slot.active && !this.closed) return;
    await deadline(browser?.close(), 5000, 'Browser retirement timed out').catch(() => {});
    if (slot.browser === browser) { slot.browser = null; slot.retiring = false; }
  }
  async release(lease) {
    if (lease.released) return;
    lease.released = true;
    try {
      if (lease.stateFile && !this.closed && lease.browser.isConnected() && !lease.page.isClosed()) await deadline(this.saveState(lease), 5000, 'Session-state save timed out');
    } catch (error) { this.logger(`[Browser pool] Could not save ${lease.owner} session state: ${error.message}`); }
    finally {
      try { await deadline(lease.context.close(), 5000, 'Context cleanup timed out'); }
      catch (error) {
        this.logger(`[Browser pool] Context cleanup failed for ${lease.owner}; waiting for sibling leases before retiring its browser.`);
        if (lease.slot.browser === lease.browser) lease.slot.retiring = true;
      }
      this.active.delete(lease); this.owners.delete(lease.owner); lease.slot.active--;
      if (lease.slot.retiring && !lease.slot.active) await this.retire(lease.slot);
      this.kick();
    }
  }
  stats() {
    return { browser_instances: this.slots.filter(slot => slot.browser?.isConnected()).length, active_contexts: this.active.size, queued_contexts: this.queue.length,
      pages: [...this.active].map(lease => ({ scraper: lease.owner, count: lease.context.pages().length, browser_slot: lease.slot.id, browser_generation: lease.slot.generation })), node_rss_bytes: process.memoryUsage().rss, resources: this.resources };
  }
  async close() {
    this.closed = true;
    for (const task of this.queue.splice(0)) task.reject(new Error('Browser pool is closed.'));
    await this.drainTask;
    await Promise.allSettled([...this.active].map(lease => this.release(lease)));
    await Promise.allSettled(this.slots.map(slot => this.retire(slot)));
  }
}
module.exports = { SharedBrowserPool, boundedState, browserLifecycleError, MAX_STATE_BYTES };
