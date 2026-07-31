const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const numChunks = parseInt(process.argv[3] || '6', 10);

if (!inputFile || isNaN(numChunks) || numChunks < 2) {
  console.error("Usage: node utils/split_input.js <path-to-input.txt> [number-of-chunks]");
  process.exit(1);
}

try {
  // Read and clean the input file
  const fileContent = fs.readFileSync(inputFile, 'utf-8');
  const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    console.error("Error: The input file is empty.");
    process.exit(1);
  }

  // Calculate chunks
  const chunkSize = Math.ceil(lines.length / numChunks);
  const inputDir = path.dirname(inputFile);
  const chunksDir = path.join(inputDir, 'chunks');

  // Create the chunks directory if it doesn't exist
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  console.log(`Splitting ${lines.length} lines into ${numChunks} chunks (approx ${chunkSize} lines each)...`);

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = start + chunkSize;
    const chunkLines = lines.slice(start, end);

    if (chunkLines.length > 0) {
      // Determine the suffix based on the chunk index
      let suffix = i === 0 ? "local" : `vps${i}`;
      const chunkFileName = `chunk-${i + 1}-${suffix}.txt`;
      const chunkFilePath = path.join(chunksDir, chunkFileName);

      fs.writeFileSync(chunkFilePath, chunkLines.join('\n'));
      console.log(`✔ Created: ${chunkFilePath} (${chunkLines.length} lines)`);
    }
  }

  console.log("\n🎉 File successfully split!");

} catch (err) {
  console.error("An error occurred:", err.message);
  process.exit(1);
}
