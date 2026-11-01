export function sanitize(value, secrets = []) {
  if (Array.isArray(value)) return value.map(item => sanitize(item, secrets));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /password|private_key|authorization|api[_-]?key|access[_-]?token/i.test(key) ? '[REDACTED]' : sanitize(item, secrets)]));
  if (typeof value !== 'string') return value;
  let text = value.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
    .replace(/^(?:[A-Za-z0-9+/]{48,}={0,2})$/gm, '[REDACTED ENCODED DATA]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]')
    .replace(/((?:password|api[_-]?key|token|authorization|cookie|secret)\s*[=:]\s*)(?:Bearer\s+)?[^\s&,;]+/gi, '$1[REDACTED]');
  for (const secret of secrets.filter(s => typeof s === 'string' && s.length >= 4)) text = text.split(secret).join('[REDACTED]');
  return text;
}
