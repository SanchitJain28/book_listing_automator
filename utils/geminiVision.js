const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const NOISE_PATTERN =
  "related|recommend|similar|upsell|cross-?sell|also-?(bought|viewed|like)|" +
  "you-?may|frequently|carousel|slider|swiper|slick|recently-?viewed|" +
  "newsletter|cookie|popup|modal|footer|breadcrumb|megamenu";

async function capturePage(page) {
  await page
    .evaluate((pattern) => {
      const re = new RegExp(pattern, "i");
      document
        .querySelectorAll("header, footer, nav, aside, iframe")
        .forEach((el) => el.remove());
      document.querySelectorAll("[class], [id]").forEach((el) => {
        const sig = `${el.className || ""} ${el.id || ""}`;
        if (typeof sig === "string" && re.test(sig)) el.remove();
      });
      document.querySelectorAll("h2, h3, h4").forEach((h) => {
        if (
          /similar|recommend|also (like|bought|viewed)|related|more from/i.test(
            h.textContent,
          )
        ) {
          (h.closest("section, div") || h).remove();
        }
      });
      window.scrollTo(0, 0);
    }, NOISE_PATTERN)
    .catch(() => {});

  await page.waitForTimeout(500);

  const text = await page
    .evaluate(() => {
      const main =
        document.querySelector(
          '[itemtype*="Product"], main, #product, .product, [role="main"]',
        ) || document.body;
      return (main.innerText || "")
        .replace(/\s+\n/g, "\n")
        .replace(/[ \t]+/g, " ");
    })
    .catch(() => "");

  const screenshot = await page.screenshot({
    fullPage: false,
    type: "jpeg",
    quality: 75,
  });
  const fullText = await page
    .evaluate(() => document.body.innerText || "")
    .catch(() => "");

  return { text: text.slice(0, 8000), fullText, screenshot };
}

const schema = {
  type: "object",
  properties: {
    is_target_product_page: {
      type: "boolean",
      description:
        "true only if the MAIN product of the page is the target book (not a search/listing page)",
    },
    isbn_seen_on_page: { type: "string", nullable: true },
    title: { type: "string", nullable: true },
    author: { type: "string", nullable: true },
    price_evidence: {
      type: "string",
      nullable: true,
      description:
        "Exact price text of the MAIN product as shown, e.g. '₹ 354.00'. null if not clearly shown",
    },
    price: { type: "number", nullable: true },
    mrp: { type: "number", nullable: true },
    currency: {
      type: "string",
      nullable: true,
      description: "ISO code: INR, USD, GBP, EUR, AUD",
    },
    stock_evidence: {
      type: "string",
      nullable: true,
      description:
        "Exact text/button that indicates stock, e.g. 'Add to Cart', 'Sold Out'",
    },
    stock: { type: "string", enum: ["in_stock", "out_of_stock", "unknown"] },
    condition: { type: "string", enum: ["new", "used", "unknown"] },
    seller: { type: "string", nullable: true },
    binding: { type: "string", nullable: true },
  },
  required: [
    "is_target_product_page",
    "price_evidence",
    "price",
    "currency",
    "stock_evidence",
    "stock",
  ],
  propertyOrdering: [
    "is_target_product_page",
    "isbn_seen_on_page",
    "title",
    "author",
    "price_evidence",
    "price",
    "mrp",
    "currency",
    "stock_evidence",
    "stock",
    "condition",
    "seller",
    "binding",
  ],
};

function buildPrompt({ isbn, expectedTitle }) {
  return `You extract data from a bookstore product page.

TARGET BOOK: ISBN ${isbn}${expectedTitle ? `, title approximately "${expectedTitle}"` : ""}.

RULES:
1. Extract data ONLY for the main product of the page. IGNORE every price in
   "recommended", "similar", "customers also bought", "you may also like",
   bundles, carousels, or sidebars — even if those are the only prices visible.
2. If the page is a search result, category page, "not found" page, or the main
   product is a different book, set is_target_product_page=false and price=null.
3. If the main product's price is not clearly shown next to its title/buy box,
   return price=null and price_evidence=null. NEVER guess or borrow a price.
4. stock="out_of_stock" if you see: Out of Stock, Sold Out, Currently Unavailable,
   Notify Me, Agotado, No disponible, or a disabled buy button.
   stock="in_stock" only with an active Add to Cart / Buy Now and no such warning.
   Otherwise stock="unknown".
5. price_evidence and stock_evidence must be text copied exactly from the page.

The cleaned page text is provided below the screenshot. Use both.`;
}

async function callGemini(parts, { apiKey, model }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0,
    },
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body,
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 429 || res.status >= 500)
        throw new Error(`Gemini ${res.status}`);
      if (!res.ok)
        throw new Error(
          `Gemini API error (${res.status}): ${await res.text()}`,
        );

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty Gemini response");
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 3 || /API error \(4\d\d\)/.test(err.message)) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

function isbn13to10(isbn13) {
  if (!/^978\d{10}$/.test(isbn13)) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(core[i]);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? "X" : String(check));
}

function isbnOnPage(isbn, pageText) {
  const compact = (pageText || "").replace(/[\s-]/g, "").toUpperCase();
  const isbn10 = isbn13to10(isbn);
  return (
    compact.includes(isbn) || (isbn10 !== null && compact.includes(isbn10))
  );
}

function priceMatchesEvidence(price, evidence) {
  if (price == null || !evidence) return false;
  const nums = (evidence.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) =>
    parseFloat(n.replace(/,/g, "")),
  );
  return nums.some((n) => Math.abs(n - price) < 0.01);
}

async function extractListing(capture, target, options = {}) {
  const apiKey =
    options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  const model = options.model || DEFAULT_MODEL;

  const parts = [{ text: buildPrompt(target) }];
  if (capture.screenshot) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: capture.screenshot.toString("base64"),
      },
    });
  }
  parts.push({ text: `PAGE TEXT:\n${capture.text || "(none)"}` });

  const raw = await callGemini(parts, { apiKey, model });

  const reasons = [];
  const isbnVerified = isbnOnPage(
    target.isbn,
    capture.fullText || capture.text,
  );
  if (!isbnVerified) reasons.push("isbn_not_on_page");
  if (!raw.is_target_product_page) reasons.push("model_says_not_target_page");

  let price = raw.price;
  if (price != null && !priceMatchesEvidence(price, raw.price_evidence)) {
    reasons.push("price_not_in_evidence");
    price = null;
  }
  if (price == null) reasons.push("no_price");
  if (raw.stock !== "in_stock") reasons.push(`stock_${raw.stock}`);

  let confidence;
  if (!raw.is_target_product_page || raw.stock === "out_of_stock")
    confidence = "rejected";
  else if (reasons.length === 0) confidence = "high";
  else confidence = "review";

  return {
    found: raw.is_target_product_page && price != null,
    title: raw.title,
    author: raw.author,
    price,
    mrp: raw.mrp,
    currency: raw.currency,
    in_stock: raw.stock === "in_stock",
    stock_status: raw.stock,
    condition: raw.condition,
    seller: raw.seller,
    binding: raw.binding,
    isbn_verified: isbnVerified,
    price_evidence: raw.price_evidence,
    stock_evidence: raw.stock_evidence,
    confidence,
    reasons,
    model,
  };
}

module.exports = { capturePage, extractListing, isbnOnPage, isbn13to10 };
