const fs = require("fs");
const path = require("path");

const DATE_STR = "2026-10-24";
const baseInputDir = path.join(__dirname, "../input-data/amazon-india/isbns", DATE_STR);
const targetInputFile = path.join(baseInputDir, "input.txt");

const baseOutputDir = path.join(__dirname, "../output/amazon-india/isbns", DATE_STR);
const chunksDir = path.join(baseOutputDir, "chunks");
const combinedOutputFile = path.join(baseOutputDir, "input.json");

console.log("================================================================================");
console.log(`📦 Combining Scraper Results for ${DATE_STR}`);
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
    obj.status === "error"
  );
}

// 1. Read all chunk files
const chunkFiles = fs.readdirSync(chunksDir).filter((f) => f.endsWith(".json"));
const dataMap = new Map();
let totalLinesRead = 0;

console.log(`\n📂 Reading chunks from ${chunksDir} (${chunkFiles.length} files)...`);
chunkFiles.forEach((file) => {
  const filePath = path.join(chunksDir, file);
  const lines = fs.readFileSync(filePath, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  totalLinesRead += lines.length;

  lines.forEach((line) => {
    try {
      const obj = JSON.parse(line);
      const isbn = (obj.searched_isbn || obj.isbn || obj.search_term || "").toString().trim();
      if (!isbn) return;
      dataMap.set(isbn, obj);
    } catch (e) {}
  });
});

console.log(`  Total Lines Read Across All Chunks: ${totalLinesRead.toLocaleString()}`);
console.log(`  Unique Scraped ISBNs Found:         ${dataMap.size.toLocaleString()}`);

// 2. Write combined output in exact original input order
console.log(`\n💾 Writing combined master file to: ${combinedOutputFile}...`);
const writeStream = fs.createWriteStream(combinedOutputFile, { flags: "w", encoding: "utf8" });

let inStockCount = 0;
let outOfStockCount = 0;
let notFoundCount = 0;
let totalErrorCount = 0;
let missingFromChunks = 0;
let matchedIsbnCount = 0;
const validPrices = [];
const errorIsbns = [];

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
      status: "unprocessed"
    };
  }

  writeStream.write(JSON.stringify(record) + "\n");

  if (isRecordError(record)) {
    totalErrorCount++;
    errorIsbns.push(isbn);
  } else if (record.found === false || record.stock_status === "Not Found") {
    notFoundCount++;
  } else if (record.in_stock === true || record.stock_status === "In Stock") {
    inStockCount++;
    if (record.isbn_matched) matchedIsbnCount++;

    const priceNum = parseFloat(String(record.price || "").replace(/[^0-9.]/g, ""));
    if (!isNaN(priceNum) && priceNum > 0) {
      validPrices.push(priceNum);
    }
  } else {
    outOfStockCount++;
    if (record.isbn_matched) matchedIsbnCount++;
  }
});

writeStream.end();

// Save error ISBNs if any
if (errorIsbns.length > 0) {
  const errorFile = path.join(baseInputDir, "error_isbns.txt");
  fs.writeFileSync(errorFile, errorIsbns.join("\n") + "\n", "utf8");
}

// 3. Price Statistics
validPrices.sort((a, b) => a - b);
const minPrice = validPrices.length ? validPrices[0] : 0;
const maxPrice = validPrices.length ? validPrices[validPrices.length - 1] : 0;
const avgPrice = validPrices.length ? (validPrices.reduce((a, b) => a + b, 0) / validPrices.length).toFixed(2) : 0;
const medianPrice = validPrices.length ? validPrices[Math.floor(validPrices.length / 2)] : 0;

const totalClean = inStockCount + outOfStockCount + notFoundCount;
const successRate = ((totalClean / originalIsbns.length) * 100).toFixed(2);
const inStockRate = ((inStockCount / (inStockCount + outOfStockCount || 1)) * 100).toFixed(2);

console.log("\n================================================================================");
console.log(`📊 FINAL STATS SUMMARY FOR ${DATE_STR}`);
console.log("================================================================================");
console.log(`🎯 Total Target Input ISBNs:       ${originalIsbns.length.toLocaleString()}`);
console.log(`📄 Combined Output Records:        ${originalIsbns.length.toLocaleString()}`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`🟢 Successfully Scraped (Clean):   ${totalClean.toLocaleString()} (${successRate}%)`);
console.log(`   ├── 🛒 In Stock:                ${inStockCount.toLocaleString()} (${inStockRate}% of found titles)`);
console.log(`   ├── 📦 Out of Stock:            ${outOfStockCount.toLocaleString()}`);
console.log(`   └── 🔍 Not Found on Amazon:     ${notFoundCount.toLocaleString()}`);
console.log(`❌ Errors / Failed:                ${totalErrorCount.toLocaleString()} (${((totalErrorCount / originalIsbns.length) * 100).toFixed(2)}%)`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`💰 Pricing Statistics (In-Stock Items):`);
console.log(`   ├── Total Priced Items:         ${validPrices.length.toLocaleString()}`);
console.log(`   ├── Min Price:                  ₹${minPrice.toLocaleString()}`);
console.log(`   ├── Average Price:              ₹${Number(avgPrice).toLocaleString()}`);
console.log(`   ├── Median Price:               ₹${medianPrice.toLocaleString()}`);
console.log(`   └── Max Price:                  ₹${maxPrice.toLocaleString()}`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`🎯 Direct ISBN Matches:            ${matchedIsbnCount.toLocaleString()}`);
console.log(`📁 Saved to:                       ${combinedOutputFile}`);
console.log("================================================================================\n");
