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

/**
 * Scrapes Agapea for a given product URL or ISBN.
 * @param {import('playwright').Page} page
 * @param {string} directUrl
 * @param {string} targetIsbn
 * @returns {Promise<Object>}
 */
async function scrapeAgapea(page, directUrl, targetIsbn) {
  let targetUrl = directUrl;
  if (!targetUrl || !targetUrl.includes("agapea.com")) {
    targetUrl = `https://www.agapea.com/buscar/buscador.php?texto=${encodeURIComponent(targetIsbn)}`;
  }

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 35000,
  });

  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const titleEl = document.querySelector("h1, .titulo-libro, .title");
    const title = titleEl ? titleEl.innerText.trim() : null;

    let author = null;
    const authorEl = document.querySelector(".autor a, .author a, a[href*='autor']");
    if (authorEl) author = authorEl.innerText.trim();

    let price = null;
    const priceEl = document.querySelector(".precio, .price, .precio-actual, [itemprop='price']");
    if (priceEl) {
      const m = priceEl.innerText.match(/([\d,.]+)/);
      if (m) price = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    }

    let inStock = true;
    let stockStatus = "In Stock";
    const pageText = document.body.innerText;
    if (
      pageText.includes("Agotado") ||
      pageText.includes("No disponible") ||
      !price
    ) {
      inStock = false;
      stockStatus = "Out of Stock";
    }

    return {
      title,
      author,
      price,
      mrp: price,
      currency: "EUR",
      in_stock: inStock,
      stock_status: stockStatus,
      seller: "Agapea",
    };
  });

  return {
    store: "Agapea",
    searched_isbn: targetIsbn || null,
    found: !!data.title || !!data.price,
    ...data,
    url: page.url(),
  };
}

// CLI Standalone Runner
if (require.main === module) {
  (async () => {
    const { inputFile, isHeadless, outputFilePath } = initScraper(
      "agapea-isbn.js",
      "agapea",
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

    let { context, page } = await initBrowser(isHeadless, "agapea_profile");

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

      startSpinner(`Searching Agapea...`);

      try {
        const res = await scrapeAgapea(page, directUrl, targetIsbn);
        const finalResult = {
          ...res,
          scraped_at: new Date().toISOString(),
        };

        appendResult(outputFilePath, finalResult);

        const priceDisplay = finalResult.price
          ? `${finalResult.currency} ${finalResult.price}`
          : "No Price";
        const stockDisplay = finalResult.in_stock
          ? "🟢 In Stock"
          : "🔴 Out of Stock";

        stopSpinner(
          `[${i + 1}/${inputItems.length}] ${finalResult.title ? finalResult.title.slice(0, 35) : "Extracted"} | ${priceDisplay} | ${stockDisplay}`,
          finalResult.in_stock ? "success" : "warn",
        );
      } catch (err) {
        stopSpinner(`Error scraping ${targetIsbn}: ${err.message}`, "error");
        appendResult(outputFilePath, {
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
      `\n🎉 Agapea Scraping Complete! Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = { scrapeAgapea };
