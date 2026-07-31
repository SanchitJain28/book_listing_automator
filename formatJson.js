const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Get the input file from the command line
const inputFile = process.argv[2];

if (!inputFile) {
  console.error("❌ Error: You must provide an input file name.");
  console.error("Usage: node formatJson.js <path_to_your_output_file>");
  process.exit(1);
}

// Ensure the "formatted" directory exists
const outputDir = path.join(__dirname, "formatted");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create the new output file name
const baseName = path.basename(inputFile);
const outputFile = path.join(outputDir, `formatted_${baseName}`);

async function formatFile() {
  console.log(`⏳ Reading and formatting: ${baseName}...`);

  const fileStream = fs.createReadStream(inputFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const jsonArray = [];

  // Read the file line by line to handle large files safely
  for await (const line of rl) {
    if (line.trim()) {
      try {
        jsonArray.push(JSON.parse(line));
      } catch (err) {
        console.error(`⚠️ Skipping invalid JSON line: ${line}`);
      }
    }
  }

  // Write the complete array to the new file with 2-space indentation
  fs.writeFileSync(outputFile, JSON.stringify(jsonArray, null, 2), "utf-8");

  console.log(
    `✅ Success! Formatted JSON saved to: formatted/formatted_${baseName}`,
  );
}

formatFile();
