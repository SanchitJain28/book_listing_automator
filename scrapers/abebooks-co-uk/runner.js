const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const { readJsonLines, readSearchTerms, appendResult } = require('../../utils/file');
const { getResumeIndex } = require('../../utils/resume');
const { scrapeAbeBooksUk } = require('./scraper');
const identity = row => String(row.searched_isbn || row.isbn || '').replace(/[\s-]/g, '').toUpperCase();
function writeReport(output, items) {
  const records = fs.existsSync(output) ? readJsonLines(output) : [];
  const rows = new Map(records.map(row => [identity(row), row]));
  const results = items.map(item => {
    const r = rows.get(identity(item));
    return { searched_isbn: identity(item), title: r?.title || null, url: r?.url || null, search_url: r?.search_url || null,
      match_type: r?.match_type || null, found_isbn: r?.found_isbn || null, isbn_matched: r?.isbn_matched || false,
      isbn_match_source: r?.isbn_match_source || null, isbn_evidence: r?.isbn_evidence || [], stock_image_isbn: r?.stock_image_isbn || null,
      price: r?.price ?? null, currency: 'GBP', stock_status: r?.stock_status || 'Pending',
      failure_reason: !r ? 'Pending (not saved)' : r.error || (!r.found ? r.stock_status : null) };
  });
  const exact = results.filter(r => r.match_type === 'exact').length;
  const closest = results.filter(r => r.match_type === 'closest_match').length;
  const report = { input_count: items.length, processed_count: results.filter(r => r.stock_status !== 'Pending').length, exact_match_count: exact, closest_match_count: closest,
    verified_count: exact + closest, results };
  const reportPath = output.replace(/\.(?:json|jsonl|ndjson)$/i, '') + '.report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  return { report, reportPath };
}
async function runBatch({ page, items, output, signal, retryFailed = false, scrape = scrapeAbeBooksUk, delay = ms => new Promise(r => setTimeout(r, ms)), onRecord = () => {} }) {
  const resumeIndex = getResumeIndex(output, items, identity);
  const start = retryFailed ? 0 : resumeIndex;
  const saved = new Map((fs.existsSync(output) ? readJsonLines(output) : []).map(row => [identity(row), row]));
  const pauseFile = output + '.pause.json';
  if (start < items.length && fs.existsSync(pauseFile)) {
    const pause = JSON.parse(fs.readFileSync(pauseFile));
    if (Date.parse(pause.resume_after) > Date.now()) {
      console.log(`Paused until ${pause.resume_after}. Output preserved.`);
      return writeReport(output, items);
    }
    fs.rmSync(pauseFile);
  }
  for (let index = start; index < items.length && !signal?.aborted; index++) {
    const item = items[index];
    if (retryFailed && ['exact', 'closest_match'].includes(saved.get(identity(item))?.match_type)) continue;
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      result = await scrape(page, { isbn: identity(item), directUrl: item.buy_url || item.url });
      if (signal?.aborted) break;
      if (result.error_code !== 'extraction_error' || attempt === 1) break;
      await delay(10000);
    }
    if (signal?.aborted) break;
    const row = { ...item, ...result, input_index: index, scraped_at: new Date().toISOString() };
    if (result.error_code === 'blocked') {
      appendResult(output + '.blocked.jsonl', row);
      fs.writeFileSync(pauseFile, JSON.stringify({ input_index: index, resume_after: result.resume_after, reason: result.error }, null, 2) + '\n');
      console.log(`[${index + 1}/${items.length}] Blocked: ${result.error}. Pending input preserved.`);
      break;
    }
    appendResult(output, row);
    onRecord(row);
    console.log(`[${index + 1}/${items.length}] ${identity(item)}: ${row.title || row.stock_status} | ${row.match_type || row.error_code} | ${row.price ?? 'No price'} GBP | ${row.stock_status}`);
    if (index + 1 < items.length) await delay(3000 + Math.floor(Math.random() * 2001));
  }
  return writeReport(output, items);
}
async function main() {
  const args = process.argv.slice(2), file = args.shift();
  if (!file || file.startsWith('--')) throw new Error('Usage: node scrapers/abebooks-co-uk/abebooks-co-uk-isbn.js input.txt [--headless] [--output results.jsonl] [--retry-failed]');
  let headless = false, output, retryFailed = false;
  while (args.length) {
    const flag = args.shift();
    if (flag === '--headless') headless = true;
    else if (flag === '--retry-failed') retryFailed = true;
    else if (flag === '--output' && args[0] && !args[0].startsWith('--')) output = path.resolve(args.shift());
    else throw new Error(`Unknown or incomplete option: ${flag}`);
  }
  const input = path.resolve(file);
  output ||= path.resolve('output/abebooks-co-uk', path.basename(path.dirname(input)), 'results.jsonl');
  const items = /\.txt$/i.test(input) ? readSearchTerms(input).map(searched_isbn => ({ searched_isbn })) : readJsonLines(input);
  if (!items.length) throw new Error('Input contains no ISBNs.');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const lock = output + '.lock';
  if (fs.existsSync(lock)) {
    const owner = JSON.parse(fs.readFileSync(lock));
    try { process.kill(owner.pid, 0); throw new Error('Another scraper owns this output.'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    fs.rmSync(lock);
  }
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }), { flag: 'wx' });
  const controller = new AbortController();
  const stop = () => { console.log('Stopping after the current request; unfinished input will resume.'); controller.abort(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  let context;
  console.log(`AbeBooks UK input: ${input}\nOutput: ${output}`);
  try {
    if (getResumeIndex(output, items, identity) === items.length && !retryFailed) {
      const { reportPath } = writeReport(output, items); console.log(`Already complete. Report: ${reportPath}`); return;
    }
    const pauseFile = output + '.pause.json';
    if (fs.existsSync(pauseFile) && Date.parse(JSON.parse(fs.readFileSync(pauseFile)).resume_after) > Date.now()) {
      console.log(`Paused until ${JSON.parse(fs.readFileSync(pauseFile)).resume_after}. No requests made.`); return;
    }
    const profile = path.resolve('profiles/abebooks-co-uk', crypto.createHash('sha256').update(output).digest('hex').slice(0, 12));
    context = await chromium.launchPersistentContext(profile, { headless, viewport: { width: 1440, height: 1000 }, locale: 'en-GB' });
    const page = context.pages()[0] || await context.newPage();
    const { report, reportPath } = await runBatch({ page, items, output, signal: controller.signal, retryFailed });
    console.log(`Verified ${report.verified_count}/${items.length}: ${report.exact_match_count} exact, ${report.closest_match_count} closest. Report: ${reportPath}`);
    if (report.verified_count !== items.length) process.exitCode = 2;
  } finally {
    try { await context?.close(); }
    finally {
      fs.rmSync(lock, { force: true });
      process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    }
  }
}
module.exports = { main, runBatch, writeReport, identity };
