const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const vpsList = [
  { id: 2, ip: "69.164.249.174", pass: "Sanchit@282930", chunkFile: "chunk-vps2.json" },
  { id: 3, ip: "69.164.244.21",  pass: "Sanchit@282930", chunkFile: "chunk-vps3.json" },
  { id: 4, ip: "162.35.176.48",  pass: "Sanchit@282930", chunkFile: "chunk-vps4.json" },
  { id: 5, ip: "69.169.103.19",  pass: "Sanchit@282930", chunkFile: "chunk-vps5.json" },
  { id: 6, ip: "200.234.32.63",  pass: "+ww8T@@Eythd/2QM", chunkFile: "chunk-vps6.json" },
];

const remoteOutputDir = "~/book_listing_automator/output/amazon-india/isbns/2026-10-07/chunks";
const localOutputDir = path.join(__dirname, "../output/amazon-india/isbns/2026-10-07/chunks");

if (!fs.existsSync(localOutputDir)) {
  fs.mkdirSync(localOutputDir, { recursive: true });
}

console.log("==================================================");
console.log("🚀 Downloading 2026-10-07 Output from VPS 2, 3, 4, 5, 6");
console.log(`📁 Local Destination: ${localOutputDir}`);
console.log("==================================================\n");

for (const vps of vpsList) {
  const localFile = path.join(localOutputDir, vps.chunkFile);
  console.log(`⬇️ Downloading [VPS ${vps.id}] ${vps.chunkFile} from ${vps.ip}...`);
  try {
    const scpCmd = `sshpass -p "${vps.pass}" scp -o StrictHostKeyChecking=no -o ConnectTimeout=15 "root@${vps.ip}:${remoteOutputDir}/${vps.chunkFile}" "${localFile}"`;
    execSync(scpCmd, { stdio: "pipe" });

    if (fs.existsSync(localFile)) {
      const stats = fs.statSync(localFile);
      console.log(`✅ [VPS ${vps.id}] Saved ${vps.chunkFile} (${(stats.size / 1024).toFixed(2)} KB)\n`);
    } else {
      console.log(`⚠️ [VPS ${vps.id}] File not found on remote.\n`);
    }
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Download failed: ${err.message}\n`);
  }
}

console.log("🎉 Download process completed!");
