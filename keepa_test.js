/**
 * Keepa API test for amazon.in books (safe for Starter plan, ~40-50 tokens).
 *
 * Requirements: Node.js 18+ (built-in fetch)
 * Setup:
 *   npm install dotenv
 *   .env file in the same folder:  KEEPA_API_KEY=your_key_here
 *
 * Run:
 *   node keepa_test.js
 */

require("dotenv").config();
const fs = require("fs");

const KEY = (process.env.KEEPA_API_KEY || "").trim();
const BASE = "https://api.keepa.com";
const DOMAIN_IN = 10; // Keepa domain id for amazon.in

if (!KEY) {
  console.error("KEEPA_API_KEY is empty. Put your key in the .env file.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET a Keepa endpoint, retry when out of tokens, log token usage. */
async function call(endpoint, params = {}) {
  const qs = new URLSearchParams({ key: KEY, ...params });
  const url = `${BASE}/${endpoint}?${qs.toString()}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `${endpoint}: non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
      );
    }

    if (res.status === 429) {
      const wait = Math.ceil((data.refillIn || 60000) / 1000) + 1;
      console.log(`  Out of tokens, waiting ${wait}s...`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(
        `${endpoint}: HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`,
      );
    }

    console.log(
      `  [${endpoint}] tokensConsumed=${data.tokensConsumed} tokensLeft=${data.tokensLeft}`,
    );
    return data;
  }
  throw new Error(`${endpoint} failed after retries`);
}

/** Keepa prices are in paise. -1 / -2 / null = no price. */
const price = (v) =>
  Number.isInteger(v) && v > 0 ? +(v / 100).toFixed(2) : null;

/** Minimal CSV escaping. */
const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  // ------------------------------------------------------------ 1. Key check
  console.log("\n1) Checking API key and token balance");
  const status = await call("token");
  console.log(`  Refill rate: ${status.refillRate} tokens/min`);

  // ------------------------------------------------------- 2. Books category
  console.log("\n2) Verifying the Books root category on amazon.in");
  const booksRoot = 976389031; // amazon.in "Books" root node
  const catInfo = await call("category", {
    domain: DOMAIN_IN,
    category: booksRoot,
    parents: 0,
  });
  const cat = (catInfo.categories || {})[booksRoot];
  if (!cat) {
    console.error(
      `Category ${booksRoot} not found in Keepa. Paste this output to debug.`,
    );
    process.exit(1);
  }
  console.log(`  -> ID ${booksRoot}: "${cat.name}" (parent=${cat.parent})`);
  if (cat.children) {
    console.log(`  -> Sub-categories: ${cat.children.length}`);
  }

  // ---------------------------------------------------- 3. Discovery sample
  console.log("\n3) Product Finder: available books in root Books category");
  const selection = {
    rootCategory: booksRoot,
    current_NEW_gte: 1, // has a current new price (available)
    sort: [["current_SALES", "asc"]], // stable order, best sellers first
    perPage: 50,
    page: 0,
  };
  const finder = await call("query", {
    domain: DOMAIN_IN,
    selection: JSON.stringify(selection),
  });
  const asins = finder.asinList || [];
  console.log(
    `  totalResults (available books matched): ${finder.totalResults}`,
  );
  console.log(`  ASINs returned on this page: ${asins.length}`);

  if (asins.length === 0) {
    console.error("No ASINs returned. Check the category ID / filters.");
    process.exit(1);
  }

  // ------------------------------------------------ 4. Title + price lookup
  console.log("\n4) Looking up title + price for 20 of those books");
  const sample = asins.slice(0, 20);
  const prod = await call("product", {
    domain: DOMAIN_IN,
    asin: sample.join(","),
    stats: 1, // current prices, no extra token cost
    history: 0, // skip price history arrays (smaller response)
  });

  const rows = [];
  let missing = 0;

  for (const p of prod.products || []) {
    const current = (p.stats && p.stats.current) || [];
    const amazonPrice = price(current[0]);
    const newPrice = price(current[1]);
    if (amazonPrice === null && newPrice === null) missing++;

    rows.push({
      asin: p.asin,
      title: p.title,
      amazon_price_inr: amazonPrice,
      lowest_new_price_inr: newPrice,
      binding: p.binding,
    });
  }

  for (const r of rows.slice(0, 10)) {
    console.log(
      `  ${r.asin}  ₹${r.lowest_new_price_inr}  ${String(r.title).slice(0, 60)}`,
    );
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ].join("\n");
  fs.writeFileSync("test_results.csv", "\uFEFF" + csv, "utf8"); // BOM so Excel shows ₹/Hindi correctly

  // ---------------------------------------------------------------- Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Books root category ID : ${booksRoot}`);
  console.log(`Available books (root) : ${finder.totalResults}`);
  console.log(`Products looked up     : ${rows.length}`);
  console.log(`Without any price      : ${missing}`);
  console.log("Saved sample to test_results.csv");
}

main().catch((err) => {
  console.error("\nERROR:", err.message);
  process.exit(1);
});
