const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const vpsList = [
  { id: 2, ip: "69.164.249.174", pass: "Sanchit@282930", chunkFile: "chunk-vps2.txt" },
  { id: 3, ip: "69.164.244.21",  pass: "Sanchit@282930", chunkFile: "chunk-vps3.txt" },
  { id: 4, ip: "162.35.176.48",  pass: "Sanchit@282930", chunkFile: "chunk-vps4.txt" },
  { id: 5, ip: "69.169.103.19",  pass: "Sanchit@282930", chunkFile: "chunk-vps5.txt" },
  { id: 6, ip: "200.234.32.63",  pass: "+ww8T@@Eythd/2QM", chunkFile: "chunk-vps6.txt" },
];

const remoteChunksDir = "~/book_listing_automator/input-data/amazon-india/isbns/2026-10-07/chunks";
const localChunksDir = path.join(__dirname, "../input-data/amazon-india/isbns/2026-10-07/chunks");

console.log("==================================================");
console.log("🚀 Uploading 2026-10-07 Chunks to VPS 2, 3, 4, 5, 6");
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

console.log("🎉 Chunk upload complete!");
