/**
 * Keepa discovery: every physical book ASIN on amazon.in via trackingSince bisection.
 *
 * Replaces fixed rank windows, which reach only 3.5% of the catalogue.
 * trackingSince is present on 100% of products and is single-valued, so
 * buckets never overlap and never need deduplication.
 *
 * Algorithm:
 *   1. Probe a trackingSince range with perPage=50 (~11 tokens) to read totalResults.
 *   2. If it fits under the cap, harvest the whole bucket in ONE request
 *      (page 0 allows perPage up to 10,000).
 *   3. If not, halve the range and push both halves back on the stack.
 *
 * Cost: ~132 tokens per 10,000 ASINs, so ~550K tokens for the full 42M.
 * That is about 1.3% of what the metadata pass will cost.
 *
 * Run:
 *   node keepa_discover.js                  # all physical books (~42.1M)
 *   SCOPE=offers node keepa_discover.js     # in-stock only (~15.8M)
 *   MAX_MINUTES=60 node keepa_discover.js   # time-boxed trial
 *
 * Resumes automatically from .discover_checkpoint.json.
 */

require("dotenv").config();
const fs = require("fs");

// ------------------------------------------------------------------ config
const KEY = (process.env.KEEPA_API_KEY || "").trim();
const BASE = "https://api.keepa.com";
const DOMAIN = 10;
const BOOKS_ROOT = 976389031;

const SCOPE = (process.env.SCOPE || "all").toLowerCase(); // "all" | "offers"
const MAX_MINUTES = Number(process.env.MAX_MINUTES || 0) || null;
const BUCKET_TARGET = 9500; // aim below the 10,000 cap; leaves headroom for drift
const HARD_CAP = 10000; // Keepa's paging ceiling
const PROBE_PER_PAGE = 50; // minimum page size - probes read only totalResults
const MIN_TOKENS = 50;

const OUT_ASINS = "discovered_asins.txt";
const CHECKPOINT = ".discover_checkpoint.json";
const OUT_SUMMARY = "discover_summary.json";

const KEEPA_EPOCH_OFFSET = 21564000;
const nowKeepa = Math.floor(Date.now() / 60000) - KEEPA_EPOCH_OFFSET;

// Widened physical list: round-1 set plus the extras that added 75,400 books.
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

function baseSelection() {
  const sel = {
    rootCategory: BOOKS_ROOT,
    productType: 0,
    lastUpdate_gte: 0, // disable the silent 6-month default
    binding: PHYSICAL_BINDINGS,
  };
  if (SCOPE === "offers") sel.current_NEW_gte = 1;
  return sel;
}

if (!KEY) {
  console.error("KEEPA_API_KEY is empty. Put your key in the .env file.");
  process.exit(1);
}

// ------------------------------------------------------------------ state
const startedAt = Date.now();
const deadline = MAX_MINUTES ? startedAt + MAX_MINUTES * 60000 : Infinity;
let stopRequested = false;

let stack = []; // pending [lo, hi] ranges, LIFO
let asinsWritten = 0;
let bucketsDone = 0;
let probes = 0;
let harvests = 0;
let tokensSpent = 0;
let lastTokensLeft = null;
let grandTotal = null; // totalResults for the whole scope
const unresolvable = []; // single-minute ranges still over the cap

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
  const h = Math.floor(s / 3600);
  return `${String(h).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const fmt = (n) =>
  typeof n === "number" ? n.toLocaleString("en-IN") : String(n);

async function sleepInterruptible(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end && !shouldStop()) {
    await new Promise((r) => setTimeout(r, Math.min(1000, end - Date.now())));
  }
}

const asinStream = fs.createWriteStream(OUT_ASINS, { flags: "a" });

// ------------------------------------------------------------------ API
async function query(lo, hi, perPage) {
  const selection = {
    ...baseSelection(),
    trackingSince_gte: lo,
    trackingSince_lte: hi,
    perPage,
    page: 0,
  };

  let backoff = 5000;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (shouldStop()) return null;

    let res, data;
    try {
      res = await fetch(
        `${BASE}/query?${new URLSearchParams({ key: KEY, domain: DOMAIN, selection: JSON.stringify(selection) })}`,
      );
      data = await res.json();
    } catch (e) {
      console.log(
        `  [${elapsed()}] network error (${e.message}), retrying in 10s`,
      );
      await sleepInterruptible(10000);
      continue;
    }

    if (typeof data.tokensLeft === "number") lastTokensLeft = data.tokensLeft;

    if (res.status === 429 || res.status >= 500) {
      const wait = Math.max(backoff, (data.refillIn || 60000) + 1000);
      console.log(
        `  [${elapsed()}] HTTP ${res.status}, waiting ${Math.round(wait / 1000)}s`,
      );
      await sleepInterruptible(wait);
      backoff *= 2;
      continue;
    }

    tokensSpent += data.tokensConsumed || 0;

    if (!res.ok) {
      console.log(
        `  [${elapsed()}] error on [${lo},${hi}]: ${JSON.stringify(data.error || data).slice(0, 180)}`,
      );
      return { failed: true };
    }

    // Keepa executes requests on a near-empty bucket and lets the balance go
    // negative, so throttle on tokensLeft rather than waiting for a 429.
    if (typeof data.tokensLeft === "number" && data.tokensLeft < MIN_TOKENS) {
      const wait = (data.refillIn || 60000) + 1000;
      console.log(
        `  [${elapsed()}] bucket low (${data.tokensLeft}), sleeping ${Math.round(wait / 1000)}s`,
      );
      await sleepInterruptible(wait);
    }

    return { total: data.totalResults, asins: data.asinList || [] };
  }
  return { failed: true };
}

// ------------------------------------------------------------------ bisect
async function run() {
  while (stack.length && !shouldStop()) {
    const [lo, hi] = stack.pop();

    // Probe cheaply for the count.
    const probe = await query(lo, hi, PROBE_PER_PAGE);
    if (!probe) break;
    probes++;
    if (probe.failed) continue;

    const total = probe.total || 0;

    if (total === 0) {
      bucketsDone++;
      continue;
    }

    if (total <= BUCKET_TARGET) {
      // Fits. Harvest the whole bucket in one request (page 0 allows perPage 10,000).
      const harvest = await query(
        lo,
        hi,
        Math.min(HARD_CAP, Math.max(50, total)),
      );
      if (!harvest) break;
      harvests++;
      if (harvest.failed) continue;

      if (harvest.asins.length) {
        asinStream.write(harvest.asins.join("\n") + "\n");
        asinsWritten += harvest.asins.length;
      }

      // Counts drift between calls; if we hit the cap with more outstanding, split.
      if (
        harvest.total > harvest.asins.length &&
        harvest.asins.length >= HARD_CAP
      ) {
        const mid = Math.floor((lo + hi) / 2);
        if (hi > lo) stack.push([lo, mid], [mid + 1, hi]);
      }

      bucketsDone++;
      report(lo, hi, total, harvest.asins.length);
      checkpoint();
      continue;
    }

    // Too big. Halve it.
    if (hi <= lo) {
      // A single trackingSince minute holding more than the cap. Take what we
      // can and record the shortfall rather than looping forever.
      const harvest = await query(lo, hi, HARD_CAP);
      if (harvest && !harvest.failed && harvest.asins.length) {
        asinStream.write(harvest.asins.join("\n") + "\n");
        asinsWritten += harvest.asins.length;
        harvests++;
      }
      unresolvable.push({
        minute: lo,
        total,
        retrieved: HARD_CAP,
        lost: total - HARD_CAP,
      });
      console.log(
        `  [${elapsed()}] ! minute ${lo} holds ${fmt(total)}; ${fmt(total - HARD_CAP)} unreachable`,
      );
      bucketsDone++;
      checkpoint();
      continue;
    }

    const mid = Math.floor((lo + hi) / 2);
    stack.push([lo, mid], [mid + 1, hi]);
  }
}

function report(lo, hi, total, got) {
  const pctDone = grandTotal
    ? ((asinsWritten / grandTotal) * 100).toFixed(2)
    : "?";
  const rate = asinsWritten / Math.max(1, (Date.now() - startedAt) / 60000);
  const remaining = grandTotal
    ? (grandTotal - asinsWritten) / Math.max(1, rate)
    : null;
  console.log(
    `  [${elapsed()}] bucket ${String(bucketsDone).padStart(5)} | +${String(got).padStart(5)} | ` +
      `total ${fmt(asinsWritten).padStart(12)} (${pctDone}%) | queue ${String(stack.length).padStart(4)} | ` +
      `tokens ${fmt(tokensSpent)} | left ${lastTokensLeft}` +
      (remaining ? ` | eta ${(remaining / 60).toFixed(1)}h` : ""),
  );
}

function checkpoint() {
  fs.writeFileSync(
    CHECKPOINT,
    JSON.stringify({
      scope: SCOPE,
      stack,
      asinsWritten,
      bucketsDone,
      probes,
      harvests,
      tokensSpent,
      grandTotal,
      unresolvable,
    }),
  );
}

// ------------------------------------------------------------------ main
async function main() {
  console.log(`Discovery via trackingSince bisection - amazon.in books`);
  console.log(
    `Scope: ${SCOPE === "offers" ? "in-stock only (current_NEW_gte 1)" : "all physical books, all time"}`,
  );
  console.log(`Now = keepa minute ${nowKeepa}\n`);

  if (fs.existsSync(CHECKPOINT)) {
    const st = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
    if (st.scope !== SCOPE) {
      console.error(
        `Checkpoint is for scope "${st.scope}" but you asked for "${SCOPE}".`,
      );
      console.error(`Delete ${CHECKPOINT} and ${OUT_ASINS} to start fresh.`);
      process.exit(1);
    }
    ({
      stack,
      asinsWritten,
      bucketsDone,
      probes,
      harvests,
      tokensSpent,
      grandTotal,
    } = st);
    unresolvable.push(...(st.unresolvable || []));
    console.log(
      `Resuming: ${fmt(asinsWritten)} ASINs written, ${stack.length} ranges queued\n`,
    );
  } else {
    const root = await query(0, nowKeepa, PROBE_PER_PAGE);
    if (!root || root.failed) {
      console.error("Opening count query failed.");
      process.exit(1);
    }
    probes++;
    grandTotal = root.total;
    console.log(`Scope total: ${fmt(grandTotal)} books`);
    console.log(
      `Expect ~${fmt(Math.ceil(grandTotal / BUCKET_TARGET))} buckets, ~${fmt(Math.ceil(grandTotal / BUCKET_TARGET) * 132)} tokens\n`,
    );
    stack = [[0, nowKeepa]];
  }

  await run();
  summarise();
}

function summarise() {
  asinStream.end();
  const minutes = (Date.now() - startedAt) / 60000;
  const lost = unresolvable.reduce((s, u) => s + u.lost, 0);

  console.log("\n==================== DISCOVERY SUMMARY ====================");
  console.log(`Scope                  : ${SCOPE}`);
  console.log(`Run time               : ${minutes.toFixed(1)} min`);
  console.log(`Scope total (expected) : ${fmt(grandTotal)}`);
  console.log(`ASINs written          : ${fmt(asinsWritten)}`);
  if (grandTotal)
    console.log(
      `Coverage               : ${((asinsWritten / grandTotal) * 100).toFixed(2)}%`,
    );
  console.log(`Buckets completed      : ${fmt(bucketsDone)}`);
  console.log(`Ranges still queued    : ${fmt(stack.length)}`);
  console.log(`Probe requests         : ${fmt(probes)}`);
  console.log(`Harvest requests       : ${fmt(harvests)}`);
  console.log(`Tokens spent           : ${fmt(tokensSpent)}`);
  console.log(
    `Tokens per 1,000 ASINs : ${asinsWritten ? ((tokensSpent / asinsWritten) * 1000).toFixed(1) : "-"}`,
  );
  console.log(`Tokens left now        : ${lastTokensLeft}`);
  if (unresolvable.length) {
    console.log(
      `\n! ${unresolvable.length} single-minute buckets exceeded the cap`,
    );
    console.log(
      `  Books unreachable    : ${fmt(lost)} (${grandTotal ? ((lost / grandTotal) * 100).toFixed(3) : "?"}%)`,
    );
    console.log(`  These need a secondary split (price or publicationDate).`);
  }
  if (stack.length)
    console.log(`\nIncomplete - re-run to resume from ${CHECKPOINT}`);
  console.log("===========================================================");

  fs.writeFileSync(
    OUT_SUMMARY,
    JSON.stringify(
      {
        scope: SCOPE,
        runMinutes: +minutes.toFixed(1),
        grandTotal,
        asinsWritten,
        bucketsDone,
        queued: stack.length,
        probes,
        harvests,
        tokensSpent,
        tokensPer1000: asinsWritten
          ? +((tokensSpent / asinsWritten) * 1000).toFixed(2)
          : null,
        unresolvable,
        complete: stack.length === 0,
      },
      null,
      2,
    ),
  );
  console.log(`\nSummary saved to ${OUT_SUMMARY}`);
  console.log(`ASINs in ${OUT_ASINS}`);
}

main().catch((e) => {
  console.error("\nERROR:", e.message);
  summarise();
  process.exit(1);
});
