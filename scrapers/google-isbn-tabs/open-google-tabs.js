const fs = require("fs");
const path = require("path");
const { initBrowser } = require("../../utils/browser");

async function main() {
  const inputArg = process.argv[2] || "test-isbn.txt";
  let inputPath = path.resolve(inputArg);

  if (!fs.existsSync(inputPath)) {
    // Check in root directory
    const rootPath = path.join(__dirname, "../..", inputArg);
    if (fs.existsSync(rootPath)) {
      inputPath = rootPath;
    } else {
      console.error(`❌ Input file not found: ${inputArg}`);
      process.exit(1);
    }
  }

  const rawLines = fs.readFileSync(inputPath, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  const isbns = rawLines.filter((l) => l !== "ISBN" && /^[0-9Xx-]+$/.test(l));

  if (isbns.length === 0) {
    console.error("❌ No valid ISBNs found in input file.");
    process.exit(1);
  }

  console.log("════════════════════════════════════════════════════════════════");
  console.log("🤖 Playwright Scraper Chrome - Google Search Tab Launcher");
  console.log("════════════════════════════════════════════════════════════════");
  console.log(`📄 Input File:     ${inputPath}`);
  console.log(`📊 Total ISBNs:    ${isbns.length}`);
  console.log(`🌐 Browser Engine: Playwright Isolated Scraper Chrome (NOT personal Chrome)`);
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("🚀 Launching dedicated Scraper Chromium browser instance...");
  // Launch Playwright headed browser with scraper profile and full styling/images enabled
  const { context, page } = await initBrowser(false, "scraper_google_tabs_profile", false);

  console.log(`📑 Opening ${isbns.length} Google search tabs in the Scraper window...\n`);

  for (let i = 0; i < isbns.length; i++) {
    const isbn = isbns[i];
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(isbn)}`;

    const tab = i === 0 ? page : await context.newPage();
    console.log(`  [${i + 1}/${isbns.length}] 🔍 Google Tab: https://www.google.com/search?q=${isbn}`);

    // Navigate to Google search
    tab.goto(googleSearchUrl).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log("\n════════════════════════════════════════════════════════════════");
  console.log("✅ All Google tabs are now open in your Scraper Chrome window!");
  console.log("👀 The Scraper browser will stay open. Press [Ctrl+C] in terminal when done.");
  console.log("════════════════════════════════════════════════════════════════\n");

  // Keep process alive so the scraper browser stays open for user
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
