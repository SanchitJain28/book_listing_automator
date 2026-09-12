const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const vpsList = [
  { id: 5, ip: "163.245.196.35", chunkFile: "rerun-chunk-2-vps5.txt" },
  { id: 3, ip: "163.245.196.45", chunkFile: "rerun-chunk-3-vps3.txt" },
];

const pass = "Sanchit@282930";
const remoteChunksDir = "~/book_listing_automator/input-data/amazon-india/isbns/2026-09-12/rerun_chunks";
const localChunksDir = path.join(__dirname, "../input-data/amazon-india/isbns/2026-09-12/rerun_chunks");

console.log("==================================================");
console.log("🚀 Uploading 2026-09-12 Rerun Chunks to VPS 5 and VPS 3");
console.log("==================================================\n");

for (const vps of vpsList) {
  const localFile = path.join(localChunksDir, vps.chunkFile);
  if (!fs.existsSync(localFile)) {
    console.error(`❌ Local chunk not found: ${localFile}`);
    continue;
  }

  console.log(`📡 [VPS ${vps.id} | ${vps.ip}] Uploading ${vps.chunkFile}...`);
  try {
    const mkdirCmd = `sshpass -p "${pass}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@${vps.ip} "mkdir -p ${remoteChunksDir}"`;
    execSync(mkdirCmd, { stdio: "pipe" });

    const scpCmd = `sshpass -p "${pass}" scp -o StrictHostKeyChecking=no -o ConnectTimeout=15 "${localFile}" "root@${vps.ip}:${remoteChunksDir}/${vps.chunkFile}"`;
    execSync(scpCmd, { stdio: "inherit" });

    console.log(`✅ [VPS ${vps.id}] Uploaded ${vps.chunkFile} successfully!\n`);
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Error: ${err.message}\n`);
  }
}

console.log("🎉 Rerun chunk upload complete!");
