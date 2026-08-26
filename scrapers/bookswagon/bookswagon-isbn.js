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
 * Scrapes Bookswagon for a given product URL or ISBN.
 * @param {import('playwright').Page} page
 * @param {string} directUrl
 * @param {string} targetIsbn
 * @returns {Promise<Object>}
 */
async function scrapeBookswagon(page, directUrl, targetIsbn) {
  let targetUrl = directUrl;
  if (!targetUrl || !targetUrl.includes("bookswagon.com")) {
    targetUrl = `https://www.bookswagon.com/search-books/${encodeURIComponent(targetIsbn)}`;
  }

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 35000,
  });

  await page.waitForTimeout(2000);

  // If on search listing page, click through to the top matching book
  let onProductPage = page.url().includes("/book/");

  if (!onProductPage) {
    const firstBookLink = await page.$(
      'a[href*="/book/"], div.card a, div.list-view-books a',
    );

    if (firstBookLink) {
      const productHref = await firstBookLink.getAttribute("href");
      if (productHref) {
        const fullProductUrl = productHref.startsWith("http")
          ? productHref
          : `https://www.bookswagon.com${productHref}`;
        await page.goto(fullProductUrl, {
          waitUntil: "domcontentloaded",
          timeout: 35000,
        });
        await page.waitForTimeout(2000);
        onProductPage = true;
      }
    }
  }

  if (!onProductPage) {
    return {
      store: "Bookswagon",
      searched_isbn: targetIsbn || null,
      found: false,
      in_stock: false,
      stock_status: "Not Listed",
      url: page.url(),
    };
  }

  const data = await page.evaluate((isbn) => {
    const titleEl = document.querySelector(
      "#ctl00_phBody_ProductDetail_lblTitle, span.headingtext",
    );
    const title = titleEl
      ? titleEl.innerText.trim()
      : document.querySelector("h1")?.innerText.trim() || null;

    const bindingEl = document.querySelector(
      "#ctl00_phBody_ProductDetail_lblBinding",
    );
    const format = bindingEl
      ? bindingEl.innerText.replace(/[()]/g, "").trim()
      : null;

    const authorEls = Array.from(
      document.querySelectorAll(
        ".authordetailtext a[href*='/author/'], a[href*='/author/']",
      ),
    );
    const author =
      authorEls.length > 0
        ? Array.from(new Set(authorEls.map((a) => a.innerText.trim()))).join(
            ", ",
          )
        : null;

    const pubEl = document.querySelector(
      "#ctl00_phBody_ProductDetail_lblPublisher a, a[href*='/publisher/']",
    );
    const publisher = pubEl ? pubEl.innerText.trim() : null;

    let price = null;
    const priceEl = document.querySelector(
      "#ctl00_phBody_ProductDetail_lblourPrice, .desktopprice .originalprice label, .mobileprice .a-price",
    );
    if (priceEl) {
      const m = priceEl.innerText.match(/₹\s*([\d,.]+)/);
      if (m) price = parseFloat(m[1].replace(/,/g, ""));
    }

    let mrp = null;
    const mrpEl = document.querySelector(
      "#ctl00_phBody_ProductDetail_lblDocPrice, .desktopprice .actualprice label, .mobileprice .mrp-price",
    );
    if (mrpEl) {
      const m = mrpEl.innerText.match(/₹\s*([\d,.]+)/);
      if (m) mrp = parseFloat(m[1].replace(/,/g, ""));
    }

    let discount = null;
    const discEl = document.querySelector(
      "#ctl00_phBody_ProductDetail_lblDiscount, .desktopprice .discount, .mobileprice .discount-percent",
    );
    if (discEl && discEl.innerText.includes("%")) {
      discount = discEl.innerText.trim();
    }

    const pageText = document.body.innerText;
    const availEl = document.querySelector(
      "#ctl00_phBody_ProductDetail_lblAvailable",
    );
    const availText = availEl ? availEl.innerText.trim() : "";

    let inStock = true;
    let stockStatus = "In Stock";

    if (
      /out\s+of\s+stock/i.test(availText) ||
      /currently\s+unavailable/i.test(availText) ||
      /out\s+of\s+stock/i.test(pageText) ||
      !price
    ) {
      inStock = false;
      stockStatus = "Out of Stock";
    }

    return {
      title,
      price,
      mrp: mrp || price,
      discount:
        discount ||
        (mrp && price && mrp > price
          ? `${Math.round(((mrp - price) / mrp) * 100)}%`
          : null),
      currency: "INR",
      in_stock: inStock,
      stock_status: stockStatus,
      author,
      publisher,
      binding: format,
    };
  }, targetIsbn);

  return {
    store: "Bookswagon",
    searched_isbn: targetIsbn || null,
    found: !!data.title || !!data.price,
    ...data,
    seller: "Bookswagon",
    url: page.url(),
  };
}

// CLI Standalone Runner
if (require.main === module) {
  (async () => {
    const { inputFile, isHeadless, outputFilePath } = initScraper(
      "bookswagon-isbn.js",
      "bookswagon",
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

    let { context, page } = await initBrowser(isHeadless, "bookswagon_profile");

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

      if (i > 0 && i % 40 === 0) {
        stopSpinner(
          "☕ Taking a 10-second breather to maintain stealth...",
          "info",
        );
        await page.waitForTimeout(10000);
      }

      startSpinner("Navigating to Bookswagon...");

      try {
        const res = await scrapeBookswagon(page, directUrl, targetIsbn);
        const finalResult = {
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
      `\n🎉 Bookswagon Scraping Complete! Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = { scrapeBookswagon };
