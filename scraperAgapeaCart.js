const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("❌ Error: You must provide an input file name.");
  console.error("Usage: node scraperAgapeaCart.js <your_isbn_list.txt>");
  process.exit(1);
}

// Ensure the profile directory exists so Chrome can save your Login session
const userDataDir = path.join(__dirname, "agapea_chrome_profile_2");
if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

// Read and parse ISBNs
const isbns = fs
  .readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((i) => i.trim())
  .filter(Boolean);

function randomDelay() {
  return Math.floor(Math.random() * 2000) + 2500; // 1.5 to 3.5 seconds
}

// Helper to wait for user to press Enter
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

(async () => {
  console.log("==========================================");
  console.log(`🛒 Starting Agapea Auto-Cart | Total ISBNs: ${isbns.length}`);
  console.log("==========================================\n");

  // 🚀 LAUNCH PERSISTENT CONTEXT
  const context = await chromium.launchPersistentContext(userDataDir, {
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
    const requestType = route.request().resourceType();
    if (["media", "font"].includes(requestType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  const page = await context.newPage();

  // 1. WARMUP & LOGIN CHECK
  console.log("🌐 Navigating to Agapea Homepage...");
  await page.goto("https://www.agapea.com/", {
    timeout: 60000,
    waitUntil: "domcontentloaded",
  });

  console.log("\n==========================================");
  console.log("🛑 SCRIPT PAUSED FOR LOGIN!");
  console.log("👉 Please look at the browser window.");
  console.log("👉 If you are not logged in, log in manually now.");
  console.log("==========================================\n");

  // Script pauses infinitely until you hit Enter in the terminal!
  await askQuestion(
    "✅ Press [ENTER] here in the terminal when you are ready to start adding to cart...",
  );

  console.log("\n🚀 Resuming automation! Beginning Cart Fill...\n");

  // 2. BATCH LOOP
  let addedCount = 0;
  let batchAddedCount = 0; // Tracks the current 100-item batch
  let notFoundCount = 0;

  for (let i = 0; i < isbns.length; i++) {
    const targetIsbn = isbns[i];

    try {
      console.log(
        `🔍 [${i + 1}/${isbns.length}] Searching ISBN: ${targetIsbn}...`,
      );

      const searchUrl = `https://www.agapea.com/buscar/buscador.php?texto=${targetIsbn}`;

      await page.goto(searchUrl, {
        timeout: 45000,
        waitUntil: "domcontentloaded",
      });

      const bodyText = await page.evaluate(() => document.body.innerText);

      if (bodyText.includes("No se han encontrado resultados")) {
        console.log(`   ⚠️ Not Found.`);
        notFoundCount++;
        continue;
      }

      // 3. ADD TO CART LOGIC
      const buyButtonSelector = 'a[name="btnComprar"], .btn-comprar';
      const buyBtn = await page.$(buyButtonSelector).catch(() => null);

      if (buyBtn) {
        await buyBtn.click();
        console.log(`   ✅ Clicked 'Add to Cart'!`);

        addedCount++;
        batchAddedCount++;

        // Wait 4 seconds to ensure Agapea's server receives the AJAX request and registers the cart item safely
        await page.waitForTimeout(4000);

        // 🛑 100-ITEM BATCH LIMIT CHECK
        if (batchAddedCount === 100 && i < isbns.length - 1) {
          console.log("\x07"); // Terminal beep
          console.log("\n==========================================");
          console.log("🛑 BATCH LIMIT REACHED (100 ITEMS ADDED)!");
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

      await page.waitForTimeout(randomDelay());
    } catch (err) {
      console.log(`   ❌ Error processing ${targetIsbn}: ${err.message}`);
    }
  }

  console.log(`\n🎉 ALL BATCHES COMPLETE!`);
  console.log(`🛒 Total successfully added: ${addedCount} items.`);
  console.log(`⚠️ Not found/Out of Stock: ${isbns.length - addedCount} items.`);

  console.log("\n👉 DO NOT CLOSE THE BROWSER YET!");
  console.log(
    "👉 Go to the open Playwright browser window, click on your Cart, and complete your final purchase there!",
  );

  // Terminal process stays alive until you manually kill it (Ctrl+C)
})();
