const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const vpsList = [
  { id: 2,  ip: "69.164.249.174", pass: "Sanchit@282930", chunk: "chunk-vps2.txt" },
  { id: 3,  ip: "69.164.244.21",  pass: "Sanchit@282930", chunk: "chunk-vps3.txt" },
  { id: 4,  ip: "162.35.176.48",  pass: "Sanchit@282930", chunk: "chunk-vps4.txt" },
  { id: 5,  ip: "69.169.103.19",  pass: "Sanchit@282930", chunk: "chunk-vps5.txt" },
  { id: 6,  ip: "200.234.32.63",  pass: "+ww8T@@Eythd/2QM", chunk: "chunk-vps6.txt" },
  { id: 7,  ip: "162.35.180.234", pass: "Sanchit@282930", chunk: "chunk-vps7.txt" },
  { id: 8,  ip: "104.37.184.22",  pass: "Sanchit@282930", chunk: "chunk-vps8.txt" },
  { id: 9,  ip: "162.35.12.38",   pass: "Sanchit@282930", chunk: "chunk-vps9.txt" },
  { id: 10, ip: "162.35.180.164", pass: "Sanchit@282930", chunk: "chunk-vps10.txt" },
  { id: 11, ip: "162.35.12.37",   pass: "Sanchit@282930", chunk: "chunk-vps11.txt" },
];

console.log("================================================================================");
console.log("📊 Round-2 Live Status Check (VPS 2 - VPS 11 + Local Machine)");
console.log("================================================================================\n");

// 1. Check Local
const localOutFile = path.join(__dirname, "../output/amazon-india/isbns/2026-10-20/round-2/chunks/chunk-local.json");
let localCount = 0;
if (fs.existsSync(localOutFile)) {
  localCount = fs.readFileSync(localOutFile, "utf8").trim().split("\n").filter(Boolean).length;
}
console.log(`💻 [Local Machine]  chunk-local.txt (3415 ISBNs)  -> Scraped: ${localCount.toString().padStart(4)} / 3415`);

// 2. Check Remote VPSs
for (const vps of vpsList) {
  try {
    const jsonName = vps.chunk.replace(".txt", ".json");
    const remoteOutFile = `/root/book_listing_automator/output/amazon-india/isbns/2026-10-20/round-2/chunks/${jsonName}`;
    const remoteCmd = `cnt=0; if [ -f "${remoteOutFile}" ]; then cnt=$(wc -l < "${remoteOutFile}"); fi; item=$(tmux capture-pane -pt scrape_round2 2>/dev/null | grep Processing | tail -n 1); echo "$cnt | $item"`;

    const out = execSync(
      `sshpass -p "${vps.pass}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${vps.ip} '${remoteCmd}'`,
      { encoding: "utf8" }
    ).trim();

    const parts = out.split("|");
    const countStr = (parts[0] || "0").trim();
    const latestItem = (parts[1] || "").trim();

    console.log(`🌐 [VPS ${vps.id.toString().padStart(2, " ")}] ${vps.ip.padEnd(15)} ${vps.chunk.padEnd(16)} -> Scraped: ${countStr.padStart(4)} lines | ${latestItem || "Active"}`);
  } catch (err) {
    console.log(`🌐 [VPS ${vps.id.toString().padStart(2, " ")}] ${vps.ip.padEnd(15)} ${vps.chunk.padEnd(16)} -> ⚠️ Check error: ${err.message}`);
  }
}

console.log("\n================================================================================");
