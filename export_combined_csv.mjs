import fs from 'fs';
import path from 'path';
import { AsyncParser } from '@json2csv/node';

const inputDir = process.argv[2];
const outputFile = process.argv[3];

if (!inputDir || !outputFile) {
  console.error('Usage: node export_combined_csv.mjs <input_dir> <output.csv>');
  process.exit(1);
}

async function exportCombinedCsv() {
  try {
    const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));
    let combinedData = [];

    for (const file of files) {
      const filePath = path.join(inputDir, file);
      console.log(`Reading ${filePath}...`);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(Boolean);
      const jsonData = lines.map(line => JSON.parse(line));
      combinedData = combinedData.concat(jsonData);
    }

    if (combinedData.length === 0) {
      console.log(`No data found in ${inputDir}.`);
      return;
    }

    console.log(`Converting ${combinedData.length} total records to CSV...`);
    const parser = new AsyncParser();
    const csv = await parser.parse(combinedData).promise();

    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, csv);
    console.log(`Successfully exported combined data to: ${outputFile}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

exportCombinedCsv();
