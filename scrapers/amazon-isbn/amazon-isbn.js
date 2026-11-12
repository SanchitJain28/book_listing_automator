const { getResumeIndex } = require('../../utils/resume');
const fs = require("fs");
const path = require("path");
const { setTimeout: sleep } = require("node:timers/promises");
const { initBrowser, getRandomDelay } = require("../../utils/browser");
const {
  readJsonLines,
  readSearchTerms,
  appendResult,
} = require("../../utils/file");
const { initScraper } = require("../../utils/scraperInit");
const { setAmazonLocation } = require("../../utils/amazon");
const { startSpinner, stopSpinner } = require("../../utils/spinner");
const { scrapeAmazonBook } = require("./scraper");
const { retryAfterMs } = require("./core/requestPolicy");

const MIN_ISBN_DELAY_MS = 18_000;
const MAX_ISBN_DELAY_MS = 42_000;
const BASE_COOLDOWN_MS = 15 * 60_000;
const MAX_CONSECUTIVE_BLOCKS = 4;
const COOLDOWN_LOG_INTERVAL_MS = 60 * 1000;
const HOMEPAGE_DELAY_MS = 3000;

function nextIsbnDelay(processed) {
  return processed % 35 === 0 ? getRandomDelay(120_000, 240_000) : getRandomDelay(MIN_ISBN_DELAY_MS, MAX_ISBN_DELAY_MS);
}

async function waitForBlockCooldown(resumeAt) {
  for (let remaining = resumeAt - Date.now(); remaining > 0; remaining = resumeAt - Date.now()) {
    // Keep the VPS watcher informed while the scraper is intentionally idle.
    const minutes = Math.ceil(remaining / COOLDOWN_LOG_INTERVAL_MS);
    console.log(`[Amazon] Block cooldown: ${minutes} minute(s) remaining.`);
    await sleep(Math.min(remaining, COOLDOWN_LOG_INTERVAL_MS));
  }
}

async function runAmazonIsbn({
  name = "amazon-isbn",
  scrape = scrapeAmazonBook,
  emptyFields = {},
  blockResources = ["media"],
} = {}) {
  const isStandard = name === "amazon-isbn";
  const useChrome = process.argv.slice(3).includes("--chrome");
  const { inputFile, isHeadless, outputFilePath } = initScraper(
    `${name}.js`,
    name,
    ".json",
    { namespaceOutput: !isStandard },
  );

  const isTxt = inputFile.endsWith(".txt");
  let inputItems = [];

  if (isTxt) {
    const isbns = readSearchTerms(inputFile);
    inputItems = isbns.map((isbn) => ({ searched_isbn: isbn }));
  } else {
    inputItems = readJsonLines(inputFile).filter(item => item && (item.searched_isbn || item.isbn || item.buy_url || item.url));
  }

  const startIndex = getResumeIndex(outputFilePath, inputItems);
  if (startIndex === inputItems.length) return;
  const pauseFile = outputFilePath + ".pause.json";
  let consecutiveBlocks = 0;
  let freshSession = false;
  if (fs.existsSync(pauseFile)) {
    const pause = JSON.parse(fs.readFileSync(pauseFile, "utf8"));
    const resumeAt = Date.parse(pause.resume_after);
    if (!Number.isFinite(resumeAt) || !Number.isInteger(pause.input_index) || pause.input_index < 0 ||
        !Number.isInteger(pause.consecutive_blocks) || pause.consecutive_blocks < 1 ||
        pause.consecutive_blocks > MAX_CONSECUTIVE_BLOCKS || pause.input_index > startIndex) {
      throw new Error(`Invalid Amazon pause checkpoint: ${pauseFile}`);
    }
    if (pause.input_index === startIndex) {
      if (pause.consecutive_blocks === MAX_CONSECUTIVE_BLOCKS && resumeAt > Date.now()) {
        console.log(`[Amazon] Batch remains paused until ${pause.resume_after}. Rerun the same command after that time.`);
        return 3;
      }
      consecutiveBlocks = pause.consecutive_blocks === MAX_CONSECUTIVE_BLOCKS ? 0 : pause.consecutive_blocks;
      freshSession = true;
      await waitForBlockCooldown(resumeAt);
    } else {
      fs.rmSync(pauseFile, { force: true });
    }
  } else if (startIndex > 0) {
    const lastResult = readJsonLines(outputFilePath).at(-1);
    if (lastResult?.error_code === "blocked") {
      await waitForBlockCooldown(Date.parse(lastResult.resume_after));
    }
  }

  const profileSuffix = path.basename(inputFile, path.extname(inputFile)).replace(/[^a-zA-Z0-9_-]/g, '_');
  const profileName = `${name.replace(/-/g, "_")}_profile_${profileSuffix}`;
  let context, page;
  async function openBrowser(fresh) {
    ({ context, page } = await initBrowser(isHeadless, fresh ? null : profileName, blockResources, {
      nativeBrowser: true,
      ...(useChrome && { channel: "chrome" }),
    }));
    startSpinner("Checking Amazon delivery location (Gurgaon 122101)...");
    const locResult = await setAmazonLocation(page, "122101", { startupDelayMs: HOMEPAGE_DELAY_MS });
    stopSpinner(
      locResult.success
        ? `Delivery location active: ${locResult.location || "Gurgaon 122101"}`
        : `Delivery location setup skipped/failed: ${locResult.error}`,
      locResult.success ? "success" : "warn",
    );
  }

  try {
    await openBrowser(freshSession);
    for (let i = startIndex; i < inputItems.length;) {
      const item = inputItems[i];
      const isbn = item.searched_isbn || item.isbn;
      const directUrl = item.buy_url || item.url;

      console.log(
        `\n\x1b[1m[${i + 1}/${inputItems.length}] Processing ISBN: ${isbn || directUrl}\x1b[0m`,
      );

      if (i > startIndex && i % 500 === 0 && !consecutiveBlocks) {
        stopSpinner(`Flushing browser memory after ${i} items...`, "info");
        await context.close();
        await openBrowser(freshSession);
      }

      startSpinner(`Searching Amazon for ISBN ${isbn}...`);
      let result;
      try {
        result = await scrape(page, { directUrl, isbn });
      } catch (err) {
        stopSpinner(`Error processing ${isbn}: ${err.message}`, "error");

        result = {
          ...emptyFields,
          title: "Error",
          found_isbn: "Error",
          isbn_matched: false,
          price: "Error",
          mrp: "Error",
          delivery: "Error",
          seller: "Error",
          used_available: "Error",
          reviews_count: "Error",
          publisher: "Error",
          publication_date: "Error",
        };
        const debugFolder = path.join(__dirname, "..", "..", "debug", isStandard ? "" : name);
        if (!fs.existsSync(debugFolder))
          fs.mkdirSync(debugFolder, { recursive: true });
        await page
          .screenshot({
            path: path.join(debugFolder, `debug-error-${isbn}.png`),
          })
          .catch(() => {});
      }

      const scrapedAt = Date.now();
      const row = { ...item, ...result, scraped_at: new Date(scrapedAt).toISOString() };
      if (result.error_code === "blocked") {
        consecutiveBlocks++;
        const backoff = BASE_COOLDOWN_MS * 2 ** (consecutiveBlocks - 1);
        const serverResumeAt = scrapedAt + retryAfterMs(result.retry_after, scrapedAt);
        const resumeAt = Math.max(scrapedAt + backoff, Number.isFinite(new Date(serverResumeAt).getTime()) ? serverResumeAt : 0);
        const pause = {
          input_index: i,
          searched_isbn: isbn,
          reason: result.error || "Blocked by Amazon",
          consecutive_blocks: consecutiveBlocks,
          resume_after: new Date(resumeAt).toISOString(),
        };
        fs.mkdirSync(path.dirname(pauseFile), { recursive: true });
        const tempPause = pauseFile + `.${process.pid}.tmp`;
        fs.writeFileSync(tempPause, JSON.stringify(pause) + "\n");
        fs.renameSync(tempPause, pauseFile);
        appendResult(outputFilePath + ".blocked.jsonl", { ...row, ...pause });
        stopSpinner(`${result.stock_status} during ${result.block_stage} (${pause.reason})`, "warn");
        if (consecutiveBlocks === MAX_CONSECUTIVE_BLOCKS) {
          console.log(`[Amazon] Batch paused after ${consecutiveBlocks} consecutive blocks. Rerun the same command after ${pause.resume_after}.`);
          return 3;
        }
        await context.close();
        context = undefined;
        await waitForBlockCooldown(resumeAt);
        freshSession = true;
        await openBrowser(freshSession);
        continue;
      }

      appendResult(outputFilePath, row);
      if (freshSession && fs.existsSync(pauseFile)) fs.rmSync(pauseFile);
      consecutiveBlocks = 0;
      if (result.title !== "Error") {
        stopSpinner(
          `Successfully parsed. Price: ₹${result.price}, Match: ${result.isbn_matched ? "Yes" : "No"}`,
          result.in_stock ? "success" : "warn",
        );
      }
      i++;
      if (i < inputItems.length) await sleep(nextIsbnDelay(i));
    }
  } finally {
    await context?.close();
  }
  console.log("\n🎉 ISBN Scraper completed.");
}

if (require.main === module) runAmazonIsbn().then(code => { process.exitCode = code ?? 0; });

module.exports = { runAmazonIsbn };
