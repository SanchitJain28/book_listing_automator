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
async function openWebsiteTabs(
  urls,
  domain,
  delayMs = 1000,
  targetSide = "right",
) {
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
  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║   🌐 Website-by-Website Tab Opener (Right Chrome Window)       ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝\n",
  );

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
    targetSide =
      sideArg.split("=")[1].toLowerCase() === "left" ? "left" : "right";
  }

  if (!inputFile) {
    if (fs.existsSync(path.join(process.cwd(), "links.txt"))) {
      inputFile = path.join(process.cwd(), "links.txt");
    } else {
      inputFile = path.join(process.cwd(), "links-2.txt");
    }
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
  const rawDomainMap = {};
  urls.forEach((urlStr) => {
    try {
      const u = new URL(urlStr);
      let host = u.hostname.replace(/^www\./, "");
      if (!rawDomainMap[host]) rawDomainMap[host] = [];
      rawDomainMap[host].push(urlStr);
    } catch (e) {}
  });

  // Exclude pattern parsing
  const excludePatterns = [];
  const includePatterns = [];
  args.forEach((arg) => {
    if (
      arg.startsWith("--exclude=") ||
      arg.startsWith("-exclude=") ||
      arg.startsWith("--ignore=") ||
      arg.startsWith("-ignore=")
    ) {
      const val = arg
        .replace(/^--?(exclude|ignore)=/, "")
        .replace(/^["']|["']$/g, "");
      const parts = val
        .split(/[,&]|\band\b|\s+/i)
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      excludePatterns.push(...parts);
    }
    if (
      arg.startsWith("--include=") ||
      arg.startsWith("-include=") ||
      arg.startsWith("--only=") ||
      arg.startsWith("-only=")
    ) {
      const val = arg
        .replace(/^--?(include|only)=/, "")
        .replace(/^["']|["']$/g, "");
      const parts = val
        .split(/[,&]|\band\b|\s+/i)
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      includePatterns.push(...parts);
    }
  });

  function wildcardToRegex(pattern) {
    const clean = pattern.trim().toLowerCase();
    const escaped = clean
      .split(".")
      .map((part) => part.replace(/\*/g, ".*"))
      .join("\\.");
    return new RegExp("^" + escaped + "$", "i");
  }

  function matchesPattern(domain, patterns) {
    if (!patterns || patterns.length === 0) return false;
    return patterns.some((p) => {
      const cleanP = p.trim().toLowerCase();
      if (cleanP.includes("*")) {
        const re = wildcardToRegex(cleanP);
        return re.test(domain);
      }
      return domain.toLowerCase().includes(cleanP);
    });
  }

  function matchesExclude(domain, patterns) {
    return matchesPattern(domain, patterns);
  }

  function matchesInclude(domain, patterns) {
    if (!patterns || patterns.length === 0) return true;
    return matchesPattern(domain, patterns);
  }

  // Quantity / Min Links Filter parser
  function parseQuantityFilter(cliArgs) {
    const qArg = cliArgs.find(
      (a) =>
        a.startsWith("--quantity=") ||
        a.startsWith("-quantity=") ||
        a.startsWith("--min=") ||
        a.startsWith("-min=") ||
        a.startsWith("--min-count=") ||
        a.startsWith("-min-count=") ||
        a.startsWith("--min-links=") ||
        a.startsWith("-min-links=") ||
        a.startsWith("--count=") ||
        a.startsWith("-count="),
    );
    if (!qArg) return null;

    const val = qArg
      .replace(/^--?(quantity|min|min-count|min-links|count)=/, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    const match = val.match(/^([><]=?|==|!=)?\s*(\d+)(\+)?$/);
    if (!match) return null;

    const op = match[1] || (match[3] === "+" ? ">=" : ">=");
    const num = parseInt(match[2], 10);

    return {
      raw: val,
      op,
      num,
      test: (count) => {
        switch (op) {
          case ">":
            return count > num;
          case ">=":
            return count >= num;
          case "<":
            return count < num;
          case "<=":
            return count <= num;
          case "==":
            return count === num;
          case "!=":
            return count !== num;
          default:
            return count >= num;
        }
      },
    };
  }

  const quantityFilter = parseQuantityFilter(args);

  const domainMap = {};
  const excludedMap = {};
  const notIncludedMap = {};
  const quantitySkippedMap = {};

  Object.keys(rawDomainMap)
    .sort((a, b) => a.localeCompare(b))
    .forEach((d) => {
      const linkCount = rawDomainMap[d].length;
      if (includePatterns.length > 0 && !matchesInclude(d, includePatterns)) {
        notIncludedMap[d] = rawDomainMap[d];
      } else if (matchesExclude(d, excludePatterns)) {
        excludedMap[d] = rawDomainMap[d];
      } else if (quantityFilter && !quantityFilter.test(linkCount)) {
        quantitySkippedMap[d] = rawDomainMap[d];
      } else {
        domainMap[d] = rawDomainMap[d];
      }
    });

  const domains = Object.keys(domainMap);
  const excludedDomains = Object.keys(excludedMap);
  const notIncludedDomains = Object.keys(notIncludedMap);
  const quantitySkippedDomains = Object.keys(quantitySkippedMap);

  const siteArg = args.find((a) => a.startsWith("--site="));

  let singleSiteFilter = null;
  if (siteArg) {
    singleSiteFilter = siteArg.split("=")[1].toLowerCase().trim();
  }

  const activeLinksCount = domains.reduce(
    (sum, d) => sum + domainMap[d].length,
    0,
  );
  const excludedLinksCount = excludedDomains.reduce(
    (sum, d) => sum + excludedMap[d].length,
    0,
  );
  const notIncludedLinksCount = notIncludedDomains.reduce(
    (sum, d) => sum + notIncludedMap[d].length,
    0,
  );
  const quantitySkippedLinksCount = quantitySkippedDomains.reduce(
    (sum, d) => sum + quantitySkippedMap[d].length,
    0,
  );

  console.log(`📁 Input File:      ${inputFile}`);
  console.log(
    `📊 Active Links:    ${activeLinksCount} (${domains.length} websites)`,
  );
  if (includePatterns.length > 0) {
    console.log(
      `🎯 Included Only:   ${activeLinksCount} links (${domains.length} websites matching: ${includePatterns.join(", ")})`,
    );
  }
  if (excludePatterns.length > 0) {
    console.log(
      `🚫 Excluded:        ${excludedLinksCount} links (${excludedDomains.length} websites matching: ${excludePatterns.join(", ")})`,
    );
  }
  if (quantityFilter) {
    console.log(
      `🔢 Quantity Filter: Filtered by [count ${quantityFilter.op} ${quantityFilter.num}] -> Skipped ${quantitySkippedLinksCount} links (${quantitySkippedDomains.length} websites)`,
    );
  }
  console.log(`🖥️ Target Window:   ${targetSide.toUpperCase()} Chrome Window`);
  console.log(`⏱️ Tab Delay:       ${delayMs / 1000}s\n`);

  if (excludedDomains.length > 0) {
    console.log("🚫 Excluded Websites List (Patterns):");
    excludedDomains.forEach((d) => {
      console.log(
        `  • ${d.padEnd(28)} : ${excludedMap[d].length} link(s) (Excluded)`,
      );
    });
    console.log("");
  }

  if (quantitySkippedDomains.length > 0) {
    console.log(
      `⏭️ Skipped Websites by Quantity Filter (${quantitySkippedDomains.length} websites):`,
    );
    quantitySkippedDomains.forEach((d) => {
      console.log(
        `  • ${d.padEnd(28)} : ${quantitySkippedMap[d].length} link(s) (Skipped)`,
      );
    });
    console.log("");
  }

  console.log("📋 Active Websites Breakdown:");
  domains.forEach((d, idx) => {
    console.log(
      `  [${String(idx + 1).padStart(2, " ")}] ${d.padEnd(28)} : ${domainMap[d].length} link(s)`,
    );
  });

  // Tracking progress file
  const progressFile = path.join(
    path.dirname(inputFile),
    `.progress_website_${path.basename(inputFile, path.extname(inputFile))}.json`,
  );

  let currentDomainIndex = 0;

  if (singleSiteFilter) {
    const matchedIdx = !isNaN(singleSiteFilter)
      ? parseInt(singleSiteFilter, 10) - 1
      : domains.findIndex((d) => d.toLowerCase().includes(singleSiteFilter));

    if (matchedIdx >= 0 && matchedIdx < domains.length) {
      currentDomainIndex = matchedIdx;
      console.log(`\n🎯 Filtered to website: ${domains[currentDomainIndex]}`);
    } else {
      console.log(`\n❌ Website '${singleSiteFilter}' not found in breakdown.`);
      return;
    }
  } else if (!isReset && fs.existsSync(progressFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(progressFile, "utf8"));
      if (
        typeof saved.currentDomainIndex === "number" &&
        saved.currentDomainIndex < domains.length
      ) {
        currentDomainIndex = saved.currentDomainIndex;
        if (currentDomainIndex > 0) {
          console.log(
            `\n▶ Resuming from Website #${currentDomainIndex + 1}: ${domains[currentDomainIndex]}`,
          );
        }
      }
    } catch (e) {}
  }

  if (!singleSiteFilter) {
    console.log(
      "\nPress [ENTER] to start, or type a Website # (1-" +
        domains.length +
        ") to jump directly...",
    );
    const initialChoice = await askQuestion("Your choice (or press [ENTER]): ");
    if (initialChoice) {
      const parsedNum = parseInt(initialChoice, 10);
      if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= domains.length) {
        currentDomainIndex = parsedNum - 1;
      } else {
        const found = domains.findIndex((d) =>
          d.toLowerCase().includes(initialChoice.toLowerCase()),
        );
        if (found !== -1) currentDomainIndex = found;
      }
    }
  }

  while (currentDomainIndex < domains.length) {
    const domain = domains[currentDomainIndex];
    const domainUrls = domainMap[domain];

    console.log("\n" + "━".repeat(70));
    console.log(
      `🚀 [Website ${currentDomainIndex + 1}/${domains.length}] Opening ${domainUrls.length} tab(s) for: ${domain}`,
    );
    console.log("━".repeat(70));

    await openWebsiteTabs(domainUrls, domain, delayMs, targetSide);

    if (singleSiteFilter) {
      console.log("\n✅ Completed opening tabs for " + domain + "!\n");
      break;
    }

    // Save progress
    fs.writeFileSync(
      progressFile,
      JSON.stringify(
        {
          currentDomainIndex,
          lastDomain: domain,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
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
    console.log(
      `  👉 Press [ENTER]            : Open NEXT website (${nextDomain} - ${nextCount} tabs)`,
    );
    console.log(
      `  👉 Type Website # (1-${domains.length})     : Jump to specific website`,
    );
    console.log(
      `  👉 Type 'r' + [ENTER]      : Re-open current website (${domain})`,
    );
    console.log(`  👉 Type 'p' + [ENTER]      : Go BACK to previous website`);
    console.log(`  👉 Type 'q' + [ENTER]      : Quit`);

    const answer = await askQuestion("\nYour choice: ");

    if (answer.toLowerCase() === "q") {
      console.log(
        "\n👋 Exited. Progress saved. Run again anytime to resume!\n",
      );
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
    } else if (
      !isNaN(parseInt(answer, 10)) &&
      parseInt(answer, 10) >= 1 &&
      parseInt(answer, 10) <= domains.length
    ) {
      currentDomainIndex = parseInt(answer, 10) - 1;
      console.log(
        `\n🎯 Jumping to [${currentDomainIndex + 1}] ${domains[currentDomainIndex]}...`,
      );
    } else {
      const foundIdx = domains.findIndex((d) =>
        d.toLowerCase().includes(answer.toLowerCase()),
      );
      if (answer && foundIdx !== -1) {
        currentDomainIndex = foundIdx;
        console.log(
          `\n🎯 Jumping to [${currentDomainIndex + 1}] ${domains[currentDomainIndex]}...`,
        );
      } else {
        currentDomainIndex++;
      }
    }
  }
}

main().catch(console.error);
