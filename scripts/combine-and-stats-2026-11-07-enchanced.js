const fs = require("fs");
const path = require("path");

const DATE_STR = "2026-11-07";
const baseInputDir = path.join(__dirname, "../input-data/amazon-isbn-enchanced/isbns", DATE_STR);
const targetInputFile = path.join(baseInputDir, "input.txt");

const baseOutputDir = path.join(__dirname, "../output/amazon-isbn-enchanced/amazon-isbn-enchanced/isbns", DATE_STR);
const altBaseOutputDir = path.join(__dirname, "../output/amazon-isbn-enchanced/isbns", DATE_STR);

const chunksDir = path.join(baseOutputDir, "chunks");
const combinedOutputFile = path.join(baseOutputDir, "input.json");
const altCombinedOutputFile = path.join(altBaseOutputDir, "input.json");

console.log("================================================================================");
console.log(`📦 Combining Scraper Results for amazon-isbn-enchanced (${DATE_STR})`);
console.log("================================================================================\n");

if (!fs.existsSync(targetInputFile)) {
  console.error(`❌ Target input file not found: ${targetInputFile}`);
  process.exit(1);
}

const originalIsbns = fs
  .readFileSync(targetInputFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && l.toUpperCase() !== "ISBN" && /^[0-9Xx-]+$/.test(l));

console.log(`📋 Total Target Input ISBNs: ${originalIsbns.length.toLocaleString()}`);

function isRecordError(obj) {
  if (!obj) return true;
  return (
    obj.title === "Error" ||
    obj.price === "Error" ||
    obj.found_isbn === "Error" ||
    obj.error ||
    obj.status === "error" ||
    String(obj.stock_status || "").toLowerCase().includes("error")
  );
}

// 1. Read all chunk files sorted numerically by VPS number
const chunkFiles = fs
  .readdirSync(chunksDir)
  .filter((f) => f.endsWith(".json"))
  .sort((a, b) => {
    const numA = parseInt((a.match(/\d+/) || [0])[0], 10);
    const numB = parseInt((b.match(/\d+/) || [0])[0], 10);
    return numA - numB;
  });

const dataMap = new Map();
let totalLinesRead = 0;
const perChunkStats = [];

console.log(`\n📂 Reading chunks from ${chunksDir} (${chunkFiles.length} files)...`);
chunkFiles.forEach((file) => {
  const filePath = path.join(chunksDir, file);
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  totalLinesRead += lines.length;

  let chunkClean = 0;
  let chunkErrors = 0;
  let chunkInStock = 0;
  let chunkOos = 0;
  let chunkNotFound = 0;

  lines.forEach((line) => {
    try {
      const obj = JSON.parse(line);
      const isbn = (obj.searched_isbn || obj.isbn || obj.search_term || "").toString().trim();
      if (!isbn) return;
      if (isRecordError(obj)) {
        chunkErrors++;
        if (!dataMap.has(isbn)) dataMap.set(isbn, obj);
      } else {
        chunkClean++;
        if (obj.in_stock === true || obj.stock_status === "In Stock") chunkInStock++;
        else if (obj.found === false || obj.stock_status === "Not Found") chunkNotFound++;
        else chunkOos++;
        dataMap.set(isbn, obj);
      }
    } catch (e) {}
  });

  const vpsMatch = file.match(/\d+/);
  const vpsId = vpsMatch ? vpsMatch[0] : "";
  const chunkInputFile = path.join(baseInputDir, "chunks", `chunk-vps${vpsId}.txt`);
  const targetCount = fs.existsSync(chunkInputFile)
    ? fs.readFileSync(chunkInputFile, "utf8").trim().split("\n").filter(Boolean).length
    : lines.length;

  perChunkStats.push({
    file,
    target: targetCount,
    lines: lines.length,
    clean: chunkClean,
    inStock: chunkInStock,
    outOfStock: chunkOos,
    notFound: chunkNotFound,
    errors: chunkErrors,
    remaining: targetCount - lines.length,
  });

  console.log(
    `   • ${file.padEnd(18)} | Target: ${String(targetCount).padStart(5)} | Done: ${String(lines.length).padStart(5)} | Rem: ${String(targetCount - lines.length).padStart(5)} | In Stock: ${String(chunkInStock).padStart(4)} | OOS: ${String(chunkOos).padStart(4)} | Not Found: ${String(chunkNotFound).padStart(5)} | Err: ${chunkErrors}`
  );
});

console.log(`\n  Total Lines Read Across All Chunks: ${totalLinesRead.toLocaleString()}`);
console.log(`  Unique Scraped ISBNs Found:         ${dataMap.size.toLocaleString()}`);

// 2. Write combined output in exact original input order
console.log(`\n💾 Writing combined master file to: ${combinedOutputFile}...`);

let inStockCount = 0;
let outOfStockCount = 0;
let notFoundCount = 0;
let totalErrorCount = 0;
let missingFromChunks = 0;
let matchedIsbnCount = 0;
let inStockMatchedCount = 0;
let usedAvailableCount = 0;
const validPrices = [];
const errorIsbns = [];
const outputLines = [];

originalIsbns.forEach((isbn) => {
  let record = dataMap.get(isbn);

  if (!record) {
    missingFromChunks++;
    record = {
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
      status: "unprocessed",
    };
  }

  outputLines.push(JSON.stringify(record));

  if (isRecordError(record)) {
    totalErrorCount++;
    errorIsbns.push(isbn);
  } else if (record.found === false || record.stock_status === "Not Found") {
    notFoundCount++;
  } else if (record.in_stock === true || record.stock_status === "In Stock") {
    inStockCount++;
    if (record.isbn_matched) {
      matchedIsbnCount++;
      inStockMatchedCount++;
    }
    if (
      record.used_available &&
      record.used_available !== "N/A" &&
      record.used_available !== "No Used Options" &&
      record.used_available !== "Error"
    ) {
      usedAvailableCount++;
    }

    const priceNum = parseFloat(String(record.price || "").replace(/[^0-9.]/g, ""));
    if (!isNaN(priceNum) && priceNum > 0) {
      validPrices.push(priceNum);
    }
  } else {
    outOfStockCount++;
    if (record.isbn_matched) matchedIsbnCount++;
    if (
      record.used_available &&
      record.used_available !== "N/A" &&
      record.used_available !== "No Used Options" &&
      record.used_available !== "Error"
    ) {
      usedAvailableCount++;
    }
  }
});

fs.writeFileSync(combinedOutputFile, outputLines.join("\n") + "\n", "utf8");
fs.mkdirSync(path.dirname(altCombinedOutputFile), { recursive: true });
fs.writeFileSync(altCombinedOutputFile, outputLines.join("\n") + "\n", "utf8");

// Save error ISBNs if any
if (errorIsbns.length > 0) {
  const errorFile = path.join(baseInputDir, "error_isbns.txt");
  fs.writeFileSync(errorFile, errorIsbns.join("\n") + "\n", "utf8");
}

// 3. Price Statistics
validPrices.sort((a, b) => a - b);
const minPrice = validPrices.length ? validPrices[0] : 0;
const maxPrice = validPrices.length ? validPrices[validPrices.length - 1] : 0;
const avgPrice = validPrices.length
  ? (validPrices.reduce((a, b) => a + b, 0) / validPrices.length).toFixed(2)
  : 0;
const medianPrice = validPrices.length ? validPrices[Math.floor(validPrices.length / 2)] : 0;

const totalClean = inStockCount + outOfStockCount + notFoundCount;
const foundOnAmazon = inStockCount + outOfStockCount;
const successRate = ((totalClean / originalIsbns.length) * 100).toFixed(2);
const inStockRateOfAll = ((inStockCount / originalIsbns.length) * 100).toFixed(2);
const inStockRateOfFound = ((inStockCount / (foundOnAmazon || 1)) * 100).toFixed(2);
const remainingUnscraped = missingFromChunks;

console.log("\n================================================================================");
console.log(`📊 FINAL STATS SUMMARY FOR amazon-isbn-enchanced (${DATE_STR})`);
console.log("================================================================================");
console.log(`🎯 Total Target Input ISBNs:       ${originalIsbns.length.toLocaleString()}`);
console.log(`📄 Combined Output Records:        ${outputLines.length.toLocaleString()}`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`🟢 Successfully Scraped (Clean):   ${totalClean.toLocaleString()} (${successRate}%)`);
console.log(`   ├── 🛒 In Stock:                ${inStockCount.toLocaleString()} (${inStockRateOfAll}% of total | ${inStockRateOfFound}% of found)`);
console.log(`   ├── 📦 Out of Stock:            ${outOfStockCount.toLocaleString()} (${((outOfStockCount / originalIsbns.length) * 100).toFixed(2)}%)`);
console.log(`   └── 🔍 Not Found on Amazon:     ${notFoundCount.toLocaleString()} (${((notFoundCount / originalIsbns.length) * 100).toFixed(2)}%)`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`⏳ Remaining (Unscraped):          ${remainingUnscraped.toLocaleString()}`);
console.log(`❌ Scraper Errors:                 ${(totalErrorCount - missingFromChunks).toLocaleString()}`);
console.log(`⚠️  Total Incomplete (Rem + Err):   ${totalErrorCount.toLocaleString()}`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`💰 Pricing Statistics (In-Stock Items):`);
console.log(`   ├── Total Priced Items:         ${validPrices.length.toLocaleString()}`);
console.log(`   ├── Min Price:                  ₹${minPrice.toLocaleString()}`);
console.log(`   ├── Average Price:              ₹${Number(avgPrice).toLocaleString()}`);
console.log(`   ├── Median Price:               ₹${medianPrice.toLocaleString()}`);
console.log(`   └── Max Price:                  ₹${maxPrice.toLocaleString()}`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`🎯 Direct ISBN Matches (Total):    ${matchedIsbnCount.toLocaleString()} (In-Stock Exact Matches: ${inStockMatchedCount.toLocaleString()})`);
console.log(`♻️  Used Options Available:         ${usedAvailableCount.toLocaleString()}`);
console.log(`📁 Saved Combined File to:         ${combinedOutputFile}`);
console.log("================================================================================\n");

