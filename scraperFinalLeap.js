const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("❌ Error: You must provide an input CSV/TXT file.");
  console.error(
    "Format must be: ISBN, PriceLimit (e.g., 9781847663191, 6448.94)",
  );
  console.error("Usage: node scraperFinalLeap.js <input_file.txt>");
  process.exit(1);
}

const isHeadless = process.argv.includes("--headless");

const outputDir = path.join(__dirname, "output");
const outputFile = `output_final_leap_${path.basename(inputFile).replace(/\.[^/.]+$/, "")}.json`;
const outputFilePath = path.join(outputDir, outputFile);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Parse Input (ISBN, Limit)
const targetList = fs
  .readFileSync(inputFile, "utf-8")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const firstCommaIdx = line.indexOf(",");
    const isbn = line.substring(0, firstCommaIdx).trim();
    let rawPrice = line.substring(firstCommaIdx + 1).trim();
    rawPrice = rawPrice.replace(/,/g, "").replace(/"/g, "");

    return {
      isbn: isbn,
      limit: parseFloat(rawPrice),
    };
  });

// Exchange Rates Configuration
const RATES = {
  USD: 95.01,
  GBP: 127.84,
  EUR: 110.7,
  INR: 1,
};

function parsePriceFloat(priceStr) {
  let clean = priceStr.replace(/[^\d.,]/g, "");
  if (clean.includes(",") && clean.includes(".")) {
    if (clean.indexOf(",") < clean.indexOf("."))
      clean = clean.replace(/,/g, "");
    else clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  }
  return parseFloat(clean);
}

function getConvertedINR(priceStr) {
  if (!priceStr) return null;
  const num = parsePriceFloat(priceStr);
  if (isNaN(num)) return null;

  const upStr = priceStr.toUpperCase();
  if (upStr.includes("£") || upStr.includes("GBP")) return num * RATES.GBP;
  if (upStr.includes("€") || upStr.includes("EUR")) return num * RATES.EUR;
  if (upStr.includes("₹") || upStr.includes("INR")) return num;

  return num * RATES.USD;
}

function randomDelay() {
  return Math.floor(Math.random() * 3000) + 4000;
}

(async () => {
  const browser = await chromium.launch({
    headless: isHeadless,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  let context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  });

  await context.route("**/*", (route) => {
    if (["media", "font"].includes(route.request().resourceType()))
      route.abort();
    else route.continue();
  });

  let page = await context.newPage();

  console.log("==========================================");
  console.log(`🚀 Starting FINAL LEAP Scraper | Targets: ${targetList.length}`);
  console.log("==========================================\n");

  for (let i = 0; i < targetList.length; i++) {
    const target = targetList[i];

    if (i > 0 && i % 200 === 0) {
      console.log("🧹 Flushing browser memory to bypass trackers...");
      await context.clearCookies();
      await page.close();
      page = await context.newPage();
    }

    try {
      console.log(
        `\n🔍 [${i + 1}/${targetList.length}] Searching Google for ISBN: ${target.isbn} (Limit: ₹${target.limit})`,
      );

      await page.goto(`https://www.google.com/search?q=${target.isbn}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(2500);

      const isCaptcha = await page.evaluate(() => {
        return (
          !!document.querySelector("form#captcha-form") ||
          document.body.textContent.includes("automated queries") ||
          document.title.includes("Sorry")
        );
      });

      if (isCaptcha) {
        console.log("\x07");
        console.log("   🚨 GOOGLE PUZZLE/CAPTCHA DETECTED!");
        console.log(
          "   👉 PLEASE SOLVE THE PUZZLE IN THE BROWSER WINDOW NOW...",
        );
        await page.waitForSelector("#search", { timeout: 0 });
        console.log("   ✅ Puzzle solved! Resuming search extraction...");
        await page.waitForTimeout(2000);
      }

      const validLinks = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("#search a"));
        const allowedDomains = [
          "abebooks.com",
          "abebooks.co.uk",
          "abebooks.de",
          "amazon.com",
          "amazon.co.uk",
          "amazon.de",
          "ebay.com",
          "ebay.co.uk",
          "ebay.de",
        ];
        let results = [];
        for (let a of anchors) {
          try {
            const urlObj = new URL(a.href);
            const host = urlObj.hostname.replace("www.", "");
            if (allowedDomains.includes(host)) {
              if (
                host.includes("abebooks") ||
                a.href.includes("/dp/") ||
                a.href.includes("/itm/") ||
                a.href.includes("servlet") ||
                a.href.includes("/p/")
              ) {
                results.push(a.href);
              }
            }
          } catch (e) {}
        }
        return [...new Set(results)].slice(0, 3);
      });

      if (validLinks.length === 0) {
        console.log(
          `   ⚠️ No valid US/UK/DE links found on Google for ${target.isbn}.`,
        );
        fs.appendFileSync(
          outputFilePath,
          JSON.stringify({
            target_isbn: target.isbn,
            target_limit: target.limit,
            found: false,
            is_buyable: false,
          }) + "\n",
        );
        await new Promise((r) => setTimeout(r, randomDelay()));
        continue;
      }

      console.log(`   -> Found ${validLinks.length} valid links to check...`);

      let bestOption = null;

      for (let rawLink of validLinks) {
        let link = rawLink;
        if (link.includes("amazon.")) {
          try {
            let urlObj = new URL(link);
            urlObj.searchParams.set("language", "en_US");
            link = urlObj.toString();
          } catch (e) {}
        }

        console.log(`      -> Checking: ${link}`);
        await page
          .goto(link, { timeout: 45000, waitUntil: "domcontentloaded" })
          .catch(() => null);
        await page.waitForTimeout(3000);

        const siteHost = new URL(link).hostname.replace("www.", "");

        let scraped = await page.evaluate(() => {
          let priceStr = null;
          let countryText = null;
          let isOutOfStock = false;
          let checkRequired = false;
          let bodyHtml = document.body.innerText;
          let rawContent = document.body.textContent;

          const host = window.location.hostname;

          // Convert everything to Lowercase for immune matching!
          const lowerBody = bodyHtml.toLowerCase();
          const lowerRaw = rawContent.toLowerCase();

          // --- ABEBOOKS LOGIC ---
          if (host.includes("abebooks")) {
            if (
              document.querySelector('[data-test-id="atb-nocopies"]') ||
              lowerBody.includes("(no available copies)")
            ) {
              isOutOfStock = true;
            } else {
              const pEl =
                document.querySelector(".bb-price") ||
                document.querySelector("#book-price");
              if (pEl) priceStr = pEl.textContent.trim();

              const shipEl =
                document.querySelector(".bb-shipping") ||
                document.querySelector(".basket-shipping");
              if (shipEl) countryText = shipEl.innerText;
            }
          }
          // --- AMAZON LOGIC ---
          else if (host.includes("amazon")) {
            const outOfStockPhrases = [
              "currently unavailable",
              "out of print--limited availability",
              "no disponible por el momento",
              "derzeit nicht verfügbar",
            ];
            isOutOfStock = outOfStockPhrases.some(
              (phrase) =>
                lowerBody.includes(phrase) || lowerRaw.includes(phrase),
            );

            // 🔥 FIX: BULLETPROOF CHECK_REQUIRED LOGIC
            // Looks for fragments, ignoring case sensitivity completely!
            const shippingErrorPhrases = [
              "cannot be shipped",
              "different delivery location",
              "no puede enviarse", // Spanish
              "no disponible para envío", // Spanish
            ];

            // If any fragment exists in either innerText OR textContent, flag it!
            checkRequired = shippingErrorPhrases.some(
              (phrase) =>
                lowerBody.includes(phrase) || lowerRaw.includes(phrase),
            );

            if (!isOutOfStock) {
              const aPrice =
                document.querySelector(".a-price .a-offscreen") ||
                document.querySelector("#price");
              if (aPrice && /\d/.test(aPrice.textContent)) {
                priceStr = aPrice.textContent;
              } else {
                const whole = document.querySelector(".a-price-whole");
                const frac = document.querySelector(".a-price-fraction");
                if (whole)
                  priceStr =
                    whole.textContent.replace(/[^\d]/g, "") +
                    (frac ? "." + frac.textContent.replace(/[^\d]/g, "") : "");
              }
            }
          }
          // --- EBAY LOGIC ---
          else if (host.includes("ebay")) {
            if (lowerBody.includes("out of stock")) {
              isOutOfStock = true;
            } else {
              const ePrice = document.querySelector(".x-price-primary");
              if (ePrice) priceStr = ePrice.textContent;
            }
          }

          return {
            priceStr,
            countryText,
            bodyText: rawContent,
            isOutOfStock,
            checkRequired,
          };
        });

        if (scraped.isOutOfStock) {
          console.log(`         [Out of Stock] Skipping...`);
          continue;
        }

        if (scraped.priceStr) {
          let inrPrice = getConvertedINR(scraped.priceStr);

          if (inrPrice !== null) {
            let finalCountry = "United States";
            if (siteHost.includes(".co.uk")) finalCountry = "United Kingdom";
            else if (siteHost.includes(".de")) finalCountry = "Germany";

            if (siteHost.includes("abebooks") && scraped.countryText) {
              const shipMatch =
                scraped.countryText.match(/Ships from (.*?) to /i) ||
                scraped.countryText.match(/Ships within (.*)/i);
              if (shipMatch) {
                finalCountry = shipMatch[1].trim();
              }
            }

            const cleanCountry = finalCountry
              .toLowerCase()
              .replace(/[^a-z]/g, "");
            const allowedOrigins = [
              "usa",
              "us",
              "unitedstates",
              "uk",
              "unitedkingdom",
              "germany",
              "de",
              "deutschland",
            ];

            const isOriginAllowed =
              allowedOrigins.includes(cleanCountry) ||
              allowedOrigins.some((c) => cleanCountry.includes(c));

            if (!isOriginAllowed) {
              console.log(
                `         [Invalid Origin] Ships from ${finalCountry} (${cleanCountry}). Skipping...`,
              );
              continue;
            }

            const cleanBody = scraped.bodyText.replace(/[-\s]/g, "");
            let isIsbnMatch = cleanBody.includes(target.isbn);
            if (!isIsbnMatch && link.includes(target.isbn)) isIsbnMatch = true;

            const maxAllowedPrice = target.limit * 1.2;

            if (inrPrice <= maxAllowedPrice && isIsbnMatch) {
              if (!bestOption || inrPrice < bestOption.inr_price) {
                bestOption = {
                  store: siteHost,
                  country: finalCountry,
                  original_price: scraped.priceStr,
                  inr_price: inrPrice,
                  is_isbn_match: isIsbnMatch,
                  is_buyable: true,
                  check_required: scraped.checkRequired,
                  link: link,
                };
              }
            } else if (inrPrice > maxAllowedPrice && isIsbnMatch) {
              console.log(
                `         [Too Expensive] Found for ₹${inrPrice.toFixed(2)}, limit is ₹${target.limit}.`,
              );
            }
          }
        } else {
          console.log(`         [No Price Found] Could not extract price.`);
        }
      }

      // 5. SAVE FINAL BEST RESULT
      if (bestOption) {
        const checkMsg = bestOption.check_required
          ? " ⚠️ [CHECK_REQUIRED]"
          : "";
        console.log(
          `   ✅ BUYABLE! Cheapest found at ${bestOption.store} (${bestOption.country}) for ₹${bestOption.inr_price.toFixed(2)}${checkMsg}`,
        );

        fs.appendFileSync(
          outputFilePath,
          JSON.stringify({
            target_isbn: target.isbn,
            target_limit: target.limit,
            found: true,
            ...bestOption,
          }) + "\n",
        );
      } else {
        console.log(
          `   ❌ No buyable options found within +20% limit (₹${(target.limit * 1.2).toFixed(2)}).`,
        );

        fs.appendFileSync(
          outputFilePath,
          JSON.stringify({
            target_isbn: target.isbn,
            target_limit: target.limit,
            found: false,
            is_buyable: false,
          }) + "\n",
        );
      }

      await new Promise((r) => setTimeout(r, randomDelay()));
    } catch (err) {
      console.log(
        `   ❌ Fatal Error processing ${target.isbn}: ${err.message}`,
      );
      fs.appendFileSync(
        outputFilePath,
        JSON.stringify({
          target_isbn: target.isbn,
          target_limit: target.limit,
          found: false,
          is_buyable: false,
          error: err.message,
        }) + "\n",
      );
    }
  }

  await browser.close();
  console.log(
    `\n🎉 The Final Leap is complete! Results saved to ${outputFile}`,
  );
})();
