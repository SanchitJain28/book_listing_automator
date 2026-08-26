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
 * Scrapes Flipkart for a given product URL or ISBN.
 * @param {import('playwright').Page} page
 * @param {string} directUrl
 * @param {string} targetIsbn
 * @returns {Promise<Object>}
 */
async function scrapeFlipkart(page, directUrl, targetIsbn) {
  let targetUrl = directUrl;
  if (!targetUrl || !targetUrl.includes("flipkart.com")) {
    targetUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(targetIsbn)}`;
  }

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 35000,
  });

  await page.waitForTimeout(2000);

  // If on search listing page, click through to the top matching book
  let onProductPage = page.url().includes("/p/");

  if (!onProductPage) {
    const firstProduct = await page.$(
      "div[data-id] a, div._1AtVbE a[href*='/p/'], div.slAVV4 a, div.cPHDOP a[href*='/p/']",
    );

    if (firstProduct) {
      const productHref = await firstProduct.getAttribute("href");
      if (productHref) {
        const fullProductUrl = productHref.startsWith("http")
          ? productHref
          : `https://www.flipkart.com${productHref}`;
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
      store: "Flipkart",
      searched_isbn: targetIsbn || null,
      found: false,
      in_stock: false,
      stock_status: "Not Listed",
      url: page.url(),
    };
  }

  const data = await page.evaluate((isbn) => {
    const h1El = document.querySelector("h1.B_NuCI, h1");
    const title = h1El ? h1El.innerText.trim() : null;

    let price = null;
    let mrp = null;
    let discount = null;

    const allLeafNodes = Array.from(document.querySelectorAll("*")).filter(
      (el) => el.children.length === 0 && el.innerText && el.innerText.trim(),
    );

    const priceNodes = allLeafNodes.filter(
      (el) =>
        /^₹\s*\d+/.test(el.innerText.trim()) &&
        !/delivery/i.test(el.innerText) &&
        !/coupon/i.test(el.innerText),
    );

    if (priceNodes.length > 0) {
      const match = priceNodes[0].innerText.match(/₹\s*([\d,]+)/);
      if (match) price = parseFloat(match[1].replace(/,/g, ""));
    }

    const mrpNode = allLeafNodes.find(
      (el) =>
        (el.style && el.style.textDecorationLine === "line-through") ||
        (el.className && el.className.includes("yRaY8j")) ||
        (el.className && el.className.includes("_3I9_wc")),
    );
    if (mrpNode) {
      const m = mrpNode.innerText.match(/([\d,]+)/);
      if (m) mrp = parseFloat(m[1].replace(/,/g, ""));
    }

    const discNode = allLeafNodes.find(
      (el) =>
        /^\d+%\s*off/i.test(el.innerText.trim()) ||
        /^\d+%$/.test(el.innerText.trim()),
    );
    if (discNode) discount = discNode.innerText.trim();

    const pageText = document.body.innerText;
    let inStock = true;
    let stockStatus = "In Stock";

    const notifyBtn = Array.from(
      document.querySelectorAll("button, a, div"),
    ).some((el) => {
      const t = el.innerText ? el.innerText.trim().toUpperCase() : "";
      return t === "NOTIFY ME" || t === "SOLD OUT" || t === "OUT OF STOCK";
    });

    if (
      notifyBtn ||
      /currently\s+out\s+of\s+stock/i.test(pageText) ||
      /sold\s+out/i.test(pageText) ||
      /this\s+item\s+is\s+unavailable/i.test(pageText) ||
      !price
    ) {
      inStock = false;
      stockStatus = "Out of Stock";
    }

    let seller = null;
    const sellerEl = document.querySelector("#sellerName");
    if (sellerEl) {
      seller = sellerEl.innerText.split("\n")[0].trim();
    } else {
      const allDivs = Array.from(document.querySelectorAll("div, span"));
      const matchDiv = allDivs.find(
        (el) =>
          el.innerText &&
          (el.innerText.includes("Fulfilled by") ||
            el.innerText.includes("Sold by")),
      );
      if (matchDiv) {
        const sMatch = matchDiv.innerText.match(
          /(?:Fulfilled by|Sold by)\s+([^\n•]+)/i,
        );
        if (sMatch) seller = sMatch[1].trim();
      }
    }

    const specs = {};
    const specRows = document.querySelectorAll(
      "div.grid-formation-dynamic, div.row, table._14cfVK tr, div._1psv1zeb9",
    );
    specRows.forEach((row) => {
      const text = row.innerText.trim();
      if (text.includes("\n")) {
        const parts = text.split("\n").map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const key = parts[0];
          const val = parts.slice(1).join(" ");
          specs[key] = val;
        }
      }
    });

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
      seller: seller || "Flipkart",
      author: specs["Author"] || specs["Written by"] || null,
      publisher: specs["Publisher"] || null,
      binding: specs["Binding"] || null,
      pages: specs["Pages"] || null,
    };
  }, targetIsbn);

  return {
    store: "Flipkart",
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
      "flipkart-isbn.js",
      "flipkart",
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

    let { context, page } = await initBrowser(isHeadless, "flipkart_profile");

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

      startSpinner("Navigating to Flipkart...");

      try {
        const res = await scrapeFlipkart(page, directUrl, targetIsbn);
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
      `\n🎉 Flipkart Scraping Complete! Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = { scrapeFlipkart };
