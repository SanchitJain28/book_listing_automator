const fs = require("fs");
const path = require("path");
const { initBrowser, getRandomDelay } = require("../utils/browser");
const { readSearchTerms, appendResult } = require("../utils/file");
const { initScraper } = require("../utils/scraperInit");
const { startSpinner, stopSpinner } = require("../utils/spinner");
const { extractBookDataWithGemini } = require("../utils/geminiVision");

// Import Google Links Harvester
const { fetchGoogleLinksForIsbn } = require("./google-links/google-links-isbn");

// Import all 13 dedicated scrapers directly
const { scrapeFlipkart } = require("./flipkart/flipkart-isbn");
const { scrapeSapnaOnline } = require("./sapnaonline/sapnaonline-isbn");
const { scrapeBookswagon } = require("./bookswagon/bookswagon-isbn");
const { scrapeBookChor } = require("./bookchor/bookchor-isbn");
const { scrapeMyPustak } = require("./mypustak/mypustak-isbn");
const { scrapeAtlanticBooks } = require("./atlanticbooks/atlanticbooks-isbn");
const { scrapeBestBookMart } = require("./bestbookmart/bestbookmart-isbn");
const { scrapeAmazon } = require("./amazon-isbn/amazon-isbn");
const { scrapeAbeBooks } = require("./abebooks/abebooks-isbn");
const { scrapeAgapea } = require("./agapea/agapea-isbn");

// Group A: 13 Dedicated Stores
const DEDICATED_DOMAINS = [
  { match: "flipkart.com", platform: "Flipkart", method: "scraper/flipkart", scraper: scrapeFlipkart },
  { match: "sapnaonline.com", platform: "SapnaOnline", method: "scraper/sapnaonline", scraper: scrapeSapnaOnline },
  { match: "bookswagon.com", platform: "Bookswagon", method: "scraper/bookswagon", scraper: scrapeBookswagon },
  { match: "bookchor.com", platform: "BookChor", method: "scraper/bookchor", scraper: scrapeBookChor },
  { match: "mypustak.com", platform: "MyPustak", method: "scraper/mypustak", scraper: scrapeMyPustak },
  { match: "atlanticbooks.com", platform: "Atlantic Books", method: "scraper/atlanticbooks", scraper: scrapeAtlanticBooks },
  { match: "bestbookmart.com", platform: "BestBookMart", method: "scraper/bestbookmart", scraper: scrapeBestBookMart },
  { match: "amazon.in", platform: "Amazon.in", method: "scraper/amazon-isbn", scraper: scrapeAmazon },
  { match: "amazon.co.uk", platform: "Amazon.co.uk", method: "scraper/amazon-isbn", scraper: scrapeAmazon },
  { match: "amazon.com", platform: "Amazon.com", method: "scraper/amazon-isbn", scraper: scrapeAmazon },
  { match: "abebooks.co.uk", platform: "AbeBooks UK", method: "scraper/abebooks", scraper: scrapeAbeBooks },
  { match: "abebooks.com", platform: "AbeBooks", method: "scraper/abebooks", scraper: scrapeAbeBooks },
  { match: "agapea.com", platform: "Agapea", method: "scraper/agapea", scraper: scrapeAgapea },
];

// Group B: 14 Image-Eligible Stores (Gemini 2.5 Flash)
const IMAGE_ELIGIBLE_DOMAINS = [
  { match: "bol.com", platform: "Bol.com" },
  { match: "ebay.co.uk", platform: "eBay UK" },
  { match: "ebay.com", platform: "eBay US" },
  { match: "bookscape.com", platform: "Bookscape" },
  { match: "snapdeal.com", platform: "Snapdeal" },
  { match: "urbanbae.com", platform: "UrbanBae" },
  { match: "ahujabooks.com", platform: "Ahuja Books" },
  { match: "worldofbooks.com", platform: "World of Books" },
  { match: "ibpbooks.in", platform: "IBP Books" },
  { match: "jainbookagency.com", platform: "Jain Book Agency" },
  { match: "ompublications.in", platform: "OM Publications" },
  { match: "sterlingbookhouse.com", platform: "Sterling Book House" },
  { match: "thebookishowl.in", platform: "The Bookish Owl" },
  { match: "casadellibro.com", platform: "Casa del Libro" },
];

function classifyUrl(urlStr) {
  if (!urlStr) return null;
  const u = urlStr.toLowerCase();

  for (const d of DEDICATED_DOMAINS) {
    if (u.includes(d.match)) {
      return { type: "dedicated", platform: d.platform, method: d.method, scraper: d.scraper };
    }
  }

  for (const img of IMAGE_ELIGIBLE_DOMAINS) {
    if (u.includes(img.match)) {
      return { type: "image", platform: img.platform, method: "gemini_2.5_flash_vision" };
    }
  }

  return null; // Ignore all other domains
}

function escapeCsv(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function appendCsvRow(csvPath, data) {
  const isNew = !fs.existsSync(csvPath) || fs.statSync(csvPath).size === 0;

  if (isNew) {
    const headers = [
      "ISBN",
      "Title",
      "Author",
      "Best_Price_INR",
      "Best_Platform",
      "In_Stock_Count",
      "Total_Whitelisted_Links",
      "Scraped_At",
    ].join(",");
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    fs.writeFileSync(csvPath, headers + "\n", "utf8");
  }

  const row = [
    escapeCsv(data.isbn),
    escapeCsv(data.title),
    escapeCsv(data.author),
    escapeCsv(data.best_price_inr),
    escapeCsv(data.best_platform),
    escapeCsv(data.in_stock_count),
    escapeCsv(data.total_whitelisted_links),
    escapeCsv(data.scraped_at),
  ].join(",");

  fs.appendFileSync(csvPath, row + "\n", "utf8");
}

(async () => {
  const { inputFile, isHeadless, outputFilePath } = initScraper(
    "master-scraper.js",
    "master",
    ".json",
  );

  const csvPath = outputFilePath.replace(/\.json$/, ".csv");
  const useGeminiVision =
    process.argv.includes("--gemini-vision") || !!process.env.GEMINI_API_KEY;

  console.log(
    `\n🚀 Starting Master Book Scraper (Google Links + Whitelist Router + Gemini 2.5 Flash):`,
  );
  console.log(`📂 Input File:    ${inputFile}`);
  console.log(`📁 JSON Output:   ${outputFilePath}`);
  console.log(`📊 CSV Output:    ${csvPath}`);
  console.log(
    `🤖 Gemini Vision: ${useGeminiVision ? "🟢 Enabled (For 14 Image Stores)" : "⚪ Disabled (Set GEMINI_API_KEY to enable)"}\n`,
  );

  const isbns = readSearchTerms(inputFile);

  // Resume tracking
  const completedIsbns = new Set();
  if (fs.existsSync(outputFilePath)) {
    const lines = fs
      .readFileSync(outputFilePath, "utf-8")
      .split("\n")
      .filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.isbn) completedIsbns.add(obj.isbn.trim());
      } catch (e) {}
    }
    if (completedIsbns.size > 0) {
      console.log(`▶ Resuming from item ${completedIsbns.size + 1}...`);
    }
  }

  const { context, page } = await initBrowser(
    isHeadless,
    "master_browser_profile",
  );

  for (let i = 0; i < isbns.length; i++) {
    const isbn = isbns[i].trim();
    if (!isbn) continue;
    if (completedIsbns.has(isbn)) continue;

    console.log(
      `\n\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`,
    );
    console.log(
      `\x1b[1m[${i + 1}/${isbns.length}] 📖 Processing ISBN: ${isbn}\x1b[0m`,
    );
    console.log(
      `\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`,
    );

    // 1. Google Page 1 Search
    startSpinner(`Searching Google SERP Page 1...`);
    let rawLinks = [];
    try {
      rawLinks = await fetchGoogleLinksForIsbn(page, isbn);
      stopSpinner(
        `Found ${rawLinks.length} total links on Google Page 1.`,
        "info",
      );
    } catch (gErr) {
      stopSpinner(`Google search error: ${gErr.message}`, "warn");
    }

    // 2. Strict 27-Domain Whitelist Filter
    const targetLinks = [];
    for (const link of rawLinks) {
      const classification = classifyUrl(link);
      if (classification) {
        targetLinks.push({ url: link, ...classification });
      }
    }

    console.log(
      `🎯 Matched ${targetLinks.length} whitelisted target store(s) for ISBN ${isbn}`,
    );

    const extractedListings = [];

    // 3. Process Each Whitelisted Store strictly one-by-one
    for (let j = 0; j < targetLinks.length; j++) {
      const target = targetLinks[j];
      const { url, type, platform, method, scraper } = target;

      startSpinner(`[${j + 1}/${targetLinks.length}] Scraping ${platform} (${method})...`);

      let data = null;

      try {
        if (type === "dedicated" && typeof scraper === "function") {
          // Direct Dedicated Scraper Execution
          data = await scraper(page, url, isbn);
        } else if (type === "image" && useGeminiVision) {
          // Gemini 2.5 Flash Vision Screenshot
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await page.waitForTimeout(2000);

          startSpinner(
            `[${j + 1}/${targetLinks.length}] 📸 Snapping screenshot for Gemini 2.5 Flash...`,
          );
          const screenshotBuffer = await page.screenshot({ fullPage: false });
          const visionData = await extractBookDataWithGemini(screenshotBuffer);

          if (visionData) {
            data = {
              platform,
              searched_isbn: isbn,
              found: !!visionData.title || !!visionData.price,
              ...visionData,
              seller: visionData.seller || platform,
              url: page.url(),
            };
          }
        }

        if (data && (data.title || data.price)) {
          const formattedListing = {
            platform: data.store || platform,
            extraction_method: method,
            url: data.url || url,
            found: true,
            title: data.title || null,
            author: data.author || null,
            price: data.price !== undefined ? data.price : null,
            mrp: data.mrp !== undefined ? data.mrp : null,
            discount: data.discount || null,
            currency: data.currency || "INR",
            in_stock: data.in_stock !== undefined ? data.in_stock : true,
            stock_status: data.stock_status || "In Stock",
            seller: data.seller || platform,
            publisher: data.publisher || null,
            binding: data.binding || null,
          };

          extractedListings.push(formattedListing);

          const priceDisplay = formattedListing.price
            ? `${formattedListing.currency} ${formattedListing.price}`
            : "No Price";
          const stockDisplay = formattedListing.in_stock
            ? "🟢 In Stock"
            : "🔴 Out of Stock";

          stopSpinner(
            `[${j + 1}/${targetLinks.length}] ${platform.padEnd(16)} | ${priceDisplay.padEnd(12)} | ${stockDisplay}`,
            formattedListing.in_stock ? "success" : "warn",
          );
        } else {
          stopSpinner(
            `[${j + 1}/${targetLinks.length}] ${platform.padEnd(16)} | Listing not found / out of stock`,
            "warn",
          );
        }
      } catch (err) {
        stopSpinner(
          `[${j + 1}/${targetLinks.length}] ${platform.padEnd(16)} | Error: ${err.message}`,
          "error",
        );
      }

      await page.waitForTimeout(getRandomDelay(1000, 2000));
    }

    // 4. Determine Best Price & Consolidate
    let bestPriceInr = null;
    let bestPlatform = null;
    let canonicalTitle = null;
    let canonicalAuthor = null;
    let inStockCount = 0;

    for (const item of extractedListings) {
      if (item.title && !canonicalTitle) canonicalTitle = item.title;
      if (item.author && !canonicalAuthor) canonicalAuthor = item.author;

      if (
        item.in_stock &&
        item.price &&
        (item.currency === "INR" || !item.currency)
      ) {
        inStockCount++;
        if (bestPriceInr === null || item.price < bestPriceInr) {
          bestPriceInr = item.price;
          bestPlatform = item.platform;
        }
      }
    }

    const finalRecord = {
      isbn,
      title: canonicalTitle,
      author: canonicalAuthor,
      best_price_inr: bestPriceInr,
      best_platform: bestPlatform,
      in_stock_count: inStockCount,
      total_whitelisted_links: targetLinks.length,
      listings: extractedListings,
      scraped_at: new Date().toISOString(),
    };

    appendResult(outputFilePath, finalRecord);
    appendCsvRow(csvPath, finalRecord);
  }

  await context.close();
  console.log(
    `\n🎉 Master Scraping Complete! Results saved to:\n- 📁 JSON: ${outputFilePath}\n- 📊 CSV:  ${csvPath}`,
  );
})();
