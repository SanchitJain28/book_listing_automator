const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Error: You must provide an input file name.");
  console.error(
    "Usage: node scraperAmazonCom.js <your_isbn_list.txt> [--headless]",
  );
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");
const outputDir = path.join(__dirname, "output");
const outputFile = `output_amazon_com_${path.basename(inputFile).replace(".txt", ".json")}`;
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
  return Math.floor(Math.random() * 4000) + 2500;
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
      "--disable-blink-features=AutomationControlled", // Hide automation flag
    ],
  });

  let context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  });

  await context.route("**/*", (route) => {
    const requestType = route.request().resourceType();
    if (["media", "font"].includes(requestType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  let page = await context.newPage();

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

  for (let i = 0; i < isbns.length; i++) {
    const isbn = isbns[i];

    if (i > 0 && i % 30 === 0) {
      console.log("☕ Taking a 15-second human break to avoid rate limits...");
      await new Promise((r) => setTimeout(r, 15000));
    }

    if (i > 0 && i % 50 === 0) {
      console.log("🧹 Flushing browser memory and clearing cookies...");
      await context.clearCookies();
      await page.close();
      page = await context.newPage();
    }

    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        console.log(
          `🔍[${i + 1}/${isbns.length}] Searching ${isbn} (Attempt ${4 - retries}/3)`,
        );

        await page.goto(`https://www.amazon.com/s?k=${isbn}`, {
          timeout: 60000,
          waitUntil: "domcontentloaded",
        });

        // 🚨 DOG PAGE & CAPTCHA DETECTION
        const pageTitle = await page.title();
        const pageText = await page.content();

        if (
          pageTitle.includes("Sorry! Something went wrong") ||
          pageTitle.includes("Robot Check") ||
          pageText.includes("something went wrong on our end")
        ) {
          console.log(`   🛑 AMAZON DOG PAGE / BOT BLOCK DETECTED!`);
          console.log(
            `   ⏳ Cooldown initiated... Waiting 3 minutes to clear IP throttle.`,
          );
          await new Promise((r) => setTimeout(r, 180000)); // 3 Minutes

          // Hard reset the context to wipe all tracking identifiers
          await context.clearCookies();
          await page.close();
          page = await context.newPage();

          retries--;
          continue; // Retry the same ISBN
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

        // ==========================================
        // SMART FORMAT SWITCH
        // ==========================================
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
            `   -> Cheaper physical format found! Switching to ${cheaperTarget.format} ($${cheaperTarget.price})...`,
          );
          await page.goto(cheaperTarget.url, {
            timeout: 60000,
            waitUntil: "domcontentloaded",
          });
          await page.waitForSelector("#productTitle", { timeout: 5000 });
        }

        let scrapedData = await page.evaluate(() => {
          let result = {
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

          const getRobustPrice = (containerSelector) => {
            const container = document.querySelector(containerSelector);
            if (!container) return null;
            const offscreen = container.querySelector("span.a-offscreen");
            const offText = offscreen ? offscreen.textContent.trim() : "";
            if (offText && /\d/.test(offText)) return offText;

            const whole = container.querySelector(".a-price-whole");
            const frac = container.querySelector(".a-price-fraction");
            if (whole) {
              let p = whole.textContent.replace(/[^\d]/g, "");
              if (frac) p += "." + frac.textContent.replace(/[^\d]/g, "");
              return "$" + p;
            }
            return null;
          };

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
          if (selectedBox) {
            result.format = selectedBox.innerText.split("\n")[0].trim();
          } else {
            result.format = getText("#productSubtitle") || "Unknown Format";
          }

          result.price =
            getRobustPrice(".priceToPay") ||
            getRobustPrice("#corePriceDisplay_desktop_feature_div") ||
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

        // ==========================================
        // SEE ALL BUYING OPTIONS PANEL / POPOVER
        // ==========================================
        const popoverTrigger = await page.$(
          "#mediaMatrixGridAODPopover a.a-popover-trigger, .aod-popover-caret-link",
        );

        if (popoverTrigger) {
          console.log(
            `   -> "Other Used" popover detected. Clicking to reveal options...`,
          );
          await popoverTrigger.click();
          await page
            .waitForSelector(".a-popover-inner a", {
              state: "visible",
              timeout: 5000,
            })
            .catch(() => {});

          const clickedLowest = await page.evaluate(() => {
            const links = Array.from(
              document.querySelectorAll(".a-popover-inner a"),
            );
            if (links.length === 0) return false;
            let lowestPrice = Infinity;
            let bestLink = null;
            for (let a of links) {
              const text = a.innerText || "";
              const match = text.match(/\$([\d,]+\.\d{2})/);
              if (match) {
                const price = parseFloat(match[1].replace(/,/g, ""));
                if (price < lowestPrice) {
                  lowestPrice = price;
                  bestLink = a;
                }
              }
            }
            if (bestLink) {
              bestLink.click();
              return true;
            } else {
              links[0].click();
              return true;
            }
          });

          if (clickedLowest) {
            console.log(
              `   -> Selected lowest price in popover. Waiting for side panel...`,
            );
            await page
              .waitForSelector("#aod-offer-list", { timeout: 8000 })
              .catch(() => {});
          }
        }

        const isAodOpen = await page.$("#aod-offer-list");

        if (
          !isAodOpen &&
          (scrapedData.price === "N/A" || scrapedData.hasUsedOptions)
        ) {
          const seeAllBtn = await page.$(
            'a[title="See All Buying Options"], #buybox-see-all-buying-choices a, #moreBuyingChoices_feature_div a, a:has-text("used & new"), a:has-text("New & Used")',
          );
          if (seeAllBtn) {
            console.log(`   -> Opening "All Buying Options" panel...`);
            await seeAllBtn.click();
            await page
              .waitForSelector("#aod-offer-list", { timeout: 8000 })
              .catch(() => {});
          }
        }

        if (
          (await page.$("#aod-offer-list")) ||
          (await page.$("#aod-pinned-offer"))
        ) {
          const panelData = await page.evaluate(() => {
            let pPrice = "N/A",
              pMrp = "N/A",
              pDel = "N/A",
              pSeller = "N/A";
            let lowestUsed = Infinity;

            const extractPriceVal = (container) => {
              if (!container) return null;
              const aPrice = container.querySelector(".a-price");
              if (aPrice) {
                const offscreen = aPrice.querySelector(".a-offscreen");
                const offText = offscreen ? offscreen.textContent.trim() : "";
                if (offText && /\d/.test(offText))
                  return parseFloat(offText.replace(/[^\d.]/g, ""));
                const whole = aPrice.querySelector(".a-price-whole");
                const frac = aPrice.querySelector(".a-price-fraction");
                if (whole) {
                  let p = whole.textContent.replace(/[^\d]/g, "");
                  if (frac) p += "." + frac.textContent.replace(/[^\d]/g, "");
                  return parseFloat(p);
                }
              }
              return null;
            };

            const checkOfferForUsedPrice = (offerEl) => {
              if (!offerEl) return;
              const headingEl = offerEl.querySelector("#aod-offer-heading");
              const text = headingEl
                ? headingEl.textContent.toLowerCase()
                : (offerEl.innerText || "").toLowerCase();

              if (text.includes("used")) {
                let priceVal = extractPriceVal(offerEl);
                if (priceVal === null || isNaN(priceVal)) {
                  const altOffscreen = offerEl.querySelector(".aok-offscreen");
                  if (altOffscreen && /\d/.test(altOffscreen.textContent)) {
                    priceVal = parseFloat(
                      altOffscreen.textContent.replace(/[^\d.]/g, ""),
                    );
                  }
                }
                if (
                  priceVal !== null &&
                  !isNaN(priceVal) &&
                  priceVal < lowestUsed
                )
                  lowestUsed = priceVal;
              }
            };

            checkOfferForUsedPrice(document.querySelector("#aod-pinned-offer"));
            const allOffers = document.querySelectorAll(
              "#aod-offer-list #aod-offer",
            );
            for (let offer of allOffers) checkOfferForUsedPrice(offer);

            const firstOffer =
              document.querySelector("#aod-offer-list #aod-offer") ||
              document.querySelector("#aod-pinned-offer");
            if (firstOffer) {
              const pVal = extractPriceVal(firstOffer);
              if (pVal !== null && !isNaN(pVal)) pPrice = "$" + pVal.toFixed(2);
              const delEl = firstOffer.querySelector(
                "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold",
              );
              if (delEl) pDel = delEl.innerText.trim();
              const sellerEl = firstOffer.querySelector("#aod-offer-soldBy a");
              if (sellerEl) pSeller = sellerEl.textContent.trim();
            }

            let pUsed =
              lowestUsed === Infinity
                ? "No Used Options"
                : "$" + lowestUsed.toFixed(2);
            return { pPrice, pMrp, pDel, pSeller, pUsed };
          });

          if (scrapedData.price === "N/A" && panelData.pPrice !== "N/A") {
            scrapedData.price = panelData.pPrice;
            scrapedData.mrp = panelData.pMrp;
            scrapedData.delivery = panelData.pDel;
            if (panelData.pSeller !== "N/A")
              scrapedData.seller = panelData.pSeller;
          }

          if (panelData.pUsed !== "No Used Options") {
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
          `✅ Success: ${data.format} | Price: ${data.price} | MRP: ${data.mrp} | Del: ${data.delivery} | Seller: ${data.seller} | Used: ${data.used_available}`,
        );

        success = true; // Mark successful to break retry loop
        await new Promise((r) => setTimeout(r, randomDelay()));
      } catch (err) {
        console.log(`❌ Error processing ${isbn}: ${err.message}`);
        retries--;

        if (retries === 0) {
          console.log(`   ⏭️ Skipping ${isbn} after 3 failed attempts.`);
          fs.appendFileSync(
            outputFilePath,
            JSON.stringify({
              isbn,
              price: "Error",
              mrp: "Error",
              delivery: "Error",
              format: "Error",
              seller: "Error",
              used_available: "Error",
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
  console.log("\n🎉 Finished scraping batch!");
})();
