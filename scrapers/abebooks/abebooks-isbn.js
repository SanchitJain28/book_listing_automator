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
const { scrapeAbeBooksBook } = require("./scraper");

(async () => {
  const { inputFile, isHeadless, outputFilePath } = initScraper(
    "abebooks-isbn.js",
    "abebooks-isbn",
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

  let { context, page } = await initBrowser(isHeadless, "abebooks_profile");

  for (let i = startIndex; i < inputItems.length; i++) {
    const item = inputItems[i];
    const targetIsbn = item.searched_isbn || item.isbn;
    const directUrl = item.buy_url || item.url;

    console.log(
      `\n\x1b[1m[${i + 1}/${inputItems.length}] Processing ISBN: ${targetIsbn || directUrl}\x1b[0m`,
    );

    if (!targetIsbn && !directUrl) {
      stopSpinner("Skipping item with no ISBN.", "warn");
      continue;
    }

    if (i > 0 && i % 50 === 0) {
      stopSpinner(
        "☕ Taking a 15-second human break to avoid rate limits...",
        "info",
      );
      await new Promise((r) => setTimeout(r, 15000));
    }

    if (i > 0 && i % 400 === 0) {
      stopSpinner(`Flushing browser memory after ${i} items...`, "info");
      await context.close();
      const newBrowser = await initBrowser(isHeadless, "abebooks_profile");
      context = newBrowser.context;
      page = newBrowser.page;
    }

    startSpinner(`Searching AbeBooks for ${targetIsbn || directUrl}...`);

    try {
      const result = await scrapeAbeBooksBook(page, { directUrl, isbn: targetIsbn });
      const finalData = { ...item, ...result, scraped_at: new Date().toISOString() };

      appendResult(outputFilePath, finalData);

      if (result.found && result.listings && result.listings.length > 0) {
        stopSpinner(
          `Found ${result.listings.length} listing(s)! (Top: ${result.listings[0].price} | Match: ${result.listings[0].isbn_match})`,
          "success",
        );
      } else {
        stopSpinner(`No listings found for ${targetIsbn}.`, "warn");
      }

      await page.waitForTimeout(getRandomDelay(2500, 5000));
    } catch (err) {
      stopSpinner(`Error processing ${targetIsbn}: ${err.message}`, "error");

      const errorData = {
        ...item,
        listings: [
          {
            price: "Error",
            shipping: "Error",
            seller: "Error",
            seller_address: "Error",
            found_isbn: "Error",
            isbn_match: false,
          },
        ],
        scraped_at: new Date().toISOString(),
      };
      appendResult(outputFilePath, errorData);

      const debugFolder = path.join(__dirname, "..", "..", "debug");
      if (!fs.existsSync(debugFolder))
        fs.mkdirSync(debugFolder, { recursive: true });
      await page.screenshot({
        path: path.join(
          debugFolder,
          `debug-abebooks-error-${targetIsbn}.png`,
        ),
      }).catch(() => {});

      await page.waitForTimeout(1000);
    }
  }

  await context.close();
  console.log(
    `\n🎉 AbeBooks Scraper completed. Results saved to ${outputFilePath}`,
  );
})();
