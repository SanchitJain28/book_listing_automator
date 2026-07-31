const fs = require("fs");
const path = require("path");
const { initBrowser, getRandomDelay } = require("../../utils/browser");
const { readSearchTerms, appendResult } = require("../../utils/file");
const { initScraper } = require("../../utils/scraperInit");
const { checkDogPage } = require("../../utils/amazon");
const { startSpinner, stopSpinner } = require("../../utils/spinner");

(async () => {
  const { inputFile, isHeadless, outputFilePath } = initScraper(
    "amazon-search-term-stage-1.js",
    "amazon-search-term",
    "-stage-1.json",
  );
  const searchTerms = readSearchTerms(inputFile);
  let { context, page } = await initBrowser(isHeadless);

  for (let i = 0; i < searchTerms.length; i++) {
    // Memory flush every 100 search terms to free up RAM
    if (i > 0 && i % 100 === 0) {
      console.log(`\n\x1b[33m[Memory Flush] Processed ${i} terms. Restarting browser...\x1b[0m`);
      await context.close().catch(() => {});
      const browserState = await initBrowser(isHeadless);
      context = browserState.context;
      page = browserState.page;
    }

    const term = searchTerms[i];
    console.log(`\n\x1b[1mProcessing search term: ${term}\x1b[0m`);

    let currentPage = 1;
    let hasNextPage = true;
    let url = `https://www.amazon.in/s?k=${encodeURIComponent(term)}`;

    while (hasNextPage) {
      try {
        startSpinner(`Navigating to page ${currentPage} for ${term}...`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        const isDogPage = await checkDogPage(page);

        if (isDogPage) {
          stopSpinner("Amazon bot block detected. Waiting 3 minutes...", "warn");
          await page.waitForTimeout(180000);
          continue;
        }

        await page
          .waitForSelector('div[data-component-type="s-search-result"]', {
            timeout: 15000,
          })
          .catch(() => {});

        const listings = await page.evaluate(() => {
          const results = [];
          const elements = document.querySelectorAll(
            'div[data-component-type="s-search-result"]',
          );

          elements.forEach((el) => {
            const asin = el.getAttribute("data-asin") || "";
            const titleContainer = el.querySelector('[data-cy="title-recipe"]');
            const titleEl = titleContainer ? titleContainer.querySelector('h2 span') : el.querySelector('h2 span');
            const title = titleEl ? titleEl.innerText.trim() : "";
            
            const linkEl = titleContainer ? titleContainer.querySelector('a.a-link-normal') : el.querySelector('.a-link-normal');
            const link = linkEl ? linkEl.href : "";
            
            const priceEl = el.querySelector(".a-price-whole");
            const price = priceEl ? priceEl.innerText.trim() : "";

            if (asin && title) {
              results.push({ asin, title, link, price });
            }
          });

          return results;
        });

        if (listings.length === 0) {
          stopSpinner(`No listings found on page ${currentPage}`, "error");
          const debugFolder = path.join(__dirname, "..", "..", "debug");
          if (!fs.existsSync(debugFolder)) {
            fs.mkdirSync(debugFolder, { recursive: true });
          }
          await page.screenshot({ path: path.join(debugFolder, `debug-empty-${term.replace(/[^a-z0-9]/gi, '_')}-p${currentPage}.png`) });
          hasNextPage = false;
          break;
        }

        listings.forEach((listing) => {
          appendResult(outputFilePath, { term, page: currentPage, ...listing });
        });

        stopSpinner(`Found ${listings.length} listings on page ${currentPage}`);

        const nextUrl = await page.evaluate(() => {
          const nextBtn = document.querySelector(
            ".s-pagination-next:not(.s-pagination-disabled)",
          );
          return nextBtn ? nextBtn.href : null;
        });

        if (nextUrl) {
          url = nextUrl;
          currentPage++;
          await page.waitForTimeout(getRandomDelay(3000, 7000));
        } else {
          hasNextPage = false;
        }
      } catch (error) {
        stopSpinner(`Error on term ${term} page ${currentPage}: ${error.message}`, "error");
        hasNextPage = false;
      }
    }
    try {
      if (!page.isClosed()) {
        await page.waitForTimeout(getRandomDelay(5000, 10000));
      }
    } catch (e) {
      console.log("Browser was closed. Reinitializing...");
      const browserState = await initBrowser(isHeadless);
      context = browserState.context;
      page = browserState.page;
    }
  }

  await context.close();
  console.log("Stage 1 completed.");
})();
