const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Error: You must provide an input file name.");
  console.error("Usage: node ScraperAbey.js <your_isbn_list.txt> [--headless]");
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `output_abey_${path.basename(inputFile).replace(".txt", ".json")}`;
const outputFilePath = path.join(outputDir, outputFile);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const isbns = fs
  .readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((i) => i.trim())
  .filter(Boolean);

function randomDelay() {
  return Math.floor(Math.random() * 3000) + 2000;
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

  await context.route("**/*", (route) => {
    const requestType = route.request().resourceType();
    if (["image", "media", "font"].includes(requestType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  let page = await context.newPage();



  for (let i = 0; i < isbns.length; i++) {
    const isbn = isbns[i];

    if (i > 0 && i % 400 === 0) {
      console.log("🧹 Flushing browser memory...");
      await page.close();
      page = await context.newPage();
    }

    try {
      console.log(`🔍 [${i + 1}/${isbns.length}] Searching ISBN: ${isbn}...`);

      const searchUrl = `https://www.abebooks.com/servlet/SearchResults?kn=${isbn}`;

      await page.goto(searchUrl, {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      });

      await page
        .waitForSelector(".result-data, #bookPurchase, #srp-no-results", {
          timeout: 15000,
        })
        .catch(() => {});

      let scrapedData = await page.evaluate(() => {
        const cleanText = (el) => (el ? el.innerText.trim() : "N/A");

        const formatShipping = (rawText) => {
          if (rawText === "N/A") return "N/A";
          const firstLine = rawText.split("\n")[0];
          const match = firstLine.match(/(.*?shipping)/i);
          return match ? match[1].trim() : firstLine.trim();
        };

        const firstResult = document.querySelector(".result-data");
        if (firstResult) {
          const priceEl = firstResult.querySelector(
            '[data-test-id="item-price"]',
          );
          const shippingEl = firstResult.querySelector(
            '[data-test-id="shipping-detail"]',
          );
          const sellerEl = firstResult.querySelector(
            '[data-test-id="listing-seller-name"]',
          );

          return {
            price: cleanText(priceEl),
            shipping: formatShipping(cleanText(shippingEl)),
            seller: cleanText(sellerEl),
          };
        }

        const productPageBuyBox = document.querySelector("#bookPurchase");
        if (productPageBuyBox) {
          const priceEl = document.querySelector(
            '#book-price, [data-test-id="item-price"]',
          );
          const shippingEl = document.querySelector(".basket-shipping-line");
          const sellerEl = document.querySelector(
            '#bookseller-name, [data-test-id="bookseller-name"]',
          );

          return {
            price: cleanText(priceEl),
            shipping: formatShipping(cleanText(shippingEl)),
            seller: cleanText(sellerEl),
          };
        }

        return null;
      });

      if (scrapedData) {
        const data = { isbn, ...scrapedData };
        fs.appendFileSync(outputFilePath, JSON.stringify(data) + "\n");
        console.log(
          `   ✅ Price: ${data.price} | Shipping: ${data.shipping} | Seller: ${data.seller}`,
        );
      } else {
        throw new Error("No search results found.");
      }

      await new Promise((r) => setTimeout(r, randomDelay())); // Mimic human delay
    } catch (err) {
      console.log(`   ❌ Not Found / Error: ${err.message}`);
      fs.appendFileSync(
        outputFilePath,
        JSON.stringify({
          isbn,
          price: "N/A",
          shipping: "N/A",
          seller: "N/A",
        }) + "\n",
      );
      await new Promise((r) => setTimeout(r, randomDelay()));
    }
  }

  await browser.close();
  console.log(
    `\n🎉 Finished scraping AbeBooks batch! Results saved to ${outputFile}`,
  );
})();
