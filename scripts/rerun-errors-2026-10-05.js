const fs = require("fs");
const path = require("path");
const { initBrowser } = require("../utils/browser");
const { setAmazonLocation } = require("../utils/amazon");
const { scrapeAmazonBook } = require("../scrapers/amazon-isbn/scraper");

const DATE_STR = "2026-10-05";
const OUTPUT_FILE = path.join(__dirname, `../output/amazon-india/isbns/${DATE_STR}/input.json`);
const ERROR_FILE = path.join(__dirname, `../input-data/amazon-india/isbns/${DATE_STR}/missing_and_error_isbns.txt`);
const ERROR_OUT_FILE = path.join(__dirname, `../input-data/amazon-india/isbns/${DATE_STR}/error_isbns.txt`);

async function main() {
  console.log("==================================================");
  console.log(`🚀 Rerunning Error ISBNs for ${DATE_STR}`);
  console.log("==================================================\n");

  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`❌ Output file not found: ${OUTPUT_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(ERROR_FILE)) {
    console.error(`❌ Error file not found: ${ERROR_FILE}`);
    process.exit(1);
  }

  const isbnsToRerun = fs
    .readFileSync(ERROR_FILE, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && /^[0-9Xx-]+$/.test(l));

  console.log(`📋 Found ${isbnsToRerun.length} ISBN(s) to rerun: ${isbnsToRerun.join(", ")}\n`);

  if (isbnsToRerun.length === 0) {
    console.log("✅ No error ISBNs to rerun.");
    return;
  }

  // Read existing output map
  const rawLines = fs.readFileSync(OUTPUT_FILE, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  const dataMap = new Map();

  rawLines.forEach((line) => {
    try {
      const obj = JSON.parse(line);
      const isbn = (obj.searched_isbn || obj.isbn || "").toString().trim();
      if (isbn) dataMap.set(isbn, obj);
    } catch (e) {}
  });

  console.log(`📄 Existing output records in input.json: ${dataMap.size}`);

  // Launch browser
  console.log("🌐 Launching Playwright browser...");
  const { context, page } = await initBrowser(true, "amazon_rerun_profile");

  try {
    console.log("📍 Setting Amazon location to Gurgaon (122101)...");
    await setAmazonLocation(page, "122101");

    const remainingErrors = [];

    for (let i = 0; i < isbnsToRerun.length; i++) {
      const isbn = isbnsToRerun[i];
      console.log(`\n[${i + 1}/${isbnsToRerun.length}] 🔍 Scraping ISBN: ${isbn}...`);

      let success = false;
      for (let attempt = 1; attempt <= 3 && !success; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`   🔁 Retry attempt ${attempt}/3...`);
            await new Promise((r) => setTimeout(r, 3000));
          }
          const result = await scrapeAmazonBook(page, { isbn });
          result.scraped_at = new Date().toISOString();
          console.log(
            `   Status: ${result.stock_status || (result.in_stock ? "In Stock" : "Out of Stock")} | Title: "${result.title ? result.title.substring(0, 50) : "N/A"}" | Price: ${result.price}`
          );

          if (result.title !== "Error" && result.price !== "Error" && result.status !== "error") {
            success = true;
          }

          dataMap.set(isbn, result);
        } catch (err) {
          console.error(`   ❌ Attempt ${attempt} failed for ${isbn}: ${err.message}`);
          if (attempt === 3) {
            remainingErrors.push(isbn);
            dataMap.set(isbn, {
              searched_isbn: isbn,
              title: "Error",
              found_isbn: "Error",
              isbn_matched: false,
              price: "Error",
              mrp: "Error",
              delivery: "Error",
              seller: "Error",
              used_available: "Error",
              reviews_count: "Error",
              publisher: "Error",
              publication_date: "Error",
              error: err.message,
              scraped_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Save updated input.json
    const updatedArray = Array.from(dataMap.values());
    const updatedLines = updatedArray.map((r) => JSON.stringify(r)).join("\n") + "\n";
    fs.writeFileSync(OUTPUT_FILE, updatedLines, "utf8");

    // Update error files
    fs.writeFileSync(ERROR_FILE, remainingErrors.join("\n") + (remainingErrors.length ? "\n" : ""), "utf8");
    fs.writeFileSync(ERROR_OUT_FILE, remainingErrors.join("\n") + (remainingErrors.length ? "\n" : ""), "utf8");

    console.log("\n==================================================");
    console.log(`✅ Success! Updated ${OUTPUT_FILE}`);
    console.log(`📊 Final total rows: ${updatedArray.length}`);
    console.log(`❌ Remaining errors: ${remainingErrors.length}`);
    console.log("==================================================");
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
