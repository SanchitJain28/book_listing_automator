const fs = require('fs');

const inputFile = process.argv[2];
const termToCut = process.argv.slice(3).join(" "); // Join in case term has spaces without quotes

if (!inputFile || !termToCut) {
  console.error("Usage: node utils/trim_input.js <path-to-input.txt> <search-term>");
  process.exit(1);
}

try {
  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.split('\n');

  const targetIndex = lines.findIndex(line => line.trim() === termToCut.trim());

  if (targetIndex === -1) {
    console.error(`❌ Error: Term "${termToCut}" not found in ${inputFile}`);
    process.exit(1);
  }

  // Slice the array to keep only everything AFTER the target index
  const remainingLines = lines.slice(targetIndex + 1);

  // Write it back to the original file
  fs.writeFileSync(inputFile, remainingLines.join('\n'));

  console.log(`✅ Successfully trimmed the file!`);
  console.log(`Removed ${targetIndex + 1} lines (including "${termToCut}").`);
  console.log(`There are ${remainingLines.filter(Boolean).length} lines remaining to be processed.`);
} catch (err) {
  console.error("An error occurred:", err.message);
  process.exit(1);
}
