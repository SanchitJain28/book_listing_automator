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

async function searchAtlanticByIsbn(isbn) {
  try {
    const searchUrl = `https://atlanticbooks.com/search?type=product&q=${encodeURIComponent(isbn)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    const matches = html.match(/\/products\/([a-zA-Z0-9_-]+)/g);
    if (!matches || matches.length === 0) return null;

    const handles = [
      ...new Set(matches.map((m) => m.replace("/products/", ""))),
    ];
    if (handles.length === 0) return null;

    const cleanTarget = isbn.replace(/[^0-9]/g, "");
    let matchedHandle = handles.find((h) => h.includes(cleanTarget)) || handles[0];
    return matchedHandle;
  } catch (e) {
    return null;
  }
}

async function fetchAtlanticProductData(handle, targetIsbn) {
  try {
    const jsonUrl = `https://atlanticbooks.com/products/${handle}.js`;
    const pageUrl = `https://atlanticbooks.com/products/${handle}`;

    const [jsonRes, pageRes] = await Promise.all([
      fetch(jsonUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      }),
      fetch(pageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      }),
    ]);

    if (!jsonRes.ok) return null;
    const productJson = await jsonRes.json();
    const html = pageRes.ok ? await pageRes.text() : "";

    const cleanTarget = targetIsbn ? targetIsbn.replace(/[^0-9]/g, "") : "";
    let variant = productJson.variants?.[0];
    if (cleanTarget && productJson.variants?.length > 1) {
      const match = productJson.variants.find(
        (v) =>
          (v.barcode && v.barcode.replace(/[^0-9]/g, "") === cleanTarget) ||
          (v.sku && v.sku.replace(/[^0-9]/g, "") === cleanTarget),
      );
      if (match) variant = match;
    }

    const inStock = variant ? variant.available : productJson.available;
    const price = variant?.price
      ? variant.price / 100
      : productJson.price
        ? productJson.price / 100
        : null;
    const mrp = variant?.compare_at_price
      ? variant.compare_at_price / 100
      : productJson.compare_at_price
        ? productJson.compare_at_price / 100
        : price;

    let discount = null;
    if (mrp && price && mrp > price) {
      discount = `${Math.round(((mrp - price) / mrp) * 100)}%`;
    }

    let author = null;
    const authorMatch = html.match(
      /<div class="custom-liquid">\s*by\s*([^<]+)<\/div>/i,
    );
    if (authorMatch) {
      const rawAuthor = authorMatch[1].trim();
      if (rawAuthor && rawAuthor !== "N") author = rawAuthor;
    }

    let pages = null;
    const pagesMatch = html.match(/<strong>Pages:<\/strong>\s*([^<]+)<\/li>/i);
    if (pagesMatch && pagesMatch[1].trim() !== "N/A") {
      pages = pagesMatch[1].trim();
    }

    let pubDate = null;
    const dateMatch =
      html.match(/<time[^>]*class="metafield-date"[^>]*>([^<]+)<\/time>/i) ||
      html.match(/<strong>Publication Date:<\/strong>\s*([^<]+)<\/li>/i);
    if (dateMatch && dateMatch[1].trim() !== "N/A") {
      pubDate = dateMatch[1].trim();
    }

    let language = null;
    const langMatch = html.match(/<strong>Language:<\/strong>\s*([^<]+)<\/li>/i);
    if (langMatch && langMatch[1].trim() !== "N/A") {
      language = langMatch[1].trim();
    }

    return {
      title: productJson.title,
      price,
      mrp,
      discount,
      currency: "INR",
      in_stock: inStock,
      stock_status: inStock ? "In Stock" : "Out of Stock",
      seller: "Atlantic Books",
      author,
      publisher: productJson.vendor || null,
      binding: variant?.option1 || variant?.title || null,
      language: language || "English",
      pages,
      publication_date: pubDate,
      weight_grams: variant?.weight || null,
      source: "shopify_engine",
      url: pageUrl,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Scrapes Atlantic Books for a given product URL or ISBN.
 * @param {import('playwright').Page} page
 * @param {string} directUrl
 * @param {string} targetIsbn
 * @returns {Promise<Object>}
 */
async function scrapeAtlanticBooks(page, directUrl, targetIsbn) {
  let handle = null;

  if (directUrl && directUrl.includes("/products/")) {
    const urlObj = new URL(directUrl);
    handle = urlObj.pathname.replace("/products/", "").replace(".js", "");
  } else if (targetIsbn) {
    handle = await searchAtlanticByIsbn(targetIsbn);
  }

  if (handle) {
    const productData = await fetchAtlanticProductData(handle, targetIsbn);
    if (productData) {
      return {
        store: "Atlantic Books",
        searched_isbn: targetIsbn || null,
        found: true,
        ...productData,
      };
    }
  }

  // Playwright Fallback if available
  if (page) {
    const navUrl = directUrl || `https://atlanticbooks.com/search?type=product&q=${encodeURIComponent(targetIsbn)}`;
    await page.goto(navUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(2000);

    if (page.url().includes("/products/")) {
      const domData = await page.evaluate(() => {
        const title = document.querySelector("h1.product-title, h1")?.innerText.trim();
        let price = null;
        const pEl = document.querySelector(".price__current .money, [data-price]");
        if (pEl) {
          const m = pEl.innerText.match(/₹\s*([\d,.]+)/);
          if (m) price = parseFloat(m[1].replace(/,/g, ""));
        }
        let mrp = null;
        const mEl = document.querySelector(".price__compare-at .money, [data-price-compare]");
        if (mEl) {
          const m = mEl.innerText.match(/₹\s*([\d,.]+)/);
          if (m) mrp = parseFloat(m[1].replace(/,/g, ""));
        }
        let inStock = true;
        const soldBadge = document.querySelector(".product__badge--soldout");
        const atcBtn = document.querySelector(".product-form--atc-button");
        if (soldBadge || atcBtn?.disabled || /sold\s*out/i.test(atcBtn?.innerText || "")) {
          inStock = false;
        }
        return { title, price, mrp, inStock };
      });

      if (domData.title || domData.price) {
        return {
          store: "Atlantic Books",
          searched_isbn: targetIsbn || null,
          found: true,
          title: domData.title,
          price: domData.price,
          mrp: domData.mrp || domData.price,
          currency: "INR",
          in_stock: domData.inStock,
          stock_status: domData.inStock ? "In Stock" : "Out of Stock",
          seller: "Atlantic Books",
          url: page.url(),
        };
      }
    }
  }

  return {
    store: "Atlantic Books",
    searched_isbn: targetIsbn || null,
    found: false,
    in_stock: false,
    stock_status: "Not Listed",
    url: directUrl || `https://atlanticbooks.com/search?type=product&q=${targetIsbn}`,
  };
}

// CLI Standalone Runner
if (require.main === module) {
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
        const res = await scrapeAtlanticBooks(page, directUrl, targetIsbn);
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
      `\n🎉 Atlantic Books Scraping Complete! Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = { scrapeAtlanticBooks };
