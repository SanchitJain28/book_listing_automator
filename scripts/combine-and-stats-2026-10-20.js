const fs = require("fs");
const path = require("path");

const DATE_STR = "2026-10-20";
const baseInputDir = path.join(__dirname, "../input-data/amazon-india/isbns", DATE_STR);
const targetInputFile = path.join(baseInputDir, "input.txt");

const baseOutputDir = path.join(__dirname, "../output/amazon-india/isbns", DATE_STR);
const round1Dir = path.join(baseOutputDir, "round-1/chunks");
const round2Dir = path.join(baseOutputDir, "round-2/chunks");
const combinedOutputFile = path.join(baseOutputDir, "input.json");

console.log("================================================================================");
console.log(`📦 Combining Round 1 & Round 2 Scraper Results for ${DATE_STR}`);
console.log("================================================================================\n");

// 1. Read Original Input ISBNs
if (!fs.existsSync(targetInputFile)) {
  console.error(`❌ Target input file not found: ${targetInputFile}`);
  process.exit(1);
}

const originalIsbns = fs
  .readFileSync(targetInputFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && l !== "ISBN" && /^[0-9Xx-]+$/.test(l));

console.log(`📋 Total Target Input ISBNs: ${originalIsbns.length.toLocaleString()}`);

// Helper to determine if a record is an error
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

// 2. Read Round 1 Chunks
const round1Files = fs.readdirSync(round1Dir).filter((f) => f.endsWith(".json"));
const round1Map = new Map();
let r1TotalLines = 0;
let r1CleanCount = 0;
let r1ErrorCount = 0;

console.log(`\n📂 Reading Round-1 chunks (${round1Files.length} files)...`);
round1Files.forEach((file) => {
  const filePath = path.join(round1Dir, file);
  const lines = fs.readFileSync(filePath, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  r1TotalLines += lines.length;

  lines.forEach((line) => {
    try {
      const obj = JSON.parse(line);
      const isbn = (obj.searched_isbn || obj.isbn || obj.search_term || "").toString().trim();
      if (!isbn) return;

      if (isRecordError(obj)) {
        r1ErrorCount++;
        if (!round1Map.has(isbn)) {
          round1Map.set(isbn, obj);
        }
      } else {
        r1CleanCount++;
        round1Map.set(isbn, obj); // Clean replaces any previous error
      }
    } catch (e) {}
  });
});

console.log(`  Round-1 Total Lines Read: ${r1TotalLines.toLocaleString()}`);
console.log(`  Round-1 Unique Clean:     ${r1CleanCount.toLocaleString()}`);
console.log(`  Round-1 Unique Error:     ${r1ErrorCount.toLocaleString()}`);

// 3. Read Round 2 Chunks
const round2Files = fs.existsSync(round2Dir) ? fs.readdirSync(round2Dir).filter((f) => f.endsWith(".json")) : [];
const round2Map = new Map();
let r2TotalLines = 0;
let r2CleanCount = 0;
let r2ErrorCount = 0;

console.log(`\n📂 Reading Round-2 chunks (${round2Files.length} files)...`);
round2Files.forEach((file) => {
  const filePath = path.join(round2Dir, file);
  const lines = fs.readFileSync(filePath, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  r2TotalLines += lines.length;

  lines.forEach((line) => {
    try {
      const obj = JSON.parse(line);
      const isbn = (obj.searched_isbn || obj.isbn || obj.search_term || "").toString().trim();
      if (!isbn) return;

      if (isRecordError(obj)) {
        r2ErrorCount++;
        if (!round2Map.has(isbn)) {
          round2Map.set(isbn, obj);
        }
      } else {
        r2CleanCount++;
        round2Map.set(isbn, obj);
      }
    } catch (e) {}
  });
});

console.log(`  Round-2 Total Lines Read: ${r2TotalLines.toLocaleString()}`);
console.log(`  Round-2 Unique Clean:     ${r2CleanCount.toLocaleString()}`);
console.log(`  Round-2 Unique Error:     ${r2ErrorCount.toLocaleString()}`);

// 4. Merge Round 1 and Round 2
// Strategy:
// - Start with Round 1 clean records
// - For any error/missing record in Round 1, take Round 2 result (clean if available, else Round 2 latest)
// - If Round 2 has a clean result for an ISBN, it always wins
console.log(`\n🔄 Merging results across all ${originalIsbns.length.toLocaleString()} target ISBNs...`);

const combinedMap = new Map();
let round1CleanUsed = 0;
let round2CleanUsed = 0;
let finalErrors = 0;
let missingUnscraped = 0;

originalIsbns.forEach((isbn) => {
  const r2Obj = round2Map.get(isbn);
  const r1Obj = round1Map.get(isbn);

  let chosenObj = null;

  if (r2Obj && !isRecordError(r2Obj)) {
    chosenObj = r2Obj;
    round2CleanUsed++;
  } else if (r1Obj && !isRecordError(r1Obj)) {
    chosenObj = r1Obj;
    round1CleanUsed++;
  } else if (r2Obj) {
    chosenObj = r2Obj;
    finalErrors++;
  } else if (r1Obj) {
    chosenObj = r1Obj;
    finalErrors++;
  } else {
    missingUnscraped++;
    chosenObj = {
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

  combinedMap.set(isbn, chosenObj);
});

// 5. Write Combined Output File in exact original input order
console.log(`\n💾 Writing combined file to: ${combinedOutputFile}...`);
const writeStream = fs.createWriteStream(combinedOutputFile, { flags: "w", encoding: "utf8" });

let inStockCount = 0;
let outOfStockCount = 0;
let notFoundCount = 0;
let totalErrorCount = 0;
let matchedIsbnCount = 0;
const validPrices = [];

originalIsbns.forEach((isbn) => {
  const record = combinedMap.get(isbn);
  writeStream.write(JSON.stringify(record) + "\n");

  if (isRecordError(record)) {
    totalErrorCount++;
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

// Price statistics
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
console.log(`📄 Combined Output Records:        ${combinedMap.size.toLocaleString()}`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`🟢 Successfully Scraped (Clean):   ${totalClean.toLocaleString()} (${successRate}%)`);
console.log(`   ├── 🛒 In Stock:                ${inStockCount.toLocaleString()} (${inStockRate}% of found books)`);
console.log(`   ├── 📦 Out of Stock:            ${outOfStockCount.toLocaleString()}`);
console.log(`   └── 🔍 Not Found on Amazon:     ${notFoundCount.toLocaleString()}`);
console.log(`❌ Remaining Errors / Failed:      ${totalErrorCount.toLocaleString()} (${((totalErrorCount / originalIsbns.length) * 100).toFixed(2)}%)`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`🧩 Contributions:`);
console.log(`   ├── Round 1 Clean Used:         ${round1CleanUsed.toLocaleString()}`);
console.log(`   └── Round 2 Clean Recovered:    ${round2CleanUsed.toLocaleString()}`);
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
