const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const chunksDir = path.join(__dirname, "..", "input-data", "search-term-31thJuly", "chunks");

rl.question('Enter VPS number (0 for local Mac, 1-5 for VPS servers): ', (vpsNum) => {
  const num = parseInt(vpsNum.trim(), 10);
  
  let fileName = "";
  if (num === 0) {
    fileName = "chunk-1-local.txt";
  } else if (num >= 1 && num <= 5) {
    fileName = `chunk-${num + 1}-vps${num}.txt`;
  } else {
    console.error("❌ Invalid VPS number. Must be between 0 and 5.");
    rl.close();
    process.exit(1);
  }

  const inputFile = path.join(chunksDir, fileName);

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: File ${inputFile} does not exist!`);
    rl.close();
    process.exit(1);
  }

  rl.question('Enter the last successfully processed term to cut off (e.g. Emma Heyderman): ', (termToCut) => {
    if (!termToCut || termToCut.trim() === "") {
      console.error("❌ Error: You must enter a valid search term.");
      rl.close();
      process.exit(1);
    }

    try {
      const content = fs.readFileSync(inputFile, 'utf-8');
      const lines = content.split('\n');

      const targetIndex = lines.findIndex(line => line.trim() === termToCut.trim());

      if (targetIndex === -1) {
        console.error(`❌ Error: Term "${termToCut}" not found in ${fileName}`);
      } else {
        // Slice the array to keep only everything AFTER the target index
        const remainingLines = lines.slice(targetIndex + 1);

        // Write it back to the original file
        fs.writeFileSync(inputFile, remainingLines.join('\n'));

        console.log(`\n✅ Successfully trimmed ${fileName}!`);
        console.log(`Removed ${targetIndex + 1} lines (including "${termToCut}").`);
        console.log(`There are ${remainingLines.filter(Boolean).length} lines remaining to be processed.`);
      }
    } catch (err) {
      console.error("An error occurred:", err.message);
    }

    rl.close();
  });
});
