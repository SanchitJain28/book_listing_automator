const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Error: You must provide an input file name.");
  console.error(
    "Usage: node scraperBookFinder.js <your_isbn_list.txt> [--headless]",
  );
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `output_bookfinder_${path.basename(inputFile).replace(".txt", ".json")}`;
const outputFilePath = path.join(outputDir, outputFile);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const isbns = fs
  .readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((i) => i.trim())
  .filter(Boolean);

// 🚀 SPEED OPTIMIZATION: Short delay (0.5 to 1.5 seconds)
function smallDelay() {
  return Math.floor(Math.random() * 1000) + 500;
}

(async () => {
  const browser = await chromium.launch({
    headless: isHeadless,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  let context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  });

  // Block heavy assets (Keep fetch/xhr alive for React)
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
    `🚀 Starting FAST BookFinder Scraper (STRICT US/UK/DE ONLY) | Total ISBNs: ${isbns.length}`,
  );
  console.log("==========================================\n");

  for (let i = 0; i < isbns.length; i++) {
    const searchIsbn = isbns[i];

    // Flush memory every 400 requests to save RAM
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

      const searchUrl = `https://www.bookfinder.com/search?isbn=${searchIsbn}`;

      await page.goto(searchUrl, {
        timeout: 30000,
        waitUntil: "domcontentloaded",
      });

      // Wait 5 seconds for results to appear
      await page
        .waitForSelector('[data-csa-c-item-type="search-offer"]', {
          timeout: 5000,
        })
        .catch(() => {});

      let scrapedData = await page.evaluate(() => {
        const offerElements = Array.from(
          document.querySelectorAll('[data-csa-c-item-type="search-offer"]'),
        );

        if (offerElements.length === 0) {
          return { found: false, top_options: [] };
        }

        const allOffers = offerElements.map((offer) => {
          const store =
            offer.getAttribute("data-csa-c-affiliate") || "Unknown Store";
          const priceUsd =
            parseFloat(offer.getAttribute("data-csa-c-usdprice")) || 0;
          const shipUsd =
            parseFloat(offer.getAttribute("data-csa-c-usdshipping")) || 0;
          const totalUsd = priceUsd + shipUsd;

          // Extract the outbound link
          const linkEl = offer.querySelector('a[data-csa-c-action="clickout"]');
          const link = linkEl ? linkEl.href : "N/A";

          let displayPrice = "N/A";
          const priceTags = Array.from(
            offer.querySelectorAll(
              "span.font-bold, a span.font-bold.underline",
            ),
          );
          for (let tag of priceTags) {
            if (/[₹$£€\d]/.test(tag.innerText) && tag.innerText.length < 20) {
              displayPrice = tag.innerText.trim();
              break;
            }
          }

          return {
            store,
            display_price: displayPrice,
            total_usd: totalUsd,
            link,
          };
        });

        // 🛑 STRICT ALLOW-LIST COUNTRY FILTER LOGIC
        const validOffers = allOffers.filter((o) => {
          if (o.total_usd <= 0) return false;

          const name = o.store.toUpperCase();

          // 1. Amazon Sites: Only allow US, UK, DE
          if (name.startsWith("AMAZON_")) {
            return ["AMAZON_USA", "AMAZON_GBR", "AMAZON_DEU"].includes(name);
          }

          // 2. AbeBooks Sites: ABEBOOKS is US/Global. Sub-sites must be UK/DE
          if (name.startsWith("ABEBOOKS_")) {
            return ["ABEBOOKS_CO_UK", "ABEBOOKS_DE"].includes(name);
          }

          // 3. Biblio Sites: BIBLIO is US/Global. Sub-sites must be UK/DE
          if (name.startsWith("BIBLIO_")) {
            return ["BIBLIO_CO_UK", "BIBLIO_DE"].includes(name);
          }

          // 4. Alibris Sites: ALIBRIS is US/Global. Sub-sites must be UK
          if (name.startsWith("ALIBRIS_")) {
            return ["ALIBRIS_UK"].includes(name);
          }

          // 5. Explicitly block other known major foreign networks (Netherlands, France, Sweden, etc.)
          const knownForeign = [
            "BOL_COM",
            "FNAC",
            "SAXOU",
            "ADLIBRIS",
            "BOKBORSEN",
            "LIVRARIA_CULTURA",
          ];
          if (knownForeign.includes(name)) return false;

          // If it's a local/independent store (e.g. ZVAB, BUCHFREUND, POWELLS), keep it!
          return true;
        });

        // Sort mathematically to find absolute cheapest first
        validOffers.sort((a, b) => a.total_usd - b.total_usd);

        if (validOffers.length === 0) {
          return { found: false, top_options: [] };
        }

        // Slice the top 3 and format the final output
        const top3 = validOffers.slice(0, 3).map((o) => ({
          store: o.store,
          price: o.display_price,
          link: o.link,
        }));

        return {
          found: true,
          top_options: top3,
        };
      });

      // Write output to JSON
      fs.appendFileSync(
        outputFilePath,
        JSON.stringify({
          search_isbn: searchIsbn,
          found: scrapedData.found,
          top_options: scrapedData.top_options,
        }) + "\n",
      );

      if (!scrapedData.found) {
        console.log(`   ⚠️ No valid US/UK/DE listings found.`);
      } else {
        console.log(
          `   ✅ Best Price: ${scrapedData.top_options[0].price} | Found ${scrapedData.top_options.length} top US/UK/DE option(s).`,
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
          top_options: [],
        }) + "\n",
      );
      await new Promise((r) => setTimeout(r, smallDelay()));
    }
  }

  await browser.close();
  console.log(
    `\n🎉 Finished fast scraping BookFinder! Results saved to ${outputFile}`,
  );
})();
