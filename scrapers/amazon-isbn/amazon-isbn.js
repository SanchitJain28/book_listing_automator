const fs = require("fs");
const path = require("path");
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

(async () => {
  const { inputFile, isHeadless, outputFilePath } = initScraper(
    "amazon-isbn.js",
    "amazon-isbn",
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

  let { context, page } = await initBrowser(isHeadless);

  // Set delivery location to Gurgaon (122101)
  startSpinner("Checking Amazon delivery location (Gurgaon 122101)...");
  const locResult = await setAmazonLocation(page, "122101");
  if (locResult.success) {
    stopSpinner(
      locResult.alreadySet
        ? `Delivery location already active: ${locResult.location}`
        : `Delivery location set to Gurgaon (${locResult.location || "122101"})`,
      "success",
    );
  } else {
    stopSpinner(
      `Delivery location setup skipped/failed: ${locResult.error}`,
      "warn",
    );
  }

  for (let i = startIndex; i < inputItems.length; i++) {
    const item = inputItems[i];
    const isbn = item.searched_isbn || item.isbn;
    const directUrl = item.buy_url || item.url;

    console.log(
      `\n\x1b[1m[${i + 1}/${inputItems.length}] Processing ISBN: ${isbn || directUrl}\x1b[0m`,
    );

    if (i > 0 && i % 500 === 0) {
      stopSpinner(`Flushing browser memory after ${i} items...`, "info");
      await context.close();
      const newBrowser = await initBrowser(isHeadless);
      context = newBrowser.context;
      page = newBrowser.page;
      await setAmazonLocation(page, "122101");
    }

    if (!isbn && !directUrl) {
      stopSpinner("Skipping item with no ISBN.", "warn");
      continue;
    }

    try {
      startSpinner(`Searching Amazon for ISBN ${isbn}...`);

      const result = await scrapeAmazonBook(page, { directUrl, isbn });
      const finalData = {
        ...item,
        ...result,
        scraped_at: new Date().toISOString(),
      };

      appendResult(outputFilePath, finalData);

      stopSpinner(
        `Successfully parsed. Price: ₹${result.price}, Match: ${result.isbn_matched ? "Yes" : "No"}`,
        result.in_stock ? "success" : "warn",
      );

      await page.waitForTimeout(getRandomDelay(2000, 5000));
    } catch (err) {
      stopSpinner(`Error processing ${isbn}: ${err.message}`, "error");

      const errorData = {
        ...item,
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
      appendResult(outputFilePath, errorData);

      const debugFolder = path.join(__dirname, "..", "..", "debug");
      if (!fs.existsSync(debugFolder))
        fs.mkdirSync(debugFolder, { recursive: true });
      await page
        .screenshot({
          path: path.join(debugFolder, `debug-error-${isbn}.png`),
        })
        .catch(() => {});

      await page.waitForTimeout(1000);
    }
  }

  await context.close();
  console.log("\n🎉 ISBN Scraper completed.");
})();
