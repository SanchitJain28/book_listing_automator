const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("❌ Error: You must provide an input file name.");
  console.error(
    "Usage: node scraperAgapea.js <your_isbn_list.txt> [--headless]",
  );
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `output_agapea_${path.basename(inputFile).replace(".txt", ".json")}`;
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

// Very short delay since Agapea has lower rate-limiting
function smallDelay() {
  return Math.floor(Math.random() * 1500) + 1000;
}

(async () => {
  const browser = await chromium.launch({
    headless: isHeadless,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled", // Hide Playwright
    ],
  });

  const context = await browser.newContext({
    locale: "es-ES", // Force Spanish locale for proper rendering
    extraHTTPHeaders: {
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });

  // 🚀 OPTIMIZATION: Block heavy assets to make page loads virtually instant
  await context.route("**/*", (route) => {
    const requestType = route.request().resourceType();
    // Block images, videos, and fonts
    if (["image", "media", "font"].includes(requestType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  let page = await context.newPage();

  console.log("==========================================");
  console.log(`🚀 Starting Agapea Scraper | Total ISBNs: ${isbns.length}`);
  console.log("==========================================\n");

  for (let i = 0; i < isbns.length; i++) {
    const searchIsbn = isbns[i];

    // Periodically flush browser memory
    if (i > 0 && i % 200 === 0) {
      console.log("🧹 Flushing browser memory...");
      await context.clearCookies();
      await page.close();
      page = await context.newPage();
    }

    try {
      console.log(
        `🔍 [${i + 1}/${isbns.length}] Searching ISBN: ${searchIsbn}...`,
      );

      // DIRECT URL INJECTION
      const searchUrl = `https://www.agapea.com/buscar/buscador.php?texto=${searchIsbn}`;

      await page.goto(searchUrl, {
        timeout: 45000,
        waitUntil: "domcontentloaded", // Wait for HTML only
      });

      // Wait for either the product page pricing box OR the "No results" header
      await page
        .waitForSelector(".info-compra, h3", { timeout: 10000 })
        .catch(() => {});

      let scrapedData = await page.evaluate((targetIsbn) => {
        const bodyText = document.body.innerText;

        // 1. Check for "No se han encontrado resultados"
        if (bodyText.includes("No se han encontrado resultados")) {
          return {
            found: false,
            price: "N/A",
            found_isbn: "N/A",
            isbn_match: false,
          };
        }

        // 2. Extract Price (Targeting the <strong> tag to get the discounted selling price)
        let priceStr = "N/A";
        const priceEl = document.querySelector(".precio strong");
        if (priceEl) {
          priceStr = priceEl.innerText.replace(/\n/g, "").trim(); // e.g. "15,20 €"
        } else {
          // Fallback just in case there is no discount and only one price block exists
          const fallbackPrice = document.querySelector(".precio div");
          if (fallbackPrice) priceStr = fallbackPrice.innerText.trim();
        }

        // 3. Extract matched ISBN from the 'Detalles del libro' table
        let foundIsbn = "N/A";
        const ths = Array.from(
          document.querySelectorAll(".detalles-libro table th"),
        );
        for (let th of ths) {
          if (th.innerText.trim().toUpperCase() === "ISBN") {
            // Strip all invisible characters and hyphens, keeping only Digits and X
            foundIsbn = th.nextElementSibling.innerText
              .replace(/[^\dX]/gi, "")
              .trim();
            break;
          }
        }

        // 4. Fallback check: If the page loads but no price/ISBN is found, mark as not found
        if (priceStr === "N/A" && foundIsbn === "N/A") {
          return {
            found: false,
            price: "N/A",
            found_isbn: "N/A",
            isbn_match: false,
          };
        }

        return {
          found: true,
          price: priceStr,
          found_isbn: foundIsbn,
          isbn_match: foundIsbn === targetIsbn,
        };
      }, searchIsbn);

      // Format and Save Data
      if (!scrapedData.found) {
        console.log(`   ⚠️ Not Available / No books found for ${searchIsbn}.`);
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
  console.log(`\n🎉 Finished scraping Agapea! Results saved to ${outputFile}`);
})();
