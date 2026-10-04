const fs = require("fs");
const path = require("path");
const { initBrowser } = require("../utils/browser");

const inputFile = process.argv[2] || path.join(__dirname, "../test-isbn.txt");

let isbns = [];
if (fs.existsSync(inputFile)) {
  isbns = fs
    .readFileSync(inputFile, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "ISBN" && /^[0-9Xx-]+$/.test(l));
} else {
  // If arguments were passed directly on CLI
  isbns = process.argv.slice(2).filter((l) => /^[0-9Xx-]+$/.test(l));
}

if (isbns.length === 0) {
  console.error("❌ No valid ISBNs found to open.");
  process.exit(1);
}

(async () => {
  console.log("==================================================");
  console.log(`🌐 Launching Scraper Chrome Profile for ${isbns.length} Google Search Tabs`);
  console.log("==================================================\n");

  // Launch browser with headless = false and resource blocking disabled so full web pages load
  const { context, page } = await initBrowser(false, "google_search_profile", false);

  try {
    console.log(`📑 Opening ${isbns.length} Google search tabs...`);

    for (let i = 0; i < isbns.length; i++) {
      const isbn = isbns[i];
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(isbn)}`;
      
      const targetPage = i === 0 ? page : await context.newPage();
      console.log(`  [${i + 1}/${isbns.length}] 🔍 Google Search: ${isbn}`);
      
      // Navigate to Google search
      targetPage.goto(searchUrl).catch(() => {});
      await new Promise((r) => setTimeout(r, 600));
    }

    console.log("\n==================================================");
    console.log("✅ All Google search tabs opened in Chrome Profile!");
    console.log("👀 Browser will stay open. Press Ctrl+C in terminal when done.");
    console.log("==================================================\n");

    // Keep process alive so browser does not close automatically
    await new Promise(() => {});
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
