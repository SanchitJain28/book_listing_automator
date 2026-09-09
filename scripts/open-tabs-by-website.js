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

// Sequentially open tabs for a specific website
async function openWebsiteTabs(urls, domain, delayMs = 1000, targetSide = "right") {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    process.stdout.write(
      `  [${i + 1}/${urls.length}] 🌐 Opening: ${url.length > 85 ? url.substring(0, 82) + "..." : url}`,
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
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║   🌐 Website-by-Website Tab Opener (Right Chrome Window)       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const args = process.argv.slice(2);
  let inputFile = args.find((a) => !a.startsWith("--"));
  const delayArg = args.find((a) => a.startsWith("--delay="));
  const sideArg = args.find((a) => a.startsWith("--window="));
  const isReset = args.includes("--reset");

  let delayMs = 1000;
  if (delayArg) {
    const parsedDelay = parseFloat(delayArg.split("=")[1]);
    delayMs = parsedDelay < 50 ? parsedDelay * 1000 : parsedDelay;
  }

  let targetSide = "right";
  if (sideArg) {
    targetSide = sideArg.split("=")[1].toLowerCase() === "left" ? "left" : "right";
  }

  if (!inputFile) {
    inputFile = path.join(process.cwd(), "links-2.txt");
  } else if (!path.isAbsolute(inputFile)) {
    inputFile = path.join(process.cwd(), inputFile);
  }

  if (!fs.existsSync(inputFile)) {
    console.log(`❌ File not found: ${inputFile}`);
    return;
  }

  const rawLines = fs.readFileSync(inputFile, "utf8").split("\n");
  const urls = rawLines
    .map((l) => l.trim())
    .filter((l) => l && (l.startsWith("http://") || l.startsWith("https://")));

  if (urls.length === 0) {
    console.log("❌ No valid URLs found in file.");
    return;
  }

  // Group URLs by domain
  const domainMap = {};
  urls.forEach((urlStr) => {
    try {
      const u = new URL(urlStr);
      let host = u.hostname.replace(/^www\./, "");
      if (!domainMap[host]) domainMap[host] = [];
      domainMap[host].push(urlStr);
    } catch (e) {}
  });

  const domains = Object.keys(domainMap);

  console.log(`📁 Input File:      ${inputFile}`);
  console.log(`📊 Total Links:     ${urls.length}`);
  console.log(`🏢 Total Websites:  ${domains.length}`);
  console.log(`🖥️ Target Window:   ${targetSide.toUpperCase()} Chrome Window`);
  console.log(`⏱️ Tab Delay:       ${delayMs / 1000}s\n`);

  console.log("📋 Website Breakdown:");
  domains.forEach((d, idx) => {
    console.log(`  [${idx + 1}] ${d.padEnd(28)} : ${domainMap[d].length} link(s)`);
  });
  console.log("\nPress [ENTER] to begin opening tabs website-by-website...");
  await askQuestion("");

  // Tracking progress file
  const progressFile = path.join(
    path.dirname(inputFile),
    `.progress_website_${path.basename(inputFile, path.extname(inputFile))}.json`,
  );

  let currentDomainIndex = 0;
  if (!isReset && fs.existsSync(progressFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(progressFile, "utf8"));
      if (typeof saved.currentDomainIndex === "number" && saved.currentDomainIndex < domains.length) {
        currentDomainIndex = saved.currentDomainIndex;
        if (currentDomainIndex > 0) {
          console.log(`\n▶ Resuming from Website #${currentDomainIndex + 1}: ${domains[currentDomainIndex]}`);
        }
      }
    } catch (e) {}
  }

  while (currentDomainIndex < domains.length) {
    const domain = domains[currentDomainIndex];
    const domainUrls = domainMap[domain];

    console.log("\n" + "━".repeat(70));
    console.log(
      `🚀 [Website ${currentDomainIndex + 1}/${domains.length}] Opening ${domainUrls.length} tab(s) for: ${domain}`
    );
    console.log("━".repeat(70));

    await openWebsiteTabs(domainUrls, domain, delayMs, targetSide);

    // Save progress
    fs.writeFileSync(
      progressFile,
      JSON.stringify({ currentDomainIndex, lastDomain: domain, timestamp: new Date().toISOString() }, null, 2),
    );

    if (currentDomainIndex === domains.length - 1) {
      console.log("\n" + "═".repeat(70));
      console.log("🎉 ALL WEBSITES COMPLETED! You have reviewed all links.");
      console.log("═".repeat(70) + "\n");
      try {
        fs.unlinkSync(progressFile);
      } catch (e) {}
      break;
    }

    const nextDomain = domains[currentDomainIndex + 1];
    const nextCount = domainMap[nextDomain].length;

    console.log(`\n✅ ${domainUrls.length} tab(s) opened for ${domain}.`);
    console.log("\nOptions:");
    console.log(`  👉 Press [ENTER]       : Open NEXT website (${nextDomain} - ${nextCount} tabs)`);
    console.log(`  👉 Type 'r' + [ENTER] : Re-open current website (${domain})`);
    console.log(`  👉 Type 'p' + [ENTER] : Go BACK to previous website`);
    console.log(`  👉 Type 'q' + [ENTER] : Quit`);

    const answer = await askQuestion("\nYour choice: ");

    if (answer.toLowerCase() === "q") {
      console.log("\n👋 Exited. Progress saved. Run again anytime to resume!\n");
      break;
    } else if (answer.toLowerCase() === "r") {
      console.log(`\n🔄 Re-opening ${domain}...`);
    } else if (answer.toLowerCase() === "p") {
      if (currentDomainIndex > 0) {
        currentDomainIndex--;
        console.log(`\n⬅️ Going back to ${domains[currentDomainIndex]}...`);
      } else {
        console.log("\n⚠️ Already at the first website.");
      }
    } else {
      currentDomainIndex++;
    }
  }
}

main().catch(console.error);
