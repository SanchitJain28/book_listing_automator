const fs = require("fs");
const path = require("path");

const isbnFile = process.argv[2];
const priceFile = process.argv[3];
const outputFile = process.argv[4] || "combined_list.txt";

if (!isbnFile || !priceFile) {
  console.error(
    "❌ Error: You must provide both an ISBN file and a Price file.",
  );
  process.exit(1);
}

try {
  const isbns = fs
    .readFileSync(isbnFile, "utf-8")
    .split("\n")
    .map((i) => i.trim())
    .filter(Boolean);
  const prices = fs
    .readFileSync(priceFile, "utf-8")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const combinedData = [];
  const limit = Math.min(isbns.length, prices.length);

  for (let i = 0; i < limit; i++) {
    // 🔥 FIX: Remove any commas or quotes from the price before merging
    const cleanPrice = prices[i].replace(/,/g, "").replace(/"/g, "");
    combinedData.push(`${isbns[i]},${cleanPrice}`);
  }

  fs.writeFileSync(outputFile, combinedData.join("\n"), "utf-8");
  console.log(
    `✅ Success! Combined ${limit} rows perfectly. Saved as: ${outputFile}`,
  );
} catch (err) {
  console.error(`❌ Error processing files: ${err.message}`);
}
