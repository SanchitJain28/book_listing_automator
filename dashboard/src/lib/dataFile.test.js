import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDataFile } from './dataFile.js';

test('CSV preserves quoted commas, newlines, escaped quotes and leading zeros', () => {
  const result = parseDataFile('ISBN,Title,Notes\r\n00123,"Hello, world","Two\nlines with ""quotes"""\r\n', 'books.csv');
  assert.equal(result.kind, 'table');
  assert.deepEqual(result.records, [{ ISBN: '00123', Title: 'Hello, world', Notes: 'Two\nlines with "quotes"' }]);
});
test('CSV validation rejects incomplete quotes, duplicate headers and missing columns', () => {
  for (const source of ['a,b\n"broken,1', 'a,a\n1,2', 'a,b\n1', 'a,b\n"one"oops,2', 'a,\n1,2']) assert.throws(() => parseDataFile(source, 'bad.csv'));
});
test('TSV keeps original headers and data', () => {
  assert.deepEqual(parseDataFile('name\tcount\nBooks\t10', 'data.tsv').records, [{ name: 'Books', count: '10' }]);
});
test('ISBN text is displayed as inputs without invented product metadata', () => {
  const result = parseDataFile('9789393097903\n9788187471622\n', 'input.txt');
  assert.equal(result.kind, 'books');
  assert.deepEqual(result.records, [{ searched_isbn: '9789393097903' }, { searched_isbn: '9788187471622' }]);
});
test('ordinary text is a line table and JSONL text remains scraper data', () => {
  assert.deepEqual(parseDataFile('first line\nsecond line', 'notes.txt').records, [{ line: 1, text: 'first line' }, { line: 2, text: 'second line' }]);
  assert.equal(parseDataFile('{"isbn":"123"}\n{"isbn":"456"}', 'output.txt').records.length, 2);
  assert.throws(() => parseDataFile('', 'empty.txt'));
});
test('JSON summaries unwrap their results array', () => {
  assert.deepEqual(parseDataFile('{"matched_count":1,"results":[{"searched_isbn":"123"}]}', 'results.report.json').records, [{ searched_isbn: '123' }]);
});
