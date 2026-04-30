const { chromium } = require("playwright");
const fs = require("fs");

// Read ISBNs
const isbns = fs
  .readFileSync("isbns.txt", "utf-8")
  .split("\n")
  .map((i) => i.trim())
  .filter(Boolean);

function randomDelay() {
  return Math.floor(Math.random() * 5000) + 4000;
}

// Math Check Helper for MRP vs Price
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
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // ==========================================
  // SETUP: SET LOCATION PIN CODE
  // ==========================================
  console.log("⚙️ Setting Delivery Location to 122101 (Gurugram)...");
  try {
    await page.goto("https://www.amazon.in/", { timeout: 60000 });
    await page.waitForSelector("#nav-global-location-popover-link", {
      timeout: 10000,
    });
    await page.click("#nav-global-location-popover-link");

    await page.waitForSelector("#GLUXZipUpdateInput", { timeout: 5000 });
    await page.fill("#GLUXZipUpdateInput", "122101");
    await page.click("#GLUXZipUpdate");

    await page.waitForTimeout(3000);
    console.log("✅ Location set successfully!\n");
  } catch (err) {
    console.log(
      "⚠️ Could not set location. It might already be set. Continuing...",
    );
  }

  // ==========================================
  // START SCRAPING LOOP
  // ==========================================
  for (let i = 0; i < isbns.length; i++) {
    const isbn = isbns[i];

    try {
      console.log(`🔍[${i + 1}/${isbns.length}] Searching ${isbn}`);
      await page.goto(`https://www.amazon.in/s?k=${isbn}`, { timeout: 60000 });

      await page.waitForSelector(
        'div[data-component-type="s-search-result"], #productTitle',
        { timeout: 15000 },
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
        await page.waitForSelector("#productTitle", { timeout: 15000 });
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

        // Used Options
        const usedLink = Array.from(document.querySelectorAll("a, span")).find(
          (el) =>
            el.innerText &&
            (el.innerText.includes("Used from") ||
              el.innerText.includes("New & Used")),
        );
        if (usedLink) {
          // Clean up the text a bit so it looks nicer in your Excel file
          result.used_available = usedLink.innerText
            .replace(/\n/g, " ")
            .replace(/\s+/g, " ")
            .trim();
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
      // 4. SEE ALL BUYING OPTIONS PANEL (If Price is missing)
      // ==========================================
      if (scrapedData.price === "N/A") {
        const seeAllBtn = await page.$(
          'a[title="See All Buying Options"], #buybox-see-all-buying-choices a',
        );

        if (seeAllBtn) {
          console.log(
            `   -> "Buy Now" box missing. Opening "See All Buying Options" panel...`,
          );
          await seeAllBtn.click();

          await page
            .waitForSelector("#aod-offer-list", { timeout: 8000 })
            .catch(() => {});

          const panelData = await page.evaluate(() => {
            let pPrice = "N/A",
              pMrp = "N/A",
              pDel = "N/A";

            // Grab the very first offer from the actual list of options
            const firstOffer = document.querySelector(
              "#aod-offer-list #aod-offer",
            );

            if (firstOffer) {
              // 1. Grab Price (Amazon hides it in .a-price-whole inside the drawer)
              const priceWholeEl = firstOffer.querySelector(
                ".a-price .a-price-whole",
              );
              if (priceWholeEl) {
                // Removes the decimal dot so it just extracts "8,600"
                pPrice = priceWholeEl.textContent.replace(".", "").trim();
              } else {
                const fallbackPrice = firstOffer.querySelector(
                  ".a-price .a-offscreen",
                );
                if (fallbackPrice && fallbackPrice.innerText.trim()) {
                  pPrice = fallbackPrice.innerText.trim();
                }
              }

              // 2. Grab Delivery
              const delEl = firstOffer.querySelector(
                "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold",
              );
              if (delEl) pDel = delEl.innerText.trim();

              // 3. Grab MRP directly from this first offer (since pinned offer is sometimes empty)
              const mrpEl = firstOffer.querySelector(
                ".a-text-price .a-offscreen",
              );
              if (mrpEl) pMrp = mrpEl.textContent.trim();
            }

            // Fallback for MRP if it's only in the pinned header (just in case)
            if (pMrp === "N/A") {
              const pinnedMrpEl = document.querySelector(
                "#aod-sticky-pinned-offer .a-text-price span.a-offscreen",
              );
              if (pinnedMrpEl) pMrp = pinnedMrpEl.textContent.trim();
            }

            return { pPrice, pMrp, pDel };
          });

          if (panelData.pPrice !== "N/A") scrapedData.price = panelData.pPrice;
          if (panelData.pMrp !== "N/A") scrapedData.mrp = panelData.pMrp;
          if (panelData.pDel !== "N/A") scrapedData.delivery = panelData.pDel;
        }
      }

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
      fs.appendFileSync("output.json", JSON.stringify(data) + "\n");
      console.log(
        `✅ Success: ${data.format} | Price: ${data.price} | MRP: ${data.mrp} | Del: ${data.delivery} | Used: ${data.used_available}`,
      );

      await new Promise((r) => setTimeout(r, randomDelay()));
    } catch (err) {
      console.log(`❌ Error processing ${isbn}: ${err.message}`);

      fs.appendFileSync(
        "output.json",
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
})();
