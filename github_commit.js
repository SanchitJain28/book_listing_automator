const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");

const OWNER = "SanchitJain28";
const REPO = "book_listing_automator";
const SEARCH_DIR = path.join(__dirname, "output");

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = match[2];
      }
    }
  }
}

function getAllJsonFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach(function (file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllJsonFiles(fullPath, arrayOfFiles);
    } else {
      if (file.endsWith(".json")) {
        arrayOfFiles.push(fullPath);
      }
    }
  });
  return arrayOfFiles;
}

async function run() {
  loadEnv();

  if (!process.env.GITHUB_TOKEN) {
    console.error("❌ Error: GITHUB_TOKEN is not set in .env");
    process.exit(1);
  }

  if (!fs.existsSync(SEARCH_DIR)) {
    console.error(`❌ Error: Output directory not found: ${SEARCH_DIR}`);
    process.exit(1);
  }

  const allFiles = getAllJsonFiles(SEARCH_DIR);
  if (allFiles.length === 0) {
    console.log(
      "⚠️ No JSON files found in output directory. Nothing to commit.",
    );
    return;
  }

  allFiles.sort((a, b) => {
    return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
  });

  console.log("\nAvailable files to commit:");
  allFiles.forEach((file, index) => {
    const displayPath = path.relative(SEARCH_DIR, file);
    console.log(`  [${index + 1}] ${displayPath}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(`\nWhich file do you want to commit? [1]: `, resolve);
  });
  rl.close();

  const selectedIndex = parseInt(answer.trim() || "1") - 1;
  if (
    isNaN(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= allFiles.length
  ) {
    console.error("❌ Invalid selection.");
    process.exit(1);
  }

  const filePath = allFiles[selectedIndex];
  const repoFilePath = path.relative(__dirname, filePath).replace(/\\/g, "/"); // ensure forward slashes for git

  console.log(`📄 Selected file: ${repoFilePath}`);
  console.log(
    `📦 Size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`,
  );

  console.log("⚙️ Configuring Git...");
  try {
    execSync(`git config user.email "vps@booklistingautomator.com"`);
    execSync(`git config user.name "VPS Bot"`);
    // Mask URL in logs by running it silently
    execSync(
      `git remote set-url origin https://${OWNER}:${process.env.GITHUB_TOKEN}@github.com/${OWNER}/${REPO}.git`,
      { stdio: "ignore" },
    );
  } catch (err) {
    console.error("❌ Failed to configure git.");
    process.exit(1);
  }

  console.log("➕ Adding file to git...");
  execSync(`git add -f "${repoFilePath}"`);

  try {
    execSync(
      `git commit -m "Automated upload of output: ${path.basename(repoFilePath)}"`,
      { stdio: "ignore" },
    );
  } catch (e) {
    console.log("⚠️ Nothing to commit (file might already be committed).");
    // We don't exit here just in case they just need to push an already committed file
  }

  console.log(
    "🚀 Pushing to GitHub (this natively handles large files flawlessly)...",
  );

  let retries = 5;
  let pushed = false;

  while (retries > 0) {
    try {
      // Pull with rebase to cleanly stack our commit on top if someone else pushed
      console.log("🔄 Syncing with remote repository...");
      execSync(`git pull --rebase origin main`, { stdio: "ignore" });

      console.log("📤 Uploading...");
      execSync(`git push origin main`, { stdio: "inherit" });
      pushed = true;
      console.log(
        `🎉 Successfully pushed ${path.basename(repoFilePath)} to GitHub!`,
      );
      break;
    } catch (err) {
      console.warn(
        `⚠️ Git push rejected (likely a concurrent push). Retrying... (${retries - 1} attempts left)`,
      );
      retries--;
      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  // Restore the safe URL so we don't leave the token in the git config!
  execSync(
    `git remote set-url origin https://github.com/${OWNER}/${REPO}.git`,
    { stdio: "ignore" },
  );

  if (!pushed) {
    console.error("❌ Failed to push after maximum retries.");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("❌ Unexpected Error:", err);
  process.exit(1);
});
