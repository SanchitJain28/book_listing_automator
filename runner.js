const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to recursively find files
function findFiles(dir, extList, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'export') continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, extList, fileList);
    } else {
      if (extList.includes(path.extname(filePath))) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

async function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log("\n🚀 Welcome to the Book Listing Automator Runner!\n");

  // 1. Find and select Input File
  const inputDirs = [
    path.join(__dirname, 'input-data'),
    path.join(__dirname, 'output')
  ];
  let allInputs = [];
  for (const dir of inputDirs) {
    allInputs = findFiles(dir, ['.txt', '.json', '.jsonl'], allInputs);
  }

  // Sort by recently modified
  allInputs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  
  // Show top 15
  const recentInputs = allInputs.slice(0, 15);

  console.log("📂 Recently Created/Modified Input Files:");
  recentInputs.forEach((file, index) => {
    // Make path relative for easier reading
    const relativePath = path.relative(__dirname, file);
    console.log(`  [${index + 1}] ${relativePath}`);
  });

  const inputChoice = await askQuestion("\n👉 Select an input file (enter the number): ");
  const inputIndex = parseInt(inputChoice, 10) - 1;
  
  if (isNaN(inputIndex) || inputIndex < 0 || inputIndex >= recentInputs.length) {
    console.error("❌ Invalid selection. Exiting.");
    process.exit(1);
  }
  
  const selectedInput = path.relative(__dirname, recentInputs[inputIndex]);

  // 2. Find and select Scraper
  console.log("\n🤖 Available Scrapers:");
  const scrapersDir = path.join(__dirname, 'scrapers');
  const allScrapers = findFiles(scrapersDir, ['.js']);
  
  allScrapers.forEach((file, index) => {
    const relativePath = path.relative(__dirname, file);
    console.log(`  [${index + 1}] ${relativePath}`);
  });

  const scraperChoice = await askQuestion("\n👉 Select a scraper to run (enter the number): ");
  const scraperIndex = parseInt(scraperChoice, 10) - 1;

  if (isNaN(scraperIndex) || scraperIndex < 0 || scraperIndex >= allScrapers.length) {
    console.error("❌ Invalid selection. Exiting.");
    process.exit(1);
  }

  const selectedScraper = path.relative(__dirname, allScrapers[scraperIndex]);

  // 3. Ask for headless mode
  const headlessChoice = await askQuestion("\n👻 Run in headless mode? (Y/n): ");
  const isHeadless = headlessChoice.toLowerCase() !== 'n';

  // 4. Ask for background mode (tmux)
  const bgChoice = await askQuestion("\n🖥️  Run in background using tmux? (Y/n): ");
  const isBackground = bgChoice.toLowerCase() !== 'n';

  console.log("\n==================================================");
  console.log(`🎯 TARGET SCRIPT:  ${selectedScraper}`);
  console.log(`📄 INPUT FILE:     ${selectedInput}`);
  console.log(`👻 HEADLESS:       ${isHeadless ? 'Yes' : 'No'}`);
  console.log(`🖥️  BACKGROUND:     ${isBackground ? 'Yes (tmux)' : 'No (terminal)'}`);
  console.log("==================================================\n");

  rl.close();

  // 5. Spawn the child process
  const args = [selectedScraper, selectedInput];
  if (isHeadless) {
    args.push('--headless');
  }

  if (isBackground) {
    const { execSync } = require('child_process');
    const sessionName = "scrape_" + Math.floor(Math.random() * 10000);
    const cmd = `tmux new-session -d -s ${sessionName} "node ${args.join(' ')}"`;
    
    try {
      execSync(cmd);
      console.log(`✅ Scraper is now running safely in the background!`);
      console.log(`\n👀 To view it live at any time, run:`);
      console.log(`   \x1b[36mtmux attach -t ${sessionName}\x1b[0m\n`);
      console.log(`(Remember: To exit the view safely without killing the scraper, press Ctrl+B then D)`);
    } catch (e) {
      console.error("❌ Failed to start tmux. Make sure tmux is installed.");
    }
  } else {
    console.log(`> node ${args.join(' ')}\n`);
    const child = spawn('node', args, {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      console.log(`\n✅ Process exited with code ${code}`);
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
