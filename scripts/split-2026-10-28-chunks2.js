const fs = require("fs");
const path = require("path");

const baseInputDir = path.join(__dirname, "../input-data/amazon-india/isbns/2026-10-28");
const inputFile = path.join(baseInputDir, "input.txt");
const outputChunksDir = path.join(__dirname, "../output/amazon-india/isbns/2026-10-28/chunks");
const targetChunksDir = path.join(baseInputDir, "chunks-2");

if (!fs.existsSync(targetChunksDir)) {
  fs.mkdirSync(targetChunksDir, { recursive: true });
}

// 1. Collect all cleanly scraped ISBNs from output chunks
const cleanScraped = new Set();
const errorIsbns = new Set();

for (const file of fs.readdirSync(outputChunksDir).sort()) {
  if (!file.endsWith(".json")) continue;
  const fp = path.join(outputChunksDir, file);
  const lines = fs.readFileSync(fp, "utf8").trim().split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const isbn = String(obj.searched_isbn || obj.isbn || "").trim();
      if (!isbn) continue;
      const isErr = Boolean(
        obj.error ||
        !obj.stock_status ||
        obj.price === "Error" ||
        String(obj.stock_status || "").toLowerCase().includes("error")
      );
      if (!isErr) {
        cleanScraped.add(isbn);
        errorIsbns.delete(isbn);
      } else if (!cleanScraped.has(isbn)) {
        errorIsbns.add(isbn);
      }
    } catch (e) {}
  }
}

// 2. Filter input.txt for remaining + error ISBNs (preserving original order)
const allInputIsbns = fs
  .readFileSync(inputFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && l.toUpperCase() !== "ISBN" && /^[0-9Xx-]+$/.test(l));

const toScrape = allInputIsbns.filter((isbn) => !cleanScraped.has(isbn));

console.log("==================================================");
console.log(`📋 Total Input ISBNs        : ${allInputIsbns.length}`);
console.log(`✅ Cleanly Scraped ISBNs    : ${cleanScraped.size}`);
console.log(`❌ Unique Error ISBNs       : ${errorIsbns.size}`);
console.log(`⏳ Remaining Unscraped      : ${toScrape.length - errorIsbns.size}`);
console.log(`🚀 Total for chunks-2       : ${toScrape.length}`);
console.log("==================================================\n");

const chunkTargets = [
  "chunk-vps3.txt",
  "chunk-vps4.txt",
  "chunk-vps5.txt",
  "chunk-vps6.txt",
  "chunk-vps7.txt",
  "chunk-vps8.txt",
  "chunk-vps9.txt",
  "chunk-vps10.txt",
  "chunk-vps11.txt",
  "chunk-vps12.txt",
  "chunk-vps13.txt",
  "chunk-vps14.txt",
  "chunk-vps15.txt",
  "chunk-vps16.txt",
];

const totalChunks = chunkTargets.length; // 14
const baseSize = Math.floor(toScrape.length / totalChunks);
const remainder = toScrape.length % totalChunks;

console.log(`📦 Distributing ${toScrape.length} ISBNs into ${totalChunks} chunks (VPS 3 to VPS 16):`);
console.log(`   Base size: ${baseSize} ISBNs/chunk | Remainder: ${remainder} chunks get +1\n`);

let startIndex = 0;
let totalWritten = 0;

chunkTargets.forEach((filename, i) => {
  const size = baseSize + (i < remainder ? 1 : 0);
  const chunkItems = toScrape.slice(startIndex, startIndex + size);
  startIndex += size;
  totalWritten += chunkItems.length;

  const destPath = path.join(targetChunksDir, filename);
  fs.writeFileSync(destPath, chunkItems.join("\n") + "\n", "utf8");

  console.log(
    `  📄 [${(i + 1).toString().padStart(2, "0")}/${totalChunks}] ${filename.padEnd(16)}: ${chunkItems.length.toString().padStart(5)} ISBNs -> ${destPath}`
  );
});

console.log("\n==================================================");
console.log(`✅ Verification: ${totalWritten} / ${toScrape.length} ISBNs written successfully.`);
console.log(`📁 Output Directory: ${targetChunksDir}`);
console.log("==================================================");

