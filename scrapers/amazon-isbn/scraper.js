const { checkDogPage } = require("../../utils/amazon");
const { searchAmazonForIsbn } = require("./core/search");
const { getCheaperPhysicalFormat } = require("./core/swatches");
const { extractProductData } = require("./core/productExtractor");
const { extractBuyingOptionsDrawer } = require("./core/buyingOptions");
const { cleanAndCheckMRP, validateIsbnMatch } = require("./core/validator");

/**
 * Scrapes a single Amazon book page using all core modules.
 * @param {import('playwright').Page} page
 * @param {Object} params - { directUrl, isbn }
 * @returns {Promise<Object>}
 */
async function scrapeAmazonBook(page, { directUrl, isbn }) {
  let targetUrl = directUrl;

  if (targetUrl) {
    targetUrl = targetUrl.replace(
      /amazon\.(com|in|co\.uk)\/-\/[a-z]{2}(_[A-Z]{2})?\//i,
      "amazon.$1/",
    );
  }

  // 1. If direct URL not provided, search by ISBN
  if (!targetUrl && isbn) {
    const searchRes = await searchAmazonForIsbn(page, isbn);
    if (!searchRes.found || !searchRes.productUrl) {
      return {
        searched_isbn: isbn,
        title: "N/A",
        found_isbn: "N/A",
        isbn_matched: false,
        price: "N/A",
        mrp: "N/A",
        delivery: "N/A",
        seller: "N/A",
        used_available: "No Used Options",
        reviews_count: "0",
        publisher: "N/A",
        publication_date: "N/A",
        found: false,
        in_stock: false,
        stock_status: "Not Found",
        url: page.url(),
      };
    }
    targetUrl = searchRes.productUrl;
  }

  // 2. Navigate to product page
  await page.goto(targetUrl, {
    timeout: 20000,
    waitUntil: "domcontentloaded",
  });

  let isDogPage = await checkDogPage(page);
  if (isDogPage) {
    await page.waitForTimeout(10000);
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  await page.waitForSelector("#productTitle", { timeout: 4000 }).catch(() => {});

  // 3. Smart Format Switch: Check if cheaper physical format swatch exists
  const cheaperTarget = await getCheaperPhysicalFormat(page);
  if (cheaperTarget && cheaperTarget.url) {
    await page.goto(cheaperTarget.url, {
      timeout: 15000,
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("#productTitle", { timeout: 3000 }).catch(() => {});
  }

  // 4. Extract Main Product Page Data
  let scrapedData = await extractProductData(page);

  // 5. Fallback to "See All Buying Options" side drawer if needed
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

  // 6. MRP & Availability Cleaning
  scrapedData.mrp = cleanAndCheckMRP(scrapedData.price, scrapedData.mrp);

  if (
    scrapedData.price === "N/A" &&
    scrapedData.used_available === "No Used Options"
  ) {
    scrapedData.mrp = "N/A";
    scrapedData.delivery = "N/A";
    scrapedData.seller = "N/A";
  }

  // 7. ISBN Matching Logic
  const isbnMatched = validateIsbnMatch(scrapedData.found_isbn, isbn);
  scrapedData.isbn_matched = isbnMatched;

  const inStock = scrapedData.price !== "N/A";

  return {
    searched_isbn: isbn,
    found: inStock || !!scrapedData.title,
    in_stock: inStock,
    stock_status: inStock ? "In Stock" : "Out of Stock",
    ...scrapedData,
    url: page.url(),
  };
}

module.exports = { scrapeAmazonBook };
