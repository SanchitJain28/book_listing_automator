const { chromium } = require("playwright");
const fs = require("fs");
const os = require("os");
const axios = require("axios");
const FormData = require("form-data");
const path = require("path");

const inputFile = process.argv[2] || "isbns.txt";
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
  return Math.floor(Math.random() * 5000) + 4000;
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
    ],
  });

   const context = await browser.newContext({
     userAgent:
       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
   });


  let page = await context.newPage();
  console.log("⚙️ Setting Delivery Location to 122101 (Gurugram)...");
  try {
    await page.goto("https://www.amazon.in/", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });

    // 1. Check if it's already set
    const currentLocation = await page
      .textContent("#glow-ingress-line2", { timeout: 5000 })
      .catch(() => "");
    if (currentLocation && currentLocation.includes("122101")) {
      console.log("✅ Location is already set! Skipping setup.\n");
    } else {
      // 2. Wait for the button to exist in the HTML, even if it's hidden
      await page.waitForSelector("#nav-global-location-popover-link", {
        state: "attached",
        timeout: 10000,
      });

      // 3. FORCE CLICK using JavaScript (bypasses invisible overlays)
      await page.evaluate(() =>
        document.querySelector("#nav-global-location-popover-link").click(),
      );

      // 4. Wait for the input box
      await page.waitForSelector("#GLUXZipUpdateInput", {
        state: "visible",
        timeout: 10000,
      });

      // 5. Fill the pincode
      await page.fill("#GLUXZipUpdateInput", "122101");
      await page.waitForTimeout(1000); // Give Amazon JS a second to register

      // 6. FORCE CLICK the submit button
      await page.evaluate(() =>
        document.querySelector("#GLUXZipUpdate input[type='submit']").click(),
      );

      // 7. Wait for Amazon to process and reload
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
       await page.close();
       page = await context.newPage();
     }

    try {
      console.log(`🔍[${i + 1}/${isbns.length}] Searching ${isbn}`);
      await page.goto(`https://www.amazon.in/s?k=${isbn}`, { timeout: 60000 });

      await page.waitForSelector(
        'div[data-component-type="s-search-result"], #productTitle',
        { timeout: 4000 },
      );
      const isProductPage = await page.$("#productTitle");

      // 1. SMART SEARCH SELECTION
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
              res.querySelector("h2 a") || res.querySelector("a.a-link-normal");
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
          console.log(`   -> Navigating into the best matched product page...`);
          await page.goto(bestUrl, { timeout: 60000 });
          await page.waitForSelector("#productTitle", { timeout: 15000 });
        } else {
          throw new Error("No search results found.");
        }
      }

      // ==========================================
      // 2. SMART FORMAT SWITCH (ABSOLUTE CHEAPEST PRIORITY)
      // ==========================================
      const cheaperTarget = await page.evaluate(() => {
        const swatches = Array.from(
          document.querySelectorAll("#tmmSwatches .swatchElement"),
        );
        if (swatches.length <= 1) return null; // Only one format available

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

            // Ignore digital/audio formats and unavailable items
            const isForbidden =
              formatNameLower.includes("kindle") ||
              formatNameLower.includes("ebook") ||
              formatNameLower.includes("e-book") ||
              formatNameLower.includes("audiobook") ||
              formatNameLower.includes("audible");

            if (!textLower.includes("unavailable") && !isForbidden) {
              // Extracts numbers like "1,456.00" or "1250"
              const match = priceText.match(/[\d,]+(?:\.\d+)?/);
              if (match) {
                priceNum = parseFloat(match[0].replace(/,/g, ""));
              }
            }
          }

          // Keep track of the absolute lowest price
          if (priceNum < lowestPrice) {
            lowestPrice = priceNum;
            bestUrl = url;
            bestFormatName = priceText
              ? priceText.split("\n")[0].trim()
              : "Unknown";
            isCurrentlySelectedCheapest = isSelected;
          }
        }

        // If the absolute lowest price we found is NOT the box we are currently looking at
        if (
          !isCurrentlySelectedCheapest &&
          bestUrl &&
          lowestPrice !== Infinity
        ) {
          return { url: bestUrl, format: bestFormatName, price: lowestPrice };
        }
        return null; // The current page is already the cheapest physical format
      });

      if (cheaperTarget) {
        console.log(
          `   -> Cheaper physical format found! Switching to ${cheaperTarget.format} (₹${cheaperTarget.price})...`,
        );
        await page.goto(cheaperTarget.url, { timeout: 60000 });
        await page.waitForSelector("#productTitle", { timeout: 5000 });
      }

      // ==========================================
      // 3. PRODUCT PAGE DATA EXTRACTION
      // ==========================================
      let scrapedData = await page.evaluate(() => {
        let result = {
          price: "N/A",
          mrp: "N/A",
          delivery: "N/A",
          format: "Unknown",
          used_available: "No Used Options",
          hasUsedOptions: false,
        };

        const getText = (selector) => {
          const el = document.querySelector(selector);
          return el ? el.innerText.trim() : null;
        };

        // Delivery
        result.delivery =
          getText(
            "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold",
          ) ||
          getText("#deliveryBlockMessage") ||
          "N/A";

        // Detect if there are Used options to trigger the Side Panel
        const usedLink = Array.from(document.querySelectorAll("a, span")).find(
          (el) =>
            el.innerText &&
            (el.innerText.toLowerCase().includes("used from") ||
              el.innerText.toLowerCase().includes("new & used") ||
              el.innerText.toLowerCase().includes("used & new")),
        );

        if (usedLink) {
          result.hasUsedOptions = true;
        }

        // Check Format (Reads the Currently Selected Box)
        const formatBoxes = Array.from(
          document.querySelectorAll("#tmmSwatches .swatchElement"),
        );
        let selectedBox = formatBoxes.find((box) =>
          box.classList.contains("selected"),
        );
        if (selectedBox) {
          result.format = selectedBox.innerText.split("\n")[0].trim(); // Grabs just "Paperback" or "Hardcover"
        } else {
          result.format = getText("#productSubtitle") || "Unknown Format";
        }

        // Grab Main Price
        result.price =
          getText(".priceToPay .a-price-whole") ||
          getText("#corePriceDisplay_desktop_feature_div .a-price-whole") ||
          "N/A";

        // Grab MRP
        const mrpEl = document.querySelector(".a-text-price span.a-offscreen");
        if (mrpEl) result.mrp = mrpEl.textContent.trim();

        return result;
      });

      // ==========================================
      // 4. SEE ALL BUYING OPTIONS PANEL
      // ==========================================
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
              pUsed = "No Used Options";

            // ----------------------------------------------------
            // STEP 1: ALWAYS grab the very first offer for main details
            // ----------------------------------------------------
            const firstOffer = document.querySelector(
              "#aod-offer-list #aod-offer",
            );

            if (firstOffer) {
              // Grab Price
              const priceWholeEl = firstOffer.querySelector(
                ".a-price .a-price-whole",
              );
              if (priceWholeEl) {
                pPrice = priceWholeEl.textContent.replace(".", "").trim();
              } else {
                const fallbackPrice = firstOffer.querySelector(
                  ".a-price .a-offscreen",
                );
                if (fallbackPrice && fallbackPrice.innerText.trim()) {
                  pPrice = fallbackPrice.innerText.trim();
                }
              }

              // Grab Delivery
              const delEl = firstOffer.querySelector(
                "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold",
              );
              if (delEl) pDel = delEl.innerText.trim();

              // Grab MRP directly from this first offer
              const mrpEl = firstOffer.querySelector(
                ".a-text-price .a-offscreen",
              );
              if (mrpEl) pMrp = mrpEl.textContent.trim();
            }

            // Fallback for MRP if it's only in the pinned header
            if (pMrp === "N/A") {
              const pinnedMrpEl = document.querySelector(
                "#aod-sticky-pinned-offer .a-text-price span.a-offscreen",
              );
              if (pinnedMrpEl) pMrp = pinnedMrpEl.textContent.trim();
            }

            // ----------------------------------------------------
            // STEP 2: Safely check for a Used price anywhere in the list
            // ----------------------------------------------------
            const allOffers = document.querySelectorAll(
              "#aod-offer-list #aod-offer",
            );
            for (let offer of allOffers) {
              // FIX: Grab the whole heading regardless of HTML tags (h5, span, etc.)
              const headingEl = offer.querySelector("#aod-offer-heading");
              const headingText = headingEl
                ? headingEl.textContent.trim().toLowerCase()
                : "";

              if (headingText.includes("used")) {
                const usedPriceWholeEl = offer.querySelector(
                  ".a-price .a-price-whole",
                );
                let tempUsedPrice = null;

                if (usedPriceWholeEl) {
                  tempUsedPrice = usedPriceWholeEl.textContent
                    .replace(/[.,]/g, "")
                    .trim();
                } else {
                  const fallbackUsedPrice = offer.querySelector(
                    ".a-price .a-offscreen",
                  );
                  if (fallbackUsedPrice && fallbackUsedPrice.innerText.trim()) {
                    tempUsedPrice = fallbackUsedPrice.innerText
                      .replace(/[^\d]/g, "")
                      .trim();
                  }
                }

                if (tempUsedPrice && pUsed === "No Used Options") {
                  pUsed = tempUsedPrice;
                  break; // Stop looking once we find the first (lowest) used price
                }
              }
            }

            return { pPrice, pMrp, pDel, pUsed };
          });

          // Only override the main price if it was originally N/A
          if (scrapedData.price === "N/A" && panelData.pPrice !== "N/A") {
            scrapedData.price = panelData.pPrice;
            scrapedData.mrp = panelData.pMrp;
            scrapedData.delivery = panelData.pDel;
          }

          if (panelData.pUsed !== "No Used Options") {
            scrapedData.used_available = panelData.pUsed;
          }
        }
      }

      delete scrapedData.hasUsedOptions;

      // Apply the MRP Math Fix
      scrapedData.mrp = cleanAndCheckMRP(scrapedData.price, scrapedData.mrp);

      // CLEANUP: Out of Stock Check
      if (
        scrapedData.price === "N/A" &&
        scrapedData.used_available === "No Used Options"
      ) {
        scrapedData.mrp = "N/A";
        scrapedData.delivery = "N/A";
      }

      const data = { isbn, ...scrapedData };
      fs.appendFileSync(outputFilePath, JSON.stringify(data) + "\n");
      console.log(
        `✅ Success: ${data.format} | Price: ${data.price} | MRP: ${data.mrp} | Del: ${data.delivery} | Used: ${data.used_available}`,
      );

      await new Promise((r) => setTimeout(r, randomDelay()));
    } catch (err) {
      console.log(`❌ Error processing ${isbn}: ${err.message}`);

      fs.appendFileSync(
        outputFilePath,
        JSON.stringify({
          isbn,
          price: "Error",
          mrp: "Error",
          delivery: "Error",
          format: "Error",
          used_available: "Error",
        }) + "\n",
      );

      await new Promise((r) => setTimeout(r, randomDelay()));
    }
  }

  await browser.close();
  console.log("\n🎉 Finished scraping batch!");
  const webhookUrl =
    "https://discord.com/api/webhooks/1499613573561716817/_0ypn7IZkCc7C0Pvq1aOdrWbKm1voPgBJCHqP8khad42q8mkrrAjLdJ3-p0cIBtAllVe";

  console.log("📤 Uploading results to Discord...");
  try {
    const form = new FormData();
    form.append(
      "content",
      `✅ **Job Completed!**\n**PC Name:** ${os.hostname()}\n**List Finished:** ${inputFile}`,
    );
    if (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0) {
      form.append("file", fs.createReadStream(outputFilePath));
    } else {
      form.append(
        "content",
        `✅ **Job Completed!**\n**PC Name:** ${os.hostname()}\n**List Finished:** ${inputFile}\n\n*Note: No data was generated (output file was empty or missing).*`,
      );
    }

    await axios.post(webhookUrl, form, {
      headers: form.getHeaders(),
    });
    console.log("🟢 Successfully sent results to Discord!");
  } catch (e) {
    console.error("🔴 Failed to upload to Discord:", e.message);
  }
})();
