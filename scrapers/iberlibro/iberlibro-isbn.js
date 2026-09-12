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
const { extractAbeBooksListings } = require("../abebooks/core/multiListingExtractor");

async function navigateIberlibro(page, directUrl, targetIsbn) {
  let retries = 3;
  let targetUrl = directUrl;

  if (!targetUrl && targetIsbn) {
    targetUrl = `https://www.iberlibro.com/products/isbn/${encodeURIComponent(targetIsbn)}`;
  }

  while (retries > 0) {
    const response = await page.goto(targetUrl, {
      timeout: 45000,
      waitUntil: "domcontentloaded",
    });

    const status = response ? response.status() : 200;
    const pageText = await page.content();

    if (status === 429 || pageText.includes("Too Many Requests")) {
      console.log(`   🛑 Iberlibro 429 Rate Limit hit! Waiting 45 seconds to cooldown...`);
      await new Promise((r) => setTimeout(r, 45000));
      retries--;
      continue;
    }

    if (status === 404 && !directUrl && targetIsbn) {
      targetUrl = `https://www.iberlibro.com/servlet/SearchResults?kn=${encodeURIComponent(targetIsbn)}`;
      retries--;
      continue;
    }

    await page
      .waitForSelector(
        'h1, .detail-block, [data-srp-item-role="listing"], .result-data, #bookPurchase, #srp-no-results, .message-error',
        { timeout: 10000 },
      )
      .catch(() => {});

    return { ok: true, status };
  }

  return { ok: false, status: 429 };
}

async function scrapeIberlibroBook(page, { directUrl, isbn }) {
  const storeName = "Iberlibro";
  const currency = "EUR";

  const navResult = await navigateIberlibro(page, directUrl, isbn);

  if (!navResult.ok) {
    return {
      store: storeName,
      searched_isbn: isbn || null,
      found: false,
      in_stock: false,
      stock_status: "Rate Limited (429)",
      listings: [],
      url: page.url(),
    };
  }

  const listings = await extractAbeBooksListings(page, isbn);

  if (!listings || listings.length === 0) {
    return {
      store: storeName,
      searched_isbn: isbn || null,
      found: false,
      in_stock: false,
      stock_status: "Not Found",
      listings: [],
      url: page.url(),
    };
  }

  const topListing = listings[0];
  const isOutOfStock = !!topListing.is_out_of_stock || (topListing.price_num === null && (!topListing.price || topListing.price === "N/A"));
  const inStock = !isOutOfStock;
  const priceVal = inStock ? (topListing.price_num !== null ? topListing.price_num : topListing.price) : null;

  return {
    store: storeName,
    searched_isbn: isbn || null,
    found: true,
    in_stock: inStock,
    stock_status: inStock ? "In Stock" : "Out of Stock",
    title: topListing.title !== "N/A" ? topListing.title : null,
    author: topListing.author !== "N/A" ? topListing.author : null,
    price: priceVal,
    mrp: priceVal,
    currency,
    seller: topListing.seller !== "N/A" ? topListing.seller : storeName,
    seller_address: topListing.seller_address,
    shipping: topListing.shipping,
    found_isbn: topListing.found_isbn,
    isbn_matched: topListing.isbn_match,
    publisher: topListing.publisher || null,
    publication_date: topListing.publication_date || null,
    binding: topListing.binding || null,
    total_sellers_found: inStock ? listings.length : 0,
    listings: listings,
    url: page.url(),
  };
}

(async () => {
  const { inputFile, isHeadless, outputFilePath } = initScraper(
    "iberlibro-isbn.js",
    "iberlibro-isbn",
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

  let { context, page } = await initBrowser(isHeadless, "iberlibro_profile");

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
        "☕ Taking a 15-second break to avoid rate limits...",
        "info",
      );
      await new Promise((r) => setTimeout(r, 15000));
    }

    if (i > 0 && i % 400 === 0) {
      stopSpinner(`Flushing browser memory after ${i} items...`, "info");
      await context.close();
      const newBrowser = await initBrowser(isHeadless, "iberlibro_profile");
      context = newBrowser.context;
      page = newBrowser.page;
    }

    startSpinner(`Searching Iberlibro for ${targetIsbn || directUrl}...`);

    try {
      const result = await scrapeIberlibroBook(page, { directUrl, isbn: targetIsbn });
      const finalData = { ...item, ...result, scraped_at: new Date().toISOString() };

      appendResult(outputFilePath, finalData);

      if (result.found && result.listings && result.listings.length > 0) {
        stopSpinner(
          `Found ${result.listings.length} listing(s)! (Top: €${result.price || "N/A"} | Match: ${result.isbn_matched ? "Yes" : "No"})`,
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
        store: "Iberlibro",
        title: "Error",
        price: "Error",
        found_isbn: "Error",
        isbn_matched: false,
        scraped_at: new Date().toISOString(),
      };
      appendResult(outputFilePath, errorData);
      await page.waitForTimeout(1000);
    }
  }

  await context.close();
  console.log(
    `\n🎉 Iberlibro Scraper completed. Results saved to ${outputFilePath}`,
  );
})();
