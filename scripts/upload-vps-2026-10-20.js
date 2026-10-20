const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const vpsList = [
  { id: 1,  ip: "216.219.85.173", pass: "Sanchit@282930", chunkFile: "chunk-vps1.txt" },
  { id: 2,  ip: "69.164.249.174", pass: "Sanchit@282930", chunkFile: "chunk-vps2.txt" },
  { id: 3,  ip: "69.164.244.21",  pass: "Sanchit@282930", chunkFile: "chunk-vps3.txt" },
  { id: 4,  ip: "162.35.176.48",  pass: "Sanchit@282930", chunkFile: "chunk-vps4.txt" },
  { id: 5,  ip: "69.169.103.19",  pass: "Sanchit@282930", chunkFile: "chunk-vps5.txt" },
  { id: 6,  ip: "200.234.32.63",  pass: "+ww8T@@Eythd/2QM", chunkFile: "chunk-vps6.txt" },
  { id: 7,  ip: "162.35.180.234", pass: "Sanchit@282930", chunkFile: "chunk-vps7.txt" },
  { id: 8,  ip: "104.37.184.22",  pass: "Sanchit@282930", chunkFile: "chunk-vps8.txt" },
  { id: 9,  ip: "162.35.12.38",   pass: "Sanchit@282930", chunkFile: "chunk-vps9.txt" },
  { id: 10, ip: "162.35.180.164", pass: "Sanchit@282930", chunkFile: "chunk-vps10.txt" },
  { id: 11, ip: "162.35.12.37",   pass: "Sanchit@282930", chunkFile: "chunk-vps11.txt" },
];

const remoteChunksDir = "~/book_listing_automator/input-data/amazon-india/isbns/2026-10-20/chunks";
const localChunksDir = path.join(__dirname, "../input-data/amazon-india/isbns/2026-10-20/chunks");

console.log("==================================================");
console.log("🚀 Uploading 2026-10-20 Chunks to VPS 1 through 11");
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

console.log("🎉 All VPS chunk uploads complete!");
