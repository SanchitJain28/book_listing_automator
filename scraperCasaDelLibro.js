const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("❌ Error: You must provide an input file name.");
  console.error("Usage: node scraperCasaDelLibro.js <your_isbn_list.txt>");
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `output_casadellibro_${path.basename(inputFile).replace(".txt", ".json")}`;
const outputFilePath = path.join(outputDir, outputFile);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const isbns = fs
  .readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((i) => i.trim())
  .filter(Boolean);

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function smallDelay() {
  return Math.floor(Math.random() * 600) + 400;
}

async function fetchProduct(isbn) {
  const url = `https://api.empathy.co/search/v1/query/cdl/isbnsearch?internal=true&query=${isbn}&origin=search_box%3Anone&start=0&rows=16&instance=cdl&lang=es&scope=desktop&currency=EUR&store=ES`;

  const res = await fetch(url, {
    headers: {
      "Accept-Language": "es-ES,es;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Referer: "https://www.casadellibro.com/",
      Origin: "https://www.casadellibro.com",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

async function fetchSeller(page, productUrl) {
  await page.goto(productUrl, {
    timeout: 30000,
    waitUntil: "domcontentloaded",
  });

  await page
    .waitForSelector('p:has-text("Vendido por")', { timeout: 8000 })
    .catch(() => {});

  return page.evaluate(() => {
    const allParagraphs = Array.from(document.querySelectorAll("p"));
    const sellerP = allParagraphs.find((p) =>
      p.textContent.toLowerCase().includes("vendido por"),
    );
    if (!sellerP) return null;
    return sellerP.textContent
      .replace(/vendido por/i, "")
      .replace(/:/g, "")
      .trim();
  });
}

(async () => {
  const browser = await chromium.launch({ headless: isHeadless });
  const context = await browser.newContext({
    locale: "es-ES",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (["image", "media", "font"].includes(type)) route.abort();
    else route.continue();
  });
  const page = await context.newPage();

  console.log("==========================================");
  console.log(
    `🚀 Starting Casa del Libro Scraper | Total ISBNs: ${isbns.length}`,
  );
  console.log("==========================================\n");

  for (let i = 0; i < isbns.length; i++) {
    const searchIsbn = isbns[i];
    console.log(
      `🔍 [${i + 1}/${isbns.length}] Searching ISBN: ${searchIsbn}...`,
    );

    try {
      const data = await fetchProduct(searchIsbn);
      const catalog = data.catalog ?? data;
      const item = catalog.content && catalog.content[0];

      if (!item || !catalog.numFound) {
        console.log(`   ⚠️ Not found: ${searchIsbn}`);
        fs.appendFileSync(
          outputFilePath,
          JSON.stringify({
            search_isbn: searchIsbn,
            found: false,
            price: "N/A",
            seller: "N/A",
          }) + "\n",
        );
      } else {
        const price = item.priceOffer ?? item.price?.current ?? "N/A";
        let seller = "Casa del Libro (Official)";

        try {
          const scrapedSeller = await fetchSeller(page, item.url);
          if (scrapedSeller) seller = scrapedSeller;
        } catch (e) {
          console.log(`   ⚠️ Seller lookup failed: ${e.message}`);
        }

        const result = {
          search_isbn: searchIsbn,
          found: true,
          price,
          seller,
          title: item.name,
          url: item.url,
          availability: item.availability,
        };
        fs.appendFileSync(outputFilePath, JSON.stringify(result) + "\n");
        console.log(`   ✅ Price: ${price} € | Seller: ${seller}`);
      }
    } catch (err) {
      console.log(`   ❌ Error processing ${searchIsbn}: ${err.message}`);
      fs.appendFileSync(
        outputFilePath,
        JSON.stringify({
          search_isbn: searchIsbn,
          found: false,
          price: "Error",
          seller: "Error",
        }) + "\n",
      );
    }

    await delay(smallDelay());
  }

  await browser.close();
  console.log(`\n🎉 Finished! Results saved to ${outputFile}`);
})();
