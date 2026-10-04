/**
 * Keepa: final book count for amazon.in - in stock, 0-N reviews.
 *
 * Standalone sizing script. Prints:
 *   1. The waterfall from all physical books down to your scope.
 *   2. Pass 1 (1-N reviews) at several cutoffs, so you can compare.
 *   3. Pass 2 (0 reviews), which is the same whatever cutoff you pick.
 *   4. Runtime for each combination at your token rate.
 *
 * Why two passes: Keepa joins filters with AND and has no OR, and a missing
 * value is not the same as zero - so a "<= N reviews" filter silently skips
 * every book with no reviews at all. "0 to N" therefore needs two queries.
 *
 * ~90 tokens total. Each probe pins perPage to the 50 minimum and reads only
 * totalResults.
 *
 * Run: node keepa_count_filtered.js
 *      REVIEW_MAX=20 node keepa_count_filtered.js    (marks your chosen row)
 */

require("dotenv").config();
const fs = require("fs");

const KEY = (process.env.KEEPA_API_KEY || "").trim();
const BASE = "https://api.keepa.com";
const DOMAIN = 10;
const BOOKS_ROOT = 976389031;

const REVIEW_MAX = Number(process.env.REVIEW_MAX || 20);
const TOKEN_RATE = Number(process.env.TOKEN_RATE || 60);
const CUTOFFS = [5, 10, 20, 50, 100];
const DISCOVERY_OVERHEAD = 0.0178; // measured: 17.8 tokens per 1,000 books

const OUT = "filtered_count.json";

if (!KEY) {
  console.error("KEEPA_API_KEY is empty. Put your key in the .env file.");
  process.exit(1);
}

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

// Physical books on amazon.in, all time.
const BOOKS_ONLY = {
  rootCategory: BOOKS_ROOT,
  productType: 0,
  lastUpdate_gte: 0,
  binding: PHYSICAL_BINDINGS,
};

// ...that are purchasable right now. A Buy Box exists only when a seller has
// a live, buyable offer, so this is "in stock with a real seller".
const IN_STOCK = { ...BOOKS_ONLY, current_BUY_BOX_SHIPPING_gte: 1 };

let tokensSpent = 0;
let lastTokensLeft = null;

async function countOf(selection) {
  const params = new URLSearchParams({
    key: KEY,
    domain: DOMAIN,
    selection: JSON.stringify({ ...selection, perPage: 50, page: 0 }),
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    let res, data;
    try {
      res = await fetch(`${BASE}/query?${params}`);
      data = await res.json();
    } catch (e) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    if (typeof data.tokensLeft === "number") lastTokensLeft = data.tokensLeft;
    tokensSpent += data.tokensConsumed || 0;

    if (!res.ok) {
      console.log(
        `    ERROR ${res.status}: ${JSON.stringify(data.error || data).slice(0, 140)}`,
      );
      return null;
    }

    if (typeof data.tokensLeft === "number" && data.tokensLeft < 30) {
      const wait = (data.refillIn || 60000) + 1000;
      console.log(`    (bucket low, sleeping ${Math.round(wait / 1000)}s)`);
      await new Promise((r) => setTimeout(r, wait));
    }

    return data.totalResults;
  }
  return null;
}

const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : "-");
const days = (books, rate) =>
  (books * (1 + DISCOVERY_OVERHEAD)) / (rate * 60 * 24);
const timeLabel = (d) =>
  d < 1
    ? `${(d * 24).toFixed(1)} hrs`
    : d < 60
      ? `${d.toFixed(1)} days`
      : `${(d / 30.4).toFixed(1)} months`;

async function main() {
  console.log(
    `Final book count - amazon.in, in stock, 0-${REVIEW_MAX} reviews`,
  );
  console.log(
    `Token rate: ${TOKEN_RATE}/min = ${fmt(TOKEN_RATE * 60 * 24)} tokens/day\n`,
  );

  // ---------------------------------------------------------- waterfall
  console.log("STEP 1: THE WATERFALL");
  console.log("-".repeat(70));

  const allBooks = await countOf(BOOKS_ONLY);
  console.log(
    `  All physical books, all time        ${fmt(allBooks).padStart(14)}`,
  );

  const inStock = await countOf(IN_STOCK);
  console.log(
    `  ...in stock (has a Buy Box)         ${fmt(inStock).padStart(14)}   -${fmt(allBooks - inStock)} (${(((allBooks - inStock) / allBooks) * 100).toFixed(1)}%)`,
  );

  const tooMany = await countOf({
    ...IN_STOCK,
    current_COUNT_REVIEWS_gte: REVIEW_MAX + 1,
  });
  console.log(
    `  ...minus ${REVIEW_MAX + 1}+ reviews${" ".repeat(Math.max(1, 22 - String(REVIEW_MAX + 1).length))}${fmt(inStock - tooMany).padStart(14)}   -${fmt(tooMany)} (${((tooMany / inStock) * 100).toFixed(1)}%)`,
  );
  console.log(`\n  ^ that last line IS your final scope.\n`);

  // ---------------------------------------------------------- the two passes
  console.log("STEP 2: HOW THE SCOPE SPLITS INTO TWO PASSES");
  console.log("-".repeat(70));

  const noReviews = await countOf({ ...IN_STOCK, hasReviews: false });
  console.log(
    `  PASS 2  books with 0 reviews        ${fmt(noReviews).padStart(14)}   ${timeLabel(days(noReviews, TOKEN_RATE)).padStart(12)}`,
  );
  console.log(`          (same whatever cutoff you choose)\n`);

  const rows = [];
  for (const cutoff of CUTOFFS) {
    const n = await countOf({ ...IN_STOCK, current_COUNT_REVIEWS_lte: cutoff });
    const total = (n || 0) + (noReviews || 0);
    rows.push({ cutoff, pass1: n, total });
    const mark = cutoff === REVIEW_MAX ? "  <-- you" : "";
    console.log(
      `  PASS 1  1-${String(cutoff).padEnd(3)} reviews${" ".repeat(13)}${fmt(n).padStart(14)}` +
        `   total ${fmt(total).padStart(12)}   ${timeLabel(days(total, TOKEN_RATE)).padStart(12)}${mark}`,
    );
  }

  // ---------------------------------------------------------- sanity check
  const chosen = rows.find((r) => r.cutoff === REVIEW_MAX);
  console.log();
  console.log("STEP 3: DOES IT RECONCILE?");
  console.log("-".repeat(70));
  if (chosen && inStock) {
    const rebuilt = chosen.total + (tooMany || 0);
    const drift = Math.abs(rebuilt - inStock) / inStock;
    console.log(
      `  pass1 + pass2 + (${REVIEW_MAX + 1}+ reviews) = ${fmt(rebuilt)}`,
    );
    console.log(`  in-stock total              = ${fmt(inStock)}`);
    if (drift < 0.02) {
      console.log(
        `  Consistent. The two passes cover the whole in-stock catalogue.`,
      );
    } else {
      console.log(
        `  ! ${(drift * 100).toFixed(1)}% drift - some books fall outside both passes.`,
      );
    }
  }

  // ---------------------------------------------------------- the decision
  console.log();
  console.log("STEP 4: WHAT IT COSTS");
  console.log("-".repeat(70));
  if (chosen) {
    console.log(
      `  Your scope (0-${REVIEW_MAX} reviews, in stock): ${fmt(chosen.total)} books`,
    );
    console.log(
      `  Tokens needed: ~${fmt(Math.round(chosen.total * (1 + DISCOVERY_OVERHEAD)))}\n`,
    );
    for (const [name, rate, price] of [
      [`your plan (${TOKEN_RATE}/min)`, TOKEN_RATE, 129],
      ["Developer (250/min)", 250, 459],
      ["Business (2000/min)", 2000, 2499],
    ]) {
      const d = days(chosen.total, rate);
      const months = Math.max(1, Math.ceil(d / 30.4));
      console.log(
        `  ${name.padEnd(24)} ${timeLabel(d).padStart(12)}   ` +
          `${months} x ${price} EUR = ${fmt(months * price)} EUR`,
      );
    }
    console.log(
      `\n  Pass 2 (0-review books) is ${((noReviews / chosen.total) * 100).toFixed(0)}% of the whole job.`,
    );
    console.log(
      `  If you dropped it, the run would be ${timeLabel(days(chosen.pass1, TOKEN_RATE))} instead.`,
    );
  }

  console.log(`\n  Tokens spent: ${tokensSpent}   left: ${lastTokensLeft}`);
  console.log("-".repeat(70));

  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        reviewMax: REVIEW_MAX,
        tokenRate: TOKEN_RATE,
        allBooks,
        inStock,
        tooManyReviews: tooMany,
        noReviews,
        byCutoff: rows,
        finalScope: chosen ? chosen.total : null,
        tokensSpent,
      },
      null,
      2,
    ),
  );
  console.log(`\nSaved to ${OUT}`);
}

main().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});
