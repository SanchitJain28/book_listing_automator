const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const DEFAULT_INPUT = path.join(
  __dirname,
  "..",
  "..",
  "output",
  "google-links",
  "isbns",
  "buy_links.json"
);

const DEFAULT_OUTPUT = path.join(
  __dirname,
  "..",
  "..",
  "output",
  "google-links",
  "isbns",
  "extracted-data.json"
);

// Realistic browser headers
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,hi;q=0.8,es;q=0.7,fr;q=0.6,de;q=0.5,it;q=0.4",
  "Sec-Ch-Ua":
    '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

// Convert ISBN-13 to ISBN-10 (if applicable)
function isbn13To10(isbn13) {
  if (!isbn13 || isbn13.length !== 13 || !isbn13.startsWith("978")) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(core[i], 10) * (10 - i);
  }
  const remainder = (11 - (sum % 11)) % 11;
  const checkDigit = remainder === 10 ? "X" : remainder.toString();
  return core + checkDigit;
}

// Extract Embedded JSON State (Shopify, Next.js, Nuxt.js, GTM DataLayer, window.product)
function extractEmbeddedJsonState(html) {
  const result = {
    title: null,
    price: null,
    currency: null,
    in_stock: null,
    stock_status: null,
    isbn: null,
  };

  if (!html || typeof html !== "string") return result;

  // 1. Next.js SSR Payload (__NEXT_DATA__)
  try {
    const nextDataMatch = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i
    );
    if (nextDataMatch) {
      const nextJson = JSON.parse(nextDataMatch[1]);
      const pageProps = nextJson.props?.pageProps || {};
      const prod =
        pageProps.product ||
        pageProps.book ||
        pageProps.item ||
        pageProps.initialState?.product;
      if (prod) {
        if (prod.title || prod.name) result.title = prod.title || prod.name;
        if (prod.price || prod.final_price || prod.sale_price) {
          result.price = (
            prod.price ||
            prod.final_price ||
            prod.sale_price
          ).toString();
        }
        if (prod.currency || prod.currencyCode) {
          result.currency = prod.currency || prod.currencyCode;
        }
        if (typeof prod.in_stock === "boolean") {
          result.in_stock = prod.in_stock;
          result.stock_status = prod.in_stock ? "In Stock" : "Out of Stock";
        } else if (typeof prod.available === "boolean") {
          result.in_stock = prod.available;
          result.stock_status = prod.available ? "In Stock" : "Out of Stock";
        }
      }
    }
  } catch (e) {}

  // 2. Shopify Product JSON & Analytics Meta
  try {
    // Shopify ProductJson block
    const shopifyJsonMatch = html.match(
      /<script[^>]*id="ProductJson-[^"]*"[^>]*>([\s\S]*?)<\/script>/i
    );
    if (shopifyJsonMatch) {
      const prod = JSON.parse(shopifyJsonMatch[1]);
      if (prod.title) result.title = prod.title;
      if (prod.price) {
        // Shopify prices can be in cents (e.g. 1999 -> 19.99) or regular
        let p = parseFloat(prod.price);
        if (p > 1000 && !html.includes("INR") && !html.includes("₹")) {
          p = p / 100;
        }
        result.price = p.toString();
      }
      if (typeof prod.available === "boolean") {
        result.in_stock = prod.available;
        result.stock_status = prod.available ? "In Stock" : "Out of Stock";
      }
    }

    // Shopify var meta = { "product": ... }
    const metaJsMatch = html.match(/var\s+meta\s*=\s*(\{[\s\S]*?\});\s*(?:if|<|\n)/i);
    if (metaJsMatch && !result.price) {
      const metaObj = JSON.parse(metaJsMatch[1]);
      if (metaObj.product) {
        const p = metaObj.product;
        if (p.price) result.price = (p.price / 100).toString();
        if (typeof p.available === "boolean") {
          result.in_stock = p.available;
          result.stock_status = p.available ? "In Stock" : "Out of Stock";
        }
        if (p.currency) result.currency = p.currency;
      }
    }
  } catch (e) {}

  // 3. Regex scan for standard e-commerce window state properties
  if (!result.price) {
    const priceRegex = /"(?:price|offer_price|sale_price|price_amount|item_price)"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)"?/i;
    const matchP = html.match(priceRegex);
    if (matchP && parseFloat(matchP[1]) > 0 && parseFloat(matchP[1]) < 100000) {
      result.price = matchP[1];
    }
  }

  if (result.in_stock === null) {
    const availRegex = /"(?:available|in_stock|inStock|is_in_stock)"\s*:\s*(true|false)/i;
    const matchA = html.match(availRegex);
    if (matchA) {
      result.in_stock = matchA[1].toLowerCase() === "true";
      result.stock_status = result.in_stock ? "In Stock" : "Out of Stock";
    }
  }

  return result;
}

// Clean DOM from clutter
function cleanCheerioDom($) {
  $(
    'script:not([type="application/ld+json"]), style, svg, noscript, iframe, canvas, video, audio, link'
  ).remove();

  $(
    "nav, header, footer, aside, .nav, .navbar, .header, .footer, .sidebar, .cookie-banner, .modal, .popup, .ads, [id*='cookie'], [class*='cookie'], [id*='banner'], [class*='banner'], [id*='modal'], [class*='modal'], .breadcrumbs, .breadcrumb"
  ).remove();
}

// Extract Title
function extractTitle($, embeddedState) {
  if (embeddedState && embeddedState.title && embeddedState.title.length > 2) {
    return embeddedState.title.trim();
  }

  // 1. Dedicated H1
  const h1 = $(
    "h1.product-title, h1.product_title, h1.entry-title, h1[itemprop='name'], h1.title, h1"
  )
    .first()
    .text()
    .trim();
  if (h1 && h1.length > 3 && h1.length < 200) {
    return h1;
  }

  // 2. OpenGraph / Twitter
  const ogTitle =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content");
  if (ogTitle && ogTitle.trim().length > 3) {
    return ogTitle
      .replace(
        /\s*[-|–]\s*(?:Flipkart|Amazon|AbeBooks|Waterstones|Walmart|Bol\.com|Prabhat Books|Mybooksfactory|Buy\s+at\s+Low\s+Price).*$/i,
        ""
      )
      .trim();
  }

  // 3. Fallback Title tag
  const pageTitle = $("title").text().trim();
  if (pageTitle) {
    return pageTitle
      .replace(
        /\s*[-|–]\s*(?:Flipkart|Amazon|AbeBooks|Waterstones|Walmart|Bol\.com|Prabhat Books|Mybooksfactory|Buy\s+at\s+Low\s+Price).*$/i,
        ""
      )
      .trim();
  }

  return null;
}

// Smart Price & Currency Extraction
function extractSmartPrice($, rawText, embeddedState) {
  if (embeddedState && embeddedState.price) {
    return {
      price: embeddedState.price,
      currency: embeddedState.currency || "INR",
    };
  }

  let price = null;
  let currency = null;

  // 1. JSON-LD (Schema.org)
  $('script[type="application/ld+json"]').each((_, el) => {
    if (price) return;
    try {
      const content = $(el).html();
      if (!content) return;
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed)
        ? parsed
        : parsed["@graph"] && Array.isArray(parsed["@graph"])
        ? parsed["@graph"]
        : [parsed];

      for (const item of items) {
        if (item.offers) {
          const offer = Array.isArray(item.offers)
            ? item.offers[0]
            : item.offers;
          if (offer && (offer.price || offer.lowPrice)) {
            const rawP = (offer.price || offer.lowPrice).toString().replace(/,/g, "");
            if (!isNaN(parseFloat(rawP)) && parseFloat(rawP) > 0) {
              price = rawP;
              currency = offer.priceCurrency || null;
              return;
            }
          }
        }
      }
    } catch (e) {}
  });

  if (price) {
    return { price, currency: currency || "INR" };
  }

  // 2. Microdata attributes & Meta tags
  const metaPrice =
    $('[itemprop="price"]').attr("content") ||
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[property="og:price:amount"]').attr("content") ||
    $('meta[name="price"]').attr("content") ||
    $('[data-price]').attr("data-price") ||
    $('[data-product-price]').attr("data-product-price");

  if (metaPrice) {
    const cleanP = metaPrice.toString().replace(/,/g, "").trim();
    if (!isNaN(parseFloat(cleanP)) && parseFloat(cleanP) > 0) {
      const metaCurr =
        $('[itemprop="priceCurrency"]').attr("content") ||
        $('meta[property="product:price:currency"]').attr("content") ||
        $('meta[property="og:price:currency"]').attr("content") ||
        "INR";
      return { price: cleanP, currency: metaCurr };
    }
  }

  // 3. Dedicated Comprehensive CSS Selectors
  const priceSelectors = [
    ".woocommerce-Price-amount bdi",
    ".woocommerce-Price-amount",
    ".a-price .a-offscreen",
    ".a-price-whole",
    "#price_inside_buybox",
    "._30jeq3",
    ".item-price",
    ".item-price-current",
    ".product-price",
    ".product__price",
    ".special-price .price",
    ".special-price",
    ".sale-price",
    ".offer-price",
    ".current-price",
    ".price--main",
    ".price-item--regular",
    ".price-item--sale",
    "[class*='product-price']",
    "[class*='current-price']",
    ".price",
  ];

  for (const sel of priceSelectors) {
    const el = $(sel).first();
    const elText = el.text().trim();
    if (elText) {
      // Check multi-currency patterns
      // 1) INR / Rupee
      const inrMatch = elText.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i);
      if (inrMatch) {
        return { price: inrMatch[1].replace(/,/g, "").trim(), currency: "INR" };
      }
      // 2) USD / CAD / AUD ($)
      const usdMatch = elText.match(/(?:\$|USD|CAD|AUD|NZD)\s*([\d,]+(?:\.\d{2})?)/i);
      if (usdMatch) {
        return { price: usdMatch[1].replace(/,/g, "").trim(), currency: "USD" };
      }
      // 3) EUR (€)
      const eurMatch = elText.match(/(?:€|EUR)\s*([\d,.]+)|([\d,.]+)\s*(?:€|EUR)/i);
      if (eurMatch) {
        const val = (eurMatch[1] || eurMatch[2]).replace(/\./g, "").replace(/,/g, ".");
        return { price: val.trim(), currency: "EUR" };
      }
      // 4) GBP (£)
      const gbpMatch = elText.match(/(?:£|GBP)\s*([\d,]+(?:\.\d{2})?)/i);
      if (gbpMatch) {
        return { price: gbpMatch[1].replace(/,/g, "").trim(), currency: "GBP" };
      }
      // 5) ZAR (R)
      const zarMatch = elText.match(/(?:R|ZAR)\s*([\d,]+(?:\.\d{2})?)/i);
      if (zarMatch) {
        return { price: zarMatch[1].replace(/,/g, "").trim(), currency: "ZAR" };
      }
      // 6) Generic number inside price selector
      const genericMatch = elText.match(/([\d,]+(?:\.\d{2})?)/);
      if (genericMatch) {
        const num = genericMatch[1].replace(/,/g, "").trim();
        if (!isNaN(parseFloat(num)) && parseFloat(num) > 0 && parseFloat(num) < 100000) {
          return { price: num, currency: "INR" };
        }
      }
    }
  }

  // 4. Raw Text Regex Scanning (Multi-Currency Fallback)
  // INR
  const textInr = rawText.match(
    /(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i
  );
  if (textInr) {
    const num = textInr[1].replace(/,/g, "").trim();
    if (!isNaN(parseFloat(num)) && parseFloat(num) > 0 && parseFloat(num) < 100000) {
      return { price: num, currency: "INR" };
    }
  }

  // Dollar ($)
  const textDollar = rawText.match(/(?:\$|USD|CAD|AUD)\s*([0-9]+(?:\.[0-9]{2})?)/i);
  if (textDollar) {
    return { price: textDollar[1].trim(), currency: "USD" };
  }

  // Euro (€)
  const textEur = rawText.match(/(?:€|EUR)\s*([0-9]+(?:[.,][0-9]{2})?)|([0-9]+(?:[.,][0-9]{2})?)\s*(?:€|EUR)/i);
  if (textEur) {
    const val = (textEur[1] || textEur[2]).replace(/,/g, ".").trim();
    return { price: val, currency: "EUR" };
  }

  // Pound (£)
  const textGbp = rawText.match(/(?:£|GBP)\s*([0-9]+(?:\.[0-9]{2})?)/i);
  if (textGbp) {
    return { price: textGbp[1].trim(), currency: "GBP" };
  }

  return { price: null, currency: null };
}

// Smart Multi-Language Stock & Availability Detection
function extractSmartStock($, rawText, embeddedState) {
  if (embeddedState && embeddedState.in_stock !== null) {
    return {
      in_stock: embeddedState.in_stock,
      stock_status: embeddedState.stock_status,
    };
  }

  // 1. Schema.org / Microdata availability
  const schemaAvail =
    $('[itemprop="availability"]').attr("href") ||
    $('[itemprop="availability"]').attr("content") ||
    $('meta[property="og:availability"]').attr("content") ||
    $('meta[name="availability"]').attr("content");

  if (schemaAvail) {
    if (schemaAvail.includes("InStock") || schemaAvail.includes("PreOrder")) {
      return { in_stock: true, stock_status: "In Stock" };
    }
    if (schemaAvail.includes("OutOfStock") || schemaAvail.includes("Discontinued") || schemaAvail.includes("SoldOut")) {
      return { in_stock: false, stock_status: "Out of Stock" };
    }
  }

  // 2. Multilingual Out of Stock Patterns (English, Spanish, French, German, Italian, Dutch)
  const outOfStockPatterns = [
    /\bout\s*of\s*stock\b/i,
    /\bcurrently\s*unavailable\b/i,
    /\btemporarily\s*out\s*of\s*stock\b/i,
    /\bsold\s*out\b/i,
    /\bnot\s*available\b/i,
    /\b0\s*(?:used|new)\s*0\s*(?:used|new)\b/i,
    /\b0\s*available\b/i,
    /\bno\s*copies\s*available\b/i,
    /item\s+is\s+currently\s+not\s+available/i,
    /edition\s+is\s+currently\s+not\s+available/i,
    /\bdisponible\s*:\s*0\b/i,
    /\bagotado\b/i,                  // Spanish (Sold out)
    /\bsin\s*stock\b/i,              // Spanish
    /\bno\s*disponible\b/i,          // Spanish / Italian
    /\bépuisé\b/i,                   // French
    /\bnon\s*disponible\b/i,         // French
    /\bnicht\s*auf\s*lager\b/i,      // German
    /\bvergriffen\b/i,               // German
    /\bzur\s*zeit\s*nicht\s*lieferbar\b/i, // German
    /\bniet\s*op\s*voorraad\b/i,     // Dutch
    /\btijdelijk\s*uitverkocht\b/i,  // Dutch
    /\butsolgt\b/i,                  // Scandinavian
    /\bnotify\s*me\b/i,
  ];

  for (const pattern of outOfStockPatterns) {
    if (pattern.test(rawText)) {
      return { in_stock: false, stock_status: "Out of Stock" };
    }
  }

  // 3. Multilingual In Stock Patterns
  const inStockPatterns = [
    /\bin\s*stock\b/i,
    /\badd\s*to\s*cart\b/i,
    /\bbuy\s*now\b/i,
    /\bavailable\s+in\s+stock\b/i,
    /\bavailable\s+now\b/i,
    /\busually\s+delivered\s+in\b/i,
    /\bget\s+it\s+by\b/i,
    /\bdispatch\s+within\b/i,
    /\bships\s+in\s+\d+\s+days\b/i,
    /\bdisponible\b/i,              // Spanish
    /\ben\s*stock\b/i,              // French
    /\bauf\s*lager\b/i,             // German
    /\bop\s*voorraad\b/i,           // Dutch
    /\bpå\s*lager\b/i,              // Scandinavian
  ];

  for (const pattern of inStockPatterns) {
    if (pattern.test(rawText)) {
      return { in_stock: true, stock_status: "In Stock" };
    }
  }

  // 4. Cart / Buy Button DOM Inspection
  const btnText = $("button, a.btn, a.button, input[type='submit']")
    .map((_, el) => $(el).text())
    .get()
    .join(" ")
    .toLowerCase();

  if (
    btnText.includes("add to cart") ||
    btnText.includes("buy now") ||
    btnText.includes("in den warenkorb") ||
    btnText.includes("ajouter au panier") ||
    btnText.includes("comprar") ||
    btnText.includes("aggiungi al carrello")
  ) {
    return { in_stock: true, stock_status: "In Stock" };
  }

  if (
    btnText.includes("notify me") ||
    btnText.includes("sold out") ||
    btnText.includes("out of stock") ||
    btnText.includes("agotado") ||
    btnText.includes("épuisé")
  ) {
    return { in_stock: false, stock_status: "Out of Stock" };
  }

  return { in_stock: null, stock_status: "Unknown" };
}

// Detect Book Format / Binding
function extractBookFormat($, rawText) {
  const t = rawText.toLowerCase();
  if (t.includes("hardcover") || t.includes("hardback") || t.includes("hardbound")) {
    return "Hardcover";
  }
  if (t.includes("paperback") || t.includes("softcover") || t.includes("paper back")) {
    return "Paperback";
  }
  if (t.includes("kindle edition") || t.includes("ebook") || t.includes("e-book")) {
    return "E-Book / Kindle";
  }
  if (t.includes("audiobook") || t.includes("audio cd") || t.includes("audible")) {
    return "Audiobook";
  }
  if (t.includes("board book")) {
    return "Board Book";
  }
  return null;
}

// Process a single URL
async function processLink(url, isbn) {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return null;
  }

  // Blacklist non-store / binary files
  const blacklistedDomains = [
    "instagram.com",
    "youtube.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "pinterest.com",
    "wikipedia.org",
    "ndl.education.gov.in",
    "t.me",
  ];

  const lowerUrl = url.toLowerCase();
  if (
    blacklistedDomains.some((d) => hostname.includes(d)) ||
    lowerUrl.endsWith(".pdf") ||
    lowerUrl.endsWith(".jpg") ||
    lowerUrl.endsWith(".png") ||
    lowerUrl.endsWith(".mp3") ||
    lowerUrl.endsWith(".zip")
  ) {
    return {
      isbn: isbn,
      url: url,
      domain: hostname,
      skipped: true,
      reason: "Blacklisted domain or binary file",
    };
  }

  try {
    const response = await axios.get(url, {
      headers: HEADERS,
      timeout: 12000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const status = response.status;
    if (status !== 200) {
      return {
        isbn: isbn,
        domain: hostname,
        url: url,
        status: status,
        error: `HTTP ${status}`,
      };
    }

    const html = response.data;
    if (typeof html !== "string") {
      return {
        isbn: isbn,
        domain: hostname,
        url: url,
        error: "Non-HTML response",
      };
    }

    // 1. Embedded JSON State Extraction (Shopify, Next.js, GTM dataLayer)
    const embeddedState = extractEmbeddedJsonState(html);

    const $ = cheerio.load(html);

    // 2. Title Extraction
    const title = extractTitle($, embeddedState);

    // 3. Clean DOM & Extract Raw Content
    cleanCheerioDom($);
    const rawText = $("body").text().replace(/\s+/g, " ").trim();

    // 4. ISBN Verification
    const isbn10 = isbn13To10(isbn);
    const matchedIsbn =
      rawText.includes(isbn) || (isbn10 ? rawText.includes(isbn10) : false);

    // 5. Smart Price & Multi-Currency Detection
    const { price, currency } = extractSmartPrice($, rawText, embeddedState);

    // 6. Smart Multi-Language Stock Detection
    const { in_stock, stock_status } = extractSmartStock($, rawText, embeddedState);

    // 7. Format / Binding Detection
    const format = extractBookFormat($, rawText);

    return {
      isbn: isbn,
      domain: hostname,
      url: url,
      matched_isbn: matchedIsbn,
      title: title,
      format: format,
      price: price,
      currency: price ? currency || "INR" : null,
      in_stock: in_stock,
      stock_status: stock_status,
      extracted_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      isbn: isbn,
      domain: hostname,
      url: url,
      error: err.message,
    };
  }
}

// Main Batch Worker
async function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] || DEFAULT_INPUT;
  const outputFile = args[1] || DEFAULT_OUTPUT;
  const concurrency = 12; // 12 parallel HTTP connections

  console.clear();
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║     🏆 Universal Smart Book Price & Availability Extractor     ║");
  console.log("║    (JSON-LD • Microdata • Shopify State • Multilingual Stock)  ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Load existing outputs to resume
  const processedUrls = new Set();
  if (fs.existsSync(outputFile)) {
    const lines = fs.readFileSync(outputFile, "utf8").split("\n").filter(Boolean);
    for (const l of lines) {
      try {
        const obj = JSON.parse(l);
        if (obj.url) processedUrls.add(obj.url);
      } catch (e) {}
    }
    if (processedUrls.size > 0) {
      console.log(`▶ Resuming: ${processedUrls.size.toLocaleString()} URLs already processed.\n`);
    }
  }

  // Read input items & flatten links
  const rawLines = fs.readFileSync(inputFile, "utf8").split("\n").filter(Boolean);
  const queue = [];

  for (const line of rawLines) {
    try {
      const obj = JSON.parse(line);
      const isbn = obj.isbn || obj.searched_isbn;
      const links = obj.links || [];
      for (const link of links) {
        if (!processedUrls.has(link)) {
          queue.push({ url: link, isbn: isbn });
        }
      }
    } catch (e) {}
  }

  console.log(`📁 Input:  ${inputFile}`);
  console.log(`📄 Output: ${outputFile}`);
  console.log(`📊 Links to Process: ${queue.length.toLocaleString()}`);
  console.log(`⚡ Concurrency: ${concurrency} parallel streams\n`);

  if (queue.length === 0) {
    console.log("🎉 All links are already processed!");
    return;
  }

  const outStream = fs.createWriteStream(outputFile, { flags: "a" });
  let completed = 0;
  let successCount = 0;
  let inStockCount = 0;
  let outOfStockCount = 0;
  let pricedCount = 0;

  async function worker(item) {
    const result = await processLink(item.url, item.isbn);
    if (result) {
      outStream.write(JSON.stringify(result) + "\n");
      if (!result.skipped && !result.error && result.status !== 500) {
        successCount++;
        if (result.price) pricedCount++;
        if (result.in_stock === true) inStockCount++;
        if (result.in_stock === false) outOfStockCount++;
      }
    }
    completed++;

    const pct = ((completed / queue.length) * 100).toFixed(1);
    const domain = result ? result.domain : "";
    const pStr = result && result.price ? `${result.currency || "₹"} ${result.price}` : "N/A";
    const sStr =
      result && result.in_stock === true
        ? "🟢 InStock"
        : result && result.in_stock === false
        ? "🔴 OutOfStock"
        : "⚪ ?";

    process.stdout.write(
      `\r[${completed}/${queue.length}] (${pct}%) | ${domain.padEnd(20)} | ${pStr.padEnd(12)} | ${sStr.padEnd(12)} | Priced: ${pricedCount}`
    );
  }

  // Execute in concurrency batches
  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency);
    await Promise.all(batch.map(worker));
  }

  outStream.end();
  console.log("\n\n🎉 Extraction Complete!");
  console.log(`- Total Links Processed: ${completed.toLocaleString()}`);
  console.log(`- Successfully Parsed:   ${successCount.toLocaleString()}`);
  console.log(`- Prices Found:          ${pricedCount.toLocaleString()}`);
  console.log(`- In Stock Books:        ${inStockCount.toLocaleString()}`);
  console.log(`- Out of Stock Books:    ${outOfStockCount.toLocaleString()}`);
}

main().catch(console.error);
