const { spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const isHeadless = process.argv.includes('--headless');

function runScraper(inputFile) {
  return new Promise((resolve, reject) => {
    const watcherPath = path.join(ROOT_DIR, 'utils', 'watcher.js');
    const scraperPath = path.join('scrapers', 'amazon-isbn', 'amazon-isbn.js');
    
    const args = [watcherPath, scraperPath, inputFile];
    if (isHeadless) {
      args.push('--headless');
    }

    console.log(`\n==================================================`);
    console.log(`🚀 Starting Task: ${inputFile}`);
    console.log(`==================================================\n`);

    const child = spawn('node', args, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ Completed successfully: ${inputFile}`);
        resolve();
      } else {
        console.error(`\n❌ Failed with exit code ${code}: ${inputFile}`);
        // resolve anyway so next tasks can proceed or notify
        resolve();
      }
    });

    child.on('error', (err) => {
      console.error(`\n❌ Error running ${inputFile}:`, err);
      resolve();
    });
  });
}

async function main() {
  console.log("==================================================");
  console.log("⚡ LOCAL WORKFLOW PIPELINE: 2026-09-06");
  console.log("==================================================");
  console.log("Phase 1: Running input_OX2.txt and input_327.txt in PARALLEL");
  console.log("Phase 2: Once both finish, run input_323.txt");
  console.log(`Mode:    ${isHeadless ? 'Headless' : 'Headful (Visible Browser)'}`);
  console.log("==================================================\n");

  const fileOX2 = 'input-data/amazon-india/isbns/2026-09-06/input_OX2.txt';
  const file327 = 'input-data/amazon-india/isbns/2026-09-06/input_327.txt';
  const file323 = 'input-data/amazon-india/isbns/2026-09-06/input_323.txt';

  // Phase 1
  console.log("▶ Starting Phase 1 (Parallel)...");
  await Promise.all([
    runScraper(fileOX2),
    runScraper(file327)
  ]);

  console.log("\n==================================================");
  console.log("🎉 Phase 1 Finished! Both input_OX2.txt and input_327.txt are done.");
  console.log("==================================================");

  // Phase 2
  console.log("\n▶ Starting Phase 2: Running input_323.txt...");
  await runScraper(file323);

  console.log("\n==================================================");
  console.log("🏁 All Local Scraping Completed Successfully!");
  console.log("==================================================");
}

main().catch(console.error);
