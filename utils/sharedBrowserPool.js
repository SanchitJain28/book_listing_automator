const fs = require('fs');
const path = require('path');
const { closeExtraPages } = require('./managedBrowser');

class SharedBrowserPool {
  constructor({ browserCount = 2, concurrency = 4, stateDir, headless = true, resources = 'block-assets',
    launch = options => require('playwright').chromium.launch(options), logger = console.log } = {}) {
    if (![browserCount, concurrency].every(value => Number.isInteger(value) && value > 0) || browserCount > concurrency) throw new Error('Use positive browser/concurrency counts with browsers <= concurrency.');
    if (!['block-assets', 'cache'].includes(resources)) throw new Error('Resources must be block-assets or cache.');
    this.slots = Array.from({ length: browserCount }, () => ({ browser: null, active: 0 }));
    Object.assign(this, { concurrency, stateDir, headless, resources, launch, logger });
    this.queue = []; this.active = new Set(); this.owners = new Set(); this.closed = false; this.draining = false;
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
        const task = this.queue.shift();
        if (this.owners.has(task.owner)) { task.reject(new Error(`A context for ${task.owner} is already active.`)); continue; }
        const slot = [...this.slots].sort((a, b) => a.active - b.active)[0];
        let context;
        try {
          if (!slot.browser || !slot.browser.isConnected()) slot.browser = await this.launch({ headless: this.headless });
          if (this.closed) throw new Error('Browser pool is closed.');
          const stateFile = this.stateDir ? path.join(this.stateDir, `${task.stateKey}.json`) : null;
          context = await slot.browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata',
            ...(stateFile && fs.existsSync(stateFile) ? { storageState: stateFile } : {}) });
          if (this.resources === 'block-assets') await context.route('**/*', route => ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue());
          const page = await context.newPage();
          context.on('page', opened => {
            if (context.pages().length > 2) Promise.resolve().then(() => opened.close()).catch(() => {});
          });
          if (this.closed) throw new Error('Browser pool is closed.');
          const lease = { owner: task.owner, context, page, slot, browser: slot.browser, stateFile, released: false };
          this.active.add(lease); this.owners.add(task.owner); slot.active++;
          task.resolve({ page, context, release: () => this.release(lease), clean: () => closeExtraPages(context, page) });
        } catch (error) { await context?.close().catch(() => {}); task.reject(error); }
      }
    } finally { this.draining = false; }
  }
  async release(lease) {
    if (lease.released) return;
    lease.released = true;
    try {
      if (lease.stateFile && !this.closed && lease.browser.isConnected()) {
        fs.mkdirSync(path.dirname(lease.stateFile), { recursive: true, mode: 0o700 });
        const state = await lease.context.storageState({ indexedDB: true });
        const temporary = `${lease.stateFile}.${process.pid}.tmp`;
        fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 }); fs.renameSync(temporary, lease.stateFile);
      }
    } catch (error) { this.logger(`[Browser pool] Could not save ${lease.owner} session state: ${error.message}`); }
    finally {
      try { await lease.context.close(); }
      catch (error) {
        this.logger(`[Browser pool] Context cleanup failed for ${lease.owner}; retiring its browser.`);
        await lease.browser.close().catch(() => {});
        if (lease.slot.browser === lease.browser) lease.slot.browser = null;
      }
      this.active.delete(lease); this.owners.delete(lease.owner); lease.slot.active--;
      this.kick();
    }
  }
  stats() {
    return { browser_instances: this.slots.filter(slot => slot.browser?.isConnected()).length, active_contexts: this.active.size, queued_contexts: this.queue.length,
      pages: [...this.active].map(lease => ({ scraper: lease.owner, count: lease.context.pages().length })), node_rss_bytes: process.memoryUsage().rss, resources: this.resources };
  }
  async close() {
    this.closed = true;
    for (const task of this.queue.splice(0)) task.reject(new Error('Browser pool is closed.'));
    await this.drainTask;
    await Promise.allSettled([...this.active].map(lease => this.release(lease)));
    await Promise.allSettled(this.slots.filter(slot => slot.browser).map(slot => slot.browser.close()));
  }
}
module.exports = { SharedBrowserPool };
