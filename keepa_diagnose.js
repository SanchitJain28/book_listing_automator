/**
 * Keepa diagnostic, round 2 - amazon.in books.
 *
 * Round 1 established: productType works, 96.5% have no rank (maybe),
 * 78.6% sit outside the Categories subtree, and the physical-binding
 * filter total is 42,074,100 against 45,455,000 for productType 0.
 *
 * This round answers the three questions that decide the architecture:
 *
 *   G. Was the no-rank figure an artefact of my 20M ceiling?
 *   H. What is in the 3.38M gap between productType 0 and the binding
 *      list - non-books, or books with an empty binding field?
 *   I. Does trackingSince actually cover every product, and does it
 *      bisect evenly enough to use as the split axis?
 *
 * Each probe pins perPage to the 50 minimum and reads only totalResults,
 * so each costs ~11 tokens. Whole run is roughly 200.
 *
 * Run: node keepa_diagnose2.js
 */

require("dotenv").config();
const fs = require("fs");

const KEY = (process.env.KEEPA_API_KEY || "").trim();
const BASE = "https://api.keepa.com";
const DOMAIN = 10;
const BOOKS_ROOT = 976389031;

const OUT = "diagnose2_results.json";

if (!KEY) {
  console.error("KEEPA_API_KEY is empty. Put your key in the .env file.");
  process.exit(1);
}

// Keepa time is minutes since 2011-01-01. Compute rather than hardcode.
const KEEPA_EPOCH_OFFSET = 21564000;
const nowKeepa = Math.floor(Date.now() / 60000) - KEEPA_EPOCH_OFFSET;

const PHYSICAL_BINDINGS = [
  "Paperback",
  "Hardcover",
  "Mass Market Paperback",
  "Board book",
  "Spiral-bound",
  "Library Binding",
  "Loose Leaf",
];

// Bindings that are physical books but were NOT in the round-1 list.
const EXTRA_PHYSICAL = [
  "Perfect Paperback",
  "Flexibound",
  "Unknown Binding",
  "Product Bundle",
  "Pamphlet",
  "Textbook Binding",
  "Ring-bound",
  "Leather Bound",
  "Staple Bound",
  "Sheet music",
  "Paperback Bunko",
  "Tankobon Hardcover",
];

// Bindings that are NOT books and should stay excluded.
const NON_BOOK_BINDINGS = [
  "Audio CD",
  "MP3 CD",
  "Audible Audiobook",
  "Kindle Edition",
  "Calendar",
  "Diary",
  "Cards",
  "Map",
  "Poster",
  "DVD",
];

// Base scope used everywhere: all-time, physical products, under Books.
const BASE_SCOPE = { rootCategory: BOOKS_ROOT, lastUpdate_gte: 0 };

let tokensSpent = 0;
let lastTokensLeft = null;

const PROBES = [
  {
    group: "G. Was the no-rank figure real, or just my 20M ceiling?",
    cases: [
      ["baseline: productType 0, all time", { ...BASE_SCOPE, productType: 0 }],
      [
        "rank 1 - 20,000,000 (round 1 probe)",
        {
          ...BASE_SCOPE,
          productType: 0,
          current_SALES_gte: 1,
          current_SALES_lte: 20000000,
        },
      ],
      [
        "rank 20,000,000 - 99,000,000",
        {
          ...BASE_SCOPE,
          productType: 0,
          current_SALES_gte: 20000000,
          current_SALES_lte: 99000000,
        },
      ],
      [
        "rank 1 - 999,000,000 (no ceiling)",
        {
          ...BASE_SCOPE,
          productType: 0,
          current_SALES_gte: 1,
          current_SALES_lte: 999000000,
        },
      ],
    ],
  },
  {
    group: "H. What is in the 3.38M binding gap?",
    cases: [
      [
        "productType 0 (the 45.45M baseline)",
        { ...BASE_SCOPE, productType: 0 },
      ],
      [
        "round-1 physical binding list",
        { ...BASE_SCOPE, binding: PHYSICAL_BINDINGS },
      ],
      [
        "NO binding value at all",
        { ...BASE_SCOPE, productType: 0, exists: { binding: false } },
      ],
      [
        "HAS some binding value",
        { ...BASE_SCOPE, productType: 0, exists: { binding: true } },
      ],
      [
        "extra physical bindings",
        { ...BASE_SCOPE, productType: 0, binding: EXTRA_PHYSICAL },
      ],
      [
        "non-book bindings (should be excluded)",
        { ...BASE_SCOPE, productType: 0, binding: NON_BOOK_BINDINGS },
      ],
      [
        "widened list: round-1 + extras",
        {
          ...BASE_SCOPE,
          productType: 0,
          binding: [...PHYSICAL_BINDINGS, ...EXTRA_PHYSICAL],
        },
      ],
    ],
  },
  {
    group: "I. Is trackingSince usable as the split axis?",
    cases: [
      ["baseline: no trackingSince filter", { ...BASE_SCOPE, productType: 0 }],
      [
        "trackingSince_gte: 0 (everything)",
        { ...BASE_SCOPE, productType: 0, trackingSince_gte: 0 },
      ],
      [
        "tracked before 2017",
        {
          ...BASE_SCOPE,
          productType: 0,
          trackingSince_lte: minutesFor("2017-01-01"),
        },
      ],
      [
        "tracked 2017 - 2020",
        {
          ...BASE_SCOPE,
          productType: 0,
          trackingSince_gte: minutesFor("2017-01-01"),
          trackingSince_lte: minutesFor("2020-01-01"),
        },
      ],
      [
        "tracked 2020 - 2023",
        {
          ...BASE_SCOPE,
          productType: 0,
          trackingSince_gte: minutesFor("2020-01-01"),
          trackingSince_lte: minutesFor("2023-01-01"),
        },
      ],
      [
        "tracked 2023 - now",
        {
          ...BASE_SCOPE,
          productType: 0,
          trackingSince_gte: minutesFor("2023-01-01"),
          trackingSince_lte: nowKeepa,
        },
      ],
    ],
  },
  {
    group: "J. Scope decision: what does requiring an offer cost?",
    cases: [
      [
        "all physical books, all time",
        { ...BASE_SCOPE, productType: 0, binding: PHYSICAL_BINDINGS },
      ],
      [
        "with a live New offer",
        {
          ...BASE_SCOPE,
          productType: 0,
          binding: PHYSICAL_BINDINGS,
          current_NEW_gte: 1,
        },
      ],
      [
        "with any current price (Buy Box)",
        {
          ...BASE_SCOPE,
          productType: 0,
          binding: PHYSICAL_BINDINGS,
          current_BUY_BOX_SHIPPING_gte: 1,
        },
      ],
    ],
  },
];

function minutesFor(isoDate) {
  return (
    Math.floor(new Date(isoDate + "T00:00:00Z").getTime() / 60000) -
    KEEPA_EPOCH_OFFSET
  );
}

async function countQuery(selection) {
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
      return {
        error: `HTTP ${res.status}: ${JSON.stringify(data.error || data).slice(0, 160)}`,
      };
    }

    if (typeof data.tokensLeft === "number" && data.tokensLeft < 20) {
      const wait = (data.refillIn || 60000) + 1000;
      console.log(`    (bucket low, sleeping ${Math.round(wait / 1000)}s)`);
      await new Promise((r) => setTimeout(r, wait));
    }

    return { total: data.totalResults };
  }
  return { error: "gave up after retries" };
}

const fmt = (n) =>
  typeof n === "number" ? n.toLocaleString("en-IN") : String(n);
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + "%" : "-");

async function main() {
  console.log(
    `Keepa diagnostic round 2 - amazon.in (now = keepa minute ${nowKeepa})\n`,
  );
  const results = {};

  for (const { group, cases } of PROBES) {
    console.log(group);
    console.log("-".repeat(70));
    results[group] = [];

    for (const [label, selection] of cases) {
      const r = await countQuery(selection);
      results[group].push({ label, selection, ...r });
      if (r.error) console.log(`  ${label.padEnd(44)} ERROR  ${r.error}`);
      else console.log(`  ${label.padEnd(44)} ${fmt(r.total).padStart(16)}`);
    }
    console.log();
  }

  // ------------------------------------------------------ interpretation
  const g = (i, j) => results[PROBES[i].group]?.[j]?.total;

  console.log("=".repeat(70));
  console.log("  WHAT THIS MEANS");
  console.log("=".repeat(70));

  // G - rank coverage
  const base = g(0, 0),
    r20 = g(0, 1),
    rHigh = g(0, 2),
    rAll = g(0, 3);
  if (base && rAll !== undefined) {
    console.log(`\n  G. RANK COVERAGE`);
    console.log(
      `     Ranked, no ceiling : ${fmt(rAll)} (${pct(rAll, base)} of all books)`,
    );
    console.log(`     Above 20M rank     : ${fmt(rHigh)}`);
    if (rHigh > r20 * 0.1) {
      console.log(
        `     -> My 20M ceiling WAS too low. Rank is more usable than round 1 suggested.`,
      );
    } else {
      console.log(
        `     -> Ceiling was not the problem. Rank genuinely covers a small minority.`,
      );
      console.log(`        Confirmed: do not build discovery on sales rank.`);
    }
  }

  // H - binding gap
  const pt0 = g(1, 0),
    list1 = g(1, 1),
    noBind = g(1, 2),
    hasBind = g(1, 3);
  const extras = g(1, 4),
    nonBook = g(1, 5),
    widened = g(1, 6);
  if (pt0) {
    console.log(`\n  H. THE BINDING GAP (${fmt(pt0 - list1)} products)`);
    console.log(
      `     No binding value   : ${fmt(noBind)} (${pct(noBind, pt0)})`,
    );
    console.log(`     Extra phys. binds  : ${fmt(extras)}`);
    console.log(`     Non-book bindings  : ${fmt(nonBook)}`);
    console.log(
      `     Widened list total : ${fmt(widened)} (was ${fmt(list1)})`,
    );
    if (noBind > 500000) {
      console.log(
        `     -> ${fmt(noBind)} books have NO binding field. A positive binding`,
      );
      console.log(
        `        filter drops every one of them. Use productType 0 as the`,
      );
      console.log(
        `        primary filter and binding only to EXCLUDE known non-books.`,
      );
    } else {
      console.log(
        `     -> Few books lack a binding. The positive list is safe to use.`,
      );
    }
  }

  // I - trackingSince
  const tBase = g(2, 0),
    tAll = g(2, 1);
  const buckets = [g(2, 2), g(2, 3), g(2, 4), g(2, 5)];
  if (tBase && tAll) {
    console.log(`\n  I. trackingSince AS SPLIT AXIS`);
    if (tAll === tBase) {
      console.log(
        `     Coverage           : 100% - every product has trackingSince.`,
      );
    } else {
      console.log(
        `     ! ${fmt(tBase - tAll)} products have NO trackingSince (${pct(tBase - tAll, tBase)}).`,
      );
      console.log(
        `       These would be invisible to a trackingSince-only split.`,
      );
    }
    const sum = buckets.reduce((a, b) => a + (b || 0), 0);
    console.log(`     Era buckets        : ${buckets.map(fmt).join("  |  ")}`);
    console.log(
      `     Sum vs baseline    : ${fmt(sum)} vs ${fmt(tBase)} (${pct(sum, tBase)})`,
    );
    if (Math.abs(sum - tBase) / tBase < 0.05) {
      console.log(`     -> Buckets partition cleanly. Bisection will work.`);
    } else {
      console.log(
        `     -> Buckets do not sum to the whole. Check boundary handling.`,
      );
    }
    const biggest = Math.max(...buckets.filter(Boolean));
    console.log(
      `     Largest era bucket : ${fmt(biggest)} -> needs ~${Math.ceil(Math.log2(biggest / 10000))} more halvings`,
    );
  }

  // J - scope
  const allBooks = g(3, 0),
    withOffer = g(3, 1),
    withBB = g(3, 2);
  if (allBooks) {
    const TOK_PER_DAY_BUSINESS = 2000 * 60 * 24;
    console.log(`\n  J. SCOPE DECISION`);
    console.log(
      `     Everything ever listed : ${fmt(allBooks).padStart(14)}  -> ${(allBooks / TOK_PER_DAY_BUSINESS).toFixed(1)} days on Business`,
    );
    console.log(
      `     With a live New offer  : ${fmt(withOffer).padStart(14)}  -> ${(withOffer / TOK_PER_DAY_BUSINESS).toFixed(1)} days`,
    );
    console.log(
      `     With a Buy Box price   : ${fmt(withBB).padStart(14)}  -> ${(withBB / TOK_PER_DAY_BUSINESS).toFixed(1)} days`,
    );
    console.log(`     (1 token/book, metadata only, excludes discovery)`);
  }

  console.log(`\n  Tokens spent: ${tokensSpent}   |   left: ${lastTokensLeft}`);
  console.log("=".repeat(70));

  fs.writeFileSync(
    OUT,
    JSON.stringify({ nowKeepa, results, tokensSpent, lastTokensLeft }, null, 2),
  );
  console.log(`\nSaved to ${OUT}`);
}

main().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});
