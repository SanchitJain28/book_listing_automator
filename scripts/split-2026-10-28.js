const fs = require("fs");
const path = require("path");

const dateStr = "2026-10-28";
const baseInputDir = path.join(__dirname, "../input-data/amazon-india/isbns", dateStr);
const inputFile = path.join(baseInputDir, "input.txt");
const chunksDir = path.join(baseInputDir, "chunks");

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Input file not found: ${inputFile}`);
  process.exit(1);
}

if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

const lines = fs
  .readFileSync(inputFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && l.toUpperCase() !== "ISBN" && /^[0-9Xx-]+$/.test(l));

console.log("==================================================");
console.log(`📋 Total Target Input ISBNs for ${dateStr}: ${lines.length}`);
console.log("==================================================");

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
const baseSize = Math.floor(lines.length / totalChunks);
const remainder = lines.length % totalChunks;

console.log(`\n📦 Distributing ${lines.length} ISBNs into ${totalChunks} chunks:`);
console.log(`   Base size: ${baseSize} ISBNs/chunk | Remainder: ${remainder} chunks get +1\n`);

let startIndex = 0;
let totalWritten = 0;

chunkTargets.forEach((filename, i) => {
  const size = baseSize + (i < remainder ? 1 : 0);
  const chunkItems = lines.slice(startIndex, startIndex + size);
  startIndex += size;
  totalWritten += chunkItems.length;

  const destPath = path.join(chunksDir, filename);
  fs.writeFileSync(destPath, chunkItems.join("\n") + "\n", "utf8");

  console.log(`  📄 [${(i + 1).toString().padStart(2, "0")}/${totalChunks}] ${filename.padEnd(16)}: ${chunkItems.length.toString().padStart(5)} ISBNs -> ${destPath}`);
});

console.log("\n==================================================");
console.log(`✅ Verification: ${totalWritten} / ${lines.length} ISBNs written successfully.`);
console.log(`📁 Chunks Directory: ${chunksDir}`);
console.log("==================================================");

