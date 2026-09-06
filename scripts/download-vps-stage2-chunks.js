const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const vpsList = [
  { id: 1, ip: "162.35.163.93", chunkFile: "chunk-2-vps1.json" },
  { id: 2, ip: "153.75.235.165", chunkFile: "chunk-3-vps2.json" },
  { id: 3, ip: "163.245.196.45", chunkFile: "chunk-4-vps3.json" },
  { id: 4, ip: "153.75.235.158", chunkFile: "chunk-5-vps4.json" },
  { id: 5, ip: "163.245.196.35", chunkFile: "chunk-6-vps5.json" },
];

const pass = "Sanchit@282930";
const remoteBaseDir = "book_listing_automator/output/amazon-india/search-term/stage-2/2026-08-18/chunks";
const localTargetDir = path.join(
  __dirname,
  "../output/amazon-india/search-term/stage-2/2026-08-18/chunks"
);

fs.mkdirSync(localTargetDir, { recursive: true });

console.log("🚀 Starting extraction of stage-2 (2026-08-18) chunks from all 5 VPS servers...");
console.log(`📁 Local Destination: ${localTargetDir}\n`);

for (const vps of vpsList) {
  const remotePath = `root@${vps.ip}:${remoteBaseDir}/${vps.chunkFile}`;
  const localFilePath = path.join(localTargetDir, vps.chunkFile);

  console.log(`⬇️ Downloading [VPS ${vps.id}] ${vps.chunkFile} from ${vps.ip}...`);

  try {
    const scpCmd = `sshpass -p "${pass}" scp -o StrictHostKeyChecking=no -o ConnectTimeout=15 "${remotePath}" "${localFilePath}"`;
    execSync(scpCmd, { stdio: "inherit" });
    const stats = fs.statSync(localFilePath);
    console.log(`✅ [VPS ${vps.id}] Saved ${vps.chunkFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)\n`);
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Failed to download: ${err.message}\n`);
  }
}

console.log("🎉 All available chunks extracted!");
