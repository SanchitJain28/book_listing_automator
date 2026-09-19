/**
 * Keepa 1-hour test: discovery + title/price collection for amazon.in books.
 *
 * What it does (for RUN_MINUTES, default 60):
 *  1. Discovers book IDs with Product Finder across 4 sales-rank slices
 *     (bestsellers, mid, long-tail, deep long-tail) and finds the largest
 *     page size Keepa accepts.
 *  2. Keeps only printed books (ASIN = ISBN-10), skips B0... (Kindle/Audible/other).
 *  3. Looks up title + price in batches of 100 and appends to books_test.csv.
 *  4. Stops at the time limit (or Ctrl+C) and prints a summary + full-run estimate.
 *
 * Setup:  npm install dotenv      (Node.js 18+)
 * Run:    caffeinate -i node keepa_hour_test.js      (caffeinate stops the Mac sleeping)
 * Optional: RUN_MINUTES=10 node keepa_hour_test.js
 *
 * Safe to re-run: books already in books_test.csv are skipped.
 */

require("dotenv").config();
const fs = require("fs");

// ------------------------------------------------------------------ config
const KEY = (process.env.KEEPA_API_KEY || "").trim();
const BASE = "https://api.keepa.com";
const DOMAIN = 10; // amazon.in
const ROOT = 976389031; // amazon.in Books
let FULL_TOTAL = 20890800; // replaced at start by the physical-books-only count
const RUN_MINUTES = Number(process.env.RUN_MINUTES || 60);
const PAGE_SIZES = [10000, 1000, 100, 50]; // tried largest first
const LOOKUP_BATCH = 100; // max ASINs per product request
const BUSINESS_TOKENS_PER_DAY = 2000 * 60 * 24;

const OUT_CSV = "books_test.csv";
const OUT_ASINS = "discovered_asins.txt";
const OUT_SUMMARY = "test_summary.json";

const WINDOWS = [
  { name: "rank 1-50k (bestsellers)", gte: 1, lte: 50000 },
  { name: "rank 200k-250k (mid)", gte: 200000, lte: 250000 },
  { name: "rank 1M-1.05M (long tail)", gte: 1000000, lte: 1050000 },
  { name: "rank 5M-5.05M (deep tail)", gte: 5000000, lte: 5050000 },
].map((w) => ({
  ...w,
  page: 0,
  total: null,
  exhausted: false,
  queue: [],
  discovered: 0,
  printed: 0,
  nonPrinted: 0,
  lookedUp: 0,
  priced: 0,
  depthError: null,
}));

if (!KEY) {
  console.error("KEEPA_API_KEY is empty. Put your key in the .env file.");
  process.exit(1);
}

// ------------------------------------------------------------------ state
const startedAt = Date.now();
const deadline = startedAt + RUN_MINUTES * 60000;
let stopRequested = false;
let perPage = null;
let tokensDiscovery = 0;
let tokensLookup = 0;
let lastTokensLeft = null;
const probeLog = [];
const seen = new Set();

process.on("SIGINT", () => {
  if (stopRequested) process.exit(1);
  stopRequested = true;
  console.log(
    "\nStopping after the current request... (Ctrl+C again to force quit)",
  );
});

const shouldStop = () => stopRequested || Date.now() >= deadline;
const elapsed = () => {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

async function sleepInterruptible(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end && !shouldStop()) {
    await new Promise((r) => setTimeout(r, Math.min(1000, end - Date.now())));
  }
}

// ------------------------------------------------------------------ helpers
const price = (v) =>
  Number.isInteger(v) && v > 0 ? +(v / 100).toFixed(2) : "";
const isIsbn10 = (a) => /^\d{9}[\dX]$/.test(a);

function isbn10to13(isbn10) {
  const core = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  return core + ((10 - (sum % 10)) % 10);
}

const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const CSV_HEADERS = ["isbn13", "title", "mrp_inr", "sale_price_inr"];

// Resume support: skip ASINs already saved.
const done = new Set();
if (fs.existsSync(OUT_CSV)) {
  for (const line of fs.readFileSync(OUT_CSV, "utf8").split("\n").slice(1)) {
    const isbn13 = line.split(",")[0];
    if (isbn13) done.add(isbn13);
  }
  console.log(`Resuming: ${done.size} books already in ${OUT_CSV}`);
} else {
  fs.writeFileSync(OUT_CSV, "\uFEFF" + CSV_HEADERS.join(",") + "\n", "utf8");
}

// ------------------------------------------------------------------ API call
async function call(endpoint, params) {
  const url = `${BASE}/${endpoint}?${new URLSearchParams({ key: KEY, ...params })}`;

  while (!shouldStop()) {
    let res, data;
    try {
      res = await fetch(url);
      data = await res.json();
    } catch (e) {
      console.log(
        `  [${elapsed()}] network error (${e.message}), retrying in 10s`,
      );
      await sleepInterruptible(10000);
      continue;
    }
    if (typeof data.tokensLeft === "number") lastTokensLeft = data.tokensLeft;

    if (res.status === 429) {
      const waitMs = Math.max(5000, (data.refillIn || 60000) + 1000);
      if (Date.now() + waitMs > deadline) return null;
      console.log(
        `  [${elapsed()}] waiting ${Math.round(waitMs / 1000)}s for tokens (left=${data.tokensLeft})`,
      );
      await sleepInterruptible(waitMs);
      continue;
    }
    return { ok: res.ok, status: res.status, data };
  }
  return null;
}

// ------------------------------------------------------------------ discovery
async function discoverPage(w) {
  const sizes = perPage ? [perPage] : PAGE_SIZES;

  for (const size of sizes) {
    const selection = {
      rootCategory: ROOT,
      productType: [0], // 0 = standard/physical products (excludes eBooks & digital)
      current_NEW_gte: 1,
      current_SALES_gte: w.gte,
      current_SALES_lte: w.lte,
      sort: [["current_SALES", "asc"]],
      perPage: size,
      page: w.page,
    };
    const r = await call("query", {
      domain: DOMAIN,
      selection: JSON.stringify(selection),
    });
    if (!r) return null;
    tokensDiscovery += r.data.tokensConsumed || 0;

    if (!r.ok) {
      const msg = JSON.stringify(r.data.error || r.data).slice(0, 200);
      probeLog.push({
        window: w.name,
        size,
        page: w.page,
        status: r.status,
        msg,
      });
      if (perPage) {
        // Known-good size failed deeper in → likely the paging depth limit.
        console.log(
          `  [${elapsed()}] ${w.name}: page ${w.page} rejected (${msg}) → treating as depth limit`,
        );
        w.exhausted = true;
        w.depthError = { page: w.page, msg };
        return [];
      }
      console.log(
        `  [${elapsed()}] perPage=${size} rejected (HTTP ${r.status}), trying smaller`,
      );
      continue;
    }

    const list = r.data.asinList || [];
    if (!perPage) {
      perPage =
        list.length > 0 &&
        list.length < size &&
        r.data.totalResults > list.length
          ? list.length // Keepa silently capped the page size
          : size;
      console.log(`  [${elapsed()}] Page size in use: ${perPage}`);
    }
    w.total = r.data.totalResults;
    w.page++;
    if (list.length === 0 || w.page * perPage >= w.total) w.exhausted = true;
    console.log(
      `  [${elapsed()}] DISCOVER ${w.name}: +${list.length} IDs (slice total ${w.total}, ` +
        `tokens ${r.data.tokensConsumed}, left ${r.data.tokensLeft})`,
    );
    return list;
  }
  throw new Error(
    "Product Finder rejected every page size: " + JSON.stringify(probeLog),
  );
}

function ingest(w, list) {
  const fresh = [];
  for (const asin of list) {
    if (seen.has(asin)) continue;
    seen.add(asin);
    fresh.push(asin);
    w.discovered++;
    if (isIsbn10(asin)) {
      w.printed++;
      if (!done.has(isbn10to13(asin))) w.queue.push(asin);
    } else {
      w.nonPrinted++;
    }
  }
  if (fresh.length) fs.appendFileSync(OUT_ASINS, fresh.join("\n") + "\n");
}

// ------------------------------------------------------------------ lookup
// Buy Box price = exact sale price shown on the product page, but +2 tokens per book (3x total).
// Turn on with:  INCLUDE_BUYBOX=true node keepa_hour_test.js
const INCLUDE_BUYBOX = process.env.INCLUDE_BUYBOX === "true";
const TOKENS_PER_BOOK = INCLUDE_BUYBOX ? 3 : 1;

async function lookup(w, batch) {
  const params = {
    domain: DOMAIN,
    asin: batch.join(","),
    stats: 1,
    history: 0,
  };
  if (INCLUDE_BUYBOX) params.buybox = 1;
  const r = await call("product", params);
  if (!r) {
    w.queue.unshift(...batch);
    return;
  }
  tokensLookup += r.data.tokensConsumed || 0;
  if (!r.ok) {
    console.log(
      `  [${elapsed()}] lookup error HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`,
    );
    return;
  }

  const now = new Date().toISOString();
  const lines = [];
  for (const p of r.data.products || []) {
    if (!p || !p.asin) continue;
    const stats = p.stats || {};
    const cur = stats.current || [];
    const amzPrice = price(cur[0]); // Amazon itself as seller
    const newPrice = price(cur[1]); // lowest new price, any seller
    const mrp = price(cur[4]); // list price = M.R.P.
    const buyBox = INCLUDE_BUYBOX ? price(stats.buyBoxPrice) : "";

    // Sale price: Buy Box if fetched, else Amazon's own price, else lowest new price.
    let sale = "",
      source = "";
    if (buyBox !== "") {
      sale = buyBox;
      source = "buybox";
    } else if (amzPrice !== "") {
      sale = amzPrice;
      source = "amazon";
    } else if (newPrice !== "") {
      sale = newPrice;
      source = "lowest_new";
    }

    const discount =
      mrp !== "" && sale !== "" && mrp > sale
        ? +(((mrp - sale) / mrp) * 100).toFixed(1)
        : "";

    if (sale !== "") w.priced++;
    if (mrp !== "") w.withMrp = (w.withMrp || 0) + 1;
    w.lookedUp++;
    const isbn13 = isbn10to13(p.asin);
    done.add(isbn13);
    lines.push([isbn13, p.title || "", mrp, sale].map(csvCell).join(","));
  }
  if (lines.length) fs.appendFileSync(OUT_CSV, lines.join("\n") + "\n", "utf8");

  const totalLooked = WINDOWS.reduce((s, x) => s + x.lookedUp, 0);
  console.log(
    `  [${elapsed()}] LOOKUP ${w.name}: +${lines.length} books ` +
      `(total ${totalLooked}, tokens ${r.data.tokensConsumed}, left ${r.data.tokensLeft})`,
  );
}

// ------------------------------------------------------------------ main
async function main() {
  console.log(`Running for ${RUN_MINUTES} minutes. Output: ${OUT_CSV}\n`);

  // Count available PHYSICAL books only (~11 tokens).
  const countSel = {
    rootCategory: ROOT,
    productType: [0],
    current_NEW_gte: 1,
    perPage: 50,
    page: 0,
  };
  const count = await call("query", {
    domain: DOMAIN,
    selection: JSON.stringify(countSel),
  });
  if (!count || !count.ok) {
    console.error(
      "Physical-books count query failed (the productType filter may be named differently):",
      count ? JSON.stringify(count.data).slice(0, 300) : "no response",
    );
    process.exit(1);
  }
  tokensDiscovery += count.data.tokensConsumed || 0;
  console.log(
    `All available books (earlier test) : ${FULL_TOTAL.toLocaleString("en-IN")}`,
  );
  FULL_TOTAL = count.data.totalResults;
  console.log(
    `Available PHYSICAL books only      : ${FULL_TOTAL.toLocaleString("en-IN")}\n`,
  );

  let rotation = 0;

  while (!shouldStop()) {
    // Top up any slice whose queue is running low.
    for (const w of WINDOWS) {
      if (shouldStop()) break;
      if (w.queue.length < LOOKUP_BATCH && !w.exhausted) {
        const list = await discoverPage(w);
        if (list === null) break;
        ingest(w, list);
      }
    }
    if (shouldStop()) break;

    const active = WINDOWS.filter((w) => w.queue.length > 0);
    if (active.length === 0) {
      if (WINDOWS.every((w) => w.exhausted)) break;
      continue;
    }
    const w = active[rotation++ % active.length];
    await lookup(w, w.queue.splice(0, LOOKUP_BATCH));
  }

  printSummary();
}

// ------------------------------------------------------------------ summary
function printSummary() {
  const minutes = (Date.now() - startedAt) / 60000;
  const discovered = WINDOWS.reduce((s, w) => s + w.discovered, 0);
  const printed = WINDOWS.reduce((s, w) => s + w.printed, 0);
  const lookedUp = WINDOWS.reduce((s, w) => s + w.lookedUp, 0);
  const priced = WINDOWS.reduce((s, w) => s + w.priced, 0);

  const sliceShares = WINDOWS.filter((w) => w.discovered > 0).map(
    (w) => w.printed / w.discovered,
  );
  const printedShare = sliceShares.length
    ? sliceShares.reduce((a, b) => a + b, 0) / sliceShares.length
    : 0;
  const printedEstimate = Math.round(FULL_TOTAL * printedShare);

  const pp = perPage || 50;
  const fullDiscoveryTokens =
    Math.ceil(FULL_TOTAL / pp) * 10 + Math.ceil(FULL_TOTAL / 100);
  const daysAll =
    (fullDiscoveryTokens + FULL_TOTAL * TOKENS_PER_BOOK) /
    BUSINESS_TOKENS_PER_DAY;
  const daysPrinted =
    (fullDiscoveryTokens + printedEstimate * TOKENS_PER_BOOK) /
    BUSINESS_TOKENS_PER_DAY;
  const withMrp = WINDOWS.reduce((s, w) => s + (w.withMrp || 0), 0);
  console.log(
    `\nBuy Box mode           : ${INCLUDE_BUYBOX ? "ON (3 tokens/book)" : "OFF (1 token/book)"}`,
  );
  console.log(
    `Books with MRP         : ${withMrp} (${lookedUp ? ((withMrp / lookedUp) * 100).toFixed(1) : 0}%)`,
  );

  console.log("\n==================== SUMMARY ====================");
  console.log(`Run time               : ${minutes.toFixed(1)} min`);
  console.log(`Page size accepted     : ${perPage}`);
  console.log(`Tokens: discovery      : ${tokensDiscovery}`);
  console.log(`Tokens: lookups        : ${tokensLookup}`);
  console.log(`Tokens left now        : ${lastTokensLeft}`);
  console.log(`IDs discovered         : ${discovered}`);
  console.log(
    `Printed (ISBN) IDs     : ${printed} (${discovered ? ((printed / discovered) * 100).toFixed(1) : 0}%)`,
  );
  console.log(`Books looked up        : ${lookedUp}  (saved to ${OUT_CSV})`);
  console.log(
    `With a price           : ${priced} (${lookedUp ? ((priced / lookedUp) * 100).toFixed(1) : 0}%)`,
  );

  console.log("\nPer rank slice:");
  for (const w of WINDOWS) {
    const share = w.discovered
      ? ((w.printed / w.discovered) * 100).toFixed(1)
      : "-";
    console.log(
      `  ${w.name.padEnd(28)} total=${w.total ?? "-"} discovered=${w.discovered} ` +
        `printed=${share}% lookedUp=${w.lookedUp} priced=${w.priced}` +
        (w.depthError ? ` DEPTH LIMIT at page ${w.depthError.page}` : ""),
    );
  }

  console.log("\nFull-run estimate on Business (2,000 tokens/min):");
  console.log(
    `  Printed-book share (avg of slices): ${(printedShare * 100).toFixed(1)}%`,
  );
  console.log(
    `  Estimated printed books           : ~${printedEstimate.toLocaleString("en-IN")}`,
  );
  console.log(
    `  Discovery tokens (perPage ${pp})   : ~${fullDiscoveryTokens.toLocaleString("en-IN")}`,
  );
  console.log(
    `  All ${FULL_TOTAL.toLocaleString("en-IN")} books       : ~${daysAll.toFixed(1)} days`,
  );
  console.log(
    `  Printed books only                : ~${daysPrinted.toFixed(1)} days`,
  );
  if (probeLog.length)
    console.log("\nProbe notes:", JSON.stringify(probeLog, null, 2));
  console.log("=================================================");

  fs.writeFileSync(
    OUT_SUMMARY,
    JSON.stringify(
      {
        runMinutes: +minutes.toFixed(1),
        perPage,
        tokensDiscovery,
        tokensLookup,
        lastTokensLeft,
        discovered,
        printed,
        lookedUp,
        priced,
        printedShare,
        printedEstimate,
        fullDiscoveryTokens,
        daysAllBusiness: +daysAll.toFixed(2),
        daysPrintedBusiness: +daysPrinted.toFixed(2),
        windows: WINDOWS.map(({ queue, ...w }) => w),
        probeLog,
      },
      null,
      2,
    ),
  );
  console.log(`Summary saved to ${OUT_SUMMARY}`);
}

main().catch((err) => {
  console.error("\nERROR:", err.message);
  printSummary();
  process.exit(1);
});
