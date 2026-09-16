const fs = require("fs");
const path = require("path");
const { initBrowser } = require("../utils/browser");
const { setAmazonLocation } = require("../utils/amazon");
const { scrapeAmazonBook } = require("../scrapers/amazon-isbn/scraper");

const OUTPUT_FILE = path.join(__dirname, "../output/amazon-india/isbns/2026-09-17/input.json");

const ERROR_ISBNS = [
  "9781394307616",
  "9780471956471",
  "9781032520391",
  "9781111525552",
  "9780947711757",
  "9789350255681",
  "9780592054438",
];

async function main() {
  console.log("==================================================");
  console.log("🚀 Rerunning 7 Error ISBNs for 2026-09-17");
  console.log("==================================================\n");

  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`❌ Output file not found: ${OUTPUT_FILE}`);
    process.exit(1);
  }

  const rawLines = fs.readFileSync(OUTPUT_FILE, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  console.log(`📄 Total existing rows in input.json: ${rawLines.length}`);

  // Filter out error rows
  const cleanLines = [];
  const removedIsbns = [];

  for (const line of rawLines) {
    try {
      const obj = JSON.parse(line);
      if (
        obj.title === "Error" ||
        obj.status === "ERROR" ||
        obj.price === "Error" ||
        ERROR_ISBNS.includes(obj.searched_isbn)
      ) {
        removedIsbns.push(obj.searched_isbn);
      } else {
        cleanLines.push(line);
      }
    } catch (e) {
      // bad JSON line, discard
    }
  }

  console.log(`🧹 Removed ${removedIsbns.length} error row(s): ${removedIsbns.join(", ")}`);
  console.log(`📊 Clean existing rows retained: ${cleanLines.length}\n`);

  // Launch browser
  console.log("🌐 Launching Playwright browser...");
  const { context, page } = await initBrowser(true, "amazon_rerun_profile");

  try {
    // Set Amazon Location
    console.log("📍 Setting Amazon location to Gurgaon (122101)...");
    await setAmazonLocation(page, "122101");

    const newResults = [];

    for (let i = 0; i < ERROR_ISBNS.length; i++) {
      const isbn = ERROR_ISBNS[i];
      console.log(`\n[${i + 1}/${ERROR_ISBNS.length}] 🔍 Scraping ISBN: ${isbn}...`);

      try {
        const result = await scrapeAmazonBook(page, { isbn });
        result.scraped_at = new Date().toISOString();
        console.log(`   Status: ${result.stock_status || (result.in_stock ? "In Stock" : "Out of Stock")} | Title: "${result.title ? result.title.substring(0, 50) : "N/A"}" | Price: ${result.price}`);
        newResults.push(result);
      } catch (err) {
        console.error(`   ❌ Failed to scrape ${isbn}: ${err.message}`);
        newResults.push({
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

    // Combine clean rows + newly scraped rows
    const finalLines = [...cleanLines, ...newResults.map((r) => JSON.stringify(r))];
    fs.writeFileSync(OUTPUT_FILE, finalLines.join("\n") + "\n", "utf8");

    console.log("\n==================================================");
    console.log(`✅ Success! Updated ${OUTPUT_FILE}`);
    console.log(`📊 Final total rows: ${finalLines.length}`);
    console.log("==================================================");
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
