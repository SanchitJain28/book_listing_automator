const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const vpsDownloads = [
  { id: 2, ip: "69.164.249.174", pass: "Sanchit@282930", chunkFiles: ["chunk-2-vps2.json"] },
  { id: 3, ip: "69.164.244.21",  pass: "Sanchit@282930", chunkFiles: ["chunk-3-vps3.json"] },
  { id: 4, ip: "162.35.176.48",  pass: "Sanchit@282930", chunkFiles: ["chunk-1-part1-vps3.json", "chunk-4-vps4.json"] },
  { id: 5, ip: "69.169.103.19",  pass: "Sanchit@282930", chunkFiles: ["chunk-5-vps5.json"] },
  { id: 6, ip: "200.234.32.63",  pass: "+ww8T@@Eythd/2QM", chunkFiles: ["chunk-1-part2-vps6.json"] },
];

const remoteBaseDir = "book_listing_automator/output/amazon-india/isbns/2026-09-16/chunks";
const localTargetDir = path.join(
  __dirname,
  "../output/amazon-india/isbns/2026-09-16/chunks"
);

fs.mkdirSync(localTargetDir, { recursive: true });

console.log("==================================================");
console.log("🚀 Extracting 2026-09-16 output chunks from all VPS servers...");
console.log(`📁 Local Destination: ${localTargetDir}`);
console.log("==================================================\n");

for (const vps of vpsDownloads) {
  for (const file of vps.chunkFiles) {
    const remotePath = `root@${vps.ip}:${remoteBaseDir}/${file}`;
    const localFilePath = path.join(localTargetDir, file);

    console.log(`⬇️ Downloading [VPS ${vps.id}] ${file} from ${vps.ip}...`);

    try {
      const scpCmd = `sshpass -p "${vps.pass}" scp -o StrictHostKeyChecking=no -o ConnectTimeout=15 "${remotePath}" "${localFilePath}"`;
      execSync(scpCmd, { stdio: "inherit" });
      const stats = fs.statSync(localFilePath);
      console.log(`✅ [VPS ${vps.id}] Saved ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)\n`);
    } catch (err) {
      console.error(`❌ [VPS ${vps.id}] Failed to download ${file}: ${err.message}\n`);
    }
  }
}

console.log("🎉 All remote chunks downloaded successfully!");
