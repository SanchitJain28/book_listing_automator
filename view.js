const { execSync, spawn } = require('child_process');
const readline = require('readline');

async function main() {
  let output;
  try {
    output = execSync('tmux ls', { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    console.log("❌ No background scrapers are currently running.");
    process.exit(0);
  }

  const lines = output.trim().split('\n');
  const sessions = lines.map(line => line.split(':')[0]).filter(name => name.startsWith('scrape_'));

  if (sessions.length === 0) {
    console.log("❌ No background scrapers are currently running.");
    process.exit(0);
  }

  let targetSession = sessions[0];

  if (sessions.length > 1) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log("\n👀 Multiple scrapers are running in the background:");
    sessions.forEach((s, i) => console.log(`  [${i + 1}] ${s}`));

    const answer = await new Promise(resolve => {
      rl.question("\n👉 Which one do you want to view? (Enter number): ", resolve);
    });

    const index = parseInt(answer, 10) - 1;
    if (isNaN(index) || index < 0 || index >= sessions.length) {
      console.error("❌ Invalid selection.");
      process.exit(1);
    }
    targetSession = sessions[index];
    rl.close();
  }

  console.log(`\n==================================================`);
  console.log(`✅ Entering window: ${targetSession}`);
  console.log(`\n⚠️  CRITICAL INSTRUCTION TO EXIT ⚠️`);
  console.log(`To leave this window WITHOUT stopping the scraper:`);
  console.log(`   1. Press \x1b[31mCtrl + B\x1b[0m (and let go)`);
  console.log(`   2. Press \x1b[31mD\x1b[0m`);
  console.log(`==================================================\n`);
  
  console.log("Opening in 3 seconds...");

  setTimeout(() => {
    const child = spawn('tmux', ['attach', '-t', targetSession], { stdio: 'inherit' });
    
    child.on('close', () => {
      console.log(`\n👋 Successfully detached from ${targetSession}. The scraper is still running in the background!`);
    });
  }, 3000);
}

main();
