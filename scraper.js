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

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  for (let i = 0; i < isbns.length; i++) {
    const isbn = isbns[i];

    try {
      console.log(`\n🔍[${i + 1}/${isbns.length}] Searching ${isbn}`);

      await page.goto(`https://www.amazon.in/s?k=${isbn}`, { timeout: 60000 });

      // Wait for EITHER the search results list OR the Product Title
      await page.waitForSelector(
        'div[data-component-type="s-search-result"], #productTitle',
        { timeout: 15000 },
      );

      // Smart Check: Are we on the Product Page already?
      const isProductPage = await page.$("#productTitle");

      if (!isProductPage) {
        console.log(
          `   -> Found Search Page. Navigating into the book's product page...`,
        );

        // FIX: Wait specifically for a valid link inside the first search result
        await page.waitForSelector(
          'div[data-component-type="s-search-result"] a.a-link-normal',
          { timeout: 10000 },
        );

        // FIX: Grab that link
        const firstLink = await page.$(
          'div[data-component-type="s-search-result"] a.a-link-normal',
        );

        if (firstLink) {
          const href = await firstLink.getAttribute("href");
          if (href) {
            const fullUrl = new URL(href, "https://www.amazon.in").href;
            await page.goto(fullUrl, { timeout: 60000 });
            await page.waitForSelector("#productTitle", { timeout: 15000 });
          }
        } else {
          throw new Error(
            "Found the search result, but couldn't find the clickable link inside it.",
          );
        }
      } else {
        console.log(
          `   -> Amazon auto-redirected directly to the Product Page.`,
        );
      }

      // NOW WE ARE ON THE PRODUCT PAGE
      const scrapedData = await page.evaluate(() => {
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

        // 1. Get Delivery Date
        result.delivery =
          getText(
            "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold",
          ) ||
          getText("#deliveryBlockMessage") ||
          "N/A";

        // 2. Check for Used Books
        const allLinks = Array.from(document.querySelectorAll("a, span"));
        const usedLink = allLinks.find(
          (el) =>
            el.innerText &&
            (el.innerText.includes("Used from") ||
              el.innerText.includes("New & Used")),
        );
        if (usedLink) {
          result.used_available = usedLink.innerText.replace(/\n/g, " ").trim();
        }

        // 3. Get Prices & Prefer Paperback
        const formatBoxes = Array.from(
          document.querySelectorAll("#tmmSwatches li.swatchElement"),
        );
        let paperbackBox = formatBoxes.find((box) =>
          box.innerText.toLowerCase().includes("paperback"),
        );

        if (paperbackBox) {
          result.format = "Paperback";
          // If Paperback isn't the currently selected tab, we can steal its price directly from the box!
          const boxPrice = paperbackBox.querySelector(".a-color-price");
          if (boxPrice) {
            result.price = boxPrice.innerText.replace("₹", "").trim();
          } else {
            // If it IS selected, grab the main price on the page
            result.price =
              getText(".priceToPay .a-price-whole") ||
              getText("#corePriceDisplay_desktop_feature_div .a-price-whole") ||
              "N/A";
          }
        } else {
          // If no Paperback exists, just take whatever format we are looking at (like Hardcover)
          result.format = getText("#productSubtitle") || "Hardcover / Other";
          result.price =
            getText(".priceToPay .a-price-whole") ||
            getText("#corePriceDisplay_desktop_feature_div .a-price-whole") ||
            "N/A";
        }

        // Use textContent for MRP because Amazon hides it from screen readers
        const mrpEl = document.querySelector(".a-text-price span.a-offscreen");
        if (mrpEl) result.mrp = mrpEl.textContent.trim();

        return result;
      });

      const data = {
        isbn,
        ...scrapedData,
      };

      // Save to output
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
