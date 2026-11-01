import fs from 'node:fs/promises';
import path from 'node:path';
import { getConnectionPool } from './vpsConnectionPool.js';
import { serversFromInfo } from './vpsManager.js';

export function vpsStatusMiddleware(root, getStatus = async () => {
  const servers = serversFromInfo(await fs.readFile(path.join(root, 'VPSInfo.md'), 'utf8'));
  const server = servers.find(value => value.id === '6');
  if (!server) throw new Error('VPS 6 is not configured.');
  const source = await fs.readFile(path.join(root, 'scripts/vps-status/collector.py'), 'utf8');
  const { stdout, code } = await getConnectionPool().exec(server, 'python3 -', source, { timeout: 40000, maxBytes: 2000000 });
  if (code !== 0) throw new Error('Could not collect the existing VPS 6 batch.');
  try { return JSON.parse(stdout); } catch { throw new Error('VPS returned an invalid status response.'); }
}) {
  let pending = null;
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/vps-status') return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const host = req.headers.host || '';
    if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) || req.headers['sec-fetch-site'] === 'cross-site' || req.headers.origin && req.headers.origin !== `http://${host}`) {
      res.statusCode = 403; return res.end(JSON.stringify({ error: 'VPS status is available only from this local dashboard.' }));
    }
    if (req.method !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'Only read operations are supported.' })); }
    if (url.search) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'The configured batch does not accept URL parameters.' })); }
    try {
      if (!pending) pending = Promise.resolve().then(getStatus).finally(() => { pending = null; });
      res.end(JSON.stringify(await pending));
    } catch (error) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: error.message || 'Could not fetch VPS status.' }));
    }
  };
}
export function vpsStatusPlugin(root) {
  return { name: 'local-vps-status', configureServer(server) { server.middlewares.use(vpsStatusMiddleware(root)); }, configurePreviewServer(server) { server.middlewares.use(vpsStatusMiddleware(root)); } };
}
