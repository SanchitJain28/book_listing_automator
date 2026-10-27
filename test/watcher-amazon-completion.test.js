const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

function checkCompletion(scriptName, exitCode) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-completion-'));
  try {
    const script = path.join(directory, scriptName);
    // A local fixture only: never import or execute a real scraper.
    fs.writeFileSync(script, `console.log('FIXTURE_EXECUTED'); process.exit(${exitCode});\n`);
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../utils/watcher.js'), script, 'unused-input.txt'], { encoding: 'utf8', timeout: 4000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, exitCode);
    assert.equal((result.stdout.match(/FIXTURE_EXECUTED/g) || []).length, 1);
    return result.stdout;
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

for (const script of ['amazon-us-isbn.js', 'amazon-uk-isbn.js']) {
  test(`${script}: circuit pause stops automatic restarts`, () => {
    assert.match(checkCompletion(script, 3), /no automatic restart/);
  });
  test(`${script}: completed batch with unverified records stops instead of restarting`, () => {
    assert.match(checkCompletion(script, 2), /automatic retries are stopped/);
  });
}
test('successful completion still exits normally', () => {
  assert.match(checkCompletion('amazon-us-isbn.js', 0), /completed all items successfully/);
});

for (const code of [2, 3]) {
  test(`Walmart deliberate exit ${code} does not restart`, () => {
    assert.match(checkCompletion('walmart-isbn.js', code), /no automatic restart/);
  });
}
