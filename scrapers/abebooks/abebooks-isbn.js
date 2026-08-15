const fs = require("fs");
const path = require("path");
const { initBrowser, getRandomDelay } = require("../../utils/browser");
const {
  readJsonLines,
  readSearchTerms,
  appendResult,
} = require("../../utils/file");
const { initScraper } = require("../../utils/scraperInit");
const { startSpinner, stopSpinner } = require("../../utils/spinner");

(async () => {
  const { inputFile, isHeadless, outputFilePath } = initScraper(
    "abebooks-isbn.js",
    "abebooks-isbn",
    ".json",
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
    const existingOutput = fs
      .readFileSync(outputFilePath, "utf-8")
      .split("\n")
      .filter(Boolean);
    startIndex = existingOutput.length;
    if (startIndex > 0) {
      console.log(
        `\n▶ Found existing output file with ${startIndex} items. Resuming from item ${startIndex + 1}...`,
      );
    }
  }

  let { context, page } = await initBrowser(isHeadless, "abebooks_profile");

  for (let i = startIndex; i < inputItems.length; i++) {
    const item = inputItems[i];
    const targetIsbn = item.searched_isbn || item.isbn;

    console.log(
      `\n\x1b[1m[${i + 1}/${inputItems.length}] Processing ISBN: ${targetIsbn}\x1b[0m`,
    );

    if (!targetIsbn) {
      stopSpinner("Skipping item with no ISBN.", "warn");
      continue;
    }

    if (i > 0 && i % 50 === 0) {
      stopSpinner(
        "☕ Taking a 15-second human break to avoid rate limits...",
        "info",
      );
      await new Promise((r) => setTimeout(r, 15000));
    }

    if (i > 0 && i % 400 === 0) {
      stopSpinner(`Flushing browser memory after ${i} items...`, "info");
      await context.close();
      const newBrowser = await initBrowser(isHeadless, "abebooks_profile");
      context = newBrowser.context;
      page = newBrowser.page;
    }

    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        startSpinner(
          `Searching AbeBooks for ${targetIsbn}... (Attempt ${4 - retries}/3)`,
        );

        const searchUrl = `https://www.abebooks.com/servlet/SearchResults?kn=${targetIsbn}`;

        const response = await page.goto(searchUrl, {
          timeout: 60000,
          waitUntil: "domcontentloaded",
        });

        const status = response ? response.status() : 200;
        const pageText = await page.content();

        if (status === 429 || pageText.includes("Too Many Requests")) {
          stopSpinner(
            `🛑 429 RATE LIMIT HIT! Cooldown initiated... Waiting 60 seconds.`,
            "warn",
          );
          await new Promise((r) => setTimeout(r, 60000)); // Wait 1 full minute
          retries--;
          continue;
        }

        await page
          .waitForSelector(
            '[data-srp-item-role="listing"], .result-data, #bookPurchase, #srp-no-results, .message-error',
            { timeout: 10000 },
          )
          .catch(() => {});

        startSpinner("Extracting listing data...");

        let scrapedData = await page.evaluate((target) => {
          const cleanText = (el) => (el ? el.innerText.trim() : "N/A");

          const formatShipping = (rawText) => {
            if (rawText === "N/A") return "N/A";
            const firstLine = rawText.split("\n")[0];
            const match = firstLine.match(/(.*?shipping)/i);
            return match ? match[1].trim() : firstLine.trim();
          };

          let extractedListings = [];

          const newUIListings = document.querySelectorAll(
            '[data-srp-item-role="listing"]',
          );
          if (newUIListings.length > 0) {
            newUIListings.forEach((item) => {
              const priceEl = item.querySelector(
                '[data-test-id^="item-price"]',
              );
              const shipEl = item.querySelector(
                '[data-test-id^="item-shipping-price"]',
              );
              const sellerLink = item.querySelector(
                '[data-test-id="listing-seller-link"]',
              );

              // Address Extraction
              let address = "N/A";
              const sellerInfoP = item.querySelector(
                '[data-test-id="seller-info"]',
              );
              if (sellerInfoP) {
                const addressSpan = sellerInfoP.querySelector(
                  'span[aria-hidden="true"]',
                );
                if (addressSpan) {
                  address = cleanText(addressSpan).replace(/^,\s*/, "");
                }
              }

              // ISBN Extraction
              let foundIsbn = "N/A";
              const isbnLink = item.querySelector(
                '[data-test-id="listing-isbn-link"]',
              );
              if (isbnLink) {
                const match = isbnLink.innerText.match(/(978\d{10})/);
                if (match) foundIsbn = match[1];
              }

              extractedListings.push({
                price: cleanText(priceEl),
                shipping: formatShipping(cleanText(shipEl)),
                seller: cleanText(sellerLink),
                seller_address: address,
                found_isbn: foundIsbn,
                isbn_match: foundIsbn === target,
              });
            });
            return { listings: extractedListings };
          }

          const oldUIListings = document.querySelectorAll(".result-data");
          if (oldUIListings.length > 0) {
            oldUIListings.forEach((item) => {
              let address = cleanText(
                item.querySelector('[data-test-id="listing-seller-location"]'),
              );

              let foundIsbn = "N/A";
              const isbn13El = item.querySelector(
                '[data-test-id="listing-isbn-13"]',
              );
              if (isbn13El) {
                const match = isbn13El.innerText.match(/(978\d{10})/);
                if (match) foundIsbn = match[1];
              }

              extractedListings.push({
                price: cleanText(
                  item.querySelector('[data-test-id="item-price"]'),
                ),
                shipping: formatShipping(
                  cleanText(
                    item.querySelector('[data-test-id="shipping-detail"]'),
                  ),
                ),
                seller: cleanText(
                  item.querySelector('[data-test-id="listing-seller-name"]'),
                ),
                seller_address: address,
                found_isbn: foundIsbn,
                isbn_match: foundIsbn === target,
              });
            });
            return { listings: extractedListings };
          }

          const productPageBuyBox = document.querySelector("#bookPurchase");
          if (productPageBuyBox) {
            let address = cleanText(
              document.querySelector("#bookseller-location"),
            );

            let foundIsbn = target;

            extractedListings.push({
              price: cleanText(
                document.querySelector(
                  '#book-price, [data-test-id="item-price"]',
                ),
              ),
              shipping: formatShipping(
                cleanText(document.querySelector(".basket-shipping-line")),
              ),
              seller: cleanText(
                document.querySelector(
                  '#bookseller-name, [data-test-id="bookseller-name"]',
                ),
              ),
              seller_address: address,
              found_isbn: foundIsbn,
              isbn_match: foundIsbn === target,
            });
            return { listings: extractedListings };
          }

          return null;
        }, targetIsbn);

        if (
          scrapedData &&
          scrapedData.listings &&
          scrapedData.listings.length > 0
        ) {
          stopSpinner(
            `Found ${scrapedData.listings.length} listing(s)! (Top: ${scrapedData.listings[0].price} | Match: ${scrapedData.listings[0].isbn_match})`,
            "success",
          );

          const finalData = { ...item, listings: scrapedData.listings };
          appendResult(outputFilePath, finalData);
        } else {
          stopSpinner(`No listings found for ${targetIsbn}.`, "warn");

          const finalData = { ...item, listings: [] };
          appendResult(outputFilePath, finalData);
        }

        success = true; // Mark as successful to exit the retry loop
        await page.waitForTimeout(getRandomDelay(3000, 7000));
      } catch (err) {
        stopSpinner(`Error processing ${targetIsbn}: ${err.message}`, "error");
        retries--;

        if (retries === 0) {
          console.log(`\n⏭️ Skipping ${targetIsbn} after 3 failed attempts.`);
          const errorData = {
            ...item,
            listings: [
              {
                price: "Error",
                shipping: "Error",
                seller: "Error",
                seller_address: "Error",
                found_isbn: "Error",
                isbn_match: false,
              },
            ],
          };
          appendResult(outputFilePath, errorData);

          const debugFolder = path.join(__dirname, "..", "..", "debug");
          if (!fs.existsSync(debugFolder))
            fs.mkdirSync(debugFolder, { recursive: true });
          await page.screenshot({
            path: path.join(
              debugFolder,
              `debug-abebooks-error-${targetIsbn}.png`,
            ),
          });
        } else {
          startSpinner("Retrying in 10 seconds...");
          await page.waitForTimeout(10000);
        }
      }
    }
  }

  await context.close();
  console.log(
    `\n🎉 AbeBooks Scraper completed. Results saved to ${outputFilePath}`,
  );
})();
