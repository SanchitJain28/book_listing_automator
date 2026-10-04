/**
 * Sample 100 used books from amazon.in - a look before committing to a full run.
 *
 * Filters: physical books, 1-20 reviews, with a live used offer.
 * Note current_BUY_BOX_SHIPPING is deliberately NOT used here - the Buy Box
 * tracks the NEW offer, so requiring it would hide books that are only
 * available second-hand, which are exactly the ones worth seeing.
 *
 * Cost: ~115 tokens (about 2 minutes of a 60/min plan).
 *
 * Stop the collector first, or this will 429 on an empty bucket:
 *   pkill -f keepa_collect
 *   sleep 120
 *   node sample_used.js
 *   nohup caffeinate -i bash -c 'while true; do PASS=1 node keepa_collect.js; sleep 60; done' > runner.log 2>&1 &
 */

require("dotenv").config();
const fs = require("fs");

const KEY = (process.env.KEEPA_API_KEY || "").trim();
const DOMAIN = 10;
const BOOKS_ROOT = 976389031;
const WANT = Number(process.env.WANT || 100);
const OUT = "books_used_sample.csv";

const PHYSICAL_BINDINGS = [
  "Paperback",
  "Hardcover",
  "Mass Market Paperback",
  "Board book",
  "Spiral-bound",
  "Library Binding",
  "Loose Leaf",
  "Perfect Paperback",
  "Flexibound",
  "Unknown Binding",
  "Product Bundle",
  "Pamphlet",
  "Textbook Binding",
  "Ring-bound",
  "Leather Bound",
  "Staple Bound",
  "Paperback Bunko",
  "Tankobon Hardcover",
];

const FILTERS = {
  rootCategory: BOOKS_ROOT,
  productType: 0,
  lastUpdate_gte: 0,
  binding: PHYSICAL_BINDINGS,
  current_COUNT_REVIEWS_lte: 20,
  current_USED_gte: 1, // a live used offer exists, any condition
};

if (!KEY) {
  console.error("KEEPA_API_KEY is empty.");
  process.exit(1);
}

const rupees = (v) =>
  Number.isInteger(v) && v > 0 ? +(v / 100).toFixed(2) : null;
const isIsbn10 = (a) => typeof a === "string" && /^\d{9}[\dX]$/.test(a);

function isbn10to13(i) {
  const core = "978" + i.slice(0, 9);
  let s = 0;
  for (let k = 0; k < 12; k++) s += Number(core[k]) * (k % 2 === 0 ? 1 : 3);
  return core + ((10 - (s % 10)) % 10);
}

const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function call(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 220)}`);
    if (res.status === 429)
      console.error(
        "\nToken bucket empty. Stop the collector and wait a couple of minutes.",
      );
    process.exit(1);
  }
  return data;
}

(async () => {
  // Ask for extra: roughly a third of ASINs have no ISBN and get dropped.
  const selection = {
    ...FILTERS,
    perPage: WANT * 3,
    page: 0,
    sort: [["current_SALES", "asc"]],
  };
  const q = await call(
    `https://api.keepa.com/query?key=${KEY}&domain=${DOMAIN}&selection=${encodeURIComponent(JSON.stringify(selection))}`,
  );

  console.log(
    `Used books matching the filters: ${(q.totalResults || 0).toLocaleString("en-IN")}`,
  );
  console.log(`Sampling ${WANT}...  (tokens left ${q.tokensLeft})\n`);

  const asins = (q.asinList || []).filter(isIsbn10).slice(0, WANT);
  if (!asins.length) {
    console.error("No ISBN-bearing ASINs returned.");
    process.exit(1);
  }

  const p = await call(
    `https://api.keepa.com/product?key=${KEY}&domain=${DOMAIN}&asin=${asins.join(",")}&stats=1&history=0`,
  );

  const rows = [];
  for (const prod of p.products || []) {
    if (!prod || !prod.asin) continue;
    const cur = (prod.stats || {}).current || [];

    const used = rupees(cur[2]); // USED - lowest across all conditions
    const nw = rupees(cur[1]); // NEW  - lowest new offer
    const amz = rupees(cur[0]); // AMAZON
    const mrp = rupees(cur[4]); // LISTPRICE
    const usedCount = Number.isInteger(cur[12]) && cur[12] > 0 ? cur[12] : null;
    const newBest = nw !== null ? nw : amz;

    rows.push({
      isbn13: isbn10to13(prod.asin),
      isbn10: prod.asin,
      title: prod.title || "",
      used_price: used,
      new_price: newBest,
      mrp,
      used_offers: usedCount,
      saving_vs_new:
        used !== null && newBest !== null && newBest > used
          ? +(((newBest - used) / newBest) * 100).toFixed(1)
          : null,
    });
  }

  // ------------------------------------------------------------ on screen
  console.log("USED PRICE   NEW PRICE   SAVE    OFF   TITLE");
  console.log("-".repeat(100));
  for (const r of rows.slice(0, 40)) {
    console.log(
      `${(r.used_price !== null ? "Rs " + r.used_price : "-").padEnd(12)}` +
        `${(r.new_price !== null ? "Rs " + r.new_price : "-").padEnd(12)}` +
        `${(r.saving_vs_new !== null ? r.saving_vs_new + "%" : "-").padEnd(8)}` +
        `${String(r.used_offers ?? "-").padEnd(6)}` +
        `${r.title.slice(0, 58)}`,
    );
  }
  if (rows.length > 40)
    console.log(`... and ${rows.length - 40} more in ${OUT}`);

  // ------------------------------------------------------------ what it means
  const withUsed = rows.filter((r) => r.used_price !== null);
  const withBoth = rows.filter(
    (r) => r.used_price !== null && r.new_price !== null,
  );
  const cheaper = withBoth.filter((r) => r.used_price < r.new_price);
  const avgSave = cheaper.length
    ? cheaper.reduce((a, r) => a + r.saving_vs_new, 0) / cheaper.length
    : 0;
  const med = (arr) => {
    if (!arr.length) return "-";
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  console.log("\n" + "=".repeat(60));
  console.log(`  Sampled                 : ${rows.length}`);
  console.log(`  With a used price       : ${withUsed.length}`);
  console.log(`  With both used and new  : ${withBoth.length}`);
  console.log(
    `  Used cheaper than new   : ${cheaper.length} of ${withBoth.length}`,
  );
  console.log(`  Average saving          : ${avgSave.toFixed(1)}%`);
  console.log(
    `  Median used price       : Rs ${med(withUsed.map((r) => r.used_price))}`,
  );
  console.log(
    `  Median new price        : Rs ${med(withBoth.map((r) => r.new_price))}`,
  );
  console.log(`  Tokens left             : ${p.tokensLeft}`);
  console.log("=".repeat(60));

  const headers = [
    "isbn13",
    "isbn10",
    "title",
    "used_price",
    "new_price",
    "mrp",
    "used_offers",
    "saving_vs_new",
  ];
  fs.writeFileSync(
    OUT,
    "\uFEFF" +
      headers.join(",") +
      "\n" +
      rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")).join("\n") +
      "\n",
    "utf8",
  );
  console.log(`\nSaved to ${OUT}`);
  console.log(
    `Spot-check any of them: https://www.amazon.in/dp/${rows[0].isbn10}`,
  );
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
