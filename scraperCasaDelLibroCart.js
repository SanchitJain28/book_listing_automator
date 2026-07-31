const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("❌ Error: You must provide an input file name.");
  console.error("Usage: node scraperCasaDelLibroCart.js <your_isbn_list.txt>");
  process.exit(1);
}

// 🔥 PUT YOUR REAL CHROME PROFILE PATH HERE if you want it to use your actual account
// Example Windows: "C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Google\\Chrome\\User Data"
// Example Mac: "/Users/YOUR_USERNAME/Library/Application Support/Google/Chrome"
// If you leave this as "cdl_chrome_profile", it will just make a local folder next to the script.
const userDataDir = path.join(__dirname, "cdl_chrome_profile");

const isbns = fs
  .readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((i) => i.trim())
  .filter(Boolean);

if (isbns.length > 50) {
  console.warn(
    `⚠️ Warning: You provided ${isbns.length} ISBNs. The script will pause every 50 items for checkout.`,
  );
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function smallDelay() {
  return Math.floor(Math.random() * 1000) + 1000;
}

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
};

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

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

(async () => {
  console.log("==========================================");
  console.log(
    `🛒 Starting Casa del Libro Auto-Cart | Total ISBNs: ${isbns.length}`,
  );
  console.log("==========================================\n");

  const context = await chromium.launchPersistentContext(userDataDir, {
    // channel: "chrome", // 🔥 UNCOMMENT THIS LINE if you are using your real Chrome User Data path above
    headless: false,
    viewport: { width: 1280, height: 720 },
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
    locale: "es-ES",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });

  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (["media", "font"].includes(type)) route.abort();
    else route.continue();
  });

  const page = await context.newPage();
    await page.addStyleTag({ content: "* { clip-path: none !important; }" });

  console.log("🌐 Navigating to Casa del Libro Homepage...");
  await page.goto("https://www.casadellibro.com/", {
    timeout: 60000,
    waitUntil: "domcontentloaded",
  });

  console.log("\n==========================================");
  console.log("🛑 SCRIPT PAUSED!");
  console.log("👉 Please look at the browser window.");
  console.log("👉 If you are not logged in, log in manually now.");
  console.log("==========================================\n");

  await askQuestion(
    "✅ Press [ENTER] here in the terminal when you are ready to start adding to cart...",
  );
  console.log("\n🚀 Resuming automation! Beginning Cart Fill...\n");

  let addedCount = 0;
  let batchAddedCount = 0;
  let notFoundCount = 0;

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
        console.log(`   ⚠️ Not found via API: ${searchIsbn}`);
        notFoundCount++;
        continue;
      }

      console.log(`   -> Found! Navigating to product page...`);
      await page.goto(item.url, {
        timeout: 45000,
        waitUntil: "domcontentloaded",
      });

      // 🔥 SVELTE FIX 1: Wait 3 to 4 seconds so Svelte can completely attach its Javascript listeners on slow connections
      const hydrationDelay = Math.floor(Math.random() * 1000) + 5000;
      await delay(hydrationDelay);

      // 🔥 SVELTE FIX 2: Target ONLY the visible button
      const buyBtnLocator = page
        .locator("button.g-btn.accent, button#b-cp-f")
        .filter({ hasText: /Añadir|Add|Comprar/i })
        .locator("visible=true")
        .first();
      const fallbackBtnLocator = page
        .locator("button.g-btn.accent")
        .locator("visible=true")
        .first();

      let isSuccess = false;

      // Try Clicking via Playwright Locator
      if ((await buyBtnLocator.count()) > 0) {
        await buyBtnLocator.click({ force: true });
        isSuccess = true;
      } else if ((await fallbackBtnLocator.count()) > 0) {
        await fallbackBtnLocator.click({ force: true });
        isSuccess = true;
      } else {
        // Native Javascript execution fallback
        isSuccess = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button.g-btn"));
          const visibleBtn = btns.find(
            (b) =>
              b.offsetParent !== null &&
              (b.innerText.includes("Añadir") || b.innerText.includes("Add")),
          );
          if (visibleBtn) {
            visibleBtn.click();
            return true;
          }
          return false;
        });
      }

      if (isSuccess) {
        console.log(
          `   ✅ Clicked 'Add to Cart' (Price: ${item.price?.current || "N/A"} €)`,
        );
        addedCount++;
        batchAddedCount++;

        // Wait 20 seconds for Svelte API to sync the cart state with the backend
        await delay(26000);

        // 🛑 200-ITEM BATCH LIMIT CHECK
        if (batchAddedCount === 50 && i < isbns.length - 1) {
          console.log("\x07"); // Terminal beep
          console.log("\n==========================================");
          console.log("🛑 BATCH LIMIT REACHED (50 ITEMS ADDED)!");
          console.log(
            "👉 Please go to the browser window and complete your order.",
          );
          console.log("👉 The script is paused.");
          console.log("==========================================\n");

          await askQuestion(
            "✅ Press [ENTER] here in the terminal AFTER you have paid to resume the next batch...",
          );

          batchAddedCount = 0; // Reset batch counter
          console.log("\n🚀 Resuming automation for the next batch...\n");
        }
      } else {
        console.log(
          `   ❌ Book found, but 'Add to Cart' button is missing (Out of stock?).`,
        );
      }
    } catch (err) {
      console.log(`   ❌ Error processing ${searchIsbn}: ${err.message}`);
    }

    await delay(smallDelay());
  }

  console.log(`\n🎉 ALL BATCHES COMPLETE!`);
  console.log(`🛒 Total successfully added: ${addedCount} items.`);
  console.log(`⚠️ Not found/Out of Stock: ${isbns.length - addedCount} items.`);

  console.log("\n👉 DO NOT CLOSE THE BROWSER YET!");
  console.log(
    "👉 Go to the open Playwright browser window, click on your Cart, and complete your final purchase there!",
  );
})();
