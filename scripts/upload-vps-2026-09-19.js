const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const vps = { id: 6, ip: "200.234.32.63", pass: "+ww8T@@Eythd/2QM", chunkFile: "chunk-vps6.txt" };

const remoteChunksDir = "~/book_listing_automator/input-data/amazon-india/isbns/2026-09-19/chunks";
const localChunksDir = path.join(__dirname, "../input-data/amazon-india/isbns/2026-09-19/chunks");

console.log("==================================================");
console.log(`🚀 Uploading 2026-09-19 Chunk to VPS ${vps.id} (${vps.ip})`);
console.log("==================================================\n");

const localFile = path.join(localChunksDir, vps.chunkFile);
if (!fs.existsSync(localFile)) {
  console.error(`❌ Local chunk not found: ${localFile}`);
  process.exit(1);
}

console.log(`📡 [VPS ${vps.id} | ${vps.ip}] Preparing remote directory & uploading ${vps.chunkFile}...`);
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

console.log("🎉 Upload complete!");
