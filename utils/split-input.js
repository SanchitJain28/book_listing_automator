const fs = require("fs");
const path = require("path");

function splitFile() {
  const inputFile = process.argv[2];
  const parts = parseInt(process.argv[3], 10) || 6;

  if (!inputFile) {
    console.log("Usage: node utils/split-input.js <input-file.txt> [number-of-parts (default 6)]");
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, "utf8");
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);

  console.log(`\n📂 Splitting ${lines.length} items from ${inputFile} into ${parts} equal chunks...\n`);

  const chunkSize = Math.ceil(lines.length / parts);
  const baseDir = path.dirname(inputFile);
  const baseName = path.basename(inputFile, path.extname(inputFile));

  for (let i = 0; i < parts; i++) {
    const chunk = lines.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunk.length === 0) continue;

    const outPath = path.join(baseDir, `${baseName}-part-${i + 1}.txt`);
    fs.writeFileSync(outPath, chunk.join("\n") + "\n", "utf8");
    console.log(`✔ Part ${i + 1}: ${outPath} (${chunk.length} ISBNs)`);
  }

  console.log("\n🎉 Splitting complete!");
}

splitFile();
