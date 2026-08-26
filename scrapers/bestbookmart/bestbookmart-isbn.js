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

function cleanBookUrl(rawUrl) {
  let u = rawUrl.replace("../", "/");
  try {
    u = decodeURIComponent(u);
  } catch (e) {}
  const match = u.match(/(?:BookInfo|bookinfo)\/(\d+)\/(.*)/i);
  if (match) {
    const id = match[1];
    const rawSlug = match[2];
    const cleanSlug = rawSlug
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return `https://www.bestbookmart.com/BookInfo/${id}/${cleanSlug}`;
  }
  return u.startsWith("http")
    ? u
    : `https://www.bestbookmart.com${u.startsWith("/") ? "" : "/"}${u}`;
}

async function searchBestBookMart(isbn) {
  try {
    const searchUrl = `https://www.bestbookmart.com/BookSearch/${encodeURIComponent(isbn)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    if (
      html.includes("Total 0 Books Found") ||
      html.includes("No Record Found") ||
      html.includes("No Books Found")
    ) {
      return null;
    }

    const onclickMatch = html.match(
      /onclick=["'][^"']*WebForm_DoPostBackWithOptions[^"']*["'](?:\.\.\/|\/)?(BookInfo\/[^"'\s>]+)["']/i,
    );
    if (onclickMatch) {
      return cleanBookUrl(onclickMatch[1]);
    }

    const linkMatch = html.match(
      /href=["'](?:\.\.\/|\/)?(BookInfo\/[^"'\s>]+)["']/i,
    );

    if (linkMatch) {
      return cleanBookUrl(linkMatch[1]);
    }

    return null;
  } catch (e) {
    return null;
  }
}

async function fetchBestBookMartData(bookUrl, targetIsbn) {
  try {
    const res = await fetch(bookUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    let extractedIsbn = null;
    const isbnMatch = html.match(
      /id="ContentPlaceHolder1_DetailsView3_lblisbn"[^>]*>ISBN\s*:\s*([^<]+)<\/span>/i,
    );
    if (isbnMatch) extractedIsbn = isbnMatch[1].trim();

    if (targetIsbn) {
      const cleanTarget = targetIsbn.replace(/[^0-9]/g, "");
      const cleanExtracted = extractedIsbn
        ? extractedIsbn.replace(/[^0-9]/g, "")
        : "";
      if (cleanTarget && cleanExtracted && cleanTarget !== cleanExtracted) {
        return null;
      }
    }

    let title = null;
    const titleMatch =
      html.match(
        /id="ContentPlaceHolder1_DetailsView1_lblTitleNew"[^>]*>([^<]+)<\/span>/i,
      ) || html.match(/class="BookTitle"[^>]*>([^<]+)<\/span>/i);
    if (titleMatch) title = titleMatch[1].trim();

    let author = null;
    const authorMatch = html.match(
      /id="ContentPlaceHolder1_DetailsView1_lblAuthor"[^>]*>([^<]+)<\/span>/i,
    );
    if (authorMatch) {
      author = authorMatch[1].replace(/^by\s*/i, "").trim();
    }

    let mrp = null;
    const mrpMatch = html.match(
      /id="ContentPlaceHolder1_DetailsView1_lblPrice"[^>]*>([\d,.]+)</i,
    );
    if (mrpMatch) mrp = parseFloat(mrpMatch[1].replace(/,/g, ""));

    let price = null;
    const priceMatch = html.match(
      /id="ContentPlaceHolder1_DetailsView1_lblNewPrice"[^>]*>([\d,.]+)</i,
    );
    if (priceMatch) price = parseFloat(priceMatch[1].replace(/,/g, ""));

    let discount = null;
    const discMatch = html.match(
      /id="ContentPlaceHolder1_lblDisc"[^>]*>([^<]+)</i,
    );
    if (discMatch) {
      discount = `${discMatch[1].trim()}%`;
    } else if (mrp && price && mrp > price) {
      discount = `${Math.round(((mrp - price) / mrp) * 100)}%`;
    }

    let inStock = false;
    let stockStatus = "Out of Stock";
    if (
      html.includes("instock.jpg") ||
      html.includes("In Stock") ||
      html.includes("btnAddToCartNew") ||
      html.includes("buttonBuyMe")
    ) {
      inStock = true;
      stockStatus = "In Stock";
    }

    let description = null;
    const descMatch = html.match(
      /id="ContentPlaceHolder1_DetailsView3_lbldetails"[^>]*>([\s\S]*?)<\/span>/i,
    );
    if (descMatch) {
      const cleanDesc = descMatch[1].replace(/<[^>]+>/g, "").trim();
      if (cleanDesc) description = cleanDesc;
    }

    if (!title && !price) return null;

    return {
      title,
      price: price !== null ? price : mrp,
      mrp: mrp !== null ? mrp : price,
      discount,
      currency: "INR",
      in_stock: inStock,
      stock_status: stockStatus,
      seller: "BestBookMart",
      author,
      isbn: extractedIsbn || targetIsbn || null,
      description,
      source: "bestbookmart_engine",
      url: bookUrl,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Scrapes BestBookMart for a given product URL or ISBN.
 * @param {import('playwright').Page} page
 * @param {string} directUrl
 * @param {string} targetIsbn
 * @returns {Promise<Object>}
 */
async function scrapeBestBookMart(page, directUrl, targetIsbn) {
  let bookUrl = null;

  if (directUrl && directUrl.includes("bestbookmart.com/BookInfo")) {
    bookUrl = cleanBookUrl(directUrl);
  } else if (targetIsbn) {
    bookUrl = await searchBestBookMart(targetIsbn);
  }

  if (bookUrl) {
    const bookData = await fetchBestBookMartData(bookUrl, targetIsbn);
    if (bookData) {
      return {
        store: "BestBookMart",
        searched_isbn: targetIsbn || null,
        found: true,
        ...bookData,
      };
    }
  }

  // Playwright Fallback
  if (page) {
    const navUrl = directUrl
      ? cleanBookUrl(directUrl)
      : `https://www.bestbookmart.com/BookSearch/${encodeURIComponent(targetIsbn)}`;
    await page.goto(navUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(2000);

    if (page.url().includes("/BookSearch/")) {
      const firstLink = await page.evaluate(() => {
        const link = document.querySelector("a[href*='BookInfo']");
        return link ? link.href : null;
      });
      if (firstLink) {
        await page.goto(cleanBookUrl(firstLink), {
          waitUntil: "domcontentloaded",
          timeout: 35000,
        });
        await page.waitForTimeout(2000);
      }
    }

    if (page.url().includes("BookInfo")) {
      const domData = await page.evaluate(() => {
        const title = document.querySelector("#ContentPlaceHolder1_DetailsView1_lblTitleNew, .BookTitle")?.innerText.trim();
        const authorRaw = document.querySelector("#ContentPlaceHolder1_DetailsView1_lblAuthor")?.innerText.trim();
        const author = authorRaw ? authorRaw.replace(/^by\s*/i, "").trim() : null;
        let mrp = null;
        const mrpEl = document.querySelector("#ContentPlaceHolder1_DetailsView1_lblPrice");
        if (mrpEl) mrp = parseFloat(mrpEl.innerText.replace(/,/g, ""));
        let price = null;
        const priceEl = document.querySelector("#ContentPlaceHolder1_DetailsView1_lblNewPrice");
        if (priceEl) price = parseFloat(priceEl.innerText.replace(/,/g, ""));
        let inStock = false;
        const inStockImg = document.querySelector("#ContentPlaceHolder1_InStockImage");
        const addBtn = document.querySelector("#ContentPlaceHolder1_btnAddToCartNew, .buttonBuyMe");
        if (inStockImg?.getAttribute("title") === "In Stock" || inStockImg?.src.includes("instock.jpg") || addBtn) {
          inStock = true;
        }
        return { title, author, price, mrp, inStock };
      });

      if (domData.title || domData.price) {
        return {
          store: "BestBookMart",
          searched_isbn: targetIsbn || null,
          found: true,
          title: domData.title,
          author: domData.author,
          price: domData.price !== null ? domData.price : domData.mrp,
          mrp: domData.mrp !== null ? domData.mrp : domData.price,
          currency: "INR",
          in_stock: domData.inStock,
          stock_status: domData.inStock ? "In Stock" : "Out of Stock",
          seller: "BestBookMart",
          url: page.url(),
        };
      }
    }
  }

  return {
    store: "BestBookMart",
    searched_isbn: targetIsbn || null,
    found: false,
    in_stock: false,
    stock_status: "Not Listed",
    url: directUrl || `https://www.bestbookmart.com/BookSearch/${targetIsbn}`,
  };
}

// CLI Standalone Runner
if (require.main === module) {
  (async () => {
    const { inputFile, isHeadless, outputFilePath } = initScraper(
      "bestbookmart-isbn.js",
      "bestbookmart",
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

    let { context, page } = await initBrowser(isHeadless, "bestbookmart_profile");

    for (let i = startIndex; i < inputItems.length; i++) {
      const item = inputItems[i];
      const targetIsbn = item.searched_isbn || item.isbn;
      const directUrl = item.buy_url || item.url;

      console.log(
        `\n\x1b[1m[${i + 1}/${inputItems.length}] Processing: ${targetIsbn || directUrl}\x1b[0m`,
      );

      if (!targetIsbn && !directUrl) {
        stopSpinner("Skipping item with no ISBN or URL.", "warn");
        continue;
      }

      startSpinner("Searching BestBookMart...");

      try {
        const res = await scrapeBestBookMart(page, directUrl, targetIsbn);
        const finalResult = {
          ...res,
          scraped_at: new Date().toISOString(),
        };

        appendResult(outputFilePath, finalResult);

        const priceDisplay = finalResult.price
          ? `₹${finalResult.price}`
          : "No Price";
        const stockDisplay = finalResult.in_stock
          ? "🟢 In Stock"
          : "🔴 Out of Stock";

        stopSpinner(
          `[${i + 1}/${inputItems.length}] ${finalResult.title ? finalResult.title.slice(0, 35) : "Extracted"} | ${priceDisplay} | ${stockDisplay}`,
          finalResult.in_stock ? "success" : "warn",
        );
      } catch (err) {
        stopSpinner(`Error scraping ${targetIsbn}: ${err.message}`, "error");
        appendResult(outputFilePath, {
          searched_isbn: targetIsbn,
          found: false,
          error: err.message,
          url: directUrl || targetIsbn,
          scraped_at: new Date().toISOString(),
        });
      }
    }

    await context.close();
    console.log(
      `\n🎉 BestBookMart Scraping Complete! Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = { scrapeBestBookMart };
