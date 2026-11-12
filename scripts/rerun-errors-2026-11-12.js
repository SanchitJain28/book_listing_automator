const fs = require("fs");
const path = require("path");
const { initBrowser } = require("../utils/browser");
const { setAmazonLocation } = require("../utils/amazon");
const { scrapeAmazonBook } = require("../scrapers/amazon-isbn/scraper");

const DATE_STR = "2026-11-12";
const OUTPUT_FILE = path.join(__dirname, `../output/amazon-india/isbns/${DATE_STR}/input.json`);
const TARGET_ISBNS = [
  "9789388725897",
  "9781432602888",
  "9781420825435",
  "9781420813692",
  "9781420813548",
  "9781438974064",
  "9781438914817",
  "9781438911601",
  "9781441545237",
  "9781441551153",
  "9781441552822",
  "9781441598387",
];

function isErrorRecord(rec) {
  return Boolean(
    rec.error ||
      !rec.stock_status ||
      rec.title === "Error" ||
      rec.price === "Error" ||
      String(rec.stock_status || "").toLowerCase().includes("error")
  );
}

async function main() {
  console.log("==================================================");
  console.log(`🚀 Rerunning ${TARGET_ISBNS.length} Error ISBNs for ${DATE_STR}`);
  console.log("==================================================\n");

  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`❌ Output file not found: ${OUTPUT_FILE}`);
    process.exit(1);
  }

  const rawLines = fs
    .readFileSync(OUTPUT_FILE, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const records = rawLines.map((l) => JSON.parse(l));
  console.log(`📄 Loaded ${records.length} existing records from ${OUTPUT_FILE}`);

  console.log("🌐 Launching Playwright headless browser...");
  const { context, page } = await initBrowser(true, "amazon_rerun_2026_11_12");

  try {
    console.log("📍 Setting Amazon location to Gurgaon (122101)...");
    const locRes = await setAmazonLocation(page, "122101");
    console.log(`   Location result: ${locRes.success ? locRes.location || "122101" : locRes.error}`);

    const updatedMap = new Map();
    const remainingErrors = [];

    for (let i = 0; i < TARGET_ISBNS.length; i++) {
      const isbn = TARGET_ISBNS[i];
      console.log(`\n[${i + 1}/${TARGET_ISBNS.length}] 🔍 Scraping ISBN: ${isbn}...`);

      let success = false;
      for (let attempt = 1; attempt <= 3 && !success; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`   🔁 Retry attempt ${attempt}/3...`);
            await page.waitForTimeout(3000);
          }
          const result = await scrapeAmazonBook(page, { isbn });
          result.scraped_at = new Date().toISOString();
          console.log(
            `   Status: ${result.stock_status} | Title: "${result.title ? result.title.substring(0, 50) : "N/A"}" | Price: ${result.price} | Match: ${result.isbn_matched}`
          );

          if (result.title !== "Error" && result.price !== "Error" && result.status !== "error") {
            success = true;
            updatedMap.set(isbn, result);
          }
        } catch (err) {
          console.error(`   ❌ Attempt ${attempt} failed for ${isbn}: ${err.message}`);
        }
      }
      if (!success) {
        remainingErrors.push(isbn);
      }
      if (i < TARGET_ISBNS.length - 1) {
        await page.waitForTimeout(2000);
      }
    }

    // Replace matching error lines in-place preserving exact order
    let replacedCount = 0;
    const finalRecords = records.map((rec) => {
      const isbn = (rec.searched_isbn || rec.isbn || "").trim();
      if (updatedMap.has(isbn) && isErrorRecord(rec)) {
        replacedCount++;
        return updatedMap.get(isbn);
      }
      return rec;
    });

    const outContent = finalRecords.map((r) => JSON.stringify(r)).join("\n") + "\n";
    fs.writeFileSync(OUTPUT_FILE, outContent, "utf8");

    console.log("\n==================================================");
    console.log(`✅ Replaced ${replacedCount} / ${TARGET_ISBNS.length} error records in ${OUTPUT_FILE}`);
    console.log(`📊 Final total rows: ${finalRecords.length}`);
    console.log(`❌ Remaining errors: ${remainingErrors.length}`);
    if (remainingErrors.length > 0) {
      console.log(`   Failed ISBNs: ${remainingErrors.join(", ")}`);
    }
    console.log("==================================================");
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

