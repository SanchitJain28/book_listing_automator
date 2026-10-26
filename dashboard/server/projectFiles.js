import fs from 'node:fs/promises';
import path from 'node:path';

const extensions = new Set(['.json', '.jsonl', '.ndjson', '.csv', '.tsv', '.txt']);
const excluded = /^(?:node_modules|dist|profiles|debug|logs|setup_logs|amazon_cart_bot_profile.*|.*browser_profile.*|.*chrome_profile.*)$/i;
const privateFiles = /^(?:credentials(?:[._-].*)?\.json|.*(?:secret|token|private.key).*|package(?:-lock)?\.json|tsconfig\.json)$/i;
const MAX_SIZE = 50 * 1024 * 1024;

function allowed(parts) {
  return parts.every(part => part && part !== '..' && !part.startsWith('.') && !excluded.test(part) && !privateFiles.test(part));
}

export function projectFilesMiddleware(root) {
  const realRoot = fs.realpath(root);
  async function resolve(relative) {
    if (path.isAbsolute(relative) || relative.includes('\\') || relative.includes('\0')) throw Object.assign(new Error('Invalid project path.'), { status: 403 });
    const parts = relative ? relative.split('/') : [];
    if (!allowed(parts)) throw Object.assign(new Error('This project path is not available.'), { status: 403 });
    const base = await realRoot;
    let current = base;
    for (const part of parts) {
      current = path.join(current, part);
      if ((await fs.lstat(current)).isSymbolicLink()) throw Object.assign(new Error('Symbolic links are not available.'), { status: 403 });
    }
    const canonical = await fs.realpath(current);
    if (canonical !== base && !canonical.startsWith(base + path.sep)) throw Object.assign(new Error('Path is outside the project.'), { status: 403 });
    return canonical;
  }
  async function hasData(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!allowed([entry.name]) || entry.isSymbolicLink()) continue;
      if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) return true;
      if (entry.isDirectory() && await hasData(path.join(directory, entry.name)).catch(() => false)) return true;
    }
    return false;
  }
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!['/api/project-files', '/api/project-file'].includes(url.pathname)) return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const host = req.headers.host || '';
      if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) || req.headers['sec-fetch-site'] === 'cross-site' || req.headers.origin && req.headers.origin !== `http://${host}`) throw Object.assign(new Error('Project files are available only from this local dashboard.'), { status: 403 });
      if (req.method !== 'GET') throw Object.assign(new Error('Only read operations are supported.'), { status: 405 });
      const relative = url.searchParams.get('path') || '';
      const target = await resolve(relative);
      const stat = await fs.stat(target);
      if (url.pathname === '/api/project-files') {
        if (!stat.isDirectory()) throw Object.assign(new Error('Choose a folder.'), { status: 400 });
        const entries = await fs.readdir(target, { withFileTypes: true });
        const items = (await Promise.all(entries.map(async entry => {
          if (!allowed([entry.name]) || entry.isSymbolicLink()) return null;
          const entryPath = [relative, entry.name].filter(Boolean).join('/');
          const absolute = path.join(target, entry.name);
          if (entry.isDirectory()) return await hasData(absolute).catch(() => false) ? { name: entry.name, path: entryPath, type: 'folder' } : null;
          if (!entry.isFile() || !extensions.has(path.extname(entry.name).toLowerCase())) return null;
          const details = await fs.stat(absolute);
          return { name: entry.name, path: entryPath, type: 'file', size: details.size, modifiedAt: details.mtime.toISOString() };
        }))).filter(Boolean).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1);
        res.end(JSON.stringify({ path: relative, items }));
      } else {
        if (!stat.isFile() || !extensions.has(path.extname(target).toLowerCase())) throw Object.assign(new Error('Choose a supported data file.'), { status: 400 });
        if (stat.size > MAX_SIZE) throw Object.assign(new Error('This file exceeds the 50 MB limit. Split it into smaller files first.'), { status: 413 });
        res.end(JSON.stringify({ name: path.basename(target), projectPath: relative, size: stat.size, content: await fs.readFile(target, 'utf8') }));
      }
    } catch (error) {
      res.statusCode = error.status || (error.code === 'ENOENT' ? 404 : 500);
      res.end(JSON.stringify({ error: error.status ? error.message : error.code === 'ENOENT' ? 'The file or folder no longer exists.' : 'Could not read this project path.' }));
    }
  };
}

export function projectFilesPlugin(root) {
  return { name: 'local-project-files', configureServer(server) { server.middlewares.use(projectFilesMiddleware(root)); }, configurePreviewServer(server) { server.middlewares.use(projectFilesMiddleware(root)); } };
}
