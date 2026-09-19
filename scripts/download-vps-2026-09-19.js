const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const vps = { id: 6, ip: "200.234.32.63", pass: "+ww8T@@Eythd/2QM", chunkFile: "chunk-vps6.json" };

const remoteBaseDir = "book_listing_automator/output/amazon-india/isbns/2026-09-19/chunks";
const localTargetDir = path.join(
  __dirname,
  "../output/amazon-india/isbns/2026-09-19/chunks"
);

fs.mkdirSync(localTargetDir, { recursive: true });

console.log("==================================================");
console.log(`🚀 Extracting 2026-09-19 output from VPS ${vps.id} (${vps.ip})...`);
console.log(`📁 Local Destination: ${localTargetDir}`);
console.log("==================================================\n");

const remotePath = `root@${vps.ip}:${remoteBaseDir}/${vps.chunkFile}`;
const localFilePath = path.join(localTargetDir, vps.chunkFile);

console.log(`⬇️ Downloading [VPS ${vps.id}] ${vps.chunkFile} from ${vps.ip}...`);

try {
  const scpCmd = `sshpass -p "${vps.pass}" scp -o StrictHostKeyChecking=no -o ConnectTimeout=15 "${remotePath}" "${localFilePath}"`;
  execSync(scpCmd, { stdio: "inherit" });
  const stats = fs.statSync(localFilePath);
  console.log(`✅ [VPS ${vps.id}] Saved ${vps.chunkFile} (${(stats.size / 1024).toFixed(2)} KB)\n`);
} catch (err) {
  console.error(`❌ [VPS ${vps.id}] Failed to download: ${err.message}\n`);
}

console.log("🎉 Extraction complete!");
