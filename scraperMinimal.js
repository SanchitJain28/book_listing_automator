const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Error: You must provide an input file name.");
  console.error("Usage: node scraperMinimal.js <your_isbn_list.txt> [--headless]");
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `minimal_${path.basename(inputFile).replace(".txt", ".json")}`;
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
      "--disable-blink-features=AutomationControlled", // 🔥 Hides automation flag
    ],
  });

  const context = await browser.newContext({
    // 🔥 UPDATED: Modern Chrome User-Agent
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    },
  });

  // 🔥 STEALTH INJECTION: Overrides navigator.webdriver so Amazon thinks you are a real human
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  let page = await context.newPage();

  console.log("⚙️ Setting Delivery Location to 122101 (Gurugram)...");
  try {
    await page.goto("https://www.amazon.in/", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });

    // Check for Rush Hour immediately on Homepage
    const isRushHour = await page.evaluate(() =>
      document.body.innerText.includes("rush hour and traffic is piling up"),
    );
    if (isRushHour) {
      console.log(
        "   🚨 RUSH HOUR BLOCK HIT ON HOMEPAGE! Waiting 15 seconds...",
      );
      await page.waitForTimeout(15000);
      await page.reload({ waitUntil: "domcontentloaded" });
    }

    const currentLocation = await page
      .textContent("#glow-ingress-line2", { timeout: 5000 })
      .catch(() => "");
    if (currentLocation && currentLocation.includes("122101")) {
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
      await page.fill("#GLUXZipUpdateInput", "122101");
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

    if (i > 0 && i % 400 === 0) {
      console.log("🧹 Flushing browser memory...");
      await context.clearCookies();
      await page.close();
      page = await context.newPage();
    }

    let retries = 2; // Setup retry loop in case we hit the Rush Hour screen randomly
    let success = false;

    while (retries > 0 && !success) {
      try {
        console.log(
          `🔍 [${i + 1}/${isbns.length}] Searching ${isbn} (Attempt ${3 - retries}/2)`,
        );

        await page.goto(`https://www.amazon.in/s?k=${isbn}`, {
          timeout: 60000,
          waitUntil: "domcontentloaded",
        });

        // 🔥 RUSH HOUR DETECTOR
        const isRushHour = await page.evaluate(() => {
          const text = document.body.innerText.toLowerCase();
          return (
            text.includes("rush hour") ||
            text.includes("traffic is piling up") ||
            text.includes("sorry! something went wrong")
          );
        });

        if (isRushHour) {
          console.log(
            "   🛑 AMAZON RUSH HOUR DETECTED! Taking a 30-second cooldown...",
          );
          await page.waitForTimeout(30000); // 30 second cooldown
          await context.clearCookies();
          retries--;
          continue; // Retry this loop
        }

        await page.waitForSelector(
          'div[data-component-type="s-search-result"], #productTitle',
          { timeout: 10000 },
        );
        const isProductPage = await page.$("#productTitle");

        if (!isProductPage) {
          const bestUrl = await page.evaluate(() => {
            const results = Array.from(
              document.querySelectorAll(
                'div[data-component-type="s-search-result"]',
              ),
            );
            if (results.length === 0) return null;

            const getLink = (res) => {
              const a =
                res.querySelector("h2 a") ||
                res.querySelector("a.a-link-normal");
              return a ? a.href : null;
            };
            const getTitle = (res) => {
              const t = res.querySelector("h2 span") || res.querySelector("h2");
              return t ? t.innerText.toLowerCase() : "";
            };

            let bestLink = getLink(results[0]);
            if (!bestLink) return null;

            const title1 = getTitle(results[0]);
            const words1 = new Set(
              title1.split(/\s+/).filter((w) => w.length > 3),
            );

            // Try to find a better matching result if the first one doesn't seem perfect
            if (results.length > 1) {
              const title2 = getTitle(results[1]);
              const words2 = title2.split(/\s+/).filter((w) => w.length > 3);
              let matchCount = 0;
              words2.forEach((w) => {
                if (words1.has(w)) matchCount++;
              });

              const overlap = matchCount / Math.max(words1.size, 1);
              if (overlap >= 0.5) {
                const link2 = getLink(results[1]);
                if (link2) bestLink = link2;
              }
            }
            return bestLink;
          });

          if (bestUrl) {
            console.log(
              `   -> Navigating into the best matched product page...`,
            );
            await page.goto(bestUrl, {
              timeout: 60000,
              waitUntil: "domcontentloaded",
            });
            await page.waitForSelector("#productTitle", { timeout: 15000 });
          } else {
            throw new Error("No search results found.");
          }
        }

        // SMART FORMAT SWITCH: Try to switch away from Kindle/Audiobook to get physical ISBN
        const physicalTarget = await page.evaluate(() => {
          const swatches = Array.from(
            document.querySelectorAll("#tmmSwatches .swatchElement"),
          );
          if (swatches.length <= 1) return null;

          let bestUrl = null;
          let bestFormatName = null;
          let isCurrentlySelectedPhysical = false;

          for (let swatch of swatches) {
            const isSelected = swatch.classList.contains("selected");
            const linkEl = swatch.querySelector("a");
            const url = linkEl ? linkEl.href : null;
            const priceText = swatch.innerText;

            if (priceText) {
              const textLower = priceText.toLowerCase();
              const formatNameLower = priceText.split("\n")[0].toLowerCase();
              const isForbidden =
                formatNameLower.includes("kindle") ||
                formatNameLower.includes("ebook") ||
                formatNameLower.includes("e-book") ||
                formatNameLower.includes("audiobook") ||
                formatNameLower.includes("audible");

              if (!textLower.includes("unavailable") && !isForbidden) {
                if (isSelected) {
                    isCurrentlySelectedPhysical = true;
                }
                if (!bestUrl) { // Just grab the first physical format we see
                    bestUrl = url;
                    bestFormatName = priceText.split("\n")[0].trim();
                }
              }
            }
          }

          if (
            !isCurrentlySelectedPhysical &&
            bestUrl
          ) {
            return { url: bestUrl, format: bestFormatName };
          }
          return null;
        });

        if (physicalTarget) {
          console.log(
            `   -> Switching away from digital format to ${physicalTarget.format}...`,
          );
          await page.goto(physicalTarget.url, {
            timeout: 60000,
            waitUntil: "domcontentloaded",
          });
          await page.waitForSelector("#productTitle", { timeout: 5000 });
        }

        // MINIMAL DATA EXTRACTION
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
          `✅ Title: ${data.title.substring(0, 50)}... | ISBN-13: ${data.found_isbn}`,
        );

        success = true; // Loop break condition met
        await new Promise((r) => setTimeout(r, randomDelay()));
      } catch (err) {
        console.log(`❌ Error processing ${isbn}: ${err.message}`);
        retries--;

        if (retries === 0) {
          fs.appendFileSync(
            outputFilePath,
            JSON.stringify({
              isbn,
              title: "Error",
              found_isbn: "Error",
              isbn_matched: false,
            }) + "\n",
          );
        } else {
          console.log("   ⏳ Retrying in 5 seconds...");
          await page.waitForTimeout(5000);
        }
      }
    }
  }

  await browser.close();
  console.log("\n🎉 Finished minimal scraping batch!");
})();
