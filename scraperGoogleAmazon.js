const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Error: You must provide an input file name.");
  console.error(
    "Usage: node scraperGoogleAmazon.js <your_isbn_list.txt> [--headless]",
  );
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `output_google_amazon_${path.basename(inputFile).replace(".txt", ".json")}`;
const outputFilePath = path.join(outputDir, outputFile);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const isbns = fs
  .readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((i) => i.trim())
  .filter(Boolean);

// Slightly higher base delay for anti-bot
function randomDelay() {
  return Math.floor(Math.random() * 4000) + 2500;
}

function waitForEnter(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(promptText, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

(async () => {
  const userDataDir = path.join(__dirname, "chrome_profile");
  
  let context = await chromium.launchPersistentContext(userDataDir, {
    headless: isHeadless,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled", // Hide automation flag
    ],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  // Block fonts & media (allow images)
  await context.route("**/*", (route) => {
    const requestType = route.request().resourceType();
    if (["media", "font"].includes(requestType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  // Persistent contexts automatically open one page on launch.
  let page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log("⚙️ Setting Delivery Location to 03063 (Nashua)...");
  try {
    await page.goto("https://www.amazon.com/", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });
    const currentLocation = await page
      .textContent("#glow-ingress-line2", { timeout: 5000 })
      .catch(() => "");

    if (currentLocation && currentLocation.includes("03063")) {
      console.log("✅ Location is already set! Skipping setup.\n");
    } else {
      await page.waitForSelector("#nav-global-location-popover-link", {
        state: "attached",
        timeout: 10000,
      });
      await page.evaluate(() =>
        document.querySelector("#nav-global-location-popover-link").click(),
      );
      await page.waitForSelector("#GLUXZipUpdateInput", {
        state: "visible",
        timeout: 10000,
      });
      await page.fill("#GLUXZipUpdateInput", "03063");
      await page.waitForTimeout(1000);
      await page.evaluate(() =>
        document.querySelector("#GLUXZipUpdate input[type='submit']").click(),
      );
      await page.waitForTimeout(3000);
      await page.reload({ waitUntil: "domcontentloaded" });
      console.log("✅ Location set successfully!\n");
    }
  } catch (err) {
    console.log(
      `⚠️ Location setup skipped or failed (${err.message.split("\n")[0]}). Moving to scraping...\n`,
    );
  }

  // ==========================================
  // START SCRAPING LOOP
  // ==========================================
  for (let i = 0; i < isbns.length; i++) {
    const isbn = isbns[i];

    if (i > 0 && i % 50 === 0) {
      console.log("🧹 Restarting page (keeping cookies for trust)...");
      await page.close();
      page = await context.newPage();
    }

    try {
      console.log(
        `🔍[${i + 1}/${isbns.length}] Searching Google for ${isbn}`
      );

      // 1. Search Google
      await page.goto(`https://www.google.com/search?q=${isbn}+site%3Aamazon.com`, {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      });

      // Check for Google Captcha
      const isGoogleCaptcha = await page.evaluate(() => {
          return document.title.includes("Sorry") || document.body.innerText.includes("Our systems have detected unusual traffic");
      });

      if (isGoogleCaptcha) {
          console.log("   🛑 GOOGLE CAPTCHA DETECTED!");
          if (!isHeadless) {
            await waitForEnter("   👉 Please solve the CAPTCHA in the browser, then press ENTER here to continue...");
            await page.waitForTimeout(2000); // Give the page a moment to load results after captcha
          } else {
            console.log("   ⚠️ Running in headless mode. Cannot solve CAPTCHA manually. Waiting 30s instead...");
            await new Promise((r) => setTimeout(r, 30000));
          }
      }

      // 2. Find first Amazon link
      const bestUrl = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          for (let link of links) {
              if (link.href && link.href.includes('amazon.com/') && !link.href.includes('google.com') && !link.href.includes('googleusercontent.com')) {
                  return link.href;
              }
          }
          return null;
      });

      if (bestUrl) {
          console.log(`   -> Found Amazon link on Google. Navigating...`);
          await page.goto(bestUrl, {
            timeout: 60000,
            waitUntil: "domcontentloaded",
          });
      } else {
          throw new Error("No Amazon link found on Google search results.");
      }

      // 🚨 AMAZON DOG PAGE & CAPTCHA DETECTION
      let pageTitle = await page.title();
      let pageText = await page.content();

      if (
        pageTitle.includes("Sorry! Something went wrong") ||
        pageTitle.includes("Robot Check") ||
        pageText.includes("something went wrong on our end")
      ) {
        console.log(`   🛑 AMAZON DOG PAGE / BOT BLOCK DETECTED! (Throttle Commented Out)`);
      }

      await page.waitForSelector("#productTitle", { timeout: 15000 });

      // ==========================================
      // MINIMAL DATA EXTRACTION
      // ==========================================
      let scrapedData = await page.evaluate(() => {
        let result = {
          title: "N/A",
          found_isbn: "N/A",
        };

        const getText = (selector) => {
          const el = document.querySelector(selector);
          return el ? el.innerText.trim() : null;
        };
        
        result.title = getText("#productTitle") || "N/A";

        // Extract ISBN to ensure accuracy
        const carouselIsbn = getText(
          "#rpi-attribute-book_details-isbn13 .rpi-attribute-value span",
        );
        if (carouselIsbn) {
          result.found_isbn = carouselIsbn.replace(/[^\dX]/gi, "");
        } else {
          const detailBullets = Array.from(
            document.querySelectorAll("#detailBullets_feature_div li"),
          );
          const isbn13Bullet = detailBullets.find((li) =>
            li.innerText.includes("ISBN-13"),
          );
          if (isbn13Bullet) {
            const parts = isbn13Bullet.innerText.split(":");
            if (parts.length > 1)
              result.found_isbn = parts[1].replace(/[^\dX]/gi, "");
          }
        }

        return result;
      });

      const data = { 
          isbn, 
          ...scrapedData,
          isbn_matched: isbn === scrapedData.found_isbn
      };
      fs.appendFileSync(outputFilePath, JSON.stringify(data) + "\n");
      console.log(
        `✅ Found: ${data.found_isbn} | Title: ${data.title ? data.title.substring(0,40) + '...' : 'N/A'} | Matched: ${data.isbn_matched}`
      );

      await new Promise((r) => setTimeout(r, randomDelay()));
    } catch (err) {
      console.log(`❌ Error processing ${isbn}: ${err.message}`);
      
      console.log(`   ⏭️ Skipping ${isbn} after failure.`);
      fs.appendFileSync(
        outputFilePath,
        JSON.stringify({
          isbn,
          title: "Error",
          found_isbn: "Error",
          isbn_matched: false
        }) + "\n",
      );
    }
  }

  await context.close();
  console.log("\n🎉 Finished scraping batch!");
})();
