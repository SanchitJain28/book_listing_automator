const { getResumeIndex } = require('../../utils/resume');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readSearchTerms, readJsonLines, appendResult } = require('../../utils/file');
const { initScraper } = require('../../utils/scraperInit');
const { getRandomDelay } = require('../../utils/browser');
const { chromium } = require('playwright-extra');
const { normalizeIsbn } = require('./core/isbn');
const { scrapeAmazonBook } = require('./scraper');
const { markets } = require('./core/international');
const { DEFAULTS, SLOW_DEFAULTS, setPolicyForPage } = require('./core/requestPolicy');

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

function readPause(output, now = Date.now()) {
  const file = output + '.pause.json';
  if (!fs.existsSync(file)) return null;
  const pause = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Number.isFinite(Date.parse(pause.resume_after))) throw new Error(`Invalid pause checkpoint: ${file}`);
  return Date.parse(pause.resume_after) > now ? pause : null;
}

function writeReport(output, items, records, pause = null) {
  const entries = items.map(item => records.get(identity(item))).filter(Boolean);
  const report = {
    generated_at: new Date().toISOString(), input_count: items.length,
    matched_count: entries.filter(isComplete).length,
    stopped: !!pause, pause,
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

async function runBatch({ items, output, page, domain = 'amazon.com', retryFailed = false, scrape = scrapeAmazonBook, cooldownMs = DEFAULTS.cooldownMs, delay = () => page.waitForTimeout(getRandomDelay(2000, 5000)) }) {
  const resumeIndex = retryFailed ? 0 : getResumeIndex(output, items, identity);
  const records = latestRecords(output);
  const activePause = readPause(output);
  if (activePause) return { ...writeReport(output, items, records, activePause), stopped: true, pause: activePause };
  for (const [index, item] of items.entries()) {
    if (retryFailed ? isComplete(records.get(identity(item)) || {}) : index < resumeIndex) continue;
    const isbn = item.searched_isbn || item.isbn;
    const directUrl = item.buy_url || item.url;
    const result = await scrape(page, { directUrl, isbn, domain });
    const record = { ...item, ...result, input_index: index, input_url: directUrl || null, scraped_at: new Date().toISOString() };
    if (result.stock_status === 'Blocked' || result.error_code === 'blocked' || result.circuit_open) {
      const pause = { input_index: index, searched_isbn: isbn, domain, reason: result.error || 'Repeated Amazon blocks',
        resume_after: new Date(Math.max(Date.now() + cooldownMs, Date.parse(result.resume_after) || 0)).toISOString() };
      // Keep attempts separate: the pending ISBN must not count as completed on resume.
      appendResult(output + '.blocked.jsonl', record);
      const checkpoint = output + '.pause.json';
      fs.writeFileSync(checkpoint + '.tmp', JSON.stringify(pause, null, 2) + '\n');
      fs.renameSync(checkpoint + '.tmp', checkpoint);
      console.log(`[Amazon] Batch paused at input ${index + 1} (${isbn}). Resume after ${pause.resume_after} using the same command. Completed output is preserved.`);
      return { ...writeReport(output, items, records, pause), stopped: true, pause };
    }
    appendResult(output, record);
    records.set(identity(item), record);
    console.log(`[${index + 1}/${items.length}] ${isbn || directUrl}: ${result.title || result.error || result.stock_status} | ${result.price ?? 'No price'} | ${result.stock_status} | ISBN ${result.isbn_matched ? 'matched' : 'not verified'}`);
    if (index < items.length - 1) await delay();
  }
  fs.rmSync(output + '.pause.json', { force: true });
  return writeReport(output, items, records);
}

async function main(domain) {
  if (!markets[domain]) throw Error('Unsupported Amazon marketplace');
  const folder = domain === 'amazon.com' ? 'amazon-us-isbn' : 'amazon-uk-isbn';
  const { inputFile, isHeadless, outputFilePath } = initScraper(`scrapers/${folder}/${folder}.js`, folder, '.json');
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex !== -1 && (!process.argv[outputIndex + 1] || process.argv[outputIndex + 1].startsWith('--'))) throw new Error('--output requires a file path.');
  const output = outputIndex === -1 ? outputFilePath : path.resolve(process.argv[outputIndex + 1]);
  const items = inputFile.toLowerCase().endsWith('.txt') ? readSearchTerms(inputFile).map(searched_isbn => ({ searched_isbn })) : readJsonLines(inputFile);
  if (!items.length) throw new Error('Input contains no records.');
  const slow = process.argv.includes('--slow');
  const profile = path.resolve(__dirname, `../../profiles/${folder}`, crypto.createHash('sha256').update(output).digest('hex').slice(0, 12));
  let context;
  console.log(`${markets[domain].store} input: ${inputFile}\nOutput: ${output}`);
  if (slow) console.log('[Amazon] Slow mode: 4–10 seconds between page requests and between ISBNs; pause at the first block for at least 30 minutes.');
  const activePause = readPause(output);
  if (activePause) {
    console.log(`[Amazon] Batch remains paused until ${activePause.resume_after}. No browser requests made. Restart the same command after that time.`);
    process.exitCode = 3;
    return;
  }
  try {
    context = await chromium.launchPersistentContext(profile, { headless: isHeadless, viewport: { width: 1440, height: 1000 }, locale: domain === 'amazon.com' ? 'en-US' : 'en-GB', timezoneId: 'Asia/Kolkata' });
    await context.addCookies([{ name: 'i18n-prefs', value: markets[domain].currency, domain: `.${domain}`, path: '/' }]);
    await context.route('**/*', route => ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue());
    const page = context.pages()[0] || await context.newPage();
    if (slow) setPolicyForPage(page, SLOW_DEFAULTS);
    const delay = () => page.waitForTimeout(slow ? getRandomDelay(4000, 10000) : getRandomDelay(2000, 5000));
    const { report, reportPath, stopped } = await runBatch({ items, output, page, domain, delay,
      cooldownMs: slow ? SLOW_DEFAULTS.cooldownMs : DEFAULTS.cooldownMs, retryFailed: process.argv.includes('--retry-failed') });
    console.log(`Verified ${report.matched_count}/${report.input_count} ISBNs. Report: ${reportPath}`);
    if (stopped) process.exitCode = 3;
    else if (report.matched_count !== report.input_count) process.exitCode = 2;
  } finally { await context?.close(); }
}

module.exports = { main, identity, isComplete, latestRecords, writeReport, runBatch, readPause };
