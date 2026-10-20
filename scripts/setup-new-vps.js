const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const NEW_VPS_LIST = [
  { id: 7,  ip: "162.35.180.234", pass: "Sanchit@282930" },
  { id: 8,  ip: "104.37.184.22",  pass: "Sanchit@282930" },
  { id: 9,  ip: "162.35.12.38",   pass: "Sanchit@282930" },
  { id: 10, ip: "162.35.180.164", pass: "Sanchit@282930" },
  { id: 11, ip: "162.35.12.37",   pass: "Sanchit@282930" },
];

const ROOT_DIR = path.resolve(__dirname, "..");
const SETUP_SCRIPT = path.join(ROOT_DIR, "setup_vps.sh");
const ENV_FILE = path.join(ROOT_DIR, ".env");
const LOGS_DIR = path.join(ROOT_DIR, "setup_logs");

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 30 }, (err, stdout, stderr) => {
      if (err) {
        reject({ err, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function setupSingleVPS(vps) {
  const logFile = path.join(LOGS_DIR, `vps${vps.id}.log`);
  fs.writeFileSync(logFile, `Starting setup for VPS ${vps.id} (${vps.ip})\n`);

  const log = (msg) => {
    const ts = new Date().toLocaleTimeString();
    const str = `[${ts}] [VPS ${vps.id} | ${vps.ip}] ${msg}`;
    console.log(str);
    fs.appendFileSync(logFile, str + "\n");
  };

  const sshOpts = "-o StrictHostKeyChecking=no -o ConnectTimeout=15";
  const pass = vps.pass;

  try {
    log("📤 1/4 Uploading setup_vps.sh...");
    await runCommand(`sshpass -p "${pass}" scp ${sshOpts} "${SETUP_SCRIPT}" "root@${vps.ip}:/root/setup_vps.sh"`);

    log("⚙️  2/4 Running setup_vps.sh (Apt packages, Node.js 22, Git clone, NPM install, Playwright Chromium)...");
    const setupResult = await runCommand(
      `sshpass -p "${pass}" ssh ${sshOpts} root@${vps.ip} "chmod +x /root/setup_vps.sh && /root/setup_vps.sh"`
    );
    fs.appendFileSync(logFile, "\n--- SETUP OUTPUT ---\n" + setupResult.stdout + "\n" + setupResult.stderr + "\n");

    if (fs.existsSync(ENV_FILE)) {
      log("🔑 3/4 Syncing .env file to /root/book_listing_automator/.env...");
      await runCommand(`sshpass -p "${pass}" scp ${sshOpts} "${ENV_FILE}" "root@${vps.ip}:/root/book_listing_automator/.env"`);
    }

    log("🧪 4/4 Verifying Playwright & scraper readiness on remote VPS...");
    const verifyResult = await runCommand(
      `sshpass -p "${pass}" ssh ${sshOpts} root@${vps.ip} "cd /root/book_listing_automator && node -e \\"const { chromium } = require('playwright'); (async () => { const b = await chromium.launch({ headless: true }); console.log('LAUNCH_OK'); await b.close(); })();\\""`
    );

    if (verifyResult.stdout.includes("LAUNCH_OK")) {
      log("🎉 ✅ Setup and Playwright verification SUCCESSFUL!");
      return { id: vps.id, ip: vps.ip, success: true, details: "Verified OK" };
    } else {
      log("⚠️ Setup finished but browser verification returned unexpected output: " + verifyResult.stdout);
      return { id: vps.id, ip: vps.ip, success: false, details: verifyResult.stdout };
    }
  } catch (error) {
    const errMsg = error.err ? error.err.message : JSON.stringify(error);
    log(`❌ Setup FAILED: ${errMsg}`);
    if (error.stderr) fs.appendFileSync(logFile, "\nSTDERR:\n" + error.stderr + "\n");
    if (error.stdout) fs.appendFileSync(logFile, "\nSTDOUT:\n" + error.stdout + "\n");
    return { id: vps.id, ip: vps.ip, success: false, details: errMsg };
  }
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log("🚀 Setting Up 5 New VPS Servers in Parallel (VPS 7 - 11)");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`Targets: ${NEW_VPS_LIST.map((v) => `VPS ${v.id} (${v.ip})`).join(", ")}\n`);

  const startTime = Date.now();
  const promises = NEW_VPS_LIST.map((vps) => setupSingleVPS(vps));
  const results = await Promise.all(promises);

  const durationMin = ((Date.now() - startTime) / 60000).toFixed(1);

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(`📊 Setup Summary for New VPS Instances (Completed in ${durationMin}m)`);
  console.log("══════════════════════════════════════════════════════════════");
  results.forEach((r) => {
    console.log(
      `  VPS ${r.id.toString().padStart(2, "0")} (${r.ip.padEnd(16)}): ${
        r.success ? "✅ SUCCESS & VERIFIED" : "❌ FAILED (" + r.details + ")"
      }`
    );
  });
  console.log("══════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
