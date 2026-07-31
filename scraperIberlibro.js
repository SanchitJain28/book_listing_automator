const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("❌ Error: You must provide an input file name.");
  console.error(
    "Usage: node scraperIberlibro.js <your_isbn_list.txt> [--headless]",
  );
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `output_iberlibro_${path.basename(inputFile).replace(".txt", ".json")}`;
const outputFilePath = path.join(outputDir, outputFile);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const isbns = fs
  .readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((i) => i.trim())
  .filter(Boolean);

// Delay: 3 to 7 seconds
function randomDelay() {
  return Math.floor(Math.random() * 4000) + 3000;
}

(async () => {
  const browser = await chromium.launch({
    headless: isHeadless,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled", // Helps hide Playwright
    ],
  });

  const context = await browser.newContext({
    locale: "es-ES", // Force Spanish locale for IberLibro
    extraHTTPHeaders: {
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });

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
    `🚀 Starting IberLibro Scraper (Multi-Listing & Detailed) | Total: ${isbns.length}`,
  );
  console.log("==========================================\n");

  for (let i = 0; i < isbns.length; i++) {
    const targetIsbn = isbns[i];

    // 🧠 HUMAN MIMICRY: Take a long break every 50 requests
    if (i > 0 && i % 50 === 0) {
      console.log("☕ Taking a 15-second human break to avoid rate limits...");
      await new Promise((r) => setTimeout(r, 15000));
    }

    // Flush memory every 400 items
    if (i > 0 && i % 400 === 0) {
      console.log("🧹 Flushing browser memory & clearing cookies...");
      await context.clearCookies();
      await page.close();
      page = await context.newPage();
    }

    let retries = 3;
    let success = false;

    // 🔄 RETRY LOOP: If we get 429, we wait and try again
    while (retries > 0 && !success) {
      try {
        console.log(
          `🔍 [${i + 1}/${isbns.length}] Searching ISBN: ${targetIsbn}... (Attempt ${4 - retries}/3)`,
        );

        // 🔥 Targeting iberlibro.com directly
        const searchUrl = `https://www.iberlibro.com/servlet/SearchResults?kn=${targetIsbn}`;

        const response = await page.goto(searchUrl, {
          timeout: 60000,
          waitUntil: "domcontentloaded",
        });

        const status = response ? response.status() : 200;
        const pageText = await page.content();

        // 🚨 CHECK FOR 429 ERROR
        if (status === 429 || pageText.includes("Too Many Requests")) {
          console.log(
            `   🛑 429 RATE LIMIT HIT! Cooldown initiated... Waiting 60 seconds.`,
          );
          await new Promise((r) => setTimeout(r, 60000));
          retries--;
          continue;
        }

        // Wait for the new UI, old UI, or product page
        await page
          .waitForSelector(
            '[data-srp-item-role="listing"], .result-data, #bookPurchase, #srp-no-results, .message-error',
            { timeout: 10000 },
          )
          .catch(() => {});

        let scrapedData = await page.evaluate((target) => {
          const cleanText = (el) => (el ? el.innerText.trim() : "N/A");

          const formatShipping = (rawText) => {
            if (rawText === "N/A") return "N/A";
            // Grab the first line and remove the hidden button text in both Spanish and English
            let clean = rawText.split("\n")[0].trim();
            clean = clean
              .replace(/Learn more.*/i, "")
              .replace(/Más información.*/i, "")
              .trim();
            return clean;
          };

          let extractedListings = [];

          // SCENARIO 1: NEW UI (VersoTypography)
          const newUIListings = document.querySelectorAll(
            '[data-srp-item-role="listing"]',
          );
          if (newUIListings.length > 0) {
            newUIListings.forEach((item) => {
              const priceEl = item.querySelector(
                '[data-test-id^="item-price"]',
              );
              const shipEl = item.querySelector(
                '[data-test-id^="item-shipping-price"]',
              );
              const sellerLink = item.querySelector(
                '[data-test-id="listing-seller-link"]',
              );

              // Address Extraction
              let address = "N/A";
              const sellerInfoP = item.querySelector(
                '[data-test-id="seller-info"]',
              );
              if (sellerInfoP) {
                const addressSpan = sellerInfoP.querySelector(
                  'span[aria-hidden="true"]',
                );
                if (addressSpan) {
                  address = cleanText(addressSpan).replace(/^,\s*/, ""); // removes leading comma
                }
              }

              // ISBN Extraction
              let foundIsbn = "N/A";
              const isbnLink = item.querySelector(
                '[data-test-id="listing-isbn-link"]',
              );
              if (isbnLink) {
                const match = isbnLink.innerText.match(/(978\d{10})/);
                if (match) foundIsbn = match[1];
              }

              extractedListings.push({
                price: cleanText(priceEl),
                shipping: formatShipping(cleanText(shipEl)),
                seller: cleanText(sellerLink),
                seller_address: address,
                found_isbn: foundIsbn,
                isbn_match: foundIsbn === target,
              });
            });
            return { listings: extractedListings };
          }

          // SCENARIO 2: OLD UI
          const oldUIListings = document.querySelectorAll(".result-data");
          if (oldUIListings.length > 0) {
            oldUIListings.forEach((item) => {
              let address = cleanText(
                item.querySelector('[data-test-id="listing-seller-location"]'),
              );

              let foundIsbn = "N/A";
              const isbn13El = item.querySelector(
                '[data-test-id="listing-isbn-13"]',
              );
              if (isbn13El) {
                const match = isbn13El.innerText.match(/(978\d{10})/);
                if (match) foundIsbn = match[1];
              }

              extractedListings.push({
                price: cleanText(
                  item.querySelector('[data-test-id="item-price"]'),
                ),
                shipping: formatShipping(
                  cleanText(
                    item.querySelector('[data-test-id="shipping-detail"]'),
                  ),
                ),
                seller: cleanText(
                  item.querySelector('[data-test-id="listing-seller-name"]'),
                ),
                seller_address: address,
                found_isbn: foundIsbn,
                isbn_match: foundIsbn === target,
              });
            });
            return { listings: extractedListings };
          }

          // SCENARIO 3: AUTO-REDIRECTED TO SINGLE PRODUCT PAGE
          const productPageBuyBox = document.querySelector("#bookPurchase");
          if (productPageBuyBox) {
            let address = cleanText(
              document.querySelector("#bookseller-location"),
            );
            let foundIsbn = target;

            extractedListings.push({
              price: cleanText(
                document.querySelector(
                  '#book-price, [data-test-id="item-price"]',
                ),
              ),
              shipping: formatShipping(
                cleanText(document.querySelector(".basket-shipping-line")),
              ),
              seller: cleanText(
                document.querySelector(
                  '#bookseller-name, [data-test-id="bookseller-name"]',
                ),
              ),
              seller_address: address,
              found_isbn: foundIsbn,
              isbn_match: foundIsbn === target,
            });
            return { listings: extractedListings };
          }

          return null; // Not found
        }, targetIsbn);

        // Save Results
        if (
          scrapedData &&
          scrapedData.listings &&
          scrapedData.listings.length > 0
        ) {
          const data = { isbn: targetIsbn, listings: scrapedData.listings };
          fs.appendFileSync(outputFilePath, JSON.stringify(data) + "\n");

          console.log(`   ✅ Found ${data.listings.length} listing(s)!`);
          console.log(
            `      -> Top Option | Price: ${data.listings[0].price} | Match: ${data.listings[0].isbn_match} | Addr: ${data.listings[0].seller_address}`,
          );
        } else {
          console.log(`   ⚠️ No listings found for ${targetIsbn}.`);
          fs.appendFileSync(
            outputFilePath,
            JSON.stringify({
              isbn: targetIsbn,
              listings: [],
            }) + "\n",
          );
        }

        success = true; // Mark as successful to exit the retry loop
        await new Promise((r) => setTimeout(r, randomDelay()));
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        retries--;
        if (retries === 0) {
          console.log(`   ⏭️ Skipping ${targetIsbn} after 3 failed attempts.`);
          fs.appendFileSync(
            outputFilePath,
            JSON.stringify({
              isbn: targetIsbn,
              listings: [
                {
                  price: "Error",
                  shipping: "Error",
                  seller: "Error",
                  seller_address: "Error",
                  found_isbn: "Error",
                  isbn_match: false,
                },
              ],
            }) + "\n",
          );
        } else {
          console.log(`   ⏳ Retrying in 10 seconds...`);
          await new Promise((r) => setTimeout(r, 10000));
        }
      }
    }
  }

  await browser.close();
  console.log(
    `\n🎉 Finished scraping IberLibro batch! Results saved to ${outputFile}`,
  );
})();
