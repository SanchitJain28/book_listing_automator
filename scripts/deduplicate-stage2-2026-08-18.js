const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TARGET_DIR = path.join(
  __dirname,
  "../output/amazon-india/search-term/stage-2/2026-08-18/chunks"
);

const COMBINED_OUTPUT = path.join(
  __dirname,
  "../output/amazon-india/search-term/stage-2/2026-08-18/combined.json"
);

function deduplicate() {
  console.log("🔍 Scanning all historical Stage-2 datasets across the repository...");

  // Find all historical stage-2 files excluding 2026-08-18
  const allHistoricalFiles = execSync(
    'find ./output -type f -name "*.json" | grep "stage-2" | grep -v "2026-08-18"'
  )
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);

  const seenAsins = new Set();
  let totalHistoryRecords = 0;

  for (const file of allHistoricalFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        const asin = (item.asin || item.searched_asin || "").trim().toUpperCase();
        if (asin) {
          seenAsins.add(asin);
          totalHistoryRecords++;
        }
      } catch (e) {}
    }
  }

  console.log(`ℹ️ Processed ${allHistoricalFiles.length} historical files.`);
  console.log(`ℹ️ Total historical records: ${totalHistoryRecords.toLocaleString()}`);
  console.log(`ℹ️ Unique historical ASIN baseline: ${seenAsins.size.toLocaleString()}\n`);

  console.log("🧹 Deduplicating Stage-2 2026-08-18 chunks against all history & cross-chunk...");

  const targetFiles = [
    "chunk-1-local.json",
    "chunk-2-vps1.json",
    "chunk-3-vps2.json",
    "chunk-4-vps3.json",
    "chunk-5-vps4.json",
    "chunk-6-vps5.json",
  ];

  let totalBefore = 0;
  let totalKept = 0;
  let totalDupHistory = 0;

  const combinedLines = [];
  const statsTable = [];

  for (const fName of targetFiles) {
    const fPath = path.join(TARGET_DIR, fName);
    if (!fs.existsSync(fPath)) {
      console.log(`⚠️ Missing file: ${fName}`);
      continue;
    }

    const lines = fs.readFileSync(fPath, "utf8").split("\n").filter(Boolean);
    const uniqueChunkLines = [];
    let dupCount = 0;

    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        const asin = (item.asin || item.searched_asin || "").trim().toUpperCase();
        if (!asin) continue;

        if (seenAsins.has(asin)) {
          dupCount++;
        } else {
          seenAsins.add(asin); // mark so subsequent chunks also don't duplicate
          uniqueChunkLines.push(line);
          combinedLines.push(line);
        }
      } catch (e) {}
    }

    // Write back deduplicated chunk file
    fs.writeFileSync(fPath, uniqueChunkLines.join("\n") + "\n", "utf8");

    totalBefore += lines.length;
    totalKept += uniqueChunkLines.length;
    totalDupHistory += dupCount;

    statsTable.push({
      "Chunk File": fName,
      "Before": lines.length,
      "Unique Kept": uniqueChunkLines.length,
      "Duplicates Removed": dupCount,
    });
  }

  // Write master combined.json
  fs.writeFileSync(COMBINED_OUTPUT, combinedLines.join("\n") + "\n", "utf8");

  console.table(statsTable);
  console.log(`\n🎉 Full Deduplication Complete:`);
  console.log(`- Total Records Processed (2026-08-18): ${totalBefore.toLocaleString()}`);
  console.log(`- Total Strictly Unique Records Kept:   ${totalKept.toLocaleString()}`);
  console.log(`- Total Duplicates Filtered Out:        ${(totalBefore - totalKept).toLocaleString()}`);
  console.log(`- Master Combined Output:               ${COMBINED_OUTPUT}`);
}

deduplicate();
