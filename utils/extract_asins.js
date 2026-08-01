const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../output/amazon-search-term');

const targetFiles = [
    'chunks-chunk-1-local-stage-1.json',
    'chunks-chunk-2-vps1-stage-1.json',
    'chunks-chunk-3-vps2-stage-1.json',
    'chunks-chunk-4-vps3-stage-1.json',
    'chunks-chunk-5-vps4-stage-1.json',
    'chunks-chunk-6-vps5-stage-1.json',
    'search-term-31thJuly-input-stage-1.json'
];

const files = targetFiles.filter(f => fs.existsSync(path.join(dir, f)));

const asins = new Set();
let totalProcessed = 0;

for (const file of files) {
    const filePath = path.join(dir, file);
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    
    for (const line of lines) {
        try {
            const data = JSON.parse(line);
            // We only want valid ASINs (Amazon Standard Identification Numbers are usually 10 chars)
            if (data.asin && data.asin !== 'N/A') {
                asins.add(data.asin);
            }
        } catch (e) {
            // Ignore parse errors on malformed lines
        }
    }
    totalProcessed += lines.length;
    console.log(`✔ Read ${lines.length} items from ${file}`);
}

const outPath = path.join(dir, 'stage2-input-asins.txt');
fs.writeFileSync(outPath, Array.from(asins).join('\n'));

console.log(`\n==================================================`);
console.log(`🎉 EXTRACTION COMPLETE!`);
console.log(`Processed:      ${totalProcessed} total items`);
console.log(`Unique ASINs:   ${asins.size}`);
console.log(`Duplicates:     ${totalProcessed - asins.size}`);
console.log(`Saved to:       ${outPath}`);
console.log(`==================================================\n`);
console.log(`You can now split this new file for Stage 2:`);
console.log(`node utils/split_input.js output/amazon-search-term/stage2-input-asins.txt 6`);
