const DEFAULTS = Object.freeze({ minDelayMs: 2000, maxDelayMs: 5000, backoffBaseMs: 30000, backoffMaxMs: 300000, blockLimit: 3, cooldownMs: 300000 });
const SLOW_DEFAULTS = Object.freeze({ minDelayMs: 4000, maxDelayMs: 10000, backoffBaseMs: 60000, backoffMaxMs: 600000, blockLimit: 1, cooldownMs: 1800000 });
function retryAfterMs(value, now = Date.now()) {
  if (value === undefined || value === null || String(value).trim() === '') return 0;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text) * 1000;
  // Do not let Date.parse interpret invalid numeric delays as calendar dates.
  if (/^[+-]?[\d.]+$/.test(text)) return 0;
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}
function createRequestPolicy({ sleep, now = Date.now, random = Math.random, logger = console.log, ...options }) {
  const config = { ...DEFAULTS, ...options };
  let previousRequest = null, failures = 0, consecutiveBlocks = 0, retryAt = 0, stopped = false;
  async function wait(ms, reason) {
    if (ms <= 0) return;
    if (ms >= 5000) logger(`[Amazon] Waiting ${Math.ceil(ms / 1000)}s (${reason}).`);
    let remaining = ms, elapsed = 0;
    while (remaining > 0) {
      const step = Math.min(10000, remaining);
      await sleep(step); remaining -= step; elapsed += step;
      if (elapsed % 60000 === 0 && remaining > 0) logger(`[Amazon] Still waiting: ${Math.ceil(remaining / 1000)}s remaining (${reason}).`);
    }
  }
  return {
    async beforeRequest() {
      if (stopped) throw Object.assign(new Error('Amazon request circuit is paused.'), { code: 'blocked', circuit_open: true, resume_after: new Date(retryAt).toISOString() });
      const pacing = previousRequest === null ? 0 : config.minDelayMs + Math.floor(random() * (config.maxDelayMs - config.minDelayMs + 1));
      await wait(Math.max(pacing, retryAt - now(), 0), retryAt > now() ? 'server Retry-After / failure backoff' : 'page request pacing');
      previousRequest = now();
    },
    success() { failures = 0; consecutiveBlocks = 0; retryAt = 0; },
    failure({ blocked = false, retryAfter, captcha = false } = {}) {
      failures++;
      if (blocked) consecutiveBlocks++;
      const backoff = Math.min(config.backoffMaxMs, config.backoffBaseMs * 2 ** Math.min(failures - 1, 20));
      // Server Retry-After is a minimum and is never shortened by our backoff cap.
      retryAt = now() + Math.max(backoff, retryAfterMs(retryAfter, now()));
      stopped = captcha || consecutiveBlocks >= config.blockLimit;
      if (stopped) retryAt = Math.max(retryAt, now() + config.cooldownMs);
      return { circuit_open: stopped, consecutive_blocks: consecutiveBlocks, resume_after: new Date(retryAt).toISOString() };
    },
  };
}
const policies = new WeakMap();
function policyForPage(page) {
  if (!policies.has(page)) policies.set(page, createRequestPolicy({ sleep: ms => page.waitForTimeout(ms) }));
  return policies.get(page);
}
function setPolicyForPage(page, options) {
  const policy = createRequestPolicy({ ...options, sleep: ms => page.waitForTimeout(ms) });
  policies.set(page, policy);
  return policy;
}
module.exports = { DEFAULTS, SLOW_DEFAULTS, retryAfterMs, createRequestPolicy, policyForPage, setPolicyForPage };
