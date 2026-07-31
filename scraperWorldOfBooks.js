const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Error: You must provide an input file name.");
  console.error(
    "Usage: node scraperWorldOfBooks.js <your_isbn_list.txt> [--headless]",
  );
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `output_wob_${path.basename(inputFile).replace(".txt", ".json")}`;
const outputFilePath = path.join(outputDir, outputFile);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read and parse ISBNs
const isbns = fs
  .readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((i) => i.trim())
  .filter(Boolean);

// Random delay (Shopify rate limits are moderate, 1 to 2.5 seconds is safe)
function randomDelay() {
  return Math.floor(Math.random() * 1500) + 1000;
}

(async () => {
  const browser = await chromium.launch({
    headless: isHeadless,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled", // Helps hide Playwright from Shopify Bot Detection
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  });

  // 🚀 OPTIMIZATION: Block heavy assets to make page loads virtually instant
  await context.route("**/*", (route) => {
    const requestType = route.request().resourceType();
    if (["image", "media", "font"].includes(requestType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  let page = await context.newPage();

  console.log("==========================================");
  console.log(
    `🚀 Starting WorldOfBooks Scraper | Total ISBNs: ${isbns.length}`,
  );
  console.log("==========================================\n");

  for (let i = 0; i < isbns.length; i++) {
    const searchIsbn = isbns[i];

    // Periodically flush browser memory
    if (i > 0 && i % 400 === 0) {
      console.log("🧹 Flushing browser memory...");
      await context.clearCookies();
      await page.close();
      page = await context.newPage();
    }

    try {
      console.log(
        `🔍 [${i + 1}/${isbns.length}] Searching ISBN: ${searchIsbn}...`,
      );

      // DIRECT SEARCH URL
      const searchUrl = `https://www.worldofbooks.com/search?q=${searchIsbn}`;

      await page.goto(searchUrl, {
        timeout: 45000,
        waitUntil: "domcontentloaded", // Wait for HTML only
      });

      // Wait for either Product Page (product-info), Search Page (.card--standard), or an empty search result text
      await page
        .waitForSelector("product-info, .card--standard, .template-search", {
          timeout: 10000,
        })
        .catch(() => {});

      let scrapedData = await page.evaluate(() => {
        // SCENARIO 1: Redirected to Product Page directly
        const productPage = document.querySelector("product-info");
        if (productPage) {
          const priceEl =
            document.querySelector(".price-item--regular") ||
            document.querySelector(".price-item");
          if (priceEl) {
            return {
              found: true,
              price: priceEl.innerText.trim(),
              type: "Product Page",
            };
          }
        }

        // SCENARIO 2: Landed on Search Results Page (Get first card)
        const firstSearchResult = document.querySelector(".card--standard");
        if (firstSearchResult) {
          const priceEl = firstSearchResult.querySelector(".price-item");
          if (priceEl) {
            return {
              found: true,
              price: priceEl.innerText.trim(),
              type: "Search Page",
            };
          }
        }

        // SCENARIO 3: No Results Found
        return { found: false, price: "N/A" };
      });

      // Format and Save Data
      if (!scrapedData.found) {
        console.log(`   ⚠️ No books found for ${searchIsbn}.`);
        fs.appendFileSync(
          outputFilePath,
          JSON.stringify({
            search_isbn: searchIsbn,
            found: false,
            price: "N/A",
          }) + "\n",
        );
      } else {
        const data = {
          search_isbn: searchIsbn,
          found: true,
          price: scrapedData.price,
        };
        fs.appendFileSync(outputFilePath, JSON.stringify(data) + "\n");
        console.log(
          `   ✅ Price: ${data.price} | (Extracted from ${scrapedData.type})`,
        );
      }

      await new Promise((r) => setTimeout(r, randomDelay()));
    } catch (err) {
      console.log(`   ❌ Error processing ${searchIsbn}: ${err.message}`);
      fs.appendFileSync(
        outputFilePath,
        JSON.stringify({
          search_isbn: searchIsbn,
          found: false,
          price: "Error",
        }) + "\n",
      );
      await new Promise((r) => setTimeout(r, randomDelay()));
    }
  }

  await browser.close();
  console.log(
    `\n🎉 Finished scraping WorldOfBooks batch! Results saved to ${outputFile}`,
  );
})();
