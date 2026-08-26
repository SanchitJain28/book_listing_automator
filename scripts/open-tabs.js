const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

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
    })
  );
}

// AppleScript runner
function runAppleScript(script) {
  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      stdio: 'pipe',
    });
  } catch (err) {
    console.error('⚠️ AppleScript execution error:', err.message);
  }
}

// Open tab in the RIGHT-HAND Chrome window specifically
function openTabInRightWindow(url, targetSide = 'right') {
  const script = `
    tell application "Google Chrome"
      if (count of windows) = 0 then
        make new window
        set URL of active tab of front window to "${url.replace(/"/g, '\\"')}"
      else
        set targetWin to missing value
        set bestX to ${targetSide === 'right' ? '-999999' : '999999'}
        
        repeat with w in windows
          set winBounds to bounds of w
          set winLeft to item 1 of winBounds
          
          ${
            targetSide === 'right'
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
async function openBatchSequentially(urls, queries, delayMs = 1000, targetSide = 'right') {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const query = queries[i];
    process.stdout.write(`  [${i + 1}/${urls.length}] 🌐 Opening tab in Right Window: ${query}`);

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
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   🚀 Chrome Split-Screen Tab Opener (Targets Right Window)     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Parse CLI args
  const args = process.argv.slice(2);
  let inputFile = args.find((a) => !a.startsWith('--'));
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const delayArg = args.find((a) => a.startsWith('--delay='));
  const sideArg = args.find((a) => a.startsWith('--window='));
  const isReset = args.includes('--reset');

  let batchSize = 50;
  if (batchArg) {
    batchSize = parseInt(batchArg.split('=')[1], 10) || 50;
  }

  let delayMs = 1000; // 1 second per tab
  if (delayArg) {
    const parsedDelay = parseFloat(delayArg.split('=')[1]);
    delayMs = parsedDelay < 50 ? parsedDelay * 1000 : parsedDelay;
  }

  let targetSide = 'right'; // Targets right window by default
  if (sideArg) {
    targetSide = sideArg.split('=')[1].toLowerCase() === 'left' ? 'left' : 'right';
  }

  // Default input file if none given
  if (!inputFile) {
    inputFile = path.join(process.cwd(), 'queries.txt');
  } else if (!path.isAbsolute(inputFile)) {
    inputFile = path.join(process.cwd(), inputFile);
  }

  if (!fs.existsSync(inputFile)) {
    console.log(`ℹ️ File "${inputFile}" not found.`);
    const sample = `Harry Potter\nAtomic Habits\n9780143455585\n`;
    fs.writeFileSync(inputFile, sample, 'utf8');
    console.log(`Created sample input file at: ${inputFile}`);
    console.log(`👉 Please paste your search queries (one per line) into "${inputFile}" and re-run.\n`);
    return;
  }

  // Read queries
  const rawLines = fs.readFileSync(inputFile, 'utf8').split('\n');
  const queries = rawLines.map((l) => l.trim()).filter(Boolean);

  if (queries.length === 0) {
    console.log(`❌ No queries found in "${inputFile}". Please add search terms and try again.`);
    return;
  }

  console.log(`📁 Input File: ${inputFile}`);
  console.log(`📊 Total Queries: ${queries.length.toLocaleString()}`);
  console.log(`📦 Batch Size: ${batchSize} tabs`);
  console.log(`🖥️ Target Window: RIGHT-HAND Chrome Window`);
  console.log(`⏱️ Speed: ${delayMs / 1000}s per tab\n`);

  // Progress state file
  const progressFile = path.join(__dirname, '.open-tabs-progress.json');
  let currentIndex = 0;

  if (fs.existsSync(progressFile) && !isReset) {
    try {
      const state = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      if (state.inputFile === inputFile && typeof state.currentIndex === 'number') {
        currentIndex = state.currentIndex;
        if (currentIndex > 0 && currentIndex < queries.length) {
          console.log(`🔄 Resuming from query #${currentIndex + 1} (${currentIndex} already viewed).`);
        }
      }
    } catch (e) {}
  }

  function saveProgress(idx) {
    fs.writeFileSync(
      progressFile,
      JSON.stringify({ inputFile, currentIndex: idx, lastUpdated: new Date().toISOString() }, null, 2),
      'utf8'
    );
  }

  while (currentIndex < queries.length) {
    const end = Math.min(currentIndex + batchSize, queries.length);
    const currentBatch = queries.slice(currentIndex, end);
    const batchNumber = Math.floor(currentIndex / batchSize) + 1;
    const totalBatches = Math.ceil(queries.length / batchSize);

    const urls = currentBatch.map((q) => {
      if (q.startsWith('http://') || q.startsWith('https://')) {
        return q;
      }
      return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    });

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚀 [Batch ${batchNumber}/${totalBatches}] Opening ${currentBatch.length} tabs (#${currentIndex + 1} to #${end}) in the RIGHT Chrome window...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    await openBatchSequentially(urls, currentBatch, delayMs, targetSide);

    console.log(`\n✅ ${currentBatch.length} tabs opened in your RIGHT Chrome window.`);
    console.log(`\nOptions:`);
    console.log(`  👉 Press [ENTER]       : Open NEXT ${batchSize} tabs in right window`);
    console.log(`  👉 Type 'r' + [ENTER] : Re-open current batch`);
    console.log(`  👉 Type 'p' + [ENTER] : Go BACK to previous batch`);
    console.log(`  👉 Type 'q' + [ENTER] : Save progress & Quit\n`);

    const answer = await askQuestion('Your choice: ');

    if (answer.toLowerCase() === 'q') {
      saveProgress(currentIndex);
      console.log(`\n💾 Progress saved at query #${currentIndex + 1}. You can resume anytime! Goodbye.`);
      break;
    } else if (answer.toLowerCase() === 'r') {
      continue;
    } else if (answer.toLowerCase() === 'p') {
      currentIndex = Math.max(0, currentIndex - batchSize);
      saveProgress(currentIndex);
      continue;
    } else {
      // Default: Enter pressed -> proceed to next batch in right window
      currentIndex = end;
      saveProgress(currentIndex);
    }
  }

  if (currentIndex >= queries.length) {
    console.log('\n🎉 ALL QUERIES COMPLETED! You have reviewed all search terms.');
    if (fs.existsSync(progressFile)) {
      fs.unlinkSync(progressFile);
    }
  }
}

main().catch((err) => console.error('Error:', err));
