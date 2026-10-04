/**
 * ============================================================================
 *  KEEPA COLLECTOR - amazon.in physical books, in stock, 0-N reviews
 *  Built to run unattended for weeks. Uses one or two Keepa API keys.
 * ============================================================================
 *
 * WHAT IT DOES
 *   Finds every in-stock physical book on amazon.in with 0-N reviews and
 *   writes isbn13, isbn10, title, sale price, MRP and review count to CSV.
 *
 * WHY TWO PASSES
 *   Keepa joins filters with AND and has no OR, and a missing value is not
 *   the same as zero - so "<= N reviews" silently skips every book with no
 *   reviews at all. "0 to N" therefore needs:
 *     PASS 1  current_COUNT_REVIEWS_lte: N   -> 1-N reviews
 *     PASS 2  hasReviews: false              -> 0 reviews
 *
 * HOW DISCOVERY WORKS
 *   Sales rank reaches only 3.5% of books and categories only 21%, so neither
 *   can enumerate the catalogue. trackingSince is present on 100% of products
 *   and is single-valued, so ranges bisect cleanly and never overlap - which
 *   also means no deduplication and no giant in-memory Set.
 *
 * TWO KEYS
 *   If KEEPA_API_KEY_2 is set, every request goes to whichever key is rested
 *   and has the most tokens. When one key runs low it rests for a refill
 *   while the other keeps working. One process, one checkpoint, one CSV.
 *
 * HARDENING (this is the "runs for weeks" part)
 *   - every fetch has a hard timeout; Node's fetch otherwise hangs forever
 *   - atomic checkpoint writes with a .bak fallback if one is truncated
 *   - bounded retries with exponential backoff; never an infinite spin
 *   - aborts cleanly after too many consecutive failures instead of looping
 *   - uncaughtException / unhandledRejection are caught, state saved, exit 1
 *   - SIGINT and SIGTERM both finish the current batch, then save
 *   - appends to a log file so you can see what happened overnight
 *   - refuses to resume into a different scope
 *
 * USAGE
 *   node keepa_collect.js --count                 size it first (~90 tokens)
 *   MAX_MINUTES=30 node keepa_collect.js          trial run
 *   PASS=1 caffeinate -i node keepa_collect.js    pass 1 only (recommended)
 *   caffeinate -i node keepa_collect.js           both passes
 *   node keepa_collect.js --status                progress, from any terminal
 *   node keepa_collect.js --dedupe                clean the CSV when finished
 *
 * AUTO-RESTART (recommended for long runs)
 *   while true; do node keepa_collect.js; sleep 60; done
 *   It resumes from the checkpoint, so a restart is always safe.
 *
 * ENV
 *   KEEPA_API_KEY   required
 *   KEEPA_API_KEY_2 optional second key (separate account, separate tokens)
 *   REVIEW_MAX      review ceiling, default 20
 *   PASS            1 or 2 to run a single pass
 *   MAX_MINUTES     stop after N minutes
 *   TOKEN_RATE      combined tokens/min of your keys, for estimates only
 *                   (default 60)
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

// ============================================================== CONFIG
const KEYS = [
  ...new Set(
    [process.env.KEEPA_API_KEY, process.env.KEEPA_API_KEY_2]
      .map((k) => (k || "").trim())
      .filter(Boolean),
  ),
];
const KEY = KEYS[0] || ""; // preflight checks this
const keyState = KEYS.map(() => ({ left: null, readyAt: 0 }));

const BASE = "https://api.keepa.com";
const DOMAIN = 10; // amazon.in
const BOOKS_ROOT = 976389031; // Books

const REVIEW_MAX = Number(process.env.REVIEW_MAX || 20);
const ONLY_PASS = Number(process.env.PASS || 0) || null;
const MAX_MINUTES = Number(process.env.MAX_MINUTES || 0) || null;
const TOKEN_RATE = Number(process.env.TOKEN_RATE || 60);

const BUCKET_TARGET = 9500; // headroom below Keepa's 10,000 paging cap
const HARD_CAP = 10000;
const PROBE_PER_PAGE = 50; // cheapest probe: totalResults only
const LOOKUP_BATCH = 100; // max ASINs per product request
const MIN_TOKENS = 120; // keep one batch in reserve (per key)

const FETCH_TIMEOUT_MS = 120000; // no Keepa call may hang longer than this
const MAX_ATTEMPTS = 8; // per request
const MAX_BACKOFF_MS = 600000; // 10 min ceiling
const MAX_CONSECUTIVE_FAILURES = 25;
const MAX_STACK = 200000; // sanity guard on the range queue

const OUT_CSV = "books.csv";
const CHECKPOINT = ".collect_checkpoint.json";
const CHECKPOINT_BAK = ".collect_checkpoint.bak.json";
const OUT_SUMMARY = "collect_summary.json";
const LOG_FILE = "collect.log";

const KEEPA_EPOCH_OFFSET = 21564000;
const nowKeepa = () => Math.floor(Date.now() / 60000) - KEEPA_EPOCH_OFFSET;

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

/**
 * productType: 0            physical only - removes 8.3M ebooks
 * lastUpdate_gte: 0         disables Keepa's silent 6-month cutoff (hides 23%)
 * binding                   POSITIVE list. Never use the exclusion prefix: it
 *                           only matches books that HAVE a binding value, so
 *                           it silently passes everything with an empty field.
 * current_BUY_BOX_SHIPPING  a Buy Box exists only when something is buyable
 *                           right now = in stock, with a real seller
 */
const BOOKS_ONLY = {
  rootCategory: BOOKS_ROOT,
  productType: 0,
  lastUpdate_gte: 0,
  binding: PHYSICAL_BINDINGS,
};
const BASE_FILTERS = { ...BOOKS_ONLY, current_BUY_BOX_SHIPPING_gte: 1 };

const PASSES = [
  {
    n: 1,
    label: `1-${REVIEW_MAX} reviews`,
    filters: { ...BASE_FILTERS, current_COUNT_REVIEWS_lte: REVIEW_MAX },
  },
  { n: 2, label: "0 reviews", filters: { ...BASE_FILTERS, hasReviews: false } },
];

// ============================================================== STATE
const startedAt = Date.now();
const deadline = MAX_MINUTES ? startedAt + MAX_MINUTES * 60000 : Infinity;

let stopRequested = false;
let fatal = null;

const S = {
  reviewMax: REVIEW_MAX,
  baseFilters: BASE_FILTERS,
  passIndex: 0,
  stack: [], // pending [lo, hi] trackingSince ranges
  pending: [], // harvested ASINs not yet looked up
  booksWritten: 0,
  bucketsDone: 0,
  tokensSpent: 0,
  passTotals: {},
  passWritten: {},
  withPrice: 0,
  withMrp: 0,
  withTitle: 0,
  skippedNoIsbn: 0, // B0-style ASINs dropped before lookup, saving a token each
  unresolvable: [],
};

let lastTokensLeft = null; // combined across all keys
let consecutiveFailures = 0;
let requestsMade = 0;

// ============================================================== LOGGING
let logStream = null;
try {
  logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  logStream.on("error", () => {
    logStream = null;
  }); // never let logging kill the run
} catch {
  /* console only */
}

const fmt = (n) =>
  typeof n === "number" && isFinite(n) ? n.toLocaleString("en-IN") : "-";

function elapsed() {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const d = Math.floor(s / 86400);
  const h = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${d ? d + "d " : ""}${h}:${m}:${sec}`;
}

function log(msg) {
  const line = `[${new Date().toISOString()}] [${elapsed()}] ${msg}`;
  console.log(line);
  try {
    logStream && logStream.write(line + "\n");
  } catch {
    /* ignore */
  }
}

// ============================================================== SAFE IO
/** Write JSON atomically: temp file, fsync, rename. A crash can never
 *  leave a half-written checkpoint behind. */
function writeJsonAtomic(file, obj) {
  const tmp = file + ".tmp";
  try {
    const data = JSON.stringify(obj);
    const fd = fs.openSync(tmp, "w");
    try {
      fs.writeFileSync(fd, data);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (fs.existsSync(file)) {
      try {
        fs.copyFileSync(file, CHECKPOINT_BAK);
      } catch {
        /* best effort */
      }
    }
    fs.renameSync(tmp, file);
    return true;
  } catch (e) {
    log(`WARN: could not write ${file}: ${e.message}`);
    try {
      fs.existsSync(tmp) && fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    return false;
  }
}

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (e) {
    log(`WARN: ${file} unreadable (${e.message})`);
    return null;
  }
}

function checkpoint() {
  writeJsonAtomic(CHECKPOINT, S);
}

function appendCsv(lines) {
  // Retry a few times: a transient EBUSY or ENOSPC should not lose a batch.
  for (let i = 0; i < 3; i++) {
    try {
      fs.appendFileSync(OUT_CSV, lines.join("\n") + "\n", "utf8");
      return true;
    } catch (e) {
      log(`WARN: CSV append failed (${e.message}), retry ${i + 1}/3`);
      sleepSync(2000);
    }
  }
  log(
    "ERROR: could not write to CSV after 3 attempts. Stopping to avoid data loss.",
  );
  stopRequested = true;
  return false;
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* deliberate block, only on the IO error path */
  }
}

// ============================================================== HELPERS
const rupees = (v) =>
  Number.isInteger(v) && v > 0 ? +(v / 100).toFixed(2) : "";
const isIsbn10 = (a) => typeof a === "string" && /^\d{9}[\dX]$/.test(a);

function isbn10to13(isbn10) {
  try {
    const core = "978" + isbn10.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
    return core + ((10 - (sum % 10)) % 10);
  } catch {
    return "";
  }
}

const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const HEADERS = [
  "isbn13",
  "isbn10",
  "title",
  "sale_price",
  "mrp",
  "discount_pct",
  "review_count",
  "rating",
  "price_source",
  "pass",
];

const shouldStop = () => stopRequested || Date.now() >= deadline;

async function sleepInterruptible(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end && !shouldStop()) {
    await new Promise((r) =>
      setTimeout(r, Math.min(1000, Math.max(0, end - Date.now()))),
    );
  }
}

// ============================================================== API
async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Pick the rested key with the most tokens. If none is rested, wait for
 *  the one that will be ready soonest. Returns -1 if we are stopping. */
async function pickKey() {
  const tokens = (i) => (keyState[i].left === null ? 1e9 : keyState[i].left);
  while (!shouldStop()) {
    const now = Date.now();
    const ready = keyState
      .map((_, i) => i)
      .filter((i) => keyState[i].readyAt <= now);
    if (ready.length) {
      ready.sort((a, b) => tokens(b) - tokens(a));
      return ready[0];
    }
    const soonest = Math.min(...keyState.map((k) => k.readyAt));
    await sleepInterruptible(soonest - now);
  }
  return -1;
}

/** Returns the parsed body, or { failed: true }, or null if we are stopping. */
async function apiCall(endpoint, params, label) {
  let backoff = 5000;
  let rateWaits = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ki = await pickKey();
    if (ki < 0 || shouldStop()) return null;
    const ks = keyState[ki];
    const tag = `${label} [key ${ki + 1}]`;

    let res, data;
    try {
      const url = `${BASE}/${endpoint}?${new URLSearchParams({ key: KEYS[ki], ...params })}`;
      res = await fetchWithTimeout(url);
      data = await res.json();
    } catch (e) {
      const why =
        e.name === "AbortError"
          ? `timeout after ${FETCH_TIMEOUT_MS / 1000}s`
          : e.message;
      log(
        `  network issue on ${tag}: ${why} (attempt ${attempt}/${MAX_ATTEMPTS})`,
      );
      await sleepInterruptible(backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      continue;
    }

    if (data && typeof data.tokensLeft === "number") {
      ks.left = data.tokensLeft;
      lastTokensLeft = keyState.reduce((a, k) => a + (k.left || 0), 0);
    }
    const refill = ((data && data.refillIn) || 60000) + 1000;

    // Rate limited: rest THIS key and carry on with the other one.
    // Being rate limited is not a failure, so it does not use up an attempt
    // (capped so a permanently limited key can never spin forever).
    if (res.status === 429) {
      ks.readyAt = Date.now() + refill;
      if (++rateWaits <= 60) attempt--;
      continue;
    }

    // Keepa-side wobble: wait it out.
    if (res.status >= 500) {
      log(
        `  HTTP ${res.status} on ${tag}, waiting ${Math.round(backoff / 1000)}s`,
      );
      await sleepInterruptible(backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      continue;
    }

    requestsMade++;
    S.tokensSpent += (data && data.tokensConsumed) || 0;

    if (!res.ok) {
      consecutiveFailures++;
      log(
        `  HTTP ${res.status} on ${tag}: ${JSON.stringify((data && data.error) || data).slice(0, 200)}`,
      );
      return { failed: true };
    }

    consecutiveFailures = 0;

    // Keepa runs requests even on an empty bucket and lets the balance go
    // negative, so rest a key on tokensLeft instead of waiting for a 429.
    // Only this key rests; the other keeps working.
    if (ks.left !== null && ks.left < MIN_TOKENS) {
      ks.readyAt = Date.now() + refill;
    }

    return data;
  }

  consecutiveFailures++;
  log(`  gave up on ${label} after ${MAX_ATTEMPTS} attempts`);
  return { failed: true };
}

async function finderQuery(filters, lo, hi, perPage) {
  const selection = {
    ...filters,
    trackingSince_gte: lo,
    trackingSince_lte: hi,
    perPage,
    page: 0,
  };
  const d = await apiCall(
    "query",
    { domain: DOMAIN, selection: JSON.stringify(selection) },
    `range[${lo},${hi}]`,
  );
  if (!d) return null;
  if (d.failed) return { failed: true };
  return {
    total: Number.isFinite(d.totalResults) ? d.totalResults : 0,
    asins: Array.isArray(d.asinList) ? d.asinList : [],
  };
}

async function countOf(filters) {
  const r = await finderQuery(filters, 0, nowKeepa(), PROBE_PER_PAGE);
  return r && !r.failed ? r.total : null;
}

// ============================================================== COLLECT
async function collectBatch(batch, passNo) {
  const d = await apiCall(
    "product",
    {
      domain: DOMAIN,
      asin: batch.join(","),
      stats: 1,
      history: 0, // metadata only: holds the cost at 1 token per ASIN
    },
    `lookup x${batch.length}`,
  );

  if (!d) return "stop";
  if (d.failed) return "skip";

  const lines = [];
  const products = Array.isArray(d.products) ? d.products : [];

  for (const p of products) {
    try {
      if (!p || typeof p.asin !== "string") continue;

      const stats = p.stats || {};
      const cur = Array.isArray(stats.current) ? stats.current : [];

      const buyBox = rupees(cur[18]); // BUY_BOX_SHIPPING
      const amazon = rupees(cur[0]); // AMAZON
      const newLow = rupees(cur[1]); // NEW
      const mrp = rupees(cur[4]); // LISTPRICE

      let sale = "",
        source = "";
      if (buyBox !== "") {
        sale = buyBox;
        source = "buybox";
      } else if (amazon !== "") {
        sale = amazon;
        source = "amazon";
      } else if (newLow !== "") {
        sale = newLow;
        source = "lowest_new";
      }

      const discount =
        mrp !== "" && sale !== "" && mrp > sale
          ? +(((mrp - sale) / mrp) * 100).toFixed(1)
          : "";

      // Pass 2 is the no-review pass, so a missing count genuinely means zero.
      let reviews = Number.isInteger(cur[17]) && cur[17] > 0 ? cur[17] : "";
      if (reviews === "" && passNo === 2) reviews = 0;

      const rating =
        Number.isInteger(cur[16]) && cur[16] > 0
          ? +(cur[16] / 10).toFixed(1)
          : "";

      if (sale !== "") S.withPrice++;
      if (mrp !== "") S.withMrp++;
      if (p.title) S.withTitle++;

      const ten = isIsbn10(p.asin) ? p.asin : "";
      lines.push(
        [
          ten ? isbn10to13(ten) : "",
          ten,
          p.title || "",
          sale,
          mrp,
          discount,
          reviews,
          rating,
          source,
          passNo,
        ]
          .map(csvCell)
          .join(","),
      );
    } catch (e) {
      log(`  WARN: skipped a malformed product record (${e.message})`);
    }
  }

  if (lines.length) {
    if (!appendCsv(lines)) return "stop";
    S.booksWritten += lines.length;
    S.passWritten[passNo] = (S.passWritten[passNo] || 0) + lines.length;
  }
  return "ok";
}

// ============================================================== ONE PASS
async function runPass(pass) {
  log(
    `--- PASS ${pass.n}: ${pass.label} (${fmt(S.passTotals[pass.n])} books) ---`,
  );

  while ((S.stack.length || S.pending.length) && !shouldStop()) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      log(
        `ERROR: ${consecutiveFailures} failures in a row. Stopping - check your keys, plan and network.`,
      );
      stopRequested = true;
      break;
    }

    // Drain harvested ASINs before discovering more.
    while (S.pending.length && !shouldStop()) {
      const batch = S.pending.slice(0, LOOKUP_BATCH);
      const result = await collectBatch(batch, pass.n);

      if (result === "stop") break; // leave pending intact for resume
      S.pending.splice(0, batch.length); // only drop after a real outcome
      checkpoint();

      if (S.booksWritten % 2000 < LOOKUP_BATCH) report(pass);
    }
    if (shouldStop() || !S.stack.length) break;

    if (S.stack.length > MAX_STACK) {
      log(
        `ERROR: range queue exceeded ${MAX_STACK}. Aborting rather than thrashing.`,
      );
      stopRequested = true;
      break;
    }

    const [lo, hi] = S.stack.pop();

    const probe = await finderQuery(pass.filters, lo, hi, PROBE_PER_PAGE);
    if (!probe) {
      S.stack.push([lo, hi]); // stopping mid-probe: keep the range for resume
      break;
    }
    if (probe.failed) {
      S.stack.push([lo, hi]);
      await sleepInterruptible(5000);
      continue;
    }

    const total = probe.total;
    if (total === 0) {
      S.bucketsDone++;
      continue;
    }

    if (total > BUCKET_TARGET) {
      if (hi > lo) {
        const mid = Math.floor((lo + hi) / 2);
        S.stack.push([lo, mid], [mid + 1, hi]);
        continue;
      }
      // One trackingSince minute holding more than the cap: take what we can.
      const h = await finderQuery(pass.filters, lo, hi, HARD_CAP);
      if (h && !h.failed && h.asins.length) {
        const keep = h.asins.filter(isIsbn10);
        S.skippedNoIsbn += h.asins.length - keep.length;
        S.pending.push(...keep);
      }
      S.unresolvable.push({
        pass: pass.n,
        minute: lo,
        total,
        lost: total - HARD_CAP,
      });
      log(
        `  ! minute ${lo}: ${fmt(total)} books, ${fmt(total - HARD_CAP)} unreachable`,
      );
      S.bucketsDone++;
      checkpoint();
      continue;
    }

    const harvest = await finderQuery(
      pass.filters,
      lo,
      hi,
      Math.min(HARD_CAP, Math.max(PROBE_PER_PAGE, total)),
    );
    if (!harvest) {
      S.stack.push([lo, hi]); // stopping mid-harvest: keep the range for resume
      break;
    }
    if (harvest.failed) {
      S.stack.push([lo, hi]);
      await sleepInterruptible(5000);
      continue;
    }

    // Counts drift between probe and harvest. If we filled the page and more
    // remain, resplit WITHOUT keeping these - otherwise the halves re-emit them.
    if (
      harvest.asins.length >= HARD_CAP &&
      harvest.total > harvest.asins.length &&
      hi > lo
    ) {
      const mid = Math.floor((lo + hi) / 2);
      S.stack.push([lo, mid], [mid + 1, hi]);
      continue;
    }

    // Only ISBN-bearing ASINs are worth a lookup token. For print books the
    // ASIN is the ISBN-10; a B0-style ASIN means Amazon never assigned one,
    // so the row would come back with both ISBN columns empty.
    const withIsbn = harvest.asins.filter(isIsbn10);
    S.skippedNoIsbn += harvest.asins.length - withIsbn.length;
    S.pending.push(...withIsbn);
    S.bucketsDone++;
    checkpoint();
  }
}

function report(pass) {
  const mins = (Date.now() - startedAt) / 60000;
  const rate = S.booksWritten / Math.max(1, mins);
  const grand = Object.values(S.passTotals).reduce((a, b) => a + b, 0);
  const eta =
    rate > 0 && grand ? (grand - S.booksWritten) / rate / 60 / 24 : null;
  log(
    `p${pass.n} ${fmt(S.booksWritten).padStart(10)} books` +
      (grand ? ` (${((S.booksWritten / grand) * 100).toFixed(2)}%)` : "") +
      ` | ${Math.round(rate)}/min | q ${S.stack.length}/${S.pending.length}` +
      ` | tokens ${fmt(S.tokensSpent)} left ${lastTokensLeft}` +
      (eta && eta > 0 ? ` | eta ${eta.toFixed(1)}d` : ""),
  );
}

// ============================================================== MODES
const daysFor = (books, rate) => (books * 1.0178) / (rate * 60 * 24);
const timeLabel = (d) =>
  d < 1
    ? `${(d * 24).toFixed(1)} hrs`
    : d < 60
      ? `${d.toFixed(1)} days`
      : `${(d / 30.4).toFixed(1)} months`;

async function countOnly() {
  console.log(`Scope - amazon.in books, in stock, 0-${REVIEW_MAX} reviews`);
  console.log(`Using ${KEYS.length} API key(s)\n`);
  const all = await countOf(BOOKS_ONLY);
  const inStock = await countOf(BASE_FILTERS);
  const tooMany = await countOf({
    ...BASE_FILTERS,
    current_COUNT_REVIEWS_gte: REVIEW_MAX + 1,
  });
  const p1 = await countOf(PASSES[0].filters);
  const p2 = await countOf(PASSES[1].filters);
  const grand = (p1 || 0) + (p2 || 0);

  console.log(`  All physical books        ${fmt(all).padStart(14)}`);
  console.log(
    `  ...in stock               ${fmt(inStock).padStart(14)}   -${fmt(all - inStock)}`,
  );
  console.log(
    `  ...minus ${REVIEW_MAX + 1}+ reviews     ${fmt(inStock - tooMany).padStart(14)}   -${fmt(tooMany)}\n`,
  );
  console.log(
    `  PASS 1  ${PASSES[0].label.padEnd(16)} ${fmt(p1).padStart(14)}   ${timeLabel(daysFor(p1, TOKEN_RATE))}`,
  );
  console.log(
    `  PASS 2  ${PASSES[1].label.padEnd(16)} ${fmt(p2).padStart(14)}   ${timeLabel(daysFor(p2, TOKEN_RATE))}`,
  );
  console.log(
    `  TOTAL   ${`0-${REVIEW_MAX} reviews`.padEnd(16)} ${fmt(grand).padStart(14)}   ${timeLabel(daysFor(grand, TOKEN_RATE))}\n`,
  );

  const rebuilt = grand + (tooMany || 0);
  const drift = inStock ? Math.abs(rebuilt - inStock) / inStock : 1;
  console.log(
    drift < 0.02
      ? `  Reconciles: ${fmt(rebuilt)} vs ${fmt(inStock)} in stock.`
      : `  ! ${(drift * 100).toFixed(1)}% drift - some books fall outside both passes.`,
  );

  console.log(`\n  Tokens spent: ${S.tokensSpent}`);
  keyState.forEach((k, i) =>
    console.log(
      `  Key ${i + 1} tokens left: ${k.left === null ? "not used" : k.left}`,
    ),
  );
}

function statusOnly() {
  const s = readJsonSafe(CHECKPOINT) || readJsonSafe(CHECKPOINT_BAK);
  if (!s) return console.log("No run in progress.");
  const grand = Object.values(s.passTotals || {}).reduce((a, b) => a + b, 0);
  console.log(`Scope         : 0-${s.reviewMax} reviews, in stock`);
  console.log(`Pass          : ${s.passIndex + 1} of ${PASSES.length}`);
  console.log(
    `Books written : ${fmt(s.booksWritten)} of ${fmt(grand)} (${grand ? ((s.booksWritten / grand) * 100).toFixed(2) : "?"}%)`,
  );
  for (const [p, n] of Object.entries(s.passWritten || {})) {
    console.log(`  pass ${p}      : ${fmt(n)} of ${fmt(s.passTotals[p])}`);
  }
  console.log(
    `Buckets done  : ${fmt(s.bucketsDone)}   ranges queued: ${(s.stack || []).length}`,
  );
  console.log(`Tokens spent  : ${fmt(s.tokensSpent)}`);
  if (s.unresolvable && s.unresolvable.length) {
    const lost = s.unresolvable.reduce((a, u) => a + u.lost, 0);
    console.log(
      `Unreachable   : ${fmt(lost)} books in ${s.unresolvable.length} oversized minutes`,
    );
  }
}

/** Rewrite the CSV keeping the first occurrence of each ASIN. Buckets are
 *  disjoint so duplicates should not occur, but a crash between the CSV
 *  append and the checkpoint can repeat up to one batch. */
function dedupe() {
  if (!fs.existsSync(OUT_CSV)) return console.log("No CSV yet.");
  const lines = fs.readFileSync(OUT_CSV, "utf8").split("\n");
  const seen = new Set();
  const out = [];
  let dropped = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (i === 0) {
      out.push(line);
      continue;
    }
    const key = line.split(",", 2).join(",");
    if (seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    out.push(line);
  }
  fs.writeFileSync(OUT_CSV + ".dedup", out.join("\n") + "\n", "utf8");
  console.log(
    `Kept ${fmt(out.length - 1)} rows, removed ${fmt(dropped)} duplicates.`,
  );
  console.log(`Written to ${OUT_CSV}.dedup`);
}

// ============================================================== ENTRY
function installSignalHandlers() {
  const onSignal = (sig) => {
    if (stopRequested) {
      log(`${sig} again - forcing exit.`);
      process.exit(130);
    }
    stopRequested = true;
    log(
      `${sig} received. Finishing the current batch, then saving. (again to force)`,
    );
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

  const onFatal = (kind) => (err) => {
    fatal = err;
    try {
      log(`FATAL (${kind}): ${(err && err.stack) || err}`);
      checkpoint();
      writeSummary();
    } catch {
      /* nothing left to do */
    }
    process.exit(1); // non-zero so an auto-restart loop picks it up
  };
  process.on("uncaughtException", onFatal("uncaughtException"));
  process.on("unhandledRejection", onFatal("unhandledRejection"));
}

function preflight() {
  if (!KEY) {
    console.error("KEEPA_API_KEY is empty. Put your key in the .env file.");
    process.exit(1);
  }
  if (!Number.isInteger(REVIEW_MAX) || REVIEW_MAX < 0) {
    console.error("REVIEW_MAX must be a non-negative integer.");
    process.exit(1);
  }

  // Fail now, not on day nine, if the directory is not writable.
  try {
    const probe = path.join(process.cwd(), ".write_probe");
    fs.writeFileSync(probe, "x");
    fs.unlinkSync(probe);
  } catch (e) {
    console.error(`Cannot write to ${process.cwd()}: ${e.message}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUT_CSV)) {
    fs.writeFileSync(OUT_CSV, "\uFEFF" + HEADERS.join(",") + "\n", "utf8");
  }
}

async function main() {
  if (process.argv.includes("--status")) return statusOnly();
  if (process.argv.includes("--dedupe")) return dedupe();

  preflight();

  // --count must never touch the live checkpoint, so it runs before the
  // fatal handlers (which save state) are installed.
  if (process.argv.includes("--count")) return countOnly();

  installSignalHandlers();

  log(
    `Keepa collector starting - amazon.in, in stock, 0-${REVIEW_MAX} reviews`,
  );
  log(`Using ${KEYS.length} API key(s).`);
  if (MAX_MINUTES) log(`Time-boxed to ${MAX_MINUTES} minutes.`);

  const todo = ONLY_PASS ? PASSES.filter((p) => p.n === ONLY_PASS) : PASSES;
  if (!todo.length) {
    console.error(`PASS=${ONLY_PASS} is not 1 or 2.`);
    process.exit(1);
  }

  const saved = readJsonSafe(CHECKPOINT) || readJsonSafe(CHECKPOINT_BAK);

  if (saved) {
    if (
      saved.reviewMax !== REVIEW_MAX ||
      JSON.stringify(saved.baseFilters) !== JSON.stringify(BASE_FILTERS)
    ) {
      console.error(
        `\nCheckpoint is for 0-${saved.reviewMax} reviews; you asked for 0-${REVIEW_MAX}.`,
      );
      console.error(
        `Delete ${CHECKPOINT} and ${OUT_CSV} to start the new scope.\n`,
      );
      process.exit(1);
    }
    Object.assign(S, saved);
    S.stack = Array.isArray(S.stack) ? S.stack : [];
    S.pending = Array.isArray(S.pending) ? S.pending : [];
    log(
      `Resuming pass ${S.passIndex + 1}: ${fmt(S.booksWritten)} books written, ${S.stack.length} ranges queued, ${S.pending.length} ASINs pending`,
    );
  } else {
    for (const pass of todo) {
      const n = await countOf(pass.filters);
      if (n === null) {
        console.error(
          "Opening count query failed. Check your key and connection.",
        );
        process.exit(1);
      }
      S.passTotals[pass.n] = n;
      log(`  PASS ${pass.n}  ${pass.label.padEnd(16)} ${fmt(n)}`);
    }
    const grand = Object.values(S.passTotals).reduce((a, b) => a + b, 0);
    log(
      `  TOTAL ${fmt(grand)} books, about ${timeLabel(daysFor(grand, TOKEN_RATE))} at ${TOKEN_RATE} tokens/min`,
    );
    S.passIndex = 0;
    S.stack = [[0, nowKeepa()]];
    checkpoint();
  }

  while (S.passIndex < todo.length && !shouldStop()) {
    await runPass(todo[S.passIndex]);
    if (shouldStop()) break;
    S.passIndex++;
    if (S.passIndex < todo.length) {
      S.stack = [[0, nowKeepa()]];
      S.pending = [];
      checkpoint();
    }
  }

  writeSummary(todo);
}

function writeSummary(todo = PASSES) {
  checkpoint();
  const mins = (Date.now() - startedAt) / 60000;
  const grand = Object.values(S.passTotals).reduce((a, b) => a + b, 0);
  const done =
    S.passIndex >= todo.length && !S.stack.length && !S.pending.length;

  const out = [];
  out.push("==================== SUMMARY ====================");
  out.push(`Scope             : 0-${REVIEW_MAX} reviews, in stock`);
  out.push(`Run time          : ${(mins / 60).toFixed(1)} hours`);
  out.push(`Books in scope    : ${fmt(grand)}`);
  out.push(
    `Books written     : ${fmt(S.booksWritten)}${grand ? ` (${((S.booksWritten / grand) * 100).toFixed(2)}%)` : ""}`,
  );
  for (const p of PASSES) {
    if (S.passTotals[p.n] === undefined) continue;
    out.push(
      `  pass ${p.n} (${p.label.padEnd(14)}): ${fmt(S.passWritten[p.n] || 0)} of ${fmt(S.passTotals[p.n])}`,
    );
  }
  out.push(`  with a title    : ${fmt(S.withTitle)}`);
  out.push(`  with a price    : ${fmt(S.withPrice)}`);
  out.push(`  with an MRP     : ${fmt(S.withMrp)}`);
  const seenAsins = S.booksWritten + S.skippedNoIsbn;
  out.push(
    `Skipped, no ISBN  : ${fmt(S.skippedNoIsbn)}${seenAsins ? ` (${((S.skippedNoIsbn / seenAsins) * 100).toFixed(1)}% of discovered)` : ""}`,
  );
  out.push(
    `Buckets done      : ${fmt(S.bucketsDone)}   queued: ${S.stack.length}`,
  );
  out.push(`API requests      : ${fmt(requestsMade)}`);
  out.push(
    `Tokens spent      : ${fmt(S.tokensSpent)}   left: ${lastTokensLeft}`,
  );
  out.push(
    `Books per minute  : ${(S.booksWritten / Math.max(1, mins)).toFixed(0)}`,
  );
  if (S.unresolvable.length) {
    const lost = S.unresolvable.reduce((a, u) => a + u.lost, 0);
    out.push(
      `! ${S.unresolvable.length} oversized minutes, ${fmt(lost)} books unreachable`,
    );
  }
  if (fatal) out.push(`! Ended on a fatal error: ${fatal.message || fatal}`);
  out.push(done ? "COMPLETE." : "Incomplete - run again to resume.");
  out.push("=================================================");
  out.forEach((l) => log(l));

  writeJsonAtomic(OUT_SUMMARY, {
    reviewMax: REVIEW_MAX,
    runHours: +(mins / 60).toFixed(2),
    passTotals: S.passTotals,
    passWritten: S.passWritten,
    booksWritten: S.booksWritten,
    withTitle: S.withTitle,
    withPrice: S.withPrice,
    withMrp: S.withMrp,
    bucketsDone: S.bucketsDone,
    queued: S.stack.length,
    requestsMade,
    tokensSpent: S.tokensSpent,
    unresolvable: S.unresolvable,
    complete: done,
    endedOnError: fatal ? String(fatal.message || fatal) : null,
  });
  log(`Data in ${OUT_CSV}, summary in ${OUT_SUMMARY}, log in ${LOG_FILE}`);
}

main().catch((e) => {
  log(`ERROR: ${(e && e.stack) || e}`);
  try {
    writeSummary();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
