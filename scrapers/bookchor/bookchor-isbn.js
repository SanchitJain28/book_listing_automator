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
 * Scrapes BookChor for a given product URL or ISBN.
 * @param {import('playwright').Page} page
 * @param {string} directUrl
 * @param {string} targetIsbn
 * @returns {Promise<Object>}
 */
async function scrapeBookChor(page, directUrl, targetIsbn) {
  let targetUrl = directUrl;
  if (!targetUrl || !targetUrl.includes("bookchor.com")) {
    targetUrl = `https://www.bookchor.com/search/?query=${encodeURIComponent(targetIsbn)}`;
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
      'a[href*="/book/"], div.book a, div.book-card a, div.Products-box a',
    );

    if (firstBookLink) {
      const productHref = await firstBookLink.getAttribute("href");
      if (productHref) {
        const fullProductUrl = productHref.startsWith("http")
          ? productHref
          : `https://www.bookchor.com${productHref}`;
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
      store: "BookChor",
      searched_isbn: targetIsbn || null,
      found: false,
      in_stock: false,
      stock_status: "Not Listed",
      url: page.url(),
    };
  }

  const data = await page.evaluate((isbn) => {
    const titleEl = document.querySelector("h1.for-desktop, h1");
    const title = titleEl ? titleEl.innerText.trim() : null;

    const authorEl = document.querySelector(
      "ul.Author a[href*='/author/'], ul.Author strong",
    );
    const author = authorEl ? authorEl.innerText.trim() : null;

    let format = null;
    const authorItems = Array.from(document.querySelectorAll("ul.Author li"));
    for (const li of authorItems) {
      if (li.innerText.includes("Binding")) {
        const strong = li.querySelector("strong");
        if (strong) format = strong.innerText.trim();
      }
    }

    let price = null;
    const priceEl = document.querySelector("#sellingPWeb, .Products-price p");
    if (priceEl) {
      const m = priceEl.innerText.match(/₹\s*([\d,.]+)/);
      if (m) price = parseFloat(m[1].replace(/,/g, ""));
    }

    let mrp = null;
    const mrpEl = document.querySelector("#mrp_desktop, .Products-price del");
    if (mrpEl) {
      const m = mrpEl.innerText.match(/₹\s*([\d,.]+)/);
      if (m) mrp = parseFloat(m[1].replace(/,/g, ""));
    }

    let discount = null;
    const discEl = document.querySelector("#off_desktop, .Products-price span");
    if (discEl && discEl.innerText.includes("%")) {
      discount = discEl.innerText.trim();
    }

    const pageText = document.body.innerText;
    const outOfStockBtn = Array.from(
      document.querySelectorAll(".buynow button"),
    ).find((b) => b.innerText.includes("OUT OF STOCK"));
    const notifyBtn = document.querySelector("#notifiy");

    let inStock = true;
    let stockStatus = "In Stock";

    if (
      outOfStockBtn ||
      notifyBtn ||
      /out\s+of\s+stock/i.test(pageText) ||
      !price
    ) {
      if (document.querySelector("#sellingPWeb") && !outOfStockBtn) {
        inStock = true;
        stockStatus = "In Stock";
      } else {
        inStock = false;
        stockStatus = "Out of Stock";
      }
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
      binding: format,
    };
  }, targetIsbn);

  return {
    store: "BookChor",
    searched_isbn: targetIsbn || null,
    found: !!data.title || !!data.price,
    ...data,
    seller: "BookChor",
    url: page.url(),
  };
}

// CLI Standalone Runner
if (require.main === module) {
  (async () => {
    const { inputFile, isHeadless, outputFilePath } = initScraper(
      "bookchor-isbn.js",
      "bookchor",
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

    let { context, page } = await initBrowser(isHeadless, "bookchor_profile");

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

      startSpinner("Navigating to BookChor...");

      try {
        const res = await scrapeBookChor(page, directUrl, targetIsbn);
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
      `\n🎉 BookChor Scraping Complete! Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = { scrapeBookChor };
