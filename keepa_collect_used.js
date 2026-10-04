/**
 * ============================================================================
 *  KEEPA USED-BOOK COLLECTOR - amazon.in, runs on a SECOND Keepa account
 * ============================================================================
 *
 * Runs in parallel with keepa_collect.js. Nothing is shared:
 *   key         KEEPA_API_KEY_2           (separate token bucket)
 *   output      books_used.csv
 *   checkpoint  .used_checkpoint.json
 *   log         collect_used.log
 *
 * SCOPE
 *   Physical books on amazon.in, 1-20 reviews, with a live used offer
 *   (any condition), ISBN-bearing only.
 *
 *   current_BUY_BOX_SHIPPING is deliberately NOT used: the Buy Box tracks the
 *   NEW offer, so requiring it would hide books sold only second-hand.
 *
 * OUTPUT COLUMNS
 *   isbn13, isbn10, title, used_price, new_price, mrp, used_offers,
 *   saving_vs_new_pct
 *   used_price is the lowest used price across ALL conditions.
 *
 * USAGE
 *   node keepa_collect_used.js --count        size it (~11 tokens)
 *   node keepa_collect_used.js --status       progress
 *   node keepa_collect_used.js --dedupe       clean the CSV when finished
 *
 *   Long run (background, survives terminal close, auto-restarts):
 *   nohup caffeinate -i bash -c 'while true; do node keepa_collect_used.js; sleep 60; done' > runner_used.log 2>&1 &
 *
 *   Stop ONLY this run:   pkill -f 'keepa_collect_used'
 *   Stop ONLY new run:    pkill -f 'keepa_collect\.js'
 *   (plain "pkill -f keepa_collect" would kill BOTH)
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

// ============================================================== CONFIG
const KEY = (process.env.KEEPA_API_KEY_2 || "").trim();
const BASE = "https://api.keepa.com";
const DOMAIN = 10;
const BOOKS_ROOT = 976389031;

const REVIEW_MAX = Number(process.env.REVIEW_MAX || 20);
const MAX_MINUTES = Number(process.env.MAX_MINUTES || 0) || null;
const TOKEN_RATE = Number(process.env.TOKEN_RATE || 60);

const BUCKET_TARGET = 9500;
const HARD_CAP = 10000;
const PROBE_PER_PAGE = 50;
const LOOKUP_BATCH = 100;
const MIN_TOKENS = 120;

const FETCH_TIMEOUT_MS = 120000;
const MAX_ATTEMPTS = 8;
const MAX_BACKOFF_MS = 600000;
const MAX_CONSECUTIVE_FAILURES = 25;
const MAX_STACK = 200000;

const OUT_CSV = "books_used.csv";
const CHECKPOINT = ".used_checkpoint.json";
const CHECKPOINT_BAK = ".used_checkpoint.bak.json";
const OUT_SUMMARY = "collect_used_summary.json";
const LOG_FILE = "collect_used.log";

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

const FILTERS = {
  rootCategory: BOOKS_ROOT,
  productType: 0,
  lastUpdate_gte: 0, // disable the silent 6-month cutoff
  binding: PHYSICAL_BINDINGS, // positive list, never the "not" prefix
  current_COUNT_REVIEWS_lte: REVIEW_MAX, // 1-N reviews (missing != zero in Keepa)
  current_USED_gte: 1, // a live used offer, any condition
};

// ============================================================== STATE
const startedAt = Date.now();
const deadline = MAX_MINUTES ? startedAt + MAX_MINUTES * 60000 : Infinity;
let stopRequested = false;
let fatal = null;

const S = {
  reviewMax: REVIEW_MAX,
  filters: FILTERS,
  stack: [],
  pending: [],
  booksWritten: 0,
  bucketsDone: 0,
  tokensSpent: 0,
  grandTotal: null,
  skippedNoIsbn: 0,
  withUsed: 0,
  withNew: 0,
  usedCheaper: 0,
  unresolvable: [],
  done: false,
};

let lastTokensLeft = null;
let consecutiveFailures = 0;
let requestsMade = 0;

// ============================================================== LOGGING
let logStream = null;
try {
  logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  logStream.on("error", () => {
    logStream = null;
  });
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
  return `${d ? d + "d " : ""}${h}:${m}:${String(s % 60).padStart(2, "0")}`;
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
function writeJsonAtomic(file, obj) {
  const tmp = file + ".tmp";
  try {
    const fd = fs.openSync(tmp, "w");
    try {
      fs.writeFileSync(fd, JSON.stringify(obj));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (file === CHECKPOINT && fs.existsSync(file)) {
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
    return raw.trim() ? JSON.parse(raw) : null;
  } catch (e) {
    log(`WARN: ${file} unreadable (${e.message})`);
    return null;
  }
}

const checkpoint = () => writeJsonAtomic(CHECKPOINT, S);

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* IO error path only */
  }
}

function appendCsv(lines) {
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
  "used_price",
  "new_price",
  "mrp",
  "used_offers",
  "saving_vs_new_pct",
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

async function apiCall(endpoint, params, label) {
  let backoff = 5000;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (shouldStop()) return null;

    let res, data;
    try {
      res = await fetchWithTimeout(
        `${BASE}/${endpoint}?${new URLSearchParams({ key: KEY, ...params })}`,
      );
      data = await res.json();
    } catch (e) {
      const why =
        e.name === "AbortError"
          ? `timeout after ${FETCH_TIMEOUT_MS / 1000}s`
          : e.message;
      log(
        `  network issue on ${label}: ${why} (attempt ${attempt}/${MAX_ATTEMPTS})`,
      );
      await sleepInterruptible(backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      continue;
    }

    if (data && typeof data.tokensLeft === "number")
      lastTokensLeft = data.tokensLeft;

    if (res.status === 429 || res.status >= 500) {
      const wait = Math.max(backoff, ((data && data.refillIn) || 60000) + 1000);
      log(
        `  HTTP ${res.status} on ${label}, waiting ${Math.round(wait / 1000)}s`,
      );
      await sleepInterruptible(wait);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      continue;
    }

    requestsMade++;
    S.tokensSpent += (data && data.tokensConsumed) || 0;

    if (!res.ok) {
      consecutiveFailures++;
      log(
        `  HTTP ${res.status} on ${label}: ${JSON.stringify((data && data.error) || data).slice(0, 200)}`,
      );
      return { failed: true };
    }

    consecutiveFailures = 0;

    if (typeof data.tokensLeft === "number" && data.tokensLeft < MIN_TOKENS) {
      await sleepInterruptible((data.refillIn || 60000) + 1000);
    }
    return data;
  }
  consecutiveFailures++;
  log(`  gave up on ${label} after ${MAX_ATTEMPTS} attempts`);
  return { failed: true };
}

async function finderQuery(lo, hi, perPage) {
  const selection = {
    ...FILTERS,
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

// ============================================================== COLLECT
async function collectBatch(batch) {
  const d = await apiCall(
    "product",
    {
      domain: DOMAIN,
      asin: batch.join(","),
      stats: 1,
      history: 0,
    },
    `lookup x${batch.length}`,
  );

  if (!d) return "stop";
  if (d.failed) return "skip";

  const lines = [];
  for (const p of Array.isArray(d.products) ? d.products : []) {
    try {
      if (!p || !isIsbn10(p.asin)) continue;
      const cur = Array.isArray((p.stats || {}).current) ? p.stats.current : [];

      const used = rupees(cur[2]); // USED, lowest across all conditions
      const nw = rupees(cur[1]) !== "" ? rupees(cur[1]) : rupees(cur[0]); // NEW, else AMAZON
      const mrp = rupees(cur[4]); // LISTPRICE
      const usedOffers =
        Number.isInteger(cur[12]) && cur[12] > 0 ? cur[12] : "";
      const saving =
        used !== "" && nw !== "" && nw > used
          ? +(((nw - used) / nw) * 100).toFixed(1)
          : "";

      if (used !== "") S.withUsed++;
      if (nw !== "") S.withNew++;
      if (saving !== "") S.usedCheaper++;

      lines.push(
        [
          isbn10to13(p.asin),
          p.asin,
          p.title || "",
          used,
          nw,
          mrp,
          usedOffers,
          saving,
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
  }
  return "ok";
}

function queueIsbnOnly(asins) {
  const keep = asins.filter(isIsbn10);
  S.skippedNoIsbn += asins.length - keep.length;
  S.pending.push(...keep);
}

// ============================================================== MAIN LOOP
async function run() {
  while ((S.stack.length || S.pending.length) && !shouldStop()) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      log(
        `ERROR: ${consecutiveFailures} failures in a row. Stopping - check KEEPA_API_KEY_2, plan and network.`,
      );
      stopRequested = true;
      break;
    }

    while (S.pending.length && !shouldStop()) {
      const batch = S.pending.slice(0, LOOKUP_BATCH);
      const result = await collectBatch(batch);
      if (result === "stop") break;
      S.pending.splice(0, batch.length);
      checkpoint();
      if (S.booksWritten % 2000 < LOOKUP_BATCH) report();
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

    const probe = await finderQuery(lo, hi, PROBE_PER_PAGE);
    if (!probe) {
      S.stack.push([lo, hi]);
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
      const h = await finderQuery(lo, hi, HARD_CAP);
      if (h && !h.failed) queueIsbnOnly(h.asins);
      S.unresolvable.push({ minute: lo, total, lost: total - HARD_CAP });
      log(
        `  ! minute ${lo}: ${fmt(total)} books, ${fmt(total - HARD_CAP)} unreachable`,
      );
      S.bucketsDone++;
      checkpoint();
      continue;
    }

    const harvest = await finderQuery(
      lo,
      hi,
      Math.min(HARD_CAP, Math.max(PROBE_PER_PAGE, total)),
    );
    if (!harvest) {
      S.stack.push([lo, hi]);
      break;
    }
    if (harvest.failed) {
      S.stack.push([lo, hi]);
      await sleepInterruptible(5000);
      continue;
    }

    if (
      harvest.asins.length >= HARD_CAP &&
      harvest.total > harvest.asins.length &&
      hi > lo
    ) {
      const mid = Math.floor((lo + hi) / 2);
      S.stack.push([lo, mid], [mid + 1, hi]);
      continue;
    }

    queueIsbnOnly(harvest.asins);
    S.bucketsDone++;
    checkpoint();
  }

  if (!S.stack.length && !S.pending.length) S.done = true;
}

function report() {
  const mins = (Date.now() - startedAt) / 60000;
  const rate = S.booksWritten / Math.max(1, mins);
  log(
    `used ${fmt(S.booksWritten).padStart(9)} books | ${Math.round(rate)}/min` +
      ` | skipped no-ISBN ${fmt(S.skippedNoIsbn)} | q ${S.stack.length}/${S.pending.length}` +
      ` | tokens ${fmt(S.tokensSpent)} left ${lastTokensLeft}`,
  );
}

// ============================================================== MODES
async function countOnly() {
  const r = await finderQuery(0, nowKeepa(), PROBE_PER_PAGE);
  if (!r || r.failed) {
    console.error("Count failed. Check KEEPA_API_KEY_2.");
    process.exit(1);
  }
  const estIsbn = Math.round(r.total * 0.7);
  const days = (estIsbn + r.total * 0.018) / (TOKEN_RATE * 60 * 24);
  console.log(`Used books in scope   : ${fmt(r.total)}`);
  console.log(`Est. with ISBN (~70%) : ~${fmt(estIsbn)}`);
  console.log(`Est. time at ${TOKEN_RATE}/min : ~${days.toFixed(1)} days`);
  console.log(`Tokens left           : ${lastTokensLeft}`);
}

function statusOnly() {
  const s = readJsonSafe(CHECKPOINT) || readJsonSafe(CHECKPOINT_BAK);
  if (!s) return console.log("No used-book run in progress.");
  const seen = s.booksWritten + s.skippedNoIsbn;
  console.log(
    `Scope          : used books, 1-${s.reviewMax} reviews, ISBN only`,
  );
  console.log(`Books written  : ${fmt(s.booksWritten)}`);
  console.log(
    `Skipped no ISBN: ${fmt(s.skippedNoIsbn)}${seen ? ` (${((s.skippedNoIsbn / seen) * 100).toFixed(1)}%)` : ""}`,
  );
  console.log(
    `Discovered     : ${fmt(seen)} of ${fmt(s.grandTotal)}${s.grandTotal ? ` (${((seen / s.grandTotal) * 100).toFixed(1)}%)` : ""}`,
  );
  console.log(
    `Buckets done   : ${fmt(s.bucketsDone)}   ranges queued: ${(s.stack || []).length}`,
  );
  console.log(`Tokens spent   : ${fmt(s.tokensSpent)}`);
  console.log(s.done ? "COMPLETE." : "Running / incomplete.");
}

function dedupe() {
  if (!fs.existsSync(OUT_CSV)) return console.log("No CSV yet.");
  const lines = fs.readFileSync(OUT_CSV, "utf8").split("\n");
  const seen = new Set();
  const out = [];
  let dropped = 0;
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    if (i === 0) return out.push(line);
    const key = line.split(",", 2).join(",");
    if (seen.has(key)) {
      dropped++;
      return;
    }
    seen.add(key);
    out.push(line);
  });
  fs.writeFileSync(OUT_CSV + ".dedup", out.join("\n") + "\n", "utf8");
  console.log(
    `Kept ${fmt(out.length - 1)} rows, removed ${fmt(dropped)} duplicates -> ${OUT_CSV}.dedup`,
  );
}

// ============================================================== ENTRY
function installHandlers() {
  const onSignal = (sig) => {
    if (stopRequested) {
      log(`${sig} again - forcing exit.`);
      process.exit(130);
    }
    stopRequested = true;
    log(`${sig} received. Finishing the current batch, then saving.`);
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
      /* nothing */
    }
    process.exit(1);
  };
  process.on("uncaughtException", onFatal("uncaughtException"));
  process.on("unhandledRejection", onFatal("unhandledRejection"));
}

function preflight() {
  if (!KEY) {
    console.error(
      "KEEPA_API_KEY_2 is empty. Add a line to .env like:  KEEPA_API_KEY_2=your_second_key",
    );
    process.exit(1);
  }
  if (KEY === (process.env.KEEPA_API_KEY || "").trim()) {
    console.error(
      "KEEPA_API_KEY_2 is the same as KEEPA_API_KEY - the two runs would fight over one token bucket.",
    );
    process.exit(1);
  }
  try {
    const probe = path.join(process.cwd(), ".write_probe_used");
    fs.writeFileSync(probe, "x");
    fs.unlinkSync(probe);
  } catch (e) {
    console.error(`Cannot write to ${process.cwd()}: ${e.message}`);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_CSV))
    fs.writeFileSync(OUT_CSV, "\uFEFF" + HEADERS.join(",") + "\n", "utf8");
}

async function main() {
  if (process.argv.includes("--status")) return statusOnly();
  if (process.argv.includes("--dedupe")) return dedupe();

  preflight();
  installHandlers();
  if (process.argv.includes("--count")) return countOnly();

  const saved = readJsonSafe(CHECKPOINT) || readJsonSafe(CHECKPOINT_BAK);

  if (saved) {
    if (JSON.stringify(saved.filters) !== JSON.stringify(FILTERS)) {
      console.error(`Checkpoint was written with different filters.`);
      console.error(
        `Delete ${CHECKPOINT} and ${OUT_CSV} to start the new scope.`,
      );
      process.exit(1);
    }
    if (saved.done) {
      // Keeps the restart loop quiet once finished: no tokens spent, no noise.
      console.log(
        "Used-book run already COMPLETE. Stop the loop with:  pkill -f 'keepa_collect_used'",
      );
      process.exit(0);
    }
    Object.assign(S, saved);
    S.stack = Array.isArray(S.stack) ? S.stack : [];
    S.pending = Array.isArray(S.pending) ? S.pending : [];
    log(
      `Resuming: ${fmt(S.booksWritten)} books written, ${S.stack.length} ranges queued, ${S.pending.length} pending`,
    );
  } else {
    const r = await finderQuery(0, nowKeepa(), PROBE_PER_PAGE);
    if (!r || r.failed) {
      console.error(
        "Opening count failed. Check KEEPA_API_KEY_2 and your connection.",
      );
      process.exit(1);
    }
    S.grandTotal = r.total;
    log(`Used-book collector starting on account 2`);
    log(
      `  Scope: ${fmt(r.total)} used books (1-${REVIEW_MAX} reviews); ISBN-only will be roughly 70% of that`,
    );
    S.stack = [[0, nowKeepa()]];
    checkpoint();
  }

  await run();
  writeSummary();
}

function writeSummary() {
  checkpoint();
  const mins = (Date.now() - startedAt) / 60000;
  const seen = S.booksWritten + S.skippedNoIsbn;
  [
    "================ USED-BOOK SUMMARY ================",
    `Run time          : ${(mins / 60).toFixed(1)} hours`,
    `Used books found  : ${fmt(seen)} of ${fmt(S.grandTotal)}`,
    `Books written     : ${fmt(S.booksWritten)} (ISBN only)`,
    `Skipped no ISBN   : ${fmt(S.skippedNoIsbn)}`,
    `  with used price : ${fmt(S.withUsed)}`,
    `  with new price  : ${fmt(S.withNew)}`,
    `  used < new      : ${fmt(S.usedCheaper)}`,
    `Tokens spent      : ${fmt(S.tokensSpent)}   left: ${lastTokensLeft}`,
    `Books per minute  : ${(S.booksWritten / Math.max(1, mins)).toFixed(0)}`,
    S.unresolvable.length
      ? `! ${S.unresolvable.length} oversized minutes, ${fmt(S.unresolvable.reduce((a, u) => a + u.lost, 0))} unreachable`
      : null,
    fatal ? `! Ended on a fatal error: ${fatal.message || fatal}` : null,
    S.done ? "COMPLETE." : "Incomplete - run again to resume.",
    "===================================================",
  ]
    .filter(Boolean)
    .forEach((l) => log(l));

  writeJsonAtomic(OUT_SUMMARY, {
    runHours: +(mins / 60).toFixed(2),
    grandTotal: S.grandTotal,
    booksWritten: S.booksWritten,
    skippedNoIsbn: S.skippedNoIsbn,
    withUsed: S.withUsed,
    withNew: S.withNew,
    usedCheaper: S.usedCheaper,
    tokensSpent: S.tokensSpent,
    requestsMade,
    unresolvable: S.unresolvable,
    complete: S.done,
    endedOnError: fatal ? String(fatal.message || fatal) : null,
  });
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
