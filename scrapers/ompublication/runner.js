const { getResumeIndex } = require('../../utils/resume');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readSearchTerms, readJsonLines, appendResult } = require('../../utils/file');
const { initScraper } = require('../../utils/scraperInit');
const { getRandomDelay } = require('../../utils/browser');
const { chromium } = require('playwright-extra');
const { normalizeIsbn } = require('./core/isbn');
const { scrapeOmPublication } = require('./scraper');

function identity(item) {
  const inputUrl = Object.hasOwn(item, 'input_url') ? item.input_url : item.buy_url || item.url || null;
  return JSON.stringify([normalizeIsbn(item.searched_isbn || item.isbn) || item.searched_isbn || item.isbn || null, inputUrl]);
}

function isComplete(item) {
  return item.found === true && item.isbn_matched === true && !item.error;
}

function latestRecords(file) {
  const records = new Map();
  if (!fs.existsSync(file)) return records;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try { const record = JSON.parse(line); records.set(identity(record), record); }
    catch { throw new Error(`Invalid existing output at line ${index + 1}; choose a fresh --output file.`); }
  });
  return records;
}

function writeReport(output, items, records) {
  const entries = items.map(item => records.get(identity(item))).filter(Boolean);
  const report = {
    generated_at: new Date().toISOString(), input_count: items.length,
    matched_count: entries.filter(isComplete).length,
    results: entries.map(row => ({ searched_isbn: row.searched_isbn, title: row.title, url: row.url,
      found_isbn: row.found_isbn, isbn_matched: row.isbn_matched, isbn_match_source: row.isbn_match_source,
      isbn_evidence: row.isbn_evidence || null, condition: row.condition, price: row.price, currency: row.currency,
      in_stock: row.in_stock, stock_status: row.stock_status, failure_reason: row.error || (row.found ? null : row.stock_status) })),
  };
  const reportPath = output.replace(/\.(?:jsonl?|ndjson)$/i, '') + '.report.json';
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  return { report, reportPath };
}

async function runBatch({ items, output, page, retryFailed = false, scrape = scrapeOmPublication, delay = () => page.waitForTimeout(getRandomDelay(2000, 4000)) }) {
  const resumeIndex = retryFailed ? 0 : getResumeIndex(output, items, identity);
  const records = latestRecords(output);
  for (const [index, item] of items.entries()) {
    if (retryFailed ? isComplete(records.get(identity(item)) || {}) : index < resumeIndex) continue;
    const isbn = item.searched_isbn || item.isbn;
    const directUrl = item.buy_url || item.url;
    const result = await scrape(page, directUrl, isbn);
    const record = { ...item, ...result, input_index: index, input_url: directUrl || null, scraped_at: new Date().toISOString() };
    appendResult(output, record);
    records.set(identity(item), record);
    console.log(`[${index + 1}/${items.length}] ${isbn || directUrl}: ${result.title || result.error || result.stock_status} | ${result.price ?? 'No price'} | ${result.stock_status} | ISBN ${result.isbn_matched ? 'matched' : 'not verified'}`);
    if (index < items.length - 1) await delay();
  }
  return writeReport(output, items, records);
}

async function main() {
  const { inputFile, isHeadless, outputFilePath } = initScraper('scrapers/ompublication/ompublication-isbn.js', 'ompublication', '.json');
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex !== -1 && (!process.argv[outputIndex + 1] || process.argv[outputIndex + 1].startsWith('--'))) throw new Error('--output requires a file path.');
  const output = outputIndex === -1 ? outputFilePath : path.resolve(process.argv[outputIndex + 1]);
  const items = inputFile.toLowerCase().endsWith('.txt') ? readSearchTerms(inputFile).map(searched_isbn => ({ searched_isbn })) : readJsonLines(inputFile);
  if (!items.length) throw new Error('Input contains no records.');
  const profile = path.resolve(__dirname, '../../profiles/ompublication', crypto.createHash('sha256').update(output).digest('hex').slice(0, 12));
  let context;
  console.log(`Om Publications input: ${inputFile}\nOutput: ${output}`);
  try {
    context = await chromium.launchPersistentContext(profile, { headless: isHeadless, viewport: { width: 1440, height: 1000 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
    await context.route('**/*', route => ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue());
    const page = context.pages()[0] || await context.newPage();
    const { report, reportPath } = await runBatch({ items, output, page, retryFailed: process.argv.includes('--retry-failed') });
    console.log(`Verified ${report.matched_count}/${report.input_count} ISBNs. Report: ${reportPath}`);
    if (report.matched_count !== report.input_count) process.exitCode = 2;
  } finally { await context?.close(); }
}

module.exports = { main, identity, isComplete, latestRecords, writeReport, runBatch };
