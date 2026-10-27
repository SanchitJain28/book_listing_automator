#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SharedBrowserPool } = require('../utils/sharedBrowserPool');
const { getResumeIndex } = require('../utils/resume');
const { readSearchTerms, readJsonLines, appendResult } = require('../utils/file');
const root = path.resolve(__dirname, '..');

function registry() {
  const platforms = {};
  const add = (name, scrape) => {
    const runner = require(`../scrapers/${name}/runner`);
    platforms[name] = { name, scrape, identity: runner.identity,
      report: (output, items) => runner.writeReport(output, items, runner.latestRecords(output)) };
  };
  add('atlanticbooks', (page, item) => require('../scrapers/atlanticbooks/scraper').scrapeAtlanticBook(page, { isbn: item.searched_isbn || item.isbn, directUrl: item.buy_url || item.url }));
  add('bookswagon', (page, item) => require('../scrapers/bookswagon/scraper').scrapeBookswagon(page, item.buy_url || item.url, item.searched_isbn || item.isbn));
  platforms.bookswagon.prepareItems = items => {
    const occurrences = new Map();
    return items.map(item => {
      const key = platforms.bookswagon.identity({ ...item, input_occurrence: 1 });
      const occurrence = (occurrences.get(key) || 0) + 1; occurrences.set(key, occurrence);
      return { ...item, input_occurrence: occurrence };
    });
  };
  add('flipkart', (page, item) => require('../scrapers/flipkart/scraper').scrapeFlipkart(page, item.buy_url || item.url, item.searched_isbn || item.isbn));
  add('mypustak', (page, item) => require('../scrapers/mypustak/scraper').scrapeMyPustakBook(page, { isbn: item.searched_isbn || item.isbn, directUrl: item.buy_url || item.url }));
  add('sapnaonline', (page, item) => require('../scrapers/sapnaonline/scraper').scrapeSapnaOnline(page, item.buy_url || item.url, item.searched_isbn || item.isbn));
  add('ompublication', (page, item) => require('../scrapers/ompublication/scraper').scrapeOmPublication(page, item.buy_url || item.url, item.searched_isbn || item.isbn));
  add('bookchor', (page, item) => require('../scrapers/bookchor/scraper').scrapeBookChor(page, item.buy_url || item.url, item.searched_isbn || item.isbn));
  // Legacy AbeBooks rows overwrite `url` with the product URL and do not retain
  // input_url. Validate their ISBN order rather than comparing that derived URL.
  platforms.abebooks = { name: 'abebooks', identity: item => String(item.searched_isbn || item.isbn || '').replace(/[\s-]/g, ''),
    scrape: (page, item) => require('../scrapers/abebooks/scraper').scrapeAbeBooksBook(page, { isbn: item.searched_isbn || item.isbn, directUrl: item.buy_url || item.url }),
    report(output, items) {
      const records = fs.existsSync(output) ? readJsonLines(output) : [];
      const reportPath = output.replace(/\.(?:jsonl?|ndjson)$/i, '') + '.report.json';
      const report = { generated_at: new Date().toISOString(), input_count: items.length, matched_count: records.filter(row => row.isbn_matched === true && row.found === true).length, results: records };
      fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
      return { report, reportPath };
    } };
  return platforms;
}
function blocked(row) { return /blocked|rate.limit|captcha|robot|429/i.test(String(row.stock_status || '')) || row.error_code === 'blocked'; }
function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n'); fs.renameSync(file + '.tmp', file);
}
async function runShared({ jobs, items, pool, batchSize = 100, statusFile, signal, logger = console.log, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('batchSize must be positive.');
  if (new Set(jobs.map(job => path.resolve(job.output))).size !== jobs.length) throw new Error('Each scraper needs a separate output file.');
  const states = {}, locks = [];
  const inputs = new Map(jobs.map(job => [job.name, job.prepareItems ? job.prepareItems(items) : items]));
  function snapshot() {
    const data = { checked_at: new Date().toISOString(), pid: process.pid, runtime: pool.stats(), scrapers: states };
    if (statusFile) atomicJson(statusFile, data);
    return data;
  }
  try {
    for (const job of jobs) {
      fs.mkdirSync(path.dirname(job.output), { recursive: true });
      const lock = job.output + '.shared.lock';
      if (fs.existsSync(lock)) {
        const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
        let alive = true;
        try { process.kill(owner.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
        if (alive) throw new Error(`Output already has a shared runner lock: ${lock}`);
        fs.unlinkSync(lock);
      }
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }), { flag: 'wx' }); locks.push(lock);
      const index = getResumeIndex(job.output, inputs.get(job.name), job.identity);
      states[job.name] = { state: index === items.length ? 'Finished' : 'Queued', processed: index, total: items.length, output: job.output, context_batches: 0 };
    }
    snapshot();
    await Promise.all(jobs.map(async job => {
      const state = states[job.name];
      const jobItems = inputs.get(job.name);
      try {
        const checkpoint = job.output + '.shared-pause.json';
        if (fs.existsSync(checkpoint)) {
          const pause = JSON.parse(fs.readFileSync(checkpoint, 'utf8'));
          if (!Number.isFinite(Date.parse(pause.resume_after))) throw new Error('Invalid shared-runner pause checkpoint.');
          if (Date.parse(pause.resume_after) > Date.now()) { Object.assign(state, { state: 'Blocked', resume_after: pause.resume_after }); return; }
        }
        while (state.processed < items.length && !signal?.aborted) {
          state.state = 'Queued'; snapshot();
          const lease = await pool.acquire(job.name);
          try {
            if (signal?.aborted) break;
            state.state = 'Running'; state.context_batches++; snapshot();
            const end = Math.min(items.length, state.processed + batchSize);
            while (state.processed < end && !signal?.aborted) {
              const index = state.processed, item = jobItems[index];
              let result;
              try { result = await job.scrape(lease.page, item); }
              catch (error) { result = { found: false, isbn_matched: false, stock_status: 'Error', error_code: 'scraper_error', error: error.message }; }
              if (signal?.aborted) break;
              if (lease.page.isClosed()) throw new Error('Browser page closed before saving the result. Resume this pending input after restarting.');
              const record = { ...item, ...result, input_index: index, input_url: item.buy_url || item.url || null, scraped_at: new Date().toISOString() };
              if (blocked(result)) {
                const resume_after = new Date(Math.max(Date.now() + 1800000, Date.parse(result.resume_after) || 0)).toISOString();
                appendResult(job.output + '.blocked.jsonl', record); atomicJson(checkpoint, { input_index: index, resume_after, reason: result.error || result.stock_status });
                Object.assign(state, { state: 'Blocked', resume_after });
                logger(`[${job.name}] Blocked at input ${index + 1}; pending input preserved. Resume after ${resume_after}.`);
                break;
              }
              appendResult(job.output, record); state.processed++;
              logger(`[${job.name} ${state.processed}/${items.length}] ${item.searched_isbn || item.isbn}: ${result.stock_status || 'saved'}`);
              // Close all pages other than the job's main page at every input boundary.
              await lease.clean();
              if (state.processed % 25 === 0) { snapshot(); logger(`[Pool] ${JSON.stringify(pool.stats())}`); }
              if (state.processed < items.length && !signal?.aborted) await sleep(job.name === 'abebooks' ? 2500 + Math.floor(Math.random() * 2501) : 2000 + Math.floor(Math.random() * 2001));
            }
          } finally { await lease.release(); }
          snapshot();
          if (state.state === 'Blocked') break;
        }
        if (signal?.aborted && state.state !== 'Blocked') state.state = 'Stopped';
        else if (state.processed === items.length) { state.state = 'Finished'; fs.rmSync(job.output + '.shared-pause.json', { force: true }); }
      } catch (error) { Object.assign(state, { state: 'Failed', error: error.message }); logger(`[${job.name}] ${error.message}`); }
      finally {
        if (job.report) try {
          const report = job.report(job.output, jobItems);
          state.report = report.reportPath; state.matched_count = report.report.matched_count;
        } catch (error) { state.report_error = error.message; }
        snapshot();
      }
    }));
  } finally {
    await pool.close();
    for (const lock of locks) fs.rmSync(lock, { force: true });
    snapshot();
  }
  return states;
}
async function main() {
  const args = process.argv.slice(2), input = args.shift();
  if (!input || input.startsWith('--')) throw new Error('Usage: node scripts/run-shared-scrapers.js input.txt [--headless] [--platforms a,b] [--concurrency 4] [--browsers 2] [--batch-size 100] [--resources block-assets|cache] [--output-subdir manual-search/date]');
  const options = {};
  while (args.length) {
    const flag = args.shift();
    if (flag === '--headless') options.headless = true;
    else if (['--platforms', '--concurrency', '--browsers', '--batch-size', '--resources', '--output-subdir'].includes(flag)) {
      const value = args.shift(); if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`); options[flag.slice(2)] = value;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  const platforms = registry(), names = options.platforms ? options.platforms.split(',') : Object.keys(platforms);
  if (!names.length || new Set(names).size !== names.length || names.some(name => !platforms[name])) throw new Error('Choose supported, distinct platform names. Amazon scrapers are not part of this runner.');
  const numeric = (name, fallback) => { const value = options[name] === undefined ? fallback : Number(options[name]); if (!Number.isInteger(value) || value < 1 || value > 10000) throw new Error(`Invalid --${name}.`); return value; };
  const concurrency = numeric('concurrency', 4), browsers = numeric('browsers', 2), batchSize = numeric('batch-size', 100);
  const relativeInput = path.relative(path.join(root, 'input-data'), path.resolve(input));
  const folder = options['output-subdir'] || (relativeInput.startsWith('..') ? `shared/${path.basename(path.dirname(input))}-${path.parse(input).name}` : path.dirname(relativeInput));
  if (path.isAbsolute(folder) || folder.split(/[\\/]/).some(part => part === '..') || folder.includes('\0')) throw new Error('Output subdirectory must stay inside output/.');
  const items = /\.txt$/i.test(input) ? readSearchTerms(input).map(searched_isbn => ({ searched_isbn })) : readJsonLines(input);
  if (!items.length) throw new Error('Input is empty.');
  const jobs = names.map(name => ({ ...platforms[name], output: name === 'abebooks' ? path.join(root, 'output', folder, path.parse(input).name + '.json') : path.join(root, 'output', name, folder, 'results.jsonl') }));
  const key = crypto.createHash('sha256').update(JSON.stringify(jobs.map(job => job.output))).digest('hex').slice(0, 12);
  const statusFile = path.join(root, 'output/shared-runs', key + '.status.json');
  const pool = new SharedBrowserPool({ browserCount: browsers, concurrency, stateDir: path.join(root, 'profiles/shared-scrapers', key), headless: !!options.headless, resources: options.resources || 'block-assets' });
  console.log(`Shared runner: ${browsers} browser(s), at most ${concurrency} active contexts, ${batchSize} inputs per context batch.\nStatus: ${statusFile}`);
  const stop = new AbortController();
  const onSignal = () => { console.log('Stopping after current scraper calls finish; pending inputs remain resumable.'); stop.abort(); };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  try {
    const states = await runShared({ items, jobs, pool, batchSize, statusFile, signal: stop.signal });
    process.exitCode = stop.signal.aborted ? 130 : Object.values(states).some(state => state.state === 'Failed' || state.report_error) ? 1 : Object.values(states).some(state => state.state === 'Blocked') ? 3 : Object.values(states).some(state => state.matched_count < state.total) ? 2 : 0;
  } finally { process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { registry, runShared, main, blocked };
