const fs = require("fs");
const path = require("path");
const { initBrowser, getRandomDelay } = require("../../utils/browser");
const {
  readJsonLines,
  readSearchTerms,
  appendResult,
} = require("../../utils/file");
const { initScraper } = require("../../utils/scraperInit");
const { checkDogPage, cleanAndCheckMRP } = require("../../utils/amazon");
const { startSpinner, stopSpinner } = require("../../utils/spinner");

(async () => {
  const { inputFile, isHeadless, outputFilePath } = initScraper(
    "amazon-search-term-stage-2.js",
    "amazon-search-term",
    "-stage-2.json",
  );

  const isTxt = inputFile.endsWith(".txt");
  let stage1Items = [];

  if (isTxt) {
    const asins = readSearchTerms(inputFile);
    stage1Items = asins.map((asin) => ({ asin }));
  } else {
    stage1Items = readJsonLines(inputFile);
  }

  let { context, page } = await initBrowser(isHeadless);

  for (let i = 0; i < stage1Items.length; i++) {
    const item = stage1Items[i];
    const asin = item.asin;

    delete item.term;
    delete item.page;
    delete item.link;

    console.log(
      `\n\x1b[1m[${i + 1}/${stage1Items.length}] Processing ASIN: ${asin}\x1b[0m`,
    );

    if (i > 0 && i % 500 === 0) {
      stopSpinner(`Flushing browser memory after ${i} items...`, "info");
      await context.close();
      const newBrowser = await initBrowser(isHeadless);
      context = newBrowser.context;
      page = newBrowser.page;
    }

    if (!asin) {
      stopSpinner("Skipping item with no ASIN.", "warn");
      continue;
    }

    let retries = 2;
    let success = false;

    while (retries > 0 && !success) {
      try {
        startSpinner(`Navigating to product page for ${asin}...`);

        await page.goto(`https://www.amazon.in/dp/${asin}`, {
          timeout: 60000,
          waitUntil: "domcontentloaded",
        });

        const isDogPage = await checkDogPage(page);

        if (isDogPage) {
          stopSpinner(
            "Amazon bot block detected. Waiting 30 seconds...",
            "warn",
          );
          await page.waitForTimeout(30000);
          await context.clearCookies();
          retries--;
          continue;
        }

        await page
          .waitForSelector("#productTitle", { timeout: 15000 })
          .catch(() => {});

        // SMART FORMAT SWITCH
        startSpinner("Checking for cheaper physical formats...");
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
          stopSpinner(
            `Switching to cheaper format: ${cheaperTarget.format} (₹${cheaperTarget.price})...`,
            "info",
          );
          startSpinner("Loading cheaper format...");
          await page.goto(cheaperTarget.url, {
            timeout: 60000,
            waitUntil: "domcontentloaded",
          });
          await page
            .waitForSelector("#productTitle", { timeout: 5000 })
            .catch(() => {});
        }

        // PRODUCT PAGE DATA EXTRACTION
        startSpinner("Extracting product data...");
        let scrapedData = await page.evaluate(() => {
          let result = {
            title: "N/A",
            found_isbn: "N/A",
            price: "N/A",
            mrp: "N/A",
            delivery: "N/A",
            seller: "N/A",
            used_available: "No Used Options",
            reviews_count: "0",
            publisher: "N/A",
            publication_date: "N/A",
            hasUsedOptions: false,
          };

          const getText = (selector) => {
            const el = document.querySelector(selector);
            return el ? el.innerText.trim() : null;
          };

          result.title = getText("#productTitle") || "N/A";

          const reviewsText = getText("#acrCustomerReviewText");
          if (reviewsText) {
             result.reviews_count = reviewsText.replace(/[^\d]/g, "");
          }

          const detailBullets = Array.from(
            document.querySelectorAll("#detailBullets_feature_div li"),
          );

          const carouselIsbn = getText(
            "#rpi-attribute-book_details-isbn13 .rpi-attribute-value span",
          );
          if (carouselIsbn) {
            result.found_isbn = carouselIsbn.replace(/[^\dX]/gi, "");
          } else {
            const isbn13Bullet = detailBullets.find((li) =>
              li.innerText.includes("ISBN-13"),
            );
            if (isbn13Bullet) {
              const parts = isbn13Bullet.innerText.split(":");
              if (parts.length > 1)
                result.found_isbn = parts[1].replace(/[^\dX]/gi, "");
            }
          }

          const pubBullet = detailBullets.find((li) =>
            li.innerText.toLowerCase().includes("publisher"),
          );
          if (pubBullet) {
            const parts = pubBullet.innerText.split(":");
            if (parts.length > 1) result.publisher = parts[1].trim();
          }

          const dateBullet = detailBullets.find((li) =>
            li.innerText.toLowerCase().includes("publication date"),
          );
          if (dateBullet) {
            const parts = dateBullet.innerText.split(":");
            if (parts.length > 1) result.publication_date = parts[1].trim();
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
          startSpinner("Checking 'See All Buying Options' panel...");
          const seeAllBtn = await page.$(
            'a[title="See All Buying Options"], #buybox-see-all-buying-choices a, #moreBuyingChoices_feature_div a, a:has-text("used & new"), a:has-text("New & Used")',
          );

          if (seeAllBtn) {
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

        const finalData = { ...item, ...scrapedData };
        appendResult(outputFilePath, finalData);

        stopSpinner(
          `Successfully parsed ${asin}. Price: ₹${scrapedData.price}, Seller: ${scrapedData.seller}, ISBN: ${scrapedData.found_isbn}`,
        );

        success = true;
        await page.waitForTimeout(getRandomDelay(2000, 5000));
      } catch (err) {
        stopSpinner(`Error processing ${asin}: ${err.message}`, "error");
        retries--;

        if (retries === 0) {
          const errorData = {
            ...item,
            title: "Error",
            found_isbn: "Error",
            price: "Error",
            mrp: "Error",
            delivery: "Error",
            seller: "Error",
            used_available: "Error",
            reviews_count: "Error",
            publisher: "Error",
            publication_date: "Error",
          };
          appendResult(outputFilePath, errorData);

          const debugFolder = path.join(__dirname, "..", "..", "debug");
          if (!fs.existsSync(debugFolder))
            fs.mkdirSync(debugFolder, { recursive: true });
          await page.screenshot({
            path: path.join(debugFolder, `debug-error-${asin}.png`),
          });
        } else {
          startSpinner("Retrying in 5 seconds...");
          await page.waitForTimeout(5000);
        }
      }
    }
  }

  await context.close();
  console.log("\n🎉 Stage 2 completed.");
})();
