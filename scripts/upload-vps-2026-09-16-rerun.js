const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rerunList = [
  { id: 3, ip: "69.164.244.21", pass: "Sanchit@282930", chunkFile: "chunk-1-part1-vps3.txt" },
  { id: 6, ip: "200.234.32.63", pass: "+ww8T@@Eythd/2QM", chunkFile: "chunk-1-part2-vps6.txt" },
];

const remoteChunksDir = "~/book_listing_automator/input-data/amazon-india/isbns/2026-09-16/chunks";
const localChunksDir = path.join(__dirname, "../input-data/amazon-india/isbns/2026-09-16/chunks");

console.log("==================================================");
console.log("🚀 Uploading Rerun Chunks to VPS 3 and VPS 6");
console.log("==================================================\n");

for (const vps of rerunList) {
  const localFile = path.join(localChunksDir, vps.chunkFile);
  if (!fs.existsSync(localFile)) {
    console.error(`❌ Local chunk not found: ${localFile}`);
    continue;
  }

  console.log(`📡 [VPS ${vps.id} | ${vps.ip}] Uploading ${vps.chunkFile}...`);
  try {
    // Ensure remote directory exists
    const mkdirCmd = `sshpass -p "${vps.pass}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@${vps.ip} "mkdir -p ${remoteChunksDir}"`;
    execSync(mkdirCmd, { stdio: "pipe" });

    // Upload file
    const scpCmd = `sshpass -p "${vps.pass}" scp -o StrictHostKeyChecking=no -o ConnectTimeout=15 "${localFile}" "root@${vps.ip}:${remoteChunksDir}/${vps.chunkFile}"`;
    execSync(scpCmd, { stdio: "inherit" });

    console.log(`✅ [VPS ${vps.id}] Uploaded ${vps.chunkFile} successfully!\n`);
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Error: ${err.message}\n`);
  }
}

console.log("🎉 Rerun chunk upload complete!");
