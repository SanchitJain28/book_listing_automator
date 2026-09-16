const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const VPS_LIST = [
  { id: 1, ip: "216.219.85.173", pass: "Sanchit@282930" },
  { id: 2, ip: "69.164.249.174", pass: "Sanchit@282930" },
  { id: 3, ip: "69.164.244.21",  pass: "Sanchit@282930" },
  { id: 4, ip: "162.35.176.48",  pass: "Sanchit@282930" },
  { id: 5, ip: "69.169.103.19",  pass: "Sanchit@282930" },
  { id: 6, ip: "200.234.32.63",  pass: "+ww8T@@Eythd/2QM" },
];

const ROOT_DIR = path.resolve(__dirname, "..");
const SETUP_SCRIPT = path.join(ROOT_DIR, "setup_vps.sh");
const ENV_FILE = path.join(ROOT_DIR, ".env");

// Parse command line arguments: e.g. "node scripts/setup-all-vps.js --vps=6" or all
const targetArg = process.argv.find(
  (a) => a.startsWith("--vps=") || a.startsWith("-vps="),
);
let targets = VPS_LIST;

if (targetArg) {
  const vpsId = parseInt(targetArg.replace(/^--?vps=/, ""), 10);
  targets = VPS_LIST.filter((v) => v.id === vpsId);
  if (targets.length === 0) {
    console.error(`❌ Invalid VPS ID: ${vpsId}. Valid IDs are 1 to ${VPS_LIST.length}.`);
    process.exit(1);
  }
}

console.log("══════════════════════════════════════════════════════════════");
console.log("🚀 Automated VPS Setup (Git Clone + .env Only)");
console.log("══════════════════════════════════════════════════════════════");
console.log(
  `Servers to setup: ${targets.map((t) => `VPS ${t.id} (${t.ip})`).join(", ")}\n`,
);

async function setupVPS(vps) {
  console.log(
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  );
  console.log(`📡 [VPS ${vps.id}] Connecting to root@${vps.ip}...`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const sshOpts = "-o StrictHostKeyChecking=no -o ConnectTimeout=15";
  const pass = vps.pass;

  // Step 1: Upload setup_vps.sh
  console.log(`📤 [VPS ${vps.id}] Uploading setup_vps.sh...`);
  try {
    execSync(
      `sshpass -p "${pass}" scp ${sshOpts} "${SETUP_SCRIPT}" "root@${vps.ip}:/root/setup_vps.sh"`,
      { stdio: "inherit" },
    );
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Upload failed:`, err.message);
    return false;
  }

  // Step 2: Run setup script on remote server (Installs Node 22, Git Clones repo, Playwright)
  console.log(
    `⚙️  [VPS ${vps.id}] Running setup script on remote VPS (Git clone + dependencies)...`,
  );
  try {
    execSync(
      `sshpass -p "${pass}" ssh ${sshOpts} root@${vps.ip} "chmod +x /root/setup_vps.sh && /root/setup_vps.sh"`,
      { stdio: "inherit" },
    );
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Setup execution failed:`, err.message);
    return false;
  }

  // Step 3: Copy only .env to the cloned project folder
  if (fs.existsSync(ENV_FILE)) {
    console.log(
      `🔑 [VPS ${vps.id}] Syncing .env file to /root/book_listing_automator/.env...`,
    );
    try {
      execSync(
        `sshpass -p "${pass}" scp ${sshOpts} "${ENV_FILE}" "root@${vps.ip}:/root/book_listing_automator/.env"`,
        { stdio: "inherit" },
      );
      console.log(`✅ [VPS ${vps.id}] .env synced successfully.`);
    } catch (err) {
      console.error(`⚠️ [VPS ${vps.id}] .env sync failed:`, err.message);
    }
  }

  console.log(`\n🎉 [VPS ${vps.id}] Successfully setup root@${vps.ip}!`);
  return true;
}

async function run() {
  const results = [];
  for (const vps of targets) {
    const success = await setupVPS(vps);
    results.push({ vps: vps.id, ip: vps.ip, success });
  }

  console.log(
    "\n══════════════════════════════════════════════════════════════",
  );
  console.log("📊 Summary of VPS Setup");
  console.log("══════════════════════════════════════════════════════════════");
  results.forEach((r) => {
    console.log(
      `VPS ${r.vps} (${r.ip.padEnd(16)}): ${r.success ? "✅ SUCCESS" : "❌ FAILED"}`,
    );
  });
  console.log("");
}

run();
