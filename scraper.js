const { chromium } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Error: You must provide an input file name.");
  console.error("Usage: node scraper.js <your_isbn_list.txt> [--headless]");
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `output_${path.basename(inputFile).replace(".txt", ".json")}`;
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

function cleanAndCheckMRP(priceStr, mrpStr) {
  if (priceStr === "N/A" || mrpStr === "N/A" || !priceStr || !mrpStr)
    return mrpStr;
  const pNum = parseFloat(priceStr.replace(/[^\d.]/g, ""));
  const mNum = parseFloat(mrpStr.replace(/[^\d.]/g, ""));
  if (!isNaN(pNum) && !isNaN(mNum)) {
    if (mNum <= pNum) return "N/A";
  }
  return mrpStr;
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

  // await context.route("**/*", (route) => {
  //   const requestType = route.request().resourceType();
  //   if (["media", "font"].includes(requestType)) {
  //     // Images are enabled so you can see captchas if needed
  //     route.abort();
  //   } else {
  //     route.continue();
  //   }
  // });

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

            const price1El = results[0].querySelector(".a-price-whole");
            let lowestPrice = price1El
              ? parseInt(price1El.innerText.replace(/,/g, ""))
              : Infinity;

            if (results.length > 1) {
              const title2 = getTitle(results[1]);
              const words2 = title2.split(/\s+/).filter((w) => w.length > 3);
              let matchCount = 0;
              words2.forEach((w) => {
                if (words1.has(w)) matchCount++;
              });

              const overlap = matchCount / Math.max(words1.size, 1);
              if (overlap >= 0.5) {
                const price2El = results[1].querySelector(".a-price-whole");
                const p2 = price2El
                  ? parseInt(price2El.innerText.replace(/,/g, ""))
                  : Infinity;
                if (p2 < lowestPrice) {
                  const link2 = getLink(results[1]);
                  if (link2) bestLink = link2;
                }
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

        // SMART FORMAT SWITCH
        const cheaperTarget = await page.evaluate(() => {
          const swatches = Array.from(
            document.querySelectorAll("#tmmSwatches .swatchElement"),
          );
          if (swatches.length <= 1) return null;

          let lowestPrice = Infinity;
          let bestUrl = null;
          let bestFormatName = null;
          let isCurrentlySelectedCheapest = false;

          for (let swatch of swatches) {
            const isSelected = swatch.classList.contains("selected");
            const linkEl = swatch.querySelector("a");
            const url = linkEl ? linkEl.href : null;
            const priceText = swatch.innerText;
            let priceNum = Infinity;

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
                const match = priceText.match(/[\d,]+(?:\.\d+)?/);
                if (match) priceNum = parseFloat(match[0].replace(/,/g, ""));
              }
            }

            if (priceNum < lowestPrice) {
              lowestPrice = priceNum;
              bestUrl = url;
              bestFormatName = priceText
                ? priceText.split("\n")[0].trim()
                : "Unknown";
              isCurrentlySelectedCheapest = isSelected;
            }
          }

          if (
            !isCurrentlySelectedCheapest &&
            bestUrl &&
            lowestPrice !== Infinity
          ) {
            return { url: bestUrl, format: bestFormatName, price: lowestPrice };
          }
          return null;
        });

        if (cheaperTarget) {
          console.log(
            `   -> Cheaper physical format found! Switching to ${cheaperTarget.format} (₹${cheaperTarget.price})...`,
          );
          await page.goto(cheaperTarget.url, {
            timeout: 60000,
            waitUntil: "domcontentloaded",
          });
          await page.waitForSelector("#productTitle", { timeout: 5000 });
        }

        // PRODUCT PAGE DATA EXTRACTION
        let scrapedData = await page.evaluate(() => {
          let result = {
            title: "N/A",
            author: "N/A",
            found_isbn: "N/A",
            price: "N/A",
            mrp: "N/A",
            delivery: "N/A",
            format: "Unknown",
            seller: "N/A",
            used_available: "No Used Options",
            hasUsedOptions: false,
          };

          const getText = (selector) => {
            const el = document.querySelector(selector);
            return el ? el.innerText.trim() : null;
          };

          result.title = getText("#productTitle") || "N/A";

          let authorText =
            getText(".author a.a-link-normal") ||
            getText("#bylineInfo .author a");
          if (!authorText) {
            const authorSpan = document.querySelector(".author");
            if (authorSpan)
              authorText = authorSpan.innerText
                .replace(/\(Author\)/gi, "")
                .replace(/,/g, "")
                .trim();
          }
          result.author = authorText || "N/A";

          const carouselIsbn = getText(
            "#rpi-attribute-book_details-isbn13 .rpi-attribute-value span",
          );
          if (carouselIsbn) {
            // 🔥 FIX: Removes ALL invisible characters, letters, and symbols. Keeps ONLY digits and 'X'.
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

          result.delivery =
            getText(
              "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold",
            ) ||
            getText("#deliveryBlockMessage") ||
            "N/A";

          const usedLink = Array.from(
            document.querySelectorAll("a, span"),
          ).find(
            (el) =>
              el.innerText &&
              (el.innerText.toLowerCase().includes("used from") ||
                el.innerText.toLowerCase().includes("new & used") ||
                el.innerText.toLowerCase().includes("used & new")),
          );
          if (usedLink) result.hasUsedOptions = true;

          const formatBoxes = Array.from(
            document.querySelectorAll("#tmmSwatches .swatchElement"),
          );
          let selectedBox = formatBoxes.find((box) =>
            box.classList.contains("selected"),
          );
          if (selectedBox)
            result.format = selectedBox.innerText.split("\n")[0].trim();
          else result.format = getText("#productSubtitle") || "Unknown Format";

          result.price =
            getText(".priceToPay .a-price-whole") ||
            getText("#corePriceDisplay_desktop_feature_div .a-price-whole") ||
            "N/A";

          const mrpEl = document.querySelector(
            ".a-text-price span.a-offscreen",
          );
          if (mrpEl) result.mrp = mrpEl.textContent.trim();

          result.seller =
            getText("#sellerProfileTriggerId") ||
            getText("#merchant-info a") ||
            "N/A";

          return result;
        });

        // SEE ALL BUYING OPTIONS PANEL
        if (scrapedData.price === "N/A" || scrapedData.hasUsedOptions) {
          const seeAllBtn = await page.$(
            'a[title="See All Buying Options"], #buybox-see-all-buying-choices a, #moreBuyingChoices_feature_div a, a:has-text("used & new"), a:has-text("New & Used")',
          );

          if (seeAllBtn) {
            console.log(`   -> Opening "All Buying Options" panel...`);
            await seeAllBtn.click();
            await page
              .waitForSelector("#aod-offer-list", { timeout: 8000 })
              .catch(() => {});

            const panelData = await page.evaluate(() => {
              let pPrice = "N/A",
                pMrp = "N/A",
                pDel = "N/A",
                pSeller = "N/A",
                pUsed = "No Used Options";

              const firstOffer = document.querySelector(
                "#aod-offer-list #aod-offer",
              );
              if (firstOffer) {
                const priceWholeEl = firstOffer.querySelector(
                  ".a-price .a-price-whole",
                );
                if (priceWholeEl)
                  pPrice = priceWholeEl.textContent.replace(".", "").trim();
                else {
                  const fallbackPrice = firstOffer.querySelector(
                    ".a-price .a-offscreen",
                  );
                  if (fallbackPrice && fallbackPrice.innerText.trim())
                    pPrice = fallbackPrice.innerText.trim();
                }

                const delEl = firstOffer.querySelector(
                  "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold",
                );
                if (delEl) pDel = delEl.innerText.trim();
                const mrpEl = firstOffer.querySelector(
                  ".a-text-price .a-offscreen",
                );
                if (mrpEl) pMrp = mrpEl.textContent.trim();
                const sellerEl = firstOffer.querySelector(
                  "#aod-offer-soldBy a",
                );
                if (sellerEl) pSeller = sellerEl.textContent.trim();
              }

              if (pMrp === "N/A") {
                const pinnedMrpEl = document.querySelector(
                  "#aod-sticky-pinned-offer .a-text-price span.a-offscreen",
                );
                if (pinnedMrpEl) pMrp = pinnedMrpEl.textContent.trim();
              }

              const allOffers = document.querySelectorAll(
                "#aod-offer-list #aod-offer",
              );
              for (let offer of allOffers) {
                const headingEl = offer.querySelector("#aod-offer-heading");
                const headingText = headingEl
                  ? headingEl.textContent.trim().toLowerCase()
                  : "";

                if (headingText.includes("used")) {
                  const usedPriceWholeEl = offer.querySelector(
                    ".a-price .a-price-whole",
                  );
                  let tempUsedPrice = null;

                  if (usedPriceWholeEl)
                    tempUsedPrice = usedPriceWholeEl.textContent
                      .replace(/[.,]/g, "")
                      .trim();
                  else {
                    const fallbackUsedPrice = offer.querySelector(
                      ".a-price .a-offscreen",
                    );
                    if (fallbackUsedPrice && fallbackUsedPrice.innerText.trim())
                      tempUsedPrice = fallbackUsedPrice.innerText
                        .replace(/[^\d]/g, "")
                        .trim();
                  }

                  if (tempUsedPrice && pUsed === "No Used Options") {
                    pUsed = tempUsedPrice;
                    break;
                  }
                }
              }
              return { pPrice, pMrp, pDel, pSeller, pUsed };
            });

            if (scrapedData.price === "N/A" && panelData.pPrice !== "N/A") {
              scrapedData.price = panelData.pPrice;
              scrapedData.mrp = panelData.pMrp;
              scrapedData.delivery = panelData.pDel;
              if (panelData.pSeller !== "N/A")
                scrapedData.seller = panelData.pSeller;
            }
            if (panelData.pUsed !== "No Used Options")
              scrapedData.used_available = panelData.pUsed;
          }
        }

        delete scrapedData.hasUsedOptions;
        scrapedData.mrp = cleanAndCheckMRP(scrapedData.price, scrapedData.mrp);

        if (
          scrapedData.price === "N/A" &&
          scrapedData.used_available === "No Used Options"
        ) {
          scrapedData.mrp = "N/A";
          scrapedData.delivery = "N/A";
          scrapedData.seller = "N/A";
        }

        const data = { isbn, ...scrapedData };
        fs.appendFileSync(outputFilePath, JSON.stringify(data) + "\n");

        console.log(
          `✅ Title: ${data.title.substring(0, 30)}... | Author: ${data.author} | ISBN-13: ${data.found_isbn}`,
        );
        console.log(
          `   -> Price: ${data.price} | MRP: ${data.mrp} | Del: ${data.delivery} | Seller: ${data.seller} | Used: ${data.used_available}`,
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
              author: "Error",
              found_isbn: "Error",
              price: "Error",
              mrp: "Error",
              delivery: "Error",
              format: "Error",
              seller: "Error",
              used_available: "Error",
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
  console.log("\n🎉 Finished scraping batch!");
})();
