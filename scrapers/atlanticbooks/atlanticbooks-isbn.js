const fs = require("fs");
const path = require("path");
const { initBrowser, getRandomDelay } = require("../../utils/browser");
const {
  readJsonLines,
  readSearchTerms,
  appendResult,
} = require("../../utils/file");
const { initScraper } = require("../../utils/scraperInit");
const { startSpinner, stopSpinner } = require("../../utils/spinner");
const { scrapeAtlanticBook } = require("./scraper");

(async () => {
  const { inputFile, isHeadless, outputFilePath } = initScraper(
    "atlanticbooks-isbn.js",
    "atlanticbooks",
    ".json",
  );

  const isTxt = inputFile.endsWith(".txt");
  let inputItems = [];

  if (isTxt) {
    const isbns = readSearchTerms(inputFile);
    inputItems = isbns.map((isbn) => ({ searched_isbn: isbn }));
  } else {
    inputItems = readJsonLines(inputFile);
  }

  let startIndex = 0;
  if (fs.existsSync(outputFilePath)) {
    const existingOutput = fs
      .readFileSync(outputFilePath, "utf-8")
      .split("\n")
      .filter(Boolean);
    startIndex = existingOutput.length;
    if (startIndex > 0) {
      console.log(
        `\n▶ Found existing output file with ${startIndex} items. Resuming from item ${startIndex + 1}...`,
      );
    }
  }

  let { context, page } = await initBrowser(isHeadless, "atlanticbooks_profile");

  for (let i = startIndex; i < inputItems.length; i++) {
    const item = inputItems[i];
    const targetIsbn = item.searched_isbn || item.isbn;
    const directUrl = item.buy_url || item.url;

    console.log(
      `\n\x1b[1m[${i + 1}/${inputItems.length}] Processing: ${targetIsbn || directUrl}\x1b[0m`,
    );

    if (!targetIsbn && !directUrl) {
      stopSpinner("Skipping item with no ISBN or URL.", "warn");
      continue;
    }

    startSpinner("Searching Atlantic Books...");

    try {
      const res = await scrapeAtlanticBook(page, { directUrl, isbn: targetIsbn });
      const finalResult = {
        ...item,
        ...res,
        scraped_at: new Date().toISOString(),
      };

      appendResult(outputFilePath, finalResult);

      const priceDisplay = finalResult.price
        ? `₹${finalResult.price}`
        : "No Price";
      const stockDisplay = finalResult.in_stock
        ? "🟢 In Stock"
        : "🔴 Out of Stock";

      stopSpinner(
        `[${i + 1}/${inputItems.length}] ${finalResult.title ? finalResult.title.slice(0, 35) : "Extracted"} | ${priceDisplay} | ${stockDisplay}`,
        finalResult.in_stock ? "success" : "warn",
      );

      await page.waitForTimeout(getRandomDelay(1000, 2500));
    } catch (err) {
      stopSpinner(`Error scraping ${targetIsbn}: ${err.message}`, "error");
      appendResult(outputFilePath, {
        ...item,
        searched_isbn: targetIsbn,
        found: false,
        error: err.message,
        url: directUrl || targetIsbn,
        scraped_at: new Date().toISOString(),
      });
    }
  }

  await context.close();
  console.log(
    `\n🎉 Atlantic Books Scraping Complete! Results saved to: ${outputFilePath}`,
  );
})();
