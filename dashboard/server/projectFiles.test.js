import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { projectFilesMiddleware } from './projectFiles.js';

test('project API lists data folders and reads files while enforcing project boundaries', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'project-browser-'));
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 'project-external-'));
  try {
    for (const dir of ['output/nested', 'empty', 'node_modules/private', '.aws', 'data']) await fs.mkdir(path.join(root, dir), { recursive: true });
    await fs.writeFile(path.join(root, 'output/nested/result.jsonl'), '{"isbn":"123"}\n');
    await fs.writeFile(path.join(root, 'data/books.csv'), 'isbn,title\n123,Book');
    await fs.writeFile(path.join(root, 'empty/README.md'), 'No data');
    await fs.writeFile(path.join(root, 'credentials.json'), '{"private_key":"secret"}');
    await fs.writeFile(path.join(root, 'node_modules/private/data.json'), '{}');
    await fs.writeFile(path.join(root, '.aws/config.txt'), 'secret');
    await fs.writeFile(path.join(external, 'outside.json'), '{"secret":true}');
    await fs.symlink(external, path.join(root, 'external-link'));
    const handler = projectFilesMiddleware(root);
    async function request(url, headers = {}, method = 'GET') {
      const response = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = JSON.parse(body); } };
      await handler({ url, method, headers: { host: '127.0.0.1:5174', ...headers } }, response, () => { response.next = true; });
      return response;
    }
    const listing = await request('/api/project-files');
    assert.deepEqual(listing.body.items.map(item => item.name), ['data', 'output']);
    const nested = await request('/api/project-files?path=output%2Fnested');
    assert.equal(nested.body.items[0].name, 'result.jsonl');
    const file = await request('/api/project-file?path=output%2Fnested%2Fresult.jsonl');
    assert.equal(file.body.content, '{"isbn":"123"}\n');
    assert.equal(file.headers['Cache-Control'], 'no-store');
    for (const target of ['../outside.json', '/etc/passwd', '.aws/config.txt', 'credentials.json', 'external-link/outside.json', 'node_modules/private/data.json']) {
      assert.equal((await request(`/api/project-file?path=${encodeURIComponent(target)}`)).statusCode, 403, target);
    }
    assert.equal((await request('/api/project-files', { origin: 'https://example.com' })).statusCode, 403);
    assert.equal((await request('/api/project-files', { host: 'evil.example' })).statusCode, 403);
    assert.equal((await request('/api/project-files', { 'sec-fetch-site': 'cross-site' })).statusCode, 403);
    assert.equal((await request('/api/project-files', {}, 'POST')).statusCode, 405);
    assert.equal((await request('/api/project-file?path=output%2Fmissing.json')).statusCode, 404);
    const oversized = path.join(root, 'data/large.txt');
    await fs.writeFile(oversized, '');
    await fs.truncate(oversized, 50 * 1024 * 1024 + 1);
    assert.equal((await request('/api/project-file?path=data%2Flarge.txt')).statusCode, 413);
    assert.equal((await request('/unrelated')).next, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(external, { recursive: true, force: true });
  }
});
