const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Error: You must provide an input file name.");
  console.error(
    "Usage: node scraperAnyBook.js <your_isbn_list.txt> [--headless]",
  );
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `output_anybook_${path.basename(inputFile).replace(".txt", ".json")}`;
const outputFilePath = path.join(outputDir, outputFile);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const isbns = fs
  .readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((i) => i.trim())
  .filter(Boolean);

function smallDelay() {
  return Math.floor(Math.random() * 1000) + 500; // 0.5 to 1.5 seconds
}

(async () => {
  const browser = await chromium.launch({
    headless: isHeadless,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
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
  console.log(`🚀 Starting AnyBook Scraper | Total ISBNs: ${isbns.length}`);
  console.log("==========================================\n");

  for (let i = 0; i < isbns.length; i++) {
    const searchIsbn = isbns[i];

    // Periodically flush browser memory
    if (i > 0 && i % 400 === 0) {
      console.log("🧹 Flushing browser memory...");
      await page.close();
      page = await context.newPage();
    }

    try {
      console.log(
        `🔍 [${i + 1}/${isbns.length}] Searching ISBN: ${searchIsbn}...`,
      );

      // DIRECT URL INJECTION (Bypasses the form submission entirely)
      const searchUrl = `https://www.anybook.com/advancedsearch.php?search_mode=smart&isbn=${searchIsbn}&date_listed=all&order_by=title_asc`;

      await page.goto(searchUrl, {
        timeout: 45000,
        waitUntil: "domcontentloaded", // Wait for HTML only
      });

      // Wait for either the search results accordion OR the "No books found" warning
      await page
        .waitForSelector("#searchResultsAccordion, .alert-warning", {
          timeout: 10000,
        })
        .catch(() => {});

      let scrapedData = await page.evaluate((targetIsbn) => {
        // 1. Check for "No books found"
        const noResults = document.querySelector(".alert-warning");
        if (noResults && noResults.innerText.includes("No books found")) {
          return { found: false };
        }

        // 2. We have results, target the first accordion item
        const firstResult = document.querySelector(".accordion-item");
        if (!firstResult) return { found: false };

        // 3. Extract Price
        // Prefer "Buy Direct" price as it's the actual checkout price, fallback to normal book price
        const buyDirectEl = firstResult.querySelector(".buy-direct-price");
        const normalPriceEl = firstResult.querySelector(".book-price");

        let price = "N/A";
        if (buyDirectEl) {
          price = buyDirectEl.innerText.replace("Buy Direct:", "").trim(); 
        } else if (normalPriceEl) {
          price = normalPriceEl.innerText.trim();
        }

        const copyBtn = document.querySelector(".copy-details");
        let foundIsbn = "N/A";

        if (copyBtn && copyBtn.getAttribute("data-isbn")) {
          foundIsbn = copyBtn.getAttribute("data-isbn").trim();
        } else {
          const textBlock = firstResult.querySelector(".small.text-muted");
          if (textBlock && textBlock.innerText.includes("ISBN:")) {
            const match = textBlock.innerText.match(/ISBN:\s*([0-9X]+)/i);
            if (match) foundIsbn = match[1];
          }
        }

        return {
          found: true,
          price: price,
          found_isbn: foundIsbn,
          isbn_match: foundIsbn === targetIsbn,
        };
      }, searchIsbn);

      if (!scrapedData.found) {
        console.log(`   ⚠️ No books found for ${searchIsbn}.`);
        fs.appendFileSync(
          outputFilePath,
          JSON.stringify({
            search_isbn: searchIsbn,
            found: false,
            price: "N/A",
            found_isbn: "N/A",
            isbn_match: false,
          }) + "\n",
        );
      } else {
        const data = { search_isbn: searchIsbn, ...scrapedData };
        fs.appendFileSync(outputFilePath, JSON.stringify(data) + "\n");
        console.log(
          `   ✅ Price: ${data.price} | Found ISBN: ${data.found_isbn} | Match: ${data.isbn_match ? "YES" : "NO"}`,
        );
      }

      await new Promise((r) => setTimeout(r, smallDelay()));
    } catch (err) {
      console.log(`   ❌ Error processing ${searchIsbn}: ${err.message}`);
      fs.appendFileSync(
        outputFilePath,
        JSON.stringify({
          search_isbn: searchIsbn,
          found: false,
          price: "Error",
          found_isbn: "Error",
          isbn_match: false,
        }) + "\n",
      );
      await new Promise((r) => setTimeout(r, smallDelay()));
    }
  }

  await browser.close();
  console.log(
    `\n🎉 Finished scraping AnyBook batch! Results saved to ${outputFile}`,
  );
})();
