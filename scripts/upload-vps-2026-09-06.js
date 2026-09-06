const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const vpsList = [
  { id: 1, ip: "162.35.163.93", chunkFile: "chunk-1-vps1.txt" },
  { id: 2, ip: "153.75.235.165", chunkFile: "chunk-2-vps2.txt" },
  { id: 3, ip: "163.245.196.45", chunkFile: "chunk-3-vps3.txt" },
  { id: 4, ip: "153.75.235.158", chunkFile: "chunk-4-vps4.txt" },
  { id: 5, ip: "163.245.196.35", chunkFile: "chunk-5-vps5.txt" },
];

const pass = "Sanchit@282930";
const remoteChunksDir = "~/book_listing_automator/input-data/amazon-india/isbns/2026-09-06/chunks";
const localChunksDir = path.join(__dirname, "../input-data/amazon-india/isbns/2026-09-06/chunks");

console.log("==================================================");
console.log("🚀 Uploading 2026-09-06 Chunks to 5 VPS Servers");
console.log("==================================================\n");

for (const vps of vpsList) {
  const localFile = path.join(localChunksDir, vps.chunkFile);
  if (!fs.existsSync(localFile)) {
    console.error(`❌ Local chunk not found: ${localFile}`);
    continue;
  }

  console.log(`📡 [VPS ${vps.id} | ${vps.ip}] Preparing remote directory & uploading ${vps.chunkFile}...`);
  try {
    // Ensure remote directory exists
    const mkdirCmd = `sshpass -p "${pass}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@${vps.ip} "mkdir -p ${remoteChunksDir}"`;
    execSync(mkdirCmd, { stdio: "pipe" });

    // Upload file
    const scpCmd = `sshpass -p "${pass}" scp -o StrictHostKeyChecking=no -o ConnectTimeout=15 "${localFile}" "root@${vps.ip}:${remoteChunksDir}/${vps.chunkFile}"`;
    execSync(scpCmd, { stdio: "inherit" });

    console.log(`✅ [VPS ${vps.id}] Uploaded ${vps.chunkFile} successfully!\n`);
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Error: ${err.message}\n`);
  }
}

console.log("🎉 Chunk upload complete!");
