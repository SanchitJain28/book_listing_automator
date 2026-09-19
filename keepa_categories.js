/**
 * Keepa diagnostic: work out what the amazon.in book counts actually mean.
 *
 * Runs a series of Product Finder count queries that differ by one variable at
 * a time, so each pair tells you exactly what one filter is doing. Only
 * totalResults is read, and perPage is pinned to the 50 minimum, so each query
 * costs ~11 tokens. The whole run is ~150 tokens.
 *
 * Questions it answers:
 *   1. Is productType being applied at all, and does [0] differ from 0?
 *   2. How many books sit outside the Categories subtree?
 *   3. How much is the undocumented 6-month lastUpdate default hiding?
 *   4. How much does current_NEW_gte:1 (requires a live offer) cost you?
 *   5. Do binding filters agree with productType about what's physical?
 *
 * Run: node keepa_diagnose.js
 */

require("dotenv").config();
const fs = require("fs");

const KEY = (process.env.KEEPA_API_KEY || "").trim();
const BASE = "https://api.keepa.com";
const DOMAIN = 10;

const BOOKS_ROOT = 976389031; // Books
const CATEGORIES = 976390031; // Books > Categories

const OUT = "diagnose_results.json";

if (!KEY) {
  console.error("KEEPA_API_KEY is empty. Put your key in the .env file.");
  process.exit(1);
}

let tokensSpent = 0;
let lastTokensLeft = null;

// Every probe pins perPage to the 50 minimum: we only want totalResults.
const PROBES = [
  {
    group: "A. Does productType work?",
    cases: [
      ["no productType filter at all", { rootCategory: BOOKS_ROOT }],
      [
        "productType: 0   (integer, per docs)",
        { rootCategory: BOOKS_ROOT, productType: 0 },
      ],
      [
        "productType: [0] (array, your script)",
        { rootCategory: BOOKS_ROOT, productType: [0] },
      ],
      [
        "productType: 2   (EBOOK - should be small or 0)",
        { rootCategory: BOOKS_ROOT, productType: 2 },
      ],
    ],
  },
  {
    group: "B. Where do the 36M unclassified books live?",
    cases: [
      ["rootCategory: Books", { rootCategory: BOOKS_ROOT, productType: 0 }],
      [
        "categories_include: Categories",
        { categories_include: [CATEGORIES], productType: 0 },
      ],
      [
        "rootCategory Books, excl. Categories",
        {
          rootCategory: BOOKS_ROOT,
          categories_exclude: [CATEGORIES],
          productType: 0,
        },
      ],
    ],
  },
  {
    group: "C. What is the 6-month lastUpdate default hiding?",
    cases: [
      [
        "default (last 6 months only)",
        { rootCategory: BOOKS_ROOT, productType: 0 },
      ],
      [
        "lastUpdate_gte: 0 (all time)",
        { rootCategory: BOOKS_ROOT, productType: 0, lastUpdate_gte: 0 },
      ],
    ],
  },
  {
    group: "D. Cost of requiring a live New offer",
    cases: [
      [
        "no offer requirement",
        { rootCategory: BOOKS_ROOT, productType: 0, lastUpdate_gte: 0 },
      ],
      [
        "current_NEW_gte: 1 (your script)",
        {
          rootCategory: BOOKS_ROOT,
          productType: 0,
          lastUpdate_gte: 0,
          current_NEW_gte: 1,
        },
      ],
    ],
  },
  {
    group: "E. Does binding agree with productType?",
    cases: [
      [
        "physical bindings only",
        {
          rootCategory: BOOKS_ROOT,
          lastUpdate_gte: 0,
          binding: [
            "Paperback",
            "Hardcover",
            "Mass Market Paperback",
            "Board book",
            "Spiral-bound",
            "Library Binding",
            "Loose Leaf",
          ],
        },
      ],
      [
        "exclude digital bindings",
        {
          rootCategory: BOOKS_ROOT,
          lastUpdate_gte: 0,
          binding: [
            "✜Kindle Edition",
            "✜Audible Audiobook",
            "✜Audio CD",
            "✜MP3 CD",
          ],
        },
      ],
      [
        "productType 0 AND physical bindings",
        {
          rootCategory: BOOKS_ROOT,
          productType: 0,
          lastUpdate_gte: 0,
          binding: [
            "Paperback",
            "Hardcover",
            "Mass Market Paperback",
            "Board book",
            "Spiral-bound",
            "Library Binding",
            "Loose Leaf",
          ],
        },
      ],
    ],
  },
  {
    group: "F. Does a sales rank exist? (what rank-slicing can reach)",
    cases: [
      [
        "all physical books",
        { rootCategory: BOOKS_ROOT, productType: 0, lastUpdate_gte: 0 },
      ],
      [
        "with any sales rank",
        {
          rootCategory: BOOKS_ROOT,
          productType: 0,
          lastUpdate_gte: 0,
          current_SALES_gte: 1,
          current_SALES_lte: 20000000,
        },
      ],
    ],
  },
];

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

    // Wait out a low bucket before the next probe.
    if (typeof data.tokensLeft === "number" && data.tokensLeft < 20) {
      const wait = (data.refillIn || 60000) + 1000;
      console.log(`    (bucket low, sleeping ${Math.round(wait / 1000)}s)`);
      await new Promise((r) => setTimeout(r, wait));
    }

    return { total: data.totalResults, returned: (data.asinList || []).length };
  }
  return { error: "gave up after retries" };
}

const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : n);

async function main() {
  console.log("Keepa book-count diagnostic - amazon.in\n");
  const results = {};

  for (const { group, cases } of PROBES) {
    console.log(group);
    console.log("-".repeat(64));
    results[group] = [];

    for (const [label, selection] of cases) {
      const r = await countQuery(selection);
      results[group].push({ label, selection, ...r });

      if (r.error) {
        console.log(`  ${label.padEnd(42)} ERROR  ${r.error}`);
      } else {
        console.log(`  ${label.padEnd(42)} ${fmt(r.total).padStart(14)}`);
      }
    }
    console.log();
  }

  // --------------------------------------------------- read the differences
  const get = (g, i) => results[g]?.[i]?.total;
  console.log("=".repeat(64));
  console.log("  WHAT THIS MEANS");
  console.log("=".repeat(64));

  const noFilter = get(PROBES[0].group, 0);
  const int0 = get(PROBES[0].group, 1);
  const arr0 = get(PROBES[0].group, 2);
  const ebooks = get(PROBES[0].group, 3);

  if (noFilter && int0) {
    if (noFilter === int0) {
      console.log(
        "  ! productType:0 changes NOTHING - the filter is being ignored.",
      );
    } else {
      console.log(
        `  productType:0 removes ${fmt(noFilter - int0)} products. Filter works.`,
      );
    }
    if (arr0 !== int0) {
      console.log(
        `  ! [0] and 0 DISAGREE (${fmt(arr0)} vs ${fmt(int0)}). Use the integer form.`,
      );
    } else {
      console.log("  [0] and 0 agree - your array form is fine.");
    }
    if (ebooks)
      console.log(`  EBOOK products under Books root: ${fmt(ebooks)}`);
  }

  const inRoot = get(PROBES[1].group, 0);
  const inCats = get(PROBES[1].group, 1);
  const outside = get(PROBES[1].group, 2);
  if (inRoot && outside !== undefined) {
    const pct = ((outside / inRoot) * 100).toFixed(1);
    console.log(
      `\n  Outside the Categories subtree: ${fmt(outside)} (${pct}%)`,
    );
    console.log("  -> category-walking discovery can never reach these.");
  }

  const sixMo = get(PROBES[2].group, 0);
  const allTime = get(PROBES[2].group, 1);
  if (sixMo && allTime) {
    console.log(
      `\n  The 6-month default hides ${fmt(allTime - sixMo)} products`,
    );
    console.log(
      `  (${(((allTime - sixMo) / allTime) * 100).toFixed(1)}% of the catalogue).`,
    );
  }

  const noOffer = get(PROBES[3].group, 0);
  const withOffer = get(PROBES[3].group, 1);
  if (noOffer && withOffer) {
    console.log(
      `\n  current_NEW_gte:1 drops ${fmt(noOffer - withOffer)} out-of-stock books`,
    );
    console.log(
      `  (${(((noOffer - withOffer) / noOffer) * 100).toFixed(1)}%). Keep it only if you want in-stock only.`,
    );
  }

  const anyBooks = get(PROBES[5].group, 0);
  const ranked = get(PROBES[5].group, 1);
  if (anyBooks && ranked) {
    const unranked = anyBooks - ranked;
    console.log(
      `\n  Books with NO sales rank: ${fmt(unranked)} (${((unranked / anyBooks) * 100).toFixed(1)}%)`,
    );
    console.log("  -> invisible to rank-slicing AND to Best Sellers. Needs a");
    console.log("     non-rank split (price, publicationDate, numberOfPages).");
    console.log(
      `\n  Ranked books needing >=${Math.ceil(ranked / 10000)} buckets of <=10,000 each.`,
    );
  }

  console.log(`\n  Tokens spent: ${tokensSpent}   |   left: ${lastTokensLeft}`);
  console.log("=".repeat(64));

  fs.writeFileSync(
    OUT,
    JSON.stringify({ results, tokensSpent, lastTokensLeft }, null, 2),
  );
  console.log(`\nSaved to ${OUT}`);
}

main().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});
