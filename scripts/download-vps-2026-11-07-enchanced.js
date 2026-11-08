const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const vpsList = [
  { id: 3,  ip: "69.164.244.21",  pass: "Sanchit@282930", chunkFile: "chunk-vps3.json" },
  { id: 4,  ip: "162.35.176.48",  pass: "Sanchit@282930", chunkFile: "chunk-vps4.json" },
  { id: 5,  ip: "69.169.103.19",  pass: "Sanchit@282930", chunkFile: "chunk-vps5.json" },
  { id: 6,  ip: "200.234.32.63",  pass: "+ww8T@@Eythd/2QM", chunkFile: "chunk-vps6.json" },
  { id: 7,  ip: "162.35.180.234", pass: "Sanchit@282930", chunkFile: "chunk-vps7.json" },
  { id: 8,  ip: "104.37.184.22",  pass: "Sanchit@282930", chunkFile: "chunk-vps8.json" },
  { id: 9,  ip: "162.35.12.38",   pass: "Sanchit@282930", chunkFile: "chunk-vps9.json" },
  { id: 10, ip: "162.35.180.164", pass: "Sanchit@282930", chunkFile: "chunk-vps10.json" },
  { id: 11, ip: "162.35.12.37",   pass: "Sanchit@282930", chunkFile: "chunk-vps11.json" },
  { id: 12, ip: "162.35.33.208",  pass: "Sanchit@282930", chunkFile: "chunk-vps12.json" },
  { id: 13, ip: "162.35.33.209",  pass: "Sanchit@282930", chunkFile: "chunk-vps13.json" },
  { id: 14, ip: "162.35.171.220", pass: "Sanchit@282930", chunkFile: "chunk-vps14.json" },
  { id: 15, ip: "162.35.13.105",  pass: "Sanchit@282930", chunkFile: "chunk-vps15.json" },
  { id: 16, ip: "162.35.171.250", pass: "Sanchit@282930", chunkFile: "chunk-vps16.json" },
];

const remoteOutputDir = "/root/book_listing_automator/output/amazon-isbn-enchanced/amazon-isbn-enchanced/isbns/2026-11-07/chunks";
const localOutputDir = path.join(__dirname, "../output/amazon-isbn-enchanced/amazon-isbn-enchanced/isbns/2026-11-07/chunks");
const altLocalOutputDir = path.join(__dirname, "../output/amazon-isbn-enchanced/isbns/2026-11-07/chunks");

if (!fs.existsSync(localOutputDir)) {
  fs.mkdirSync(localOutputDir, { recursive: true });
}
if (!fs.existsSync(altLocalOutputDir)) {
  fs.mkdirSync(altLocalOutputDir, { recursive: true });
}

console.log("==================================================");
console.log("🚀 Downloading 2026-11-07 Output from VPS 3 through 16");
console.log(`📁 Local Destination: ${localOutputDir}`);
console.log("==================================================\n");

const summary = [];

for (const vps of vpsList) {
  const localFile = path.join(localOutputDir, vps.chunkFile);
  const altLocalFile = path.join(altLocalOutputDir, vps.chunkFile);
  console.log(`⬇️ Downloading [VPS ${vps.id}] ${vps.chunkFile} from ${vps.ip}...`);
  try {
    const scpCmd = `sshpass -p "${vps.pass}" scp -o StrictHostKeyChecking=no -o ConnectTimeout=15 "root@${vps.ip}:${remoteOutputDir}/${vps.chunkFile}" "${localFile}"`;
    execSync(scpCmd, { stdio: "pipe" });

    if (fs.existsSync(localFile)) {
      fs.copyFileSync(localFile, altLocalFile);
      const stats = fs.statSync(localFile);
      const lines = fs.readFileSync(localFile, "utf8").trim().split("\n").filter(Boolean).length;
      console.log(`✅ [VPS ${vps.id}] Saved ${vps.chunkFile} (${lines} lines, ${(stats.size / 1024).toFixed(2)} KB)\n`);
      summary.push({ id: vps.id, ip: vps.ip, file: vps.chunkFile, lines, status: "OK" });
    } else {
      console.log(`⚠️ [VPS ${vps.id}] File not found on remote.\n`);
      summary.push({ id: vps.id, ip: vps.ip, file: vps.chunkFile, lines: 0, status: "NOT_FOUND" });
    }
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Download failed: ${err.message}\n`);
    summary.push({ id: vps.id, ip: vps.ip, file: vps.chunkFile, lines: 0, status: "ERROR" });
  }
}

console.log("\n==================================================");
console.log("📊 Download Summary for 2026-11-07:");
console.table(summary);
console.log("==================================================");

