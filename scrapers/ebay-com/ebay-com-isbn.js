const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { chromium } = require('playwright');
const { initScraper } = require('../../utils/scraperInit');
const { readSearchTerms, readJsonLines, appendResult } = require('../../utils/file');
const { getResumeIndex } = require('../../utils/resume');
const { scrapeEbayBook } = require('./scraper');
const { connectProfile, stopProfile } = require('../../utils/kameleo');

async function waitForEnter(page, prompt) {
  if (!process.stdin.isTTY || !page || page.isClosed()) return false;
  const terminal = readline.createInterface({ input: process.stdin });
  const closeTerminal = () => terminal.close();
  const closed = once(terminal, 'close');
  let entered = false;
  terminal.once('line', () => {
    entered = true;
    closeTerminal();
  });
  page.once('close', closeTerminal);
  try {
    console.log(prompt);
    await closed;
    return entered && !page.isClosed();
  } finally {
    page.off('close', closeTerminal);
    terminal.close();
  }
}

async function main() {
  const { inputFile, isHeadless, outputFilePath } = initScraper(__filename, 'ebay-com', '.jsonl');
  const warmUp = process.argv.includes('--warm-up');
  const persistent = warmUp || process.argv.includes('--persistent-chrome');
  const kameleoIndex = process.argv.indexOf('--kameleo-profile');
  const kameleoProfile = kameleoIndex === -1 ? null : process.argv[kameleoIndex + 1];
  if (kameleoIndex !== -1 && (!kameleoProfile || kameleoProfile.startsWith('--'))) {
    throw new Error('--kameleo-profile requires a profile ID');
  }
  if (kameleoProfile && (isHeadless || process.argv.includes('--chrome') || process.argv.includes('--persistent-chrome'))) {
    throw new Error('Use --kameleo-profile with the browser settings configured in Kameleo');
  }
  if (warmUp && (isHeadless || !process.stdin.isTTY)) {
    throw new Error('--warm-up requires a headed run in an interactive terminal');
  }
  const outputIndex = process.argv.indexOf('--output');
  const explicitOutput = outputIndex === -1 ? null : process.argv[outputIndex + 1];
  if (outputIndex !== -1 && (!explicitOutput || explicitOutput.startsWith('--'))) {
    throw new Error('--output requires a file path');
  }
  const output = explicitOutput ? path.resolve(explicitOutput) : outputFilePath;
  const items = inputFile.toLowerCase().endsWith('.txt')
    ? readSearchTerms(inputFile).map(searched_isbn => ({ searched_isbn }))
    : readJsonLines(inputFile);
  if (!items.length) throw new Error('Input contains no ISBNs');
  const identity = row => row.searched_isbn ?? row.isbn;
  const start = getResumeIndex(output, items, identity);
  console.log('eBay US output: ' + output);

  let browser;
  let context;
  let page;
  let kameleoConnected = false;
  let blocked = null;
  try {
    if (start < items.length) {
      if (kameleoProfile) {
        browser = await connectProfile(kameleoProfile);
        kameleoConnected = true;
        const existingContext = browser.contexts()[0];
        if (!existingContext) throw new Error('Kameleo did not provide an existing browser context');
        page = existingContext.pages()[0] || await existingContext.newPage();
      } else if (persistent) {
        const profile = path.resolve(__dirname, '../../profiles/ebay-com/chrome');
        context = await chromium.launchPersistentContext(profile, {
          channel: 'chrome',
          headless: isHeadless,
          locale: 'en-US',
        });
        page = context.pages()[0] || await context.newPage();
      } else {
        const channel = process.argv.includes('--chrome') ? 'chrome' : undefined;
        browser = await chromium.launch({ headless: isHeadless, channel });
        page = await browser.newPage({ locale: 'en-US' });
      }
      if (warmUp && !await waitForEnter(page, 'Browse or sign in to eBay in Chrome, then press Enter here to start the ISBN search.')) {
        return;
      }
      for (let index = start; index < items.length; index++) {
        const isbn = identity(items[index]);
        let result;
        try {
          result = await scrapeEbayBook(page, { isbn });
        } catch (error) {
          if (error.code === 'blocked') {
            blocked = { input_index: index, isbn, reason: error.message };
            console.error(error.message + '. Pending ISBN preserved: ' + isbn);
            break;
          }
          result = { searched_isbn: isbn, store: 'eBay US', found: false, isbn_matched: false, stock_status: 'Error', error: error.message };
        }
        appendResult(output, { ...items[index], ...result, input_index: index, scraped_at: new Date().toISOString() });
        console.log(`[${index + 1}/${items.length}] ${isbn} | ${result.title || result.error || result.stock_status} | ${result.isbn_matched ? 'ISBN verified' : result.stock_status}`);
        if (index + 1 < items.length) await page.waitForTimeout(2000);
      }
    }

    const results = fs.existsSync(output) ? readJsonLines(output) : [];
    const report = {
      input_count: items.length,
      attempted_count: results.length + Number(Boolean(blocked)),
      saved_count: results.length,
      matched_count: results.filter(row => row.isbn_matched).length,
      blocked,
      results,
    };
    const reportPath = output.replace(/\.(?:jsonl?|ndjson)$/i, '') + '.report.json';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(`Verified ${report.matched_count}/${items.length} ISBNs. Report: ${reportPath}`);
    process.exitCode = blocked ? 3 : report.matched_count === items.length ? 0 : 2;
    if (!isHeadless) await waitForEnter(page, 'Press Enter in this terminal to close the eBay browser.');
  } finally {
    try {
      if (kameleoConnected) await stopProfile(kameleoProfile);
    } finally {
      await context?.close();
      await browser?.close();
    }
  }
}

if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
