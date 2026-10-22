const fs = require("fs");
const path = require("path");

const dateStr = "2026-10-20";
const baseInputDir = path.join(__dirname, "../input-data/amazon-india/isbns", dateStr);
const inputFile = path.join(baseInputDir, "input.txt");

const round2InputDir = path.join(baseInputDir, "round-2/chunks");
if (!fs.existsSync(round2InputDir)) {
  fs.mkdirSync(round2InputDir, { recursive: true });
}

const baseOutputDir = path.join(__dirname, "../output/amazon-india/isbns", dateStr);
const outputChunksDir = path.join(baseOutputDir, "chunks");

// 1. Read full target input
if (!fs.existsSync(inputFile)) {
  console.error(`❌ Input file not found: ${inputFile}`);
  process.exit(1);
}

const originalIsbns = fs
  .readFileSync(inputFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && l !== "ISBN" && /^[0-9Xx-]+$/.test(l));

console.log("==================================================");
console.log(`📋 Total Target Input ISBNs for ${dateStr}: ${originalIsbns.length}`);
console.log("==================================================");

// 2. Read all outputs and track clean vs error
const allChunkFiles = [
  "chunk-vps1.json", "chunk-vps2.json", "chunk-vps3.json", "chunk-vps4.json",
  "chunk-vps5.json", "chunk-vps6.json", "chunk-vps7.json", "chunk-vps8.json",
  "chunk-vps9.json", "chunk-vps10.json", "chunk-vps11.json", "chunk-local.json"
];

const cleanScrapedSet = new Set();
const errorSet = new Set();
let totalProcessedRecords = 0;

allChunkFiles.forEach((cf) => {
  const fp = path.join(outputChunksDir, cf);
  if (!fs.existsSync(fp)) {
    console.warn(`⚠️ Missing output file: ${cf}`);
    return;
  }
  const lines = fs.readFileSync(fp, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  totalProcessedRecords += lines.length;

  lines.forEach((line) => {
    try {
      const obj = JSON.parse(line);
      const isbn = (obj.searched_isbn || obj.isbn || obj.search_term || "").toString().trim();
      if (!isbn) return;

      const isError =
        obj.title === "Error" ||
        obj.price === "Error" ||
        obj.found_isbn === "Error" ||
        obj.error ||
        obj.status === "error";

      if (isError) {
        errorSet.add(isbn);
      } else {
        cleanScrapedSet.add(isbn);
        errorSet.delete(isbn);
      }
    } catch (e) {}
  });
});

console.log(`📦 Total Raw Scraped Records:     ${totalProcessedRecords}`);
console.log(`🟢 Unique Clean Scraped ISBNs:   ${cleanScrapedSet.size}`);
console.log(`❌ Unique Error ISBNs:            ${errorSet.size}`);

// 3. Find all ISBNs from original input that still need to be scraped
const toRerun = [];
const seenRerun = new Set();

originalIsbns.forEach((isbn) => {
  if (!cleanScrapedSet.has(isbn)) {
    if (!seenRerun.has(isbn)) {
      seenRerun.add(isbn);
      toRerun.push(isbn);
    }
  }
});

console.log(`🔁 Total Remaining + Error ISBNs to Rerun: ${toRerun.length}`);
fs.writeFileSync(path.join(baseInputDir, "missing_and_error_isbns.txt"), toRerun.join("\n") + "\n", "utf8");

// 4. Split into 11 chunks (VPS 2 - VPS 11 + Local, strictly NO VPS 1)
const chunkTargets = [
  "chunk-vps2.txt",
  "chunk-vps3.txt",
  "chunk-vps4.txt",
  "chunk-vps5.txt",
  "chunk-vps6.txt",
  "chunk-vps7.txt",
  "chunk-vps8.txt",
  "chunk-vps9.txt",
  "chunk-vps10.txt",
  "chunk-vps11.txt",
  "chunk-local.txt",
];

const totalChunks = chunkTargets.length; // 11
const baseSize = Math.floor(toRerun.length / totalChunks);
const remainder = toRerun.length % totalChunks;

console.log(`\n📦 Distributing ${toRerun.length} ISBNs into ${totalChunks} chunks in round-2/chunks:`);

let startIndex = 0;
chunkTargets.forEach((filename, i) => {
  const size = baseSize + (i < remainder ? 1 : 0);
  const items = toRerun.slice(startIndex, startIndex + size);
  startIndex += size;

  const destFile = path.join(round2InputDir, filename);
  fs.writeFileSync(destFile, items.join("\n") + "\n", "utf8");
  console.log(`  📄 [${(i + 1).toString().padStart(2, "0")}/11] ${filename.padEnd(16)}: ${items.length.toString().padStart(5)} ISBNs`);
});

console.log(`\n✅ Verification: ${startIndex} / ${toRerun.length} ISBNs written successfully.`);
