const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const vpsList = [
  { id: 5, ip: "163.245.196.35", platforms: ["Amazon.co.uk", "AbeBooks.co.uk"] },
  { id: 3, ip: "163.245.196.45", platforms: ["Amazon.ca", "Iberlibro.com"] },
];

const pass = "Sanchit@282930";
const localInputDataDir = path.join(__dirname, "../input-data");
const localScrapersDir = path.join(__dirname, "../scrapers");

console.log("==================================================");
console.log("🚀 Syncing Platform Input Files & Codebase to VPS 5 and VPS 3");
console.log("==================================================\n");

for (const vps of vpsList) {
  console.log(`📡 [VPS ${vps.id} | ${vps.ip}] Target: ${vps.platforms.join(" + ")}`);

  try {
    // 1. Ensure remote directories exist
    const mkdirCmd = `sshpass -p "${pass}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@${vps.ip} "mkdir -p ~/book_listing_automator/input-data ~/book_listing_automator/scrapers"`;
    execSync(mkdirCmd, { stdio: "pipe" });

    // 2. Upload input-data directories
    console.log(`   📄 Syncing input-data directories...`);
    const scpInputCmd = `sshpass -p "${pass}" scp -r -o StrictHostKeyChecking=no -o ConnectTimeout=15 "${localInputDataDir}/abebooks" "${localInputDataDir}/abebooks-uk" "${localInputDataDir}/iberlibro" "${localInputDataDir}/amazon-us" "${localInputDataDir}/amazon-ca" "${localInputDataDir}/amazon-uk" "root@${vps.ip}:~/book_listing_automator/input-data/"`;
    execSync(scpInputCmd, { stdio: "pipe" });

    // 3. Sync scrapers to VPS
    console.log(`   🛠️  Syncing scrapers...`);
    const scpScrapersCmd = `sshpass -p "${pass}" scp -r -o StrictHostKeyChecking=no -o ConnectTimeout=15 "${localScrapersDir}/abebooks" "${localScrapersDir}/abebooks-uk" "${localScrapersDir}/iberlibro" "${localScrapersDir}/amazon-ca-isbn" "${localScrapersDir}/amazon-us-isbn" "${localScrapersDir}/amazon-uk-isbn" "root@${vps.ip}:~/book_listing_automator/scrapers/"`;
    execSync(scpScrapersCmd, { stdio: "pipe" });

    console.log(`✅ [VPS ${vps.id}] Synced successfully!\n`);
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Error: ${err.message}\n`);
  }
}

console.log("🎉 Distribution to VPS servers complete!");
