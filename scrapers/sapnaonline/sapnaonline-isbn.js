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
 * Scrapes SapnaOnline for a given product URL or ISBN.
 * @param {import('playwright').Page} page
 * @param {string} directUrl
 * @param {string} targetIsbn
 * @returns {Promise<Object>}
 */
async function scrapeSapnaOnline(page, directUrl, targetIsbn) {
  let targetUrl = directUrl;
  if (!targetUrl || !targetUrl.includes("sapnaonline.com")) {
    targetUrl = `https://www.sapnaonline.com/search?keyword=${encodeURIComponent(targetIsbn)}`;
  }

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 35000,
  });

  await page.waitForTimeout(2000);

  // If on search listing page, click through to the top matching book
  let onProductPage = page.url().includes("/books/") || page.url().includes("/shop/product/");

  if (!onProductPage) {
    const firstProduct = await page.$(
      "div[class*='ProductImageDetailCard'] a, div[class*='BookCard'] a, div[class*='ProductList'] a[href*='/books/'], div[class*='ProductList'] a[href*='/shop/product/']",
    );

    if (firstProduct) {
      const productHref = await firstProduct.getAttribute("href");
      if (productHref) {
        const fullProductUrl = productHref.startsWith("http")
          ? productHref
          : `https://www.sapnaonline.com${productHref}`;
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
      store: "SapnaOnline",
      searched_isbn: targetIsbn || null,
      found: false,
      in_stock: false,
      stock_status: "Not Listed",
      url: page.url(),
    };
  }

  const data = await page.evaluate((isbn) => {
    // 1. Next.js __NEXT_DATA__ JSON State
    try {
      const nextDataEl = document.querySelector("#__NEXT_DATA__");
      if (nextDataEl) {
        const json = JSON.parse(nextDataEl.innerText);
        const apolloState =
          json.props?.pageProps?.initialApolloState ||
          json.props?.pageProps?.initialState ||
          {};

        for (const key of Object.keys(apolloState)) {
          if (
            key.startsWith("ProductEntity:") ||
            key.startsWith("BookEntity:") ||
            key.startsWith("Product:")
          ) {
            const entity = apolloState[key];
            if (entity.product_name || entity.name) {
              const stockQty = entity.product_stock_qty ?? 1;
              const inStock = stockQty > 0;
              const price =
                entity.product_unit_price || entity.product_msrp || null;
              const mrp =
                entity.product_discount && entity.product_discount > 0
                  ? price + entity.product_discount
                  : price;

              return {
                title: entity.product_name || null,
                price: price ? Number(price) : null,
                mrp: mrp ? Number(mrp) : null,
                discount: entity.product_discount_percentage
                  ? `${entity.product_discount_percentage}%`
                  : null,
                in_stock: inStock,
                stock_status: inStock ? "In Stock" : "Out of Stock",
                author: entity.product_author || null,
                publisher: entity.product_publisher || null,
                binding: entity.product_binding || null,
                language: entity.product_language || null,
                source: "next_data",
              };
            }
          }
        }
      }
    } catch (err) {}

    // 2. DOM Parsing Fallback
    const h1El = document.querySelector(
      "h1, div[class*='ProductImageDetailCard__TitleText'] h1, div[class*='TitleText']",
    );
    const title = h1El ? h1El.innerText.trim() : null;

    let price = null;
    let mrp = null;
    let discount = null;

    const priceEl = document.querySelector(
      "div[class*='AmountBlock__PriceText'], div[class*='PriceText']",
    );
    if (priceEl && priceEl.innerText.includes("₹")) {
      const match = priceEl.innerText.match(/₹\s*([\d,.]+)/);
      if (match) price = parseFloat(match[1].replace(/,/g, ""));
    }

    if (!price) {
      const allLeafs = Array.from(document.querySelectorAll("*")).filter(
        (el) => el.children.length === 0 && el.innerText && el.innerText.trim(),
      );
      const pNode = allLeafs.find((el) => /^₹\s*\d+/.test(el.innerText.trim()));
      if (pNode) {
        const m = pNode.innerText.match(/₹\s*([\d,.]+)/);
        if (m) price = parseFloat(m[1].replace(/,/g, ""));
      }
    }

    const mrpEl = document.querySelector("div[class*='ActualPrice'], div[class*='MrpPrice']");
    if (mrpEl) {
      const m = mrpEl.innerText.match(/₹\s*([\d,.]+)/);
      if (m) mrp = parseFloat(m[1].replace(/,/g, ""));
    }

    let author = null;
    const authorEl = document.querySelector(
      "a[href*='/shop/author/'], a[href*='/author/']",
    );
    if (authorEl) author = authorEl.innerText.replace(/,/g, "").trim();

    let publisher = null;
    const pubEl = document.querySelector(
      "a[href*='/shop/publisher/'], a[href*='/publisher/']",
    );
    if (pubEl) publisher = pubEl.innerText.trim();

    const pageText = document.body.innerText;
    let inStock = true;
    let stockStatus = "In Stock";

    const notifyBtn = Array.from(
      document.querySelectorAll("button, div"),
    ).some((el) => {
      const t = el.innerText ? el.innerText.trim().toUpperCase() : "";
      return (
        t === "NOTIFY ME" ||
        t.includes("CURRENTLY UNAVAILABLE") ||
        t.includes("OUT OF STOCK")
      );
    });

    if (
      notifyBtn ||
      /out\s+of\s+stock/i.test(pageText) ||
      /currently\s+unavailable/i.test(pageText) ||
      !price
    ) {
      inStock = false;
      stockStatus = "Out of Stock";
    }

    return {
      title,
      price,
      mrp: mrp || price,
      discount: mrp && price && mrp > price ? `${Math.round(((mrp - price) / mrp) * 100)}%` : null,
      currency: "INR",
      in_stock: inStock,
      stock_status: stockStatus,
      author,
      publisher,
      source: "browser_dom",
    };
  }, targetIsbn);

  return {
    store: "SapnaOnline",
    searched_isbn: targetIsbn || null,
    found: !!data.title || !!data.price,
    ...data,
    seller: "SapnaOnline",
    url: page.url(),
  };
}

// CLI Standalone Runner
if (require.main === module) {
  (async () => {
    const { inputFile, isHeadless, outputFilePath } = initScraper(
      "sapnaonline-isbn.js",
      "sapnaonline",
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

    let { context, page } = await initBrowser(isHeadless, "sapnaonline_profile");

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

      startSpinner("Navigating to SapnaOnline...");

      try {
        const res = await scrapeSapnaOnline(page, directUrl, targetIsbn);
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
      `\n🎉 SapnaOnline Scraping Complete! Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = { scrapeSapnaOnline };
