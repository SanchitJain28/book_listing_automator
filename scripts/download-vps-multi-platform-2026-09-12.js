const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const pass = "Sanchit@282930";
const localOutputDir = path.join(__dirname, "../output");
fs.mkdirSync(localOutputDir, { recursive: true });

console.log("==================================================");
console.log("🚀 Extracting Multi-Platform Outputs from VPS 5 & VPS 3");
console.log(`📁 Local Destination: ${localOutputDir}`);
console.log("==================================================\n");

const vpsList = [
  { id: 5, ip: "163.245.196.35", platforms: ["Amazon UK", "AbeBooks UK"] },
  { id: 3, ip: "163.245.196.45", platforms: ["Amazon CA", "Iberlibro"] },
];

for (const vps of vpsList) {
  console.log(`⬇️ Pulling output directories from [VPS ${vps.id} | ${vps.ip}] (${vps.platforms.join(" + ")})...`);
  try {
    const scpCmd = `sshpass -p "${pass}" scp -r -o StrictHostKeyChecking=no -o ConnectTimeout=15 "root@${vps.ip}:~/book_listing_automator/output/*" "${localOutputDir}/"`;
    execSync(scpCmd, { stdio: "pipe" });
    console.log(`✅ [VPS ${vps.id}] Extracted successfully!\n`);
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Error: ${err.message}\n`);
  }
}

console.log("🎉 Extraction complete!");
