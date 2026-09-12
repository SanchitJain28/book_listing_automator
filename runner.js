const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { spawn } = require("child_process");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper to recursively find executable scraper files
function findFiles(dir, extList, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (
      file === "node_modules" ||
      file === ".git" ||
      file === "export" ||
      file === "core"
    )
      continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, extList, fileList);
    } else {
      if (extList.includes(path.extname(filePath)) && file !== "scraper.js") {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

async function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

const prompts = [
  "Select Platform",
  "Select Intent",
  "Select Stage or Date",
  "Select Date or Round",
  "Select Subfolder or File",
];

function formatDateLabel(name) {
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = name.match(dateRegex);
  if (match) {
    const year = match[1];
    const monthStr = match[2];
    const day = parseInt(match[3], 10);

    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
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
    items = ["input-data", "output"].filter((f) =>
      fs.existsSync(path.join(currentPath, f)),
    );
  } else {
    items = fs
      .readdirSync(currentPath)
      .filter(
        (f) => !f.startsWith(".") && f !== "node_modules" && f !== "export",
      );
  }

  const dirs = [];
  const files = [];

  for (const item of items) {
    if (item === "config.json" || item === ".DS_Store") continue;
    const fullPath = path.join(currentPath, item);
    if (fs.statSync(fullPath).isDirectory()) {
      dirs.push({ name: item, path: fullPath, type: "dir" });
    } else {
      if ([".txt", ".json", ".jsonl"].includes(path.extname(item))) {
        files.push({ name: item, path: fullPath, type: "file" });
      }
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  const options = [...dirs, ...files];

  if (options.length === 0) {
    console.log("⚠️ No files or folders found here.");
    return depth > -1
      ? navigateAndSelectFile(path.dirname(currentPath), depth - 1)
      : null;
  }

  const promptMsg =
    depth === -1
      ? "Select Data Source"
      : prompts[Math.min(depth, prompts.length - 1)];
  const displayPath =
    depth === -1 ? "root" : path.relative(__dirname, currentPath) || "root";
  console.log(`\n📂 ${promptMsg} (in ${displayPath}):`);

  options.forEach((opt, idx) => {
    const icon = opt.type === "dir" ? "📁" : "📄";
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
  if (selected.type === "dir") {
    return navigateAndSelectFile(selected.path, depth + 1);
  } else {
    return selected.path;
  }
}

// Helper to find recommended scraper from config.json or path heuristics
function findRecommendedScraper(inputFullPath) {
  let dir = path.dirname(path.resolve(inputFullPath));
  const workspaceRoot = path.resolve(__dirname);

  // 1. Check for config.json in directory and ancestor directories up to workspace
  while (dir.startsWith(workspaceRoot)) {
    const configPath = path.join(dir, "config.json");
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const rec =
          config.scraper ||
          config.recommended_scraper ||
          config.default_scraper;
        if (rec) return rec;
      } catch (e) {}
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 2. Fallback: Heuristic based on input path
  const lowerPath = inputFullPath.toLowerCase();
  if (lowerPath.includes("abebooks-uk"))
    return "scrapers/abebooks-uk/abebooks-uk-isbn.js";
  if (lowerPath.includes("abebooks"))
    return "scrapers/abebooks/abebooks-isbn.js";
  if (lowerPath.includes("iberlibro"))
    return "scrapers/iberlibro/iberlibro-isbn.js";
  if (lowerPath.includes("amazon-us"))
    return "scrapers/amazon-us-isbn/amazon-us-isbn.js";
  if (lowerPath.includes("amazon-ca"))
    return "scrapers/amazon-ca-isbn/amazon-ca-isbn.js";
  if (lowerPath.includes("amazon-uk"))
    return "scrapers/amazon-uk-isbn/amazon-uk-isbn.js";
  if (lowerPath.includes("amazon-india"))
    return "scrapers/amazon-isbn/amazon-isbn.js";
  if (lowerPath.includes("flipkart"))
    return "scrapers/flipkart/flipkart-isbn.js";
  if (lowerPath.includes("sapnaonline"))
    return "scrapers/sapnaonline/sapnaonline-isbn.js";
  if (lowerPath.includes("bookswagon"))
    return "scrapers/bookswagon/bookswagon-isbn.js";
  if (lowerPath.includes("bookchor"))
    return "scrapers/bookchor/bookchor-isbn.js";
  if (lowerPath.includes("mypustak"))
    return "scrapers/mypustak/mypustak-isbn.js";
  if (lowerPath.includes("atlanticbooks"))
    return "scrapers/atlanticbooks/atlanticbooks-isbn.js";
  if (lowerPath.includes("bestbookmart"))
    return "scrapers/bestbookmart/bestbookmart-isbn.js";
  if (lowerPath.includes("agapea")) return "scrapers/agapea/agapea-isbn.js";
  if (lowerPath.includes("google-links"))
    return "scrapers/google-links/google-links-isbn.js";

  return null;
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

  // 2. Find and select Scraper with Recommendation Support
  const scrapersDir = path.join(__dirname, "scrapers");
  const allScraperPaths = findFiles(scrapersDir, [".js"]);
  const allScrapers = allScraperPaths
    .map((f) => path.relative(__dirname, f))
    .sort((a, b) => a.localeCompare(b));

  const recommended = findRecommendedScraper(selectedFullPath);
  let sortedScrapers = [...allScrapers];

  if (recommended) {
    const normRec = recommended.replace(/\\/g, "/");
    const matchedIdx = sortedScrapers.findIndex(
      (s) => s.replace(/\\/g, "/") === normRec || s.includes(normRec),
    );
    if (matchedIdx > -1) {
      const recItem = sortedScrapers.splice(matchedIdx, 1)[0];
      sortedScrapers.unshift(recItem);
    }
  }

  console.log("\n🤖 Available Scrapers:");
  sortedScrapers.forEach((file, index) => {
    if (index === 0 && recommended) {
      console.log(
        `  [\x1b[32m${index + 1}\x1b[0m] \x1b[1;32m⭐ RECOMMENDED:\x1b[0m \x1b[36m${file}\x1b[0m \x1b[90m(Press [ENTER] to select)\x1b[0m`,
      );
    } else {
      console.log(`  [${index + 1}] ${file}`);
    }
  });

  const promptText = recommended
    ? `\n👉 Select a scraper to run [default: 1 (${sortedScrapers[0]})]: `
    : `\n👉 Select a scraper to run (enter the number): `;

  const scraperChoice = await askQuestion(promptText);
  let scraperIndex = 0;

  if (scraperChoice.trim() === "") {
    scraperIndex = 0; // Default to option 1 (recommended)
  } else {
    scraperIndex = parseInt(scraperChoice, 10) - 1;
  }

  if (
    isNaN(scraperIndex) ||
    scraperIndex < 0 ||
    scraperIndex >= sortedScrapers.length
  ) {
    console.error("❌ Invalid selection. Exiting.");
    process.exit(1);
  }

  const selectedScraper = sortedScrapers[scraperIndex];

  // 3. Ask for headless mode
  const headlessChoice = await askQuestion(
    "\n👻 Run in headless mode? (Y/n): ",
  );
  const isHeadless = headlessChoice.toLowerCase() !== "n";

  // 4. Ask for background mode (tmux)
  const bgChoice = await askQuestion(
    "\n🖥️  Run in background using tmux? (Y/n): ",
  );
  const isBackground = bgChoice.toLowerCase() !== "n";

  console.log("\n==================================================");
  console.log(`🎯 TARGET SCRIPT:  ${selectedScraper}`);
  console.log(`📄 INPUT FILE:     ${selectedInput}`);
  console.log(`👻 HEADLESS:       ${isHeadless ? "Yes" : "No"}`);
  console.log(`🛡️  WATCHER:        Enabled (Auto-Restart on Crash/Stall)`);
  console.log(
    `🖥️  BACKGROUND:     ${isBackground ? "Yes (tmux)" : "No (terminal)"}`,
  );
  console.log("==================================================\n");

  rl.close();

  // 5. Spawn the child process wrapped with the Watcher supervisor
  const watcherScript = path.relative(
    __dirname,
    path.join(__dirname, "utils", "watcher.js"),
  );
  const scraperArgs = [selectedScraper, selectedInput];
  if (isHeadless) {
    scraperArgs.push("--headless");
  }

  const fullArgs = [watcherScript, ...scraperArgs];

  if (isBackground) {
    const { execSync } = require("child_process");
    const sessionName = "scrape_" + Math.floor(Math.random() * 10000);
    const cmd = `tmux new-session -d -s ${sessionName} "node ${fullArgs.join(" ")}"`;

    try {
      execSync(cmd);
      console.log(
        `✅ Scraper is now running safely in the background under Watcher supervision!`,
      );
      console.log(`\n👀 To view it live at any time, run:`);
      console.log(`   \x1b[36mtmux attach -t ${sessionName}\x1b[0m\n`);
      console.log(
        `(Remember: To exit the view safely without killing the scraper, press Ctrl+B then D)`,
      );
    } catch (e) {
      console.error("❌ Failed to start tmux. Make sure tmux is installed.");
    }
  } else {
    console.log(`> node ${fullArgs.join(" ")}\n`);
    const child = spawn("node", fullArgs, {
      stdio: "inherit",
    });

    child.on("close", (code) => {
      console.log(`\n✅ Watcher exited with code ${code}`);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
