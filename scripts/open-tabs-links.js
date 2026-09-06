const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for user input in terminal
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    }),
  );
}

// AppleScript runner
function runAppleScript(script) {
  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      stdio: "pipe",
    });
  } catch (err) {
    console.error("⚠️ AppleScript execution error:", err.message);
  }
}

// Open tab in the RIGHT-HAND Chrome window specifically
function openTabInRightWindow(url, targetSide = "right") {
  const script = `
    tell application "Google Chrome"
      if (count of windows) = 0 then
        make new window
        set URL of active tab of front window to "${url.replace(/"/g, '\\"')}"
      else
        set targetWin to missing value
        set bestX to ${targetSide === "right" ? "-999999" : "999999"}
        
        repeat with w in windows
          set winBounds to bounds of w
          set winLeft to item 1 of winBounds
          
          ${
            targetSide === "right"
              ? `if winLeft > bestX then
                   set bestX to winLeft
                   set targetWin to w
                 end if`
              : `if winLeft < bestX then
                   set bestX to winLeft
                   set targetWin to w
                 end if`
          }
        end repeat
        
        if targetWin is not missing value then
          tell targetWin
            make new tab with properties {URL:"${url.replace(/"/g, '\\"')}"}
          end tell
        else
          tell front window
            make new tab with properties {URL:"${url.replace(/"/g, '\\"')}"}
          end tell
        end if
      end if
    end tell
  `;
  runAppleScript(script);
}

// Sequentially open tabs with a configurable delay (default 1 second)
async function openBatchSequentially(
  urls,
  delayMs = 1000,
  targetSide = "right",
) {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    process.stdout.write(
      `  [${i + 1}/${urls.length}] 🌐 Opening URL: ${url.length > 80 ? url.substring(0, 77) + "..." : url}`,
    );

    openTabInRightWindow(url, targetSide);

    if (i < urls.length - 1) {
      process.stdout.write(` (waiting ${delayMs / 1000}s)...\n`);
      await sleep(delayMs);
    } else {
      process.stdout.write(` ✅ Done!\n`);
    }
  }
}

async function main() {
  console.clear();
  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║   🔗 Direct URL Tab Opener (Split-Screen Right Window)         ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝\n",
  );

  // Parse CLI args
  const args = process.argv.slice(2);
  let inputFile = args.find((a) => !a.startsWith("--"));
  const batchArg = args.find((a) => a.startsWith("--batch="));
  const delayArg = args.find((a) => a.startsWith("--delay="));
  const sideArg = args.find((a) => a.startsWith("--window="));
  const isExact = args.includes("--exact");
  const domainArg = args.find(
    (a) =>
      a.startsWith("--domain=") ||
      a.startsWith("--site=") ||
      a.startsWith("--filter="),
  );
  let targetDomain = null;
  if (domainArg) {
    targetDomain = domainArg
      .split("=")[1]
      .toLowerCase()
      .replace(/^https?:\/\//, "");
    if (!isExact) {
      targetDomain = targetDomain.replace(/^www\./, "");
    }
  }
  const isDistinct = args.includes("--distinct") || args.includes("--unique");
  const isAll =
    args.includes("--all") ||
    (batchArg && batchArg.toLowerCase().includes("all"));
  const isReset = args.includes("--reset");

  let batchSize = isAll ? 999999 : 25;
  if (batchArg && !isAll) {
    batchSize = parseInt(batchArg.split("=")[1], 10) || 25;
  }

  let delayMs = 1000; // 1 second per tab
  if (delayArg) {
    const parsedDelay = parseFloat(delayArg.split("=")[1]);
    delayMs = parsedDelay < 50 ? parsedDelay * 1000 : parsedDelay;
  }

  let targetSide = "right"; // Targets right window by default
  if (sideArg) {
    targetSide =
      sideArg.split("=")[1].toLowerCase() === "left" ? "left" : "right";
  }

  // Default input file if none given
  if (!inputFile) {
    inputFile = path.join(process.cwd(), "links.txt");
  } else if (!path.isAbsolute(inputFile)) {
    inputFile = path.join(process.cwd(), inputFile);
  }

  if (!fs.existsSync(inputFile)) {
    console.log(`ℹ️ File "${inputFile}" not found.`);
    return;
  }

  // Read URLs
  const rawLines = fs.readFileSync(inputFile, "utf8").split("\n");
  let urls = rawLines
    .map((l) => l.trim())
    .filter((l) => l && (l.startsWith("http://") || l.startsWith("https://")));

  if (targetDomain) {
    if (isExact) {
      urls = urls.filter((u) => {
        try {
          const parsed = new URL(u);
          return parsed.hostname.toLowerCase() === targetDomain;
        } catch (e) {
          return false;
        }
      });
    } else {
      urls = urls.filter((u) => u.toLowerCase().includes(targetDomain));
    }
  }

  if (urls.length === 0) {
    console.log(
      `❌ No matching URLs found for "${targetDomain || inputFile}". Please check your filter and try again.`,
    );
    return;
  }

  if (isDistinct) {
    const seenDomains = new Set();
    const distinctList = [];
    for (const u of urls) {
      try {
        const host = new URL(u).hostname.replace(/^www\./, "").toLowerCase();
        if (!seenDomains.has(host)) {
          seenDomains.add(host);
          distinctList.push(u);
        }
      } catch (e) {}
    }
    urls = distinctList;
  }

  console.log(`📁 Input File: ${inputFile}`);
  console.log(
    `📊 Total URLs: ${urls.length.toLocaleString()}${isDistinct ? " (Unique Websites Only)" : ""}`,
  );
  if (targetDomain) {
    console.log(`🎯 Domain Filter: 🟢 "${targetDomain}" (${urls.length} link${urls.length > 1 ? "s" : ""})`);
  }
  if (isDistinct) {
    console.log(`🌐 Distinct Mode: 🟢 Active (1 link per unique domain)`);
  }
  console.log(`📦 Batch Size: ${isAll ? "ALL" : batchSize} tabs`);
  console.log(`🖥️ Target Window: RIGHT-HAND Chrome Window`);
  console.log(`⏱️ Speed: ${delayMs / 1000}s per tab\n`);

  // Progress state file
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const domainSuffix = targetDomain
    ? `-${targetDomain.replace(/[^a-z0-9]/g, "_")}`
    : "";
  const progressSuffix = (isDistinct ? "-distinct" : "") + domainSuffix;
  const progressFile = path.join(
    __dirname,
    `.open-tabs-progress-links-${baseName}${progressSuffix}.json`,
  );
  let currentIndex = 0;

  if (fs.existsSync(progressFile) && !isReset) {
    try {
      const state = JSON.parse(fs.readFileSync(progressFile, "utf8"));
      if (
        state.inputFile === inputFile &&
        typeof state.currentIndex === "number"
      ) {
        currentIndex = state.currentIndex;
        if (currentIndex > 0 && currentIndex < urls.length) {
          console.log(
            `🔄 Resuming from link #${currentIndex + 1} (${currentIndex} already viewed).`,
          );
        }
      }
    } catch (e) {}
  }

  function saveProgress(idx) {
    fs.writeFileSync(
      progressFile,
      JSON.stringify(
        { inputFile, currentIndex: idx, lastUpdated: new Date().toISOString() },
        null,
        2,
      ),
      "utf8",
    );
  }

  while (currentIndex < urls.length) {
    const end = Math.min(currentIndex + batchSize, urls.length);
    const currentBatch = urls.slice(currentIndex, end);
    const batchNumber = Math.floor(currentIndex / batchSize) + 1;
    const totalBatches = Math.ceil(urls.length / batchSize);

    console.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );
    console.log(
      `🚀 [Batch ${batchNumber}/${totalBatches}] Opening ${currentBatch.length} links (#${currentIndex + 1} to #${end}) in Chrome...`,
    );
    console.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );

    await openBatchSequentially(currentBatch, delayMs, targetSide);

    console.log(
      `\n✅ ${currentBatch.length} tabs opened in your Chrome window.`,
    );

    if (end >= urls.length || isAll) {
      currentIndex = urls.length;
      break;
    }

    console.log(`\nOptions:`);
    console.log(`  👉 Press [ENTER]       : Open NEXT ${batchSize} links`);
    console.log(`  👉 Type 'r' + [ENTER] : Re-open current batch`);
    console.log(`  👉 Type 'p' + [ENTER] : Go BACK to previous batch`);
    console.log(`  👉 Type 'q' + [ENTER] : Save progress & Quit\n`);

    const answer = await askQuestion("Your choice: ");

    if (answer.toLowerCase() === "q") {
      saveProgress(currentIndex);
      console.log(
        `\n💾 Progress saved at link #${currentIndex + 1}. You can resume anytime! Goodbye.`,
      );
      break;
    } else if (answer.toLowerCase() === "r") {
      continue;
    } else if (answer.toLowerCase() === "p") {
      currentIndex = Math.max(0, currentIndex - batchSize);
      saveProgress(currentIndex);
      continue;
    } else {
      // Default: Enter pressed -> proceed to next batch
      currentIndex = end;
      saveProgress(currentIndex);
    }
  }

  if (currentIndex >= urls.length) {
    console.log("\n🎉 ALL LINKS COMPLETED! You have reviewed all URLs.");
    if (fs.existsSync(progressFile)) {
      fs.unlinkSync(progressFile);
    }
  }
}

main().catch((err) => console.error("Error:", err));
