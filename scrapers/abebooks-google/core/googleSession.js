const fs = require('fs');
const path = require('path');

const DEFAULT_SESSION_FILE = path.resolve('profiles/abebooks-google/google-clearance.json');

function clearanceCookieFrom(cookies, now = Date.now()) {
  return (cookies || []).find(cookie => cookie?.name === 'GOOGLE_ABUSE_EXEMPTION'
    && /(^|\.)google\./i.test(cookie.domain || '')
    && typeof cookie.value === 'string' && cookie.value.length > 0
    && (cookie.expires < 0 || cookie.expires > now / 1000 + 30)) || null;
}

function loadGoogleClearance(file = DEFAULT_SESSION_FILE, now = Date.now()) {
  if (!fs.existsSync(file)) return null;
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved.version !== 1) return null;
    return clearanceCookieFrom([saved.cookie], now);
  } catch {
    return null;
  }
}

function saveGoogleClearance(cookie, file = DEFAULT_SESSION_FILE) {
  const valid = clearanceCookieFrom([cookie]);
  if (!valid) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, saved_at: new Date().toISOString(), cookie: valid }) + '\n', { mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return true;
}

module.exports = { DEFAULT_SESSION_FILE, clearanceCookieFrom, loadGoogleClearance, saveGoogleClearance };
