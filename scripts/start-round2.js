const { execSync } = require("child_process");

const vpsList = [
  { id: 2,  ip: "69.164.249.174", pass: "Sanchit@282930" },
  { id: 3,  ip: "69.164.244.21",  pass: "Sanchit@282930" },
  { id: 4,  ip: "162.35.176.48",  pass: "Sanchit@282930" },
  { id: 5,  ip: "69.169.103.19",  pass: "Sanchit@282930" },
  { id: 6,  ip: "200.234.32.63",  pass: "+ww8T@@Eythd/2QM" },
  { id: 7,  ip: "162.35.180.234", pass: "Sanchit@282930" },
  { id: 8,  ip: "104.37.184.22",  pass: "Sanchit@282930" },
  { id: 9,  ip: "162.35.12.38",   pass: "Sanchit@282930" },
  { id: 10, ip: "162.35.180.164", pass: "Sanchit@282930" },
  { id: 11, ip: "162.35.12.37",   pass: "Sanchit@282930" },
];

console.log("==================================================");
console.log("🚀 Starting Round-2 Scraper across VPS 2 through 11");
console.log("==================================================\n");

const summary = [];

for (const vps of vpsList) {
  const chunkFileName = `chunk-vps${vps.id}.txt`;
  const chunkRelPath = `input-data/amazon-india/isbns/2026-10-20/round-2/chunks/${chunkFileName}`;
  console.log(`\n--------------------------------------------------`);
  console.log(`🌐 [VPS ${vps.id}] ${vps.ip} -> ${chunkFileName}`);

  // If VPS 2 is already running properly, check pane
  if (vps.id === 2) {
    try {
      const pane = execSync(
        `sshpass -p "${vps.pass}" ssh -o StrictHostKeyChecking=no root@${vps.ip} "tmux capture-pane -pt scrape_round2 2>/dev/null || echo NONE"`,
        { encoding: "utf8" }
      ).trim();
      if (pane !== "NONE") {
        console.log(`✅ [VPS 2] Already running happily in tmux session 'scrape_round2'!`);
        summary.push({ id: 2, ip: vps.ip, status: "RUNNING", chunk: chunkFileName });
        continue;
      }
    } catch (e) {}
  }

  const commands = [
    "cd /root/book_listing_automator",
    "git checkout -- . || true",
    "git pull origin main",
    `wc -l ${chunkRelPath}`,
    "tmux kill-session -t scrape_round2 2>/dev/null || true",
    "tmux kill-session -t scrape 2>/dev/null || true",
    "pkill -f amazon-isbn 2>/dev/null || true",
    "sleep 1",
    `tmux new-session -d -s scrape_round2 -c /root/book_listing_automator 'node utils/watcher.js scrapers/amazon-isbn/amazon-isbn.js ${chunkRelPath} --headless'`,
    "sleep 2",
    "tmux ls",
    "pgrep -a node || true"
  ];

  const fullScript = commands.join(" && ");

  try {
    const out = execSync(
      `sshpass -p "${vps.pass}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 root@${vps.ip} "${fullScript.replace(/"/g, '\\"')}"`,
      { encoding: "utf8" }
    );
    console.log(`✅ [VPS ${vps.id}] Successfully launched in tmux!`);
    console.log(out.trim());
    summary.push({ id: vps.id, ip: vps.ip, status: "RUNNING", chunk: chunkFileName });
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Failed: ${err.message}`);
    summary.push({ id: vps.id, ip: vps.ip, status: "ERROR", error: err.message });
  }
}

console.log("\n==================================================");
console.log("📊 Final Launch Summary for Round-2:");
console.table(summary);
console.log("==================================================");
