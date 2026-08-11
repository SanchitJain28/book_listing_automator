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

const prompts = [
  "Select Platform",
  "Select Intent",
  "Select Stage or Date",
  "Select Date or Round",
  "Select Subfolder or File"
];

function formatDateLabel(name) {
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = name.match(dateRegex);
  if (match) {
    const year = match[1];
    const monthStr = match[2];
    const day = parseInt(match[3], 10);
    
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = months[parseInt(monthStr, 10) - 1];
    
    let suffix = "th";
    if (day % 10 === 1 && day !== 11) suffix = "st";
    else if (day % 10 === 2 && day !== 12) suffix = "nd";
    else if (day % 10 === 3 && day !== 13) suffix = "rd";
    
    return `${day}${suffix} ${month} ${year}`;
  }
  return name;
}

async function navigateAndSelectFile(currentPath, depth = -1) {
  if (!fs.existsSync(currentPath)) return null;

  let items = [];
  if (depth === -1) {
    items = ['input-data', 'output'].filter(f => fs.existsSync(path.join(currentPath, f)));
  } else {
    items = fs.readdirSync(currentPath).filter(f => !f.startsWith('.') && f !== 'node_modules' && f !== 'export');
  }
  
  const dirs = [];
  const files = [];

  for (const item of items) {
    const fullPath = path.join(currentPath, item);
    if (fs.statSync(fullPath).isDirectory()) {
      dirs.push({ name: item, path: fullPath, type: 'dir' });
    } else {
      if (['.txt', '.json', '.jsonl'].includes(path.extname(item))) {
        files.push({ name: item, path: fullPath, type: 'file' });
      }
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  const options = [...dirs, ...files];

  if (options.length === 0) {
    console.log("⚠️ No files or folders found here.");
    return depth > -1 ? navigateAndSelectFile(path.dirname(currentPath), depth - 1) : null;
  }

  const promptMsg = depth === -1 ? "Select Data Source" : prompts[Math.min(depth, prompts.length - 1)];
  const displayPath = depth === -1 ? 'root' : (path.relative(__dirname, currentPath) || 'root');
  console.log(`\n📂 ${promptMsg} (in ${displayPath}):`);
  
  options.forEach((opt, idx) => {
    const icon = opt.type === 'dir' ? '📁' : '📄';
    console.log(`  [${idx + 1}] ${icon} ${formatDateLabel(opt.name)}`);
  });

  if (depth > -1) {
    console.log(`  [0] 🔙 Go Back`);
  }

  let choice = -1;
  while (true) {
    const choiceStr = await askQuestion(`\n👉 Enter your choice: `);
    choice = parseInt(choiceStr, 10);
    if (depth > -1 && choice === 0) {
      return navigateAndSelectFile(path.dirname(currentPath), depth - 1);
    }
    if (!isNaN(choice) && choice >= 1 && choice <= options.length) {
      break;
    }
    console.log("❌ Invalid choice, try again.");
  }

  const selected = options[choice - 1];
  if (selected.type === 'dir') {
    return navigateAndSelectFile(selected.path, depth + 1);
  } else {
    return selected.path;
  }
}

async function main() {
  console.log("\n🚀 Welcome to the Book Listing Automator Runner!\n");

  // 1. Find and select Input File
  const selectedFullPath = await navigateAndSelectFile(__dirname, -1);
  
  if (!selectedFullPath) {
    console.log("❌ File selection cancelled or failed. Exiting.");
    process.exit(1);
  }

  const selectedInput = path.relative(__dirname, selectedFullPath);
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
