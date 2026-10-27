const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getResumeIndex } = require('../utils/resume');
const ids = ['9780816069613', '9780306406157', '9789394991248', '9788125063247'];
const items = ids.map(searched_isbn => ({ searched_isbn }));
const identity = item => item.searched_isbn;
function fixture(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scraper-resume-'));
  return Promise.resolve().then(() => callback(path.join(directory, 'output.jsonl'), directory))
    .finally(() => fs.rmSync(directory, { recursive: true, force: true }));
}
function write(file, rows) { fs.writeFileSync(file, rows.map(JSON.stringify).join('\n') + '\n'); }

test('default resumes after all saved statuses, including blocked and failed rows', () => fixture(file => {
  assert.equal(getResumeIndex(file, items, identity), 0);
  write(file, [{ ...items[0], found: false, stock_status: 'Blocked' }, { ...items[1], error: 'timeout' }]);
  assert.equal(getResumeIndex(file, items, identity), 2);
  assert.equal(getResumeIndex(file, items), 2);
}));
test('legacy retries do not advance beyond the last contiguous input', () => fixture(file => {
  write(file, [items[0], items[1], items[0], items[1]]);
  assert.equal(getResumeIndex(file, items, identity), 2);
}));
test('duplicate inputs retain separate positions, including explicit indices', () => fixture(file => {
  const duplicates = [items[0], items[0], items[1]];
  write(file, [{ ...items[0], input_index: 0 }, { ...items[0], input_index: 0 }]);
  assert.equal(getResumeIndex(file, duplicates, identity), 1);
  fs.appendFileSync(file, JSON.stringify({ ...items[0], input_index: 1 }) + '\n');
  assert.equal(getResumeIndex(file, duplicates, identity), 2);
}));
test('incomplete final append is backed up and unfinished input is retried', () => fixture((file, directory) => {
  const saved = JSON.stringify({ ...items[0], title: 'हिंदी' }) + '\n';
  fs.writeFileSync(file, saved + '{"searched_isbn":');
  assert.equal(getResumeIndex(file, items, identity), 1);
  assert.equal(fs.readFileSync(file, 'utf8'), saved);
  const backup = fs.readdirSync(directory).find(name => name.endsWith('.bak'));
  assert.equal(fs.readFileSync(path.join(directory, backup), 'utf8'), '{"searched_isbn":');
}));
test('a complete record without a trailing newline is separated before appending', () => fixture(file => {
  fs.writeFileSync(file, JSON.stringify(items[0]));
  assert.equal(getResumeIndex(file, items, identity), 1);
  assert(fs.readFileSync(file, 'utf8').endsWith('\n'));
}));
test('malformed middle records fail without modifying output', () => fixture(file => {
  const content = JSON.stringify(items[0]) + '\ninvalid\n' + JSON.stringify(items[1]) + '\n';
  fs.writeFileSync(file, content);
  assert.throws(() => getResumeIndex(file, items, identity), /Invalid output JSON/);
  assert.equal(fs.readFileSync(file, 'utf8'), content);
}));
test('unrelated input/output pairing is rejected', () => fixture(file => {
  write(file, [{ searched_isbn: 'different' }]);
  assert.throws(() => getResumeIndex(file, items, identity), /does not match this input/);
}));

const runners = [
  'flipkart/runner', 'bookchor/runner', 'bookswagon/runner', 'sapnaonline/runner',
  'atlanticbooks/runner', 'mypustak/runner', 'ompublication/runner', 'amazon-isbn/internationalRunner',
];
for (const name of runners) {
  test(`${name}: interrupt after two writes, restart at item three, skip saved failure`, () => fixture(async file => {
    const { runBatch } = require(`../scrapers/${name}`);
    let calls = [];
    const scrape = async (_, arg, target) => {
      const isbn = typeof arg === 'object' && arg ? arg.isbn : target;
      calls.push(isbn);
      if (calls.length === 3) throw new Error('simulated interruption');
      return { searched_isbn: isbn, found: isbn !== ids[0], isbn_matched: isbn !== ids[0], stock_status: isbn === ids[0] ? (name === 'amazon-isbn/internationalRunner' ? 'Error' : 'Blocked') : 'In Stock' };
    };
    await assert.rejects(runBatch({ items, output: file, page: {}, delay: async () => {}, scrape }), /simulated interruption/);
    assert.equal(fs.readFileSync(file, 'utf8').trim().split('\n').length, 2);
    calls = [];
    await runBatch({ items, output: file, page: {}, delay: async () => {}, scrape });
    assert.deepEqual(calls, ids.slice(2));
    calls = [];
    await runBatch({ items, output: file, page: {}, delay: async () => {}, scrape });
    assert.deepEqual(calls, []);
    const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map(row => row.searched_isbn), ids);
  }));
}
