const fs = require("fs");
const { initBrowser, getRandomDelay } = require("../../utils/browser");
const {
  readJsonLines,
  readSearchTerms,
  appendResult,
} = require("../../utils/file");
const { initScraper } = require("../../utils/scraperInit");
const { startSpinner, stopSpinner } = require("../../utils/spinner");
const { scrapeMyPustakBook } = require("./scraper");

// CLI Standalone Runner
if (require.main === module) {
  (async () => {
    const { inputFile, isHeadless, outputFilePath } = initScraper(
      "mypustak-isbn.js",
      "mypustak",
      ".json",
    );

    const isTxt = inputFile.endsWith(".txt");
    let inputItems = [];

    if (isTxt) {
      const isbns = readSearchTerms(inputFile);
      inputItems = isbns
        .filter(
          (isbn) =>
            isbn.toLowerCase() !== "isbn" &&
            isbn.toLowerCase() !== "search_term",
        )
        .map((isbn) => ({ searched_isbn: isbn }));
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

    const { context, page } = await initBrowser(
      isHeadless,
      "mypustak_browser_profile",
    );

    for (let i = startIndex; i < inputItems.length; i++) {
      const item = inputItems[i];
      const targetIsbn = item.searched_isbn;

      console.log(
        `\n\x1b[1m[${i + 1}/${inputItems.length}] Processing ISBN: ${targetIsbn}\x1b[0m`,
      );

      if (!targetIsbn) {
        stopSpinner("Skipping item with no ISBN.", "warn");
        continue;
      }

      startSpinner(`Searching MyPustak for ISBN: ${targetIsbn}...`);

      try {
        const result = await scrapeMyPustakBook(page, { isbn: targetIsbn });

        const resultData = {
          ...item,
          ...result,
          scraped_at: new Date().toISOString(),
        };

        appendResult(outputFilePath, resultData);

        if (result.found) {
          const priceDisplay = result.price ? `₹${result.price}` : "No Price";
          const stockDisplay = result.in_stock ? "In Stock" : "Out of Stock";
          stopSpinner(
            `Found! Title: "${result.title || "N/A"}" | Price: ${priceDisplay} | Stock: ${stockDisplay}`,
            result.in_stock ? "success" : "warn",
          );
        } else {
          stopSpinner(
            `No listing found on MyPustak for ISBN: ${targetIsbn}`,
            "warn",
          );
        }

        await page.waitForTimeout(getRandomDelay(2000, 4000));
      } catch (err) {
        stopSpinner(`Error scraping ${targetIsbn}: ${err.message}`, "error");

        const errorData = {
          ...item,
          searched_isbn: targetIsbn,
          found: false,
          in_stock: false,
          stock_status: "Error",
          error: err.message,
          scraped_at: new Date().toISOString(),
        };
        appendResult(outputFilePath, errorData);

        await page.waitForTimeout(1000);
      }
    }

    await context.close();
    console.log(
      `\n🎉 MyPustak Scraper completed. Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = { scrapeMyPustakBook };
