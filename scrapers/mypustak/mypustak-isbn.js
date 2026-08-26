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

const TYPESENSE_SEARCH_URL =
  "https://ew5h2tr67livkp41p-1.a1.typesense.net/multi_search?use_cache=true&x-typesense-api-key=ynYXfz3KuyLdSvLrMitLZWtsOImkATlb";

async function queryTypesense(isbn) {
  try {
    const payload = {
      searches: [
        {
          collection: "books_collection",
          q: isbn,
          query_by: "isbn,title,author,publication",
          per_page: 5,
        },
      ],
    };

    const res = await fetch(TYPESENSE_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const hits = json.results?.[0]?.hits || [];
    if (hits.length === 0) return null;

    const cleanTarget = isbn.replace(/[^0-9]/g, "");
    const exactHit = hits.find(
      (h) =>
        h.document?.isbn &&
        h.document.isbn.replace(/[^0-9]/g, "") === cleanTarget,
    );
    return exactHit ? exactHit.document : null;
  } catch (e) {
    return null;
  }
}

async function fetchLiveProductData(bookUrl, fallbackDoc) {
  try {
    const res = await fetch(bookUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    const hasOutOfStock =
      /out\s+of\s+stock/i.test(html) || html.includes("Notify Me");
    const hasBuyNow = html.includes("Buy Now") || html.includes("Add to Cart");
    const inStock = hasBuyNow && !hasOutOfStock;

    let price = fallbackDoc?.price ? parseFloat(fallbackDoc.price) : null;
    let mrp = fallbackDoc?.mrp ? parseFloat(fallbackDoc.mrp) : null;

    const sp =
      html.match(/itemProp="Price"[^>]*>₹(?:<!--\s*-->|\s)*([\d,]+)/i) ||
      html.match(
        /class="[^"]*Product_font15[^"]*"[^>]*>₹(?:<!--\s*-->|\s)*([\d,]+)/i,
      );
    if (sp) price = parseFloat(sp[1].replace(/,/g, ""));

    const mp =
      html.match(/itemProp="MRP"[^>]*>₹(?:<!--\s*-->|\s)*([\d,]+)/i) ||
      html.match(
        /class="[^"]*Product_decoration_overline[^"]*"[^>]*>₹(?:<!--\s*-->|\s)*([\d,]+)/i,
      );
    if (mp) mrp = parseFloat(mp[1].replace(/,/g, ""));

    let condition = "Used";
    if (html.includes("Brand New")) condition = "Brand New";
    else if (html.includes("Very Good")) condition = "Very Good";
    else if (html.includes("Good")) condition = "Good";

    let binding = fallbackDoc?.binding || null;
    const bindingMatch = html.match(
      /itemProp="Binding"[^>]*>[^<]*<\/span><span[^>]*itemProp="([^"]+)"/i,
    );
    if (bindingMatch) binding = bindingMatch[1];

    let language = fallbackDoc?.language || null;
    const langMatch = html.match(
      /itemProp="Language"[^>]*>[^<]*<\/span><span[^>]*itemProp="([^"]+)"/i,
    );
    if (langMatch) language = langMatch[1];

    return {
      inStock,
      stockStatus: inStock ? "In Stock" : "Out of Stock",
      price,
      mrp,
      condition,
      binding,
      language,
      url: bookUrl,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Scrapes MyPustak for a given product URL or ISBN.
 * @param {import('playwright').Page} page
 * @param {string} directUrl
 * @param {string} targetIsbn
 * @returns {Promise<Object>}
 */
async function scrapeMyPustak(page, directUrl, targetIsbn) {
  let doc = null;
  let bookUrl = directUrl;

  if (targetIsbn && (!bookUrl || !bookUrl.includes("mypustak.com/product/"))) {
    doc = await queryTypesense(targetIsbn);
    if (doc) {
      const slug = doc.slug || `${doc.title || "book"}-${targetIsbn}`;
      bookUrl = `https://www.mypustak.com/product/${slug}`;
    }
  }

  if (bookUrl) {
    const liveData = await fetchLiveProductData(bookUrl, doc);
    if (liveData) {
      const price = liveData.price || (doc?.price ? parseFloat(doc.price) : null);
      const mrp = liveData.mrp || (doc?.mrp ? parseFloat(doc.mrp) : price);
      return {
        store: "MyPustak",
        searched_isbn: targetIsbn || null,
        found: true,
        title: doc?.title || null,
        price,
        mrp,
        discount:
          mrp && price && mrp > price
            ? `${Math.round(((mrp - price) / mrp) * 100)}%`
            : null,
        currency: "INR",
        in_stock: liveData.inStock,
        stock_status: liveData.stockStatus,
        seller: "MyPustak",
        author: doc?.author || null,
        publisher: doc?.publication || null,
        binding: liveData.binding || doc?.binding || null,
        url: liveData.url,
      };
    }
  }

  // Playwright Fallback if available
  if (page) {
    const navUrl = bookUrl || `https://www.mypustak.com/search?q=${encodeURIComponent(targetIsbn)}`;
    await page.goto(navUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(2000);

    const domData = await page.evaluate(() => {
      const title = document.querySelector("h1, .Product_title")?.innerText.trim();
      let price = null;
      const pEl = document.querySelector(".Product_price, [class*='Price']");
      if (pEl) {
        const m = pEl.innerText.match(/₹?\s*([\d,.]+)/);
        if (m) price = parseFloat(m[1].replace(/,/g, ""));
      }
      const inStock = !document.body.innerText.includes("OUT OF STOCK") && !document.body.innerText.includes("Sold Out");
      return { title, price, inStock };
    });

    if (domData.title || domData.price) {
      return {
        store: "MyPustak",
        searched_isbn: targetIsbn || null,
        found: true,
        title: domData.title,
        price: domData.price,
        mrp: domData.price,
        currency: "INR",
        in_stock: domData.inStock,
        stock_status: domData.inStock ? "In Stock" : "Out of Stock",
        seller: "MyPustak",
        url: page.url(),
      };
    }
  }

  return {
    store: "MyPustak",
    searched_isbn: targetIsbn || null,
    found: false,
    in_stock: false,
    stock_status: "Not Listed",
    url: bookUrl || `https://www.mypustak.com/search?q=${targetIsbn}`,
  };
}

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

    let { context, page } = await initBrowser(isHeadless, "mypustak_profile");

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

      startSpinner("Searching MyPustak...");

      try {
        const res = await scrapeMyPustak(page, directUrl, targetIsbn);
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
      `\n🎉 MyPustak Scraping Complete! Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = { scrapeMyPustak };
