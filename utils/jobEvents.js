const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
function redact(value) {
  let text = String(value ?? '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]')
    .replace(/((?:password|api[_-]?key|token|authorization|cookie|secret)\s*[=:]\s*)(?:Bearer\s+)?[^\s&,;]+/gi, '$1[REDACTED]');
  for (const [key, secret] of Object.entries(process.env)) if (/password|secret|token|api.?key|private.?key/i.test(key) && secret?.length >= 4) text = text.split(secret).join('[REDACTED]');
  return text.slice(0, 8192);
}
function createJobLogger({ file, jobId, attemptId = crypto.randomUUID(), scraper, serverId = process.env.BOOK_SERVER_ID || null, maxBytes = 10 * 1024 * 1024, keep = 4, retentionDays = 7, onError = () => {} }) {
  let warned = false, checkedAt = 0;
  return (event, fields = {}) => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error('Refusing linked log file');
      if (Date.now() - checkedAt > 60000) {
        checkedAt = Date.now();
        for (let i = 1; i <= keep; i++) if (fs.existsSync(`${file}.${i}`) && Date.now() - fs.statSync(`${file}.${i}`).mtimeMs > retentionDays * 86400000) fs.rmSync(`${file}.${i}`);
      }
      if (fs.existsSync(file) && fs.statSync(file).size >= maxBytes) {
        fs.rmSync(`${file}.${keep}`, { force: true });
        for (let i = keep - 1; i >= 1; i--) if (fs.existsSync(`${file}.${i}`)) fs.renameSync(`${file}.${i}`, `${file}.${i + 1}`);
        fs.renameSync(file, `${file}.1`);
      }
      const record = { timestamp: new Date().toISOString(), server_id: serverId, job_id: jobId, attempt_id: attemptId, scraper, level: 'info', event,
        input_index: null, isbn: null, ...fields };
      for (const key of ['message', 'error', 'url', 'stack']) if (record[key] != null) record[key] = redact(record[key]);
      fs.appendFileSync(file, JSON.stringify(record) + '\n', { mode: 0o600 });
    } catch (error) { if (!warned) { warned = true; onError(error); } }
  };
}
module.exports = { createJobLogger, redact };
