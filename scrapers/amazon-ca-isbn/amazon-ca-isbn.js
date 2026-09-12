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
const { getCheaperPhysicalFormat } = require("../amazon-isbn/core/swatches");
const { extractProductData } = require("../amazon-isbn/core/productExtractor");
const { extractBuyingOptionsDrawer } = require("../amazon-isbn/core/buyingOptions");
const { validateIsbnMatch } = require("../amazon-isbn/core/validator");

(async () => {
  const { inputFile, isHeadless, outputFilePath } = initScraper(
    "amazon-ca-isbn.js",
    "amazon-ca-isbn",
    ".json"
  );

  const isTxt = inputFile.endsWith(".txt");
  let inputItems = [];

  if (isTxt) {
    const isbns = readSearchTerms(inputFile);
    inputItems = isbns.map((isbn) => ({ searched_isbn: isbn }));
  } else {
    inputItems = readJsonLines(inputFile);
  }

  let startIndex = 0;
  if (fs.existsSync(outputFilePath)) {
    const existingOutput = fs.readFileSync(outputFilePath, "utf-8").split("\n").filter(Boolean);
    startIndex = existingOutput.length;
    if (startIndex > 0) {
      console.log(`\n▶ Found existing output file with ${startIndex} items. Resuming from item ${startIndex + 1}...`);
    }
  }

  let { context, page } = await initBrowser(isHeadless, "amazon_ca_profile");

  for (let i = startIndex; i < inputItems.length; i++) {
    const item = inputItems[i];
    const isbn = item.searched_isbn;

    console.log(`\n\x1b[1m[${i + 1}/${inputItems.length}] Processing ISBN: ${isbn}\x1b[0m`);

    if (i > 0 && i % 500 === 0) {
      stopSpinner(`Flushing browser memory after ${i} items...`, "info");
      await context.close();
      const newBrowser = await initBrowser(isHeadless, "amazon_ca_profile");
      context = newBrowser.context;
      page = newBrowser.page;
    }

    if (!isbn) {
      stopSpinner("Skipping item with no ISBN.", "warn");
      continue;
    }

    let retries = 2;
    let success = false;

    while (retries > 0 && !success) {
      try {
        startSpinner(`Searching Amazon.ca for ISBN ${isbn}...`);

        await page.goto(`https://www.amazon.ca/s?k=${encodeURIComponent(isbn)}`, {
          timeout: 45000,
          waitUntil: "domcontentloaded",
        });

        let isDogPage = await checkDogPage(page);
        if (isDogPage) {
          stopSpinner("Amazon bot block detected. Waiting 30 seconds...", "warn");
          await page.waitForTimeout(30000);
          await context.clearCookies();
          retries--;
          continue;
        }

        // Get first search result
        const firstResult = await page.$('.s-search-results .s-result-item[data-component-type="s-search-result"] a.a-link-normal[href*="/dp/"]');
        
        if (!firstResult) {
          throw new Error("No search results found.");
        }

        const productUrl = await page.evaluate(el => el.href, firstResult);
        
        startSpinner(`Navigating to product page...`);
        await page.goto(productUrl, {
          timeout: 45000,
          waitUntil: "domcontentloaded",
        });

        isDogPage = await checkDogPage(page);
        if (isDogPage) {
          stopSpinner("Amazon bot block detected on product page. Waiting 30 seconds...", "warn");
          await page.waitForTimeout(30000);
          await context.clearCookies();
          retries--;
          continue;
        }

        await page
          .waitForSelector("#productTitle", { timeout: 10000 })
          .catch(() => {});

        // Format Switcher: Check for cheaper physical format
        const cheaperTarget = await getCheaperPhysicalFormat(page);
        if (cheaperTarget && cheaperTarget.url) {
          startSpinner("Loading cheaper physical format...");
          await page.goto(cheaperTarget.url, {
            timeout: 45000,
            waitUntil: "domcontentloaded",
          });
          await page
            .waitForSelector("#productTitle", { timeout: 4000 })
            .catch(() => {});
        }

        // Extract product data
        startSpinner("Extracting product data...");
        let scrapedData = await extractProductData(page);

        // Fallback to AOD Drawer if needed
        if (scrapedData.price === "N/A" || scrapedData.hasUsedOptions) {
          const panelData = await extractBuyingOptionsDrawer(page);
          if (panelData) {
            if (scrapedData.price === "N/A" && panelData.pPrice !== "N/A") {
              scrapedData.price = panelData.pPrice;
              scrapedData.mrp = panelData.pMrp;
              scrapedData.delivery = panelData.pDel;
              if (panelData.pSeller !== "N/A") scrapedData.seller = panelData.pSeller;
            }
            if (panelData.pUsed !== "No Used Options") {
              scrapedData.used_available = panelData.pUsed;
            }
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

        const isbnMatched = validateIsbnMatch(scrapedData.found_isbn, isbn);
        scrapedData.isbn_matched = isbnMatched;
        const inStock = scrapedData.price !== "N/A";

        const finalData = {
          ...item,
          store: "Amazon.ca",
          found: inStock || !!scrapedData.title,
          in_stock: inStock,
          stock_status: inStock ? "In Stock" : "Out of Stock",
          currency: "CAD",
          ...scrapedData,
          url: page.url(),
          scraped_at: new Date().toISOString(),
        };

        appendResult(outputFilePath, finalData);

        stopSpinner(
          `Successfully parsed. Price: CDN$${scrapedData.price}, Match: ${isbnMatched ? "Yes" : "No"}`
        );

        success = true;
        await page.waitForTimeout(getRandomDelay(2000, 4500));
      } catch (err) {
        stopSpinner(`Error processing ${isbn}: ${err.message}`, "error");
        retries--;

        if (retries === 0) {
          const errorData = {
            ...item,
            store: "Amazon.ca",
            title: "Error",
            found_isbn: "Error",
            isbn_matched: false,
            price: "Error",
            mrp: "Error",
            delivery: "Error",
            seller: "Error",
            used_available: "Error",
            reviews_count: "Error",
            publisher: "Error",
            publication_date: "Error",
            found: false,
            in_stock: false,
            stock_status: "Error",
            scraped_at: new Date().toISOString(),
          };
          appendResult(outputFilePath, errorData);
        } else {
          startSpinner("Retrying in 5 seconds...");
          await page.waitForTimeout(5000);
        }
      }
    }
  }

  await context.close();
  console.log(`\n🎉 Amazon CA Scraper completed. Results saved to ${outputFilePath}`);
})();
