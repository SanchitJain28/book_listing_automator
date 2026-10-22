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
console.log("🚀 Deploying Round-2 to VPS 2 through VPS 11");
console.log("==================================================\n");

const results = [];

for (const vps of vpsList) {
  const chunkFileName = `chunk-vps${vps.id}.txt`;
  const chunkRelativePath = `input-data/amazon-india/isbns/2026-10-20/round-2/chunks/${chunkFileName}`;
  console.log(`\n--------------------------------------------------`);
  console.log(`🌐 [VPS ${vps.id}] Connecting to ${vps.ip}...`);
  console.log(`📄 Target Chunk: ${chunkFileName}`);

  const bashScript = [
    "set -e",
    "cd /root/book_listing_automator",
    "git checkout -- . || true",
    "git pull origin main",
    `ls -lh ${chunkRelativePath}`,
    `wc -l ${chunkRelativePath}`,
    "tmux kill-session -t scrape_round2 2>/dev/null || true",
    "tmux kill-session -t scrape 2>/dev/null || true",
    "pkill -f amazon-isbn 2>/dev/null || true",
    "sleep 1",
    `tmux new-session -d -s scrape_round2 -c /root/book_listing_automator "node utils/watcher.js scrapers/amazon-isbn/amazon-isbn.js ${chunkRelativePath} --headless"`,
    "sleep 2",
    "tmux ls",
    "pgrep -a node || true"
  ].join(" && ");

  try {
    const output = execSync(
      `sshpass -p "${vps.pass}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 root@${vps.ip} "${bashScript}"`,
      { encoding: "utf8" }
    );
    console.log(`✅ [VPS ${vps.id}] Successfully pulled and started!`);
    console.log(output.trim());
    results.push({ id: vps.id, ip: vps.ip, status: "RUNNING", chunk: chunkFileName });
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Failed: ${err.message}`);
    if (err.stdout) console.log("Stdout:", err.stdout);
    if (err.stderr) console.log("Stderr:", err.stderr);
    results.push({ id: vps.id, ip: vps.ip, status: "ERROR", error: err.message });
  }
}

console.log("\n==================================================");
console.log("📊 Deployment Summary:");
console.table(results);
console.log("==================================================");
