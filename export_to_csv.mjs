import fs from 'fs';
import path from 'path';
import { AsyncParser } from '@json2csv/node';

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: node export_to_csv.mjs <input.json> <output.csv>');
  process.exit(1);
}

async function exportToCsv() {
  try {
    const fileContent = fs.readFileSync(inputFile, 'utf-8');
    const lines = fileContent.split('\n').filter(Boolean);
    const jsonData = lines.map(line => JSON.parse(line));

    if (jsonData.length === 0) {
      console.log(`File ${inputFile} is empty.`);
      return;
    }

    const parser = new AsyncParser();
    const csv = await parser.parse(jsonData).promise();

    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, csv);
    console.log(`Successfully exported to: ${outputFile}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

exportToCsv();
