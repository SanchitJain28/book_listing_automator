const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const { getResumeIndex } = require('../../utils/resume');
const { readSearchTerms, readJsonLines, appendResult } = require('../../utils/file');
const { normalizeIsbn } = require('./core/isbn');
const { scrapeWalmart } = require('./scraper');

function identity(item) {
  const inputUrl = Object.hasOwn(item, 'input_url') ? item.input_url : item.buy_url || item.url || null;
  return JSON.stringify([normalizeIsbn(item.searched_isbn || item.isbn) || item.searched_isbn || item.isbn || null, inputUrl]);
}
const isComplete = row => row?.found === true && row.isbn_matched === true && !row.error;
function readPause(output) {
  const file = output + '.pause.json';
  if (!fs.existsSync(file)) return null;
  const pause = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Number.isFinite(Date.parse(pause.resume_after))) throw new Error(`Invalid pause checkpoint: ${file}`);
  return Date.parse(pause.resume_after) > Date.now() ? pause : null;
}
function savedRecords(output, items) {
  const records = new Map();
  if (!fs.existsSync(output)) return records;
  const rows = readJsonLines(output);
  rows.forEach((row, position) => {
    const index = Number.isInteger(row.input_index) ? row.input_index : position;
    if (!items[index] || identity(items[index]) !== identity(row)) throw new Error(`Output does not match input at saved record ${position + 1}.`);
    records.set(index, row);
  });
  return records;
}
function waitForInspection(context, page, { signals = process, logger = console.log, heartbeatMs = 60000 } = {}) {
  if (page.isClosed()) return Promise.resolve();
  logger('[Walmart] Headed inspection paused on the blocked page. Close the browser window or press Ctrl+C to exit. No further scraper requests will run.');
  return new Promise(resolve => {
    const heartbeat = setInterval(() => logger('[Walmart] Still paused for inspection. Close the window or press Ctrl+C to exit.'), heartbeatMs);
    const finish = () => {
      clearInterval(heartbeat);
      context.removeListener('close', finish);
      page.removeListener('close', finish);
      signals.removeListener('SIGINT', finish);
      signals.removeListener('SIGTERM', finish);
      resolve();
    };
    context.once('close', finish);
    page.once('close', finish);
    signals.once('SIGINT', finish);
    signals.once('SIGTERM', finish);
  });
}
function writeReport(output, items, records, pause = null) {
  const report = { generated_at: new Date().toISOString(), input_count: items.length,
    attempted_count: records.size, matched_count: [...records.values()].filter(isComplete).length, stopped: !!pause, pause,
    results: items.map((item, index) => {
      const row = records.get(index);
      return { input_index: index, searched_isbn: item.searched_isbn || item.isbn, title: row?.title || null, url: row?.url || null,
        found_isbn: row?.found_isbn || null, isbn_matched: row?.isbn_matched ?? false, isbn_match_source: row?.isbn_match_source || null,
        isbn_evidence: row?.isbn_evidence || [], price: row?.price ?? null, currency: row?.currency || 'USD', seller: row?.seller || null,
        in_stock: row?.in_stock ?? null, stock_status: row ? row.stock_status || 'Unknown' : 'Pending',
        failure_reason: row ? row.error || (row.found ? null : row.stock_status) : pause ? 'Not attempted: batch paused after a block.' : 'Not attempted.' };
    }) };
  const reportPath = output.replace(/\.(?:jsonl?|ndjson)$/i, '') + '.report.json';
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  const columns = ['searched_isbn', 'title', 'url', 'found_isbn', 'isbn_match_source', 'price', 'currency', 'stock_status', 'failure_reason'];
  const cell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  fs.writeFileSync(reportPath.replace(/\.json$/, '.csv'), [columns.join(','), ...report.results.map(row => columns.map(key => cell(row[key])).join(','))].join('\n') + '\n');
  return { report, reportPath, stopped: !!pause };
}
async function runBatch({ items, output, page, retryFailed = false, scrape = scrapeWalmart,
  delay = () => page.waitForTimeout(2000 + Math.floor(Math.random() * 3001)) }) {
  const resumeIndex = getResumeIndex(output, items, identity);
  const records = savedRecords(output, items);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (!fs.existsSync(output)) fs.writeFileSync(output, '');
  const activePause = readPause(output);
  if (activePause) {
    if (activePause.attempt) records.set(activePause.input_index, activePause.attempt);
    return writeReport(output, items, records, activePause);
  }
  for (const [index, item] of items.entries()) {
    if (retryFailed ? isComplete(records.get(index)) : index < resumeIndex) continue;
    const isbn = item.searched_isbn || item.isbn, directUrl = item.buy_url || item.url;
    const result = await scrape(page, directUrl, isbn);
    const record = { ...item, ...result, input_index: index, input_url: directUrl || null, scraped_at: new Date().toISOString() };
    records.set(index, record);
    if (result.error_code === 'blocked' || result.stock_status === 'Blocked') {
      const pause = { input_index: index, searched_isbn: isbn, resume_after: new Date(Math.max(Date.now() + 300000, Date.parse(result.resume_after) || 0)).toISOString(), attempt: record };
      appendResult(output + '.attempts.jsonl', record);
      fs.writeFileSync(output + '.pause.json.tmp', JSON.stringify(pause, null, 2) + '\n');
      fs.renameSync(output + '.pause.json.tmp', output + '.pause.json');
      console.log(`[Walmart] Blocked at input ${index + 1} (${isbn}); stopped. Pending ISBN preserved. Resume after ${pause.resume_after}.`);
      return writeReport(output, items, records, pause);
    }
    appendResult(output, record);
    // Periodic reports keep large batches from rewriting the entire report per row.
    if (index % 25 === 0) writeReport(output, items, records);
    console.log(`[${index + 1}/${items.length}] ${isbn}: ${result.title || result.error || result.stock_status} | ${result.price ?? 'No price'} | ${result.stock_status} | ISBN ${result.isbn_matched ? 'matched' : 'not verified'}`);
    if (index < items.length - 1) await delay();
  }
  fs.rmSync(output + '.pause.json', { force: true });
  return writeReport(output, items, records);
}
async function main() {
  const input = process.argv[2];
  if (!input || input.startsWith('--')) throw new Error('Usage: node scrapers/walmart/walmart-isbn.js <input.txt|input.jsonl> [--headless] [--output results.jsonl] [--retry-failed]');
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex !== -1 && (!process.argv[outputIndex + 1] || process.argv[outputIndex + 1].startsWith('--'))) throw new Error('--output requires a file path.');
  const output = path.resolve(outputIndex === -1 ? `output/walmart/${path.basename(path.dirname(input))}-${path.parse(input).name}.jsonl` : process.argv[outputIndex + 1]);
  const items = /\.txt$/i.test(input) ? readSearchTerms(input).map(searched_isbn => ({ searched_isbn })) : readJsonLines(input);
  if (!items.length) throw new Error('Input contains no ISBN records.');
  console.log(`Walmart input: ${path.resolve(input)}\nOutput: ${output}`);
  const pause = readPause(output);
  if (pause) { console.log(`[Walmart] Paused until ${pause.resume_after}. No requests made.`); process.exitCode = 3; return; }
  const profile = path.resolve(__dirname, '../../profiles/walmart', crypto.createHash('sha256').update(output).digest('hex').slice(0, 12));
  const isHeadless = process.argv.includes('--headless');
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, { headless: isHeadless, locale: 'en-US', viewport: { width: 1440, height: 1000 } });
    const page = context.pages()[0] || await context.newPage();
    const result = await runBatch({ items, output, page, retryFailed: process.argv.includes('--retry-failed') });
    if (result.stopped) {
      await page.screenshot({ path: output + '.blocked.png', fullPage: false }).catch(() => {});
      await page.content().then(html => fs.writeFileSync(output + '.blocked.html', html)).catch(() => {});
    }
    console.log(`Verified ${result.report.matched_count}/${items.length} ISBNs. Report: ${result.reportPath}`);
    if (result.stopped) process.exitCode = 3;
    else if (result.report.matched_count !== items.length) process.exitCode = 2;
    if (result.stopped && !isHeadless) {
      await page.bringToFront().catch(() => {});
      await waitForInspection(context, page);
    }
  } finally { await context?.close(); }
}
module.exports = { main, identity, isComplete, savedRecords, readPause, writeReport, runBatch, waitForInspection };
