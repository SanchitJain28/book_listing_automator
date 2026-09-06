const fs = require("fs");
const path = require("path");
const readline = require("readline");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { initBrowser, getRandomDelay } = require("../utils/browser");
const { readSearchTerms, appendResult } = require("../utils/file");
const { initScraper } = require("../utils/scraperInit");
const { startSpinner, stopSpinner } = require("../utils/spinner");
const { extractBookDataWithGemini } = require("../utils/geminiVision");

function waitForEnter(
  promptMessage = "\n👉 Press [ENTER] to proceed to next website (or Ctrl+C to stop)... ",
) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(promptMessage, () => {
      rl.close();
      resolve();
    });
  });
}

const {
  fetchGoogleLinksForIsbn,
  normalizeUrl,
} = require("./google-links/google-links-isbn");
const { scrapeFlipkart } = require("./flipkart/flipkart-isbn");
const { scrapeSapnaOnline } = require("./sapnaonline/sapnaonline-isbn");
const { scrapeBookswagon } = require("./bookswagon/bookswagon-isbn");
const { scrapeBookChor } = require("./bookchor/bookchor-isbn");
const { scrapeMyPustakBook } = require("./mypustak/scraper");
const { scrapeAtlanticBook } = require("./atlanticbooks/scraper");
const { scrapeBestBookMart } = require("./bestbookmart/bestbookmart-isbn");
const { scrapeAmazonBook } = require("./amazon-isbn/scraper");
const { scrapeAbeBooksBook } = require("./abebooks/scraper");
const { scrapeAgapeaBook } = require("./agapea/scraper");

const DEDICATED_DOMAINS = [
  {
    match: "flipkart.com",
    platform: "Flipkart",
    method: "scraper/flipkart",
    scraper: scrapeFlipkart,
  },
  {
    match: "sapnaonline.com",
    platform: "SapnaOnline",
    method: "scraper/sapnaonline",
    scraper: scrapeSapnaOnline,
  },
  {
    match: "bookswagon.com",
    platform: "Bookswagon",
    method: "scraper/bookswagon",
    scraper: scrapeBookswagon,
  },
  {
    match: "bookchor.com",
    platform: "BookChor",
    method: "scraper/bookchor",
    scraper: scrapeBookChor,
  },
  {
    match: "mypustak.com",
    platform: "MyPustak",
    method: "scraper/mypustak",
    scraper: (page, url, isbn) =>
      scrapeMyPustakBook(page, { directUrl: url, isbn }),
  },
  {
    match: "atlanticbooks.com",
    platform: "Atlantic Books",
    method: "scraper/atlanticbooks",
    scraper: (page, url, isbn) =>
      scrapeAtlanticBook(page, { directUrl: url, isbn }),
  },
  {
    match: "bestbookmart.com",
    platform: "BestBookMart",
    method: "scraper/bestbookmart",
    scraper: scrapeBestBookMart,
  },
  {
    match: "amazon.in",
    platform: "Amazon.in",
    method: "scraper/amazon-isbn",
    scraper: (page, url, isbn) =>
      scrapeAmazonBook(page, { directUrl: url, isbn }),
  },
  {
    match: "amazon.co.uk",
    platform: "Amazon.co.uk",
    method: "scraper/amazon-isbn",
    scraper: (page, url, isbn) =>
      scrapeAmazonBook(page, { directUrl: url, isbn }),
  },
  {
    match: "amazon.com",
    platform: "Amazon.com",
    method: "scraper/amazon-isbn",
    scraper: (page, url, isbn) =>
      scrapeAmazonBook(page, { directUrl: url, isbn }),
  },
  {
    match: "abebooks.co.uk",
    platform: "AbeBooks UK",
    method: "scraper/abebooks",
    scraper: (page, url, isbn) =>
      scrapeAbeBooksBook(page, { directUrl: url, isbn }),
  },
  {
    match: "abebooks.com",
    platform: "AbeBooks",
    method: "scraper/abebooks",
    scraper: (page, url, isbn) =>
      scrapeAbeBooksBook(page, { directUrl: url, isbn }),
  },
  {
    match: "agapea.com",
    platform: "Agapea",
    method: "scraper/agapea",
    scraper: (page, url, isbn) =>
      scrapeAgapeaBook(page, { directUrl: url, isbn }),
  },
];

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
  { match: "adityaprakashan.com", platform: "Aditya Prakashan" },
  { match: "ajayonlinestall.com", platform: "Ajay Online Stall" },
  { match: "bestbookcentre.com", platform: "Best Book Centre" },
];

function classifyUrl(urlStr) {
  if (!urlStr) return null;
  const u = urlStr.toLowerCase();

  if (
    u.includes("/live/video/") ||
    u.includes("/help/") ||
    u.includes("/gp/help/") ||
    u.includes("/customer-service") ||
    u.includes("/terms") ||
    u.includes("/privacy")
  ) {
    return null;
  }

  for (const d of DEDICATED_DOMAINS) {
    if (u.includes(d.match)) {
      return {
        type: "dedicated",
        platform: d.platform,
        method: d.method,
        scraper: d.scraper,
      };
    }
  }

  for (const img of IMAGE_ELIGIBLE_DOMAINS) {
    if (u.includes(img.match)) {
      return {
        type: "image",
        platform: img.platform,
        method: "gemini_2.5_flash_vision",
      };
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

  const isDebugMode =
    process.argv.includes("--debug") ||
    process.argv.includes("-debug") ||
    process.argv.includes("-d");

  const effectiveHeadless = process.argv.includes("--headless")
    ? true
    : isDebugMode
      ? false
      : isHeadless;

  const modelName = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  console.log(
    `\n🚀 Starting Master Book Scraper (Google Links + Whitelist Router + Gemini Vision):`,
  );
  console.log(`📂 Input File:    ${inputFile}`);
  console.log(`📁 JSON Output:   ${outputFilePath}`);
  console.log(`📊 CSV Output:    ${csvPath}`);
  console.log(
    `🤖 Gemini Vision: ${useGeminiVision ? `🟢 Enabled (${modelName} - Lowest Cost Tier)` : "⚪ Disabled (Set GEMINI_API_KEY to enable)"}`,
  );
  console.log(
    `🐛 Debug Mode:   ${isDebugMode ? "🟢 Enabled (Interactive step-by-step with [ENTER])" : "⚪ Disabled (Pass --debug to step through each site)"}\n`,
  );

  const isbns = readSearchTerms(inputFile);

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
    effectiveHeadless,
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

    // 2. Strict Whitelist Filter & De-duplication
    const seenTargetKeys = new Set();
    const targetLinks = [];
    for (const link of rawLinks) {
      const normalizedLink = normalizeUrl(link);
      const classification = classifyUrl(normalizedLink);
      if (classification) {
        const key = `${classification.platform}:${normalizedLink}`;
        if (!seenTargetKeys.has(key)) {
          seenTargetKeys.add(key);
          targetLinks.push({ url: normalizedLink, ...classification });
        }

        // Smart Amazon Regional Expansion:
        // If Google indexed an international Amazon link (e.g. amazon.com/dp/8132232607) for an Indian ISBN (97881... / 97893...),
        // also include the Amazon.in product page (https://www.amazon.in/dp/8132232607).
        const asinMatch = normalizedLink.match(
          /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i,
        );
        if (
          asinMatch &&
          (isbn.startsWith("97881") || isbn.startsWith("97893"))
        ) {
          const inUrl = `https://www.amazon.in/dp/${asinMatch[1]}`;
          const inClassification = classifyUrl(inUrl);
          if (inClassification) {
            const inKey = `${inClassification.platform}:${inUrl}`;
            if (!seenTargetKeys.has(inKey)) {
              seenTargetKeys.add(inKey);
              targetLinks.push({ url: inUrl, ...inClassification });
            }
          }
        }
      }
    }

    console.log(
      `🎯 Matched ${targetLinks.length} whitelisted target store(s) for ISBN ${isbn}`,
    );

    if (isDebugMode) {
      console.log(
        `\n  ┌─────────────────────────────────────────────────────────────┐`,
      );
      console.log(`  │ 🌐 [DEBUG] Google Page 1 SERP Loaded for ISBN: ${isbn}`);
      console.log(`  │ ℹ️  Total Organic Links: ${rawLinks.length}`);
      console.log(`  │ 🎯 Whitelisted Stores Matched: ${targetLinks.length}`);
      targetLinks.forEach((t, idx) => {
        console.log(`  │    ${idx + 1}. [${t.platform}] ${t.url}`);
      });
      console.log(
        `  └─────────────────────────────────────────────────────────────┘`,
      );
      if (targetLinks.length > 0) {
        await waitForEnter(
          `  👉 Press [ENTER] to open & scrape [1/${targetLinks.length}] ${targetLinks[0].platform}... `,
        );
      } else {
        await waitForEnter(
          `  👉 No whitelisted stores found for this ISBN. Press [ENTER] to continue... `,
        );
      }
    }

    const extractedListings = [];

    // 3. Process Each Whitelisted Store strictly one-by-one
    for (let j = 0; j < targetLinks.length; j++) {
      const target = targetLinks[j];
      const { url, type, platform, method, scraper } = target;

      startSpinner(
        `[${j + 1}/${targetLinks.length}] Scraping ${platform} (${method})...`,
      );

      let data = null;

      try {
        if (type === "dedicated" && typeof scraper === "function") {
          // Direct Dedicated Scraper Execution
          data = await scraper(page, url, isbn);
        } else if (type === "image" && useGeminiVision) {
          // Gemini Vision Screenshot with 67% zoom to capture full buybox & out-of-stock banners
          await page.setViewportSize({ width: 1440, height: 1080 });
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await page.waitForTimeout(2000);

          await page
            .evaluate(() => {
              document.body.style.zoom = "0.67";
            })
            .catch(() => {});
          await page.waitForTimeout(1000);

          startSpinner(
            `[${j + 1}/${targetLinks.length}] 📸 Snapping 67% zoomed screenshot for Gemini Vision...`,
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
            seller_address: data.seller_address || null,
            shipping: data.shipping || null,
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

      if (isDebugMode) {
        console.log(
          `\n  ┌─────────────────────────────────────────────────────────────┐`,
        );
        console.log(
          `  │ 🔍 [DEBUG] Extracted details for [${j + 1}/${targetLinks.length}]: ${platform}`,
        );
        console.log(`  │ 🌐 URL: ${url}`);
        if (data && (data.title || data.price)) {
          console.log(`  │ 📖 Title:  ${data.title || "N/A"}`);
          console.log(`  │ 👤 Author: ${data.author || "N/A"}`);
          console.log(
            `  │ 💰 Price:  ${data.currency || "INR"} ${data.price !== undefined && data.price !== null ? data.price : "N/A"} (MRP: ${data.mrp || "N/A"})`,
          );
          console.log(
            `  │ 📦 Stock:  ${data.in_stock ? "🟢 In Stock" : "🔴 Out of Stock"} (${data.stock_status || "N/A"})`,
          );
          console.log(`  │ 🏪 Seller: ${data.seller || "N/A"}`);
          if (data.seller_address && data.seller_address !== "N/A") {
            console.log(`  │ 📍 Shipping: ${data.seller_address}`);
          }
        } else {
          console.log(`  │ ❌ Result: Listing not found / out of stock`);
        }
        console.log(
          `  └─────────────────────────────────────────────────────────────┘`,
        );
        if (j + 1 < targetLinks.length) {
          await waitForEnter(
            `  👉 Press [ENTER] to open & scrape [${j + 2}/${targetLinks.length}] ${targetLinks[j + 1].platform}... `,
          );
        } else {
          await waitForEnter(
            `  👉 Finished all ${targetLinks.length} store(s) for ISBN ${isbn}. Press [ENTER] to finalize & proceed... `,
          );
        }
      }

      if (!page.isClosed()) {
        await page.waitForTimeout(getRandomDelay(1000, 2000)).catch(() => {});
      }
    }

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
      links_found: rawLinks,
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
